'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const load=p=>{const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;};
const diversity=load('f4/f4-c-diverse-candidates-v125.js');
const policy=load('f4/f4-c-healer-policy-v100.js');
const search=load('f4/f4-c-healer-search-v100.js');
const base=load('f4/f4-chronological-core-v1.js');
const clock=load('f4/f4-b-game-week-v1.js');
const names=base.FOOD;
const raw=Array.from({length:10},(_,i)=>({
 id:'p'+i,source:'F1_B_PINNED_66_SPECIES',healerRole:i<2?'TEAM_WIDE_HEALER':null,
 helpingBonus:false,
 skillCode:i===8?'Charge Strength M':i===9?'Cooking Power-Up S':null,
 selectedMainSkillLevel:2,
 ratesByTeammateBonus:Array.from({length:5},()=>({
  status:'BASE_RATES_AVAILABLE',helpSeconds:3600,
  berryEnergyPerHelp:i>=2&&i<=5?180:10,
  ingredientCountsPerHelp:{apple:i===6?4:0,tomato:i===7?4:0},
  skillProbabilityPerEligibleHelp:(i===8||i===9)?0.2:0,
  berryItemsPerHelp:1,berryCountPerBerryHelp:1
 }))
}));
const known={skillValue:(skill,level)=>skill==='Cooking Power-Up S'?
 ({status:'BASE_VALUE_ONLY',unit:'POT_CAPACITY_DELTA',
  value:level===7?31:10}):
 ({status:'BASE_VALUE_ONLY',unit:'ENERGY_PER_ACTIVATION',value:230})};
const recipes=[
 {id:'high',type:'curry',baseStrength:500000,
  requirements:{apple:12,tomato:12}},
 {id:'small',type:'curry',baseStrength:500,
  requirements:{apple:6}}
];
const fillPolicy=policy.validate({profiles:raw,primaryHealerId:'p0',
 secondaryHealerId:'p1',sleepScore:100});
const common={policy:fillPolicy,profiles:base.normalizeProfiles(raw),
 rawProfiles:raw,recipes:base.normalizeRecipes(recipes),foods:names,
 inventory:{apple:0,tomato:0},count:12,
 potCapacity:57,camp:false,skillValues:known};
const asText=t=>t.map(x=>x.join(',')).join('|');
test('v125: a berry, two complementary ingredient, direct and cooking-support strategy survive',()=>{
 assert.equal(fillPolicy.status,'POLICY_READY');
 const result=diversity.selectTeams({...common,slot:'morning'});
 assert.equal(result.status,'CANDIDATES_READY',result.reason);
 assert.equal(result.scoreIsWeeklyEnergy,false);
 assert.equal(result.indirectSkillEnergyPriced,false);
 assert.equal(result.teams.length,12);
 assert(result.teams.some(t=>t.includes('p6')&&t.includes('p7')),
  'both recipe ingredients must survive the candidate screening');
 assert(result.teams.some(t=>t.includes('p8')),'direct skill specialist survives');
 assert(result.teams.some(t=>t.includes('p9')),'cooking support survives unpriced');
 assert(result.teams.some(t=>t.includes('p2')&&t.includes('p3')&&t.includes('p4')),
  'berry specialist composition survives');
 for(const team of result.teams){
  assert.equal(team.length,5);assert.equal(team[4],'p0');
  assert.equal(team[3],'p1');assert.equal(new Set(team).size,5);
 }
 assert(result.lanes.recipe_0>0);
 assert(result.lanes.support_skill>0);
});
test('v125: independent exhaustive tiny roster oracle keeps best recipe-complementing combination',()=>{
 const selected=diversity.selectTeams({...common,slot:'morning'});
 const fillers=fillPolicy.fillerIds;
 let max=-1;
 const cover=team=>{
  const produce=(ingredient)=>team.reduce((n,id)=>
   n+(raw[Number(id.slice(1))].ratesByTeammateBonus[0]
    .ingredientCountsPerHelp[ingredient]||0)*6,0);
  return Math.min(1,produce('apple')/12,produce('tomato')/12);
 };
 for(let a=0;a<fillers.length;a++)
 for(let b=a+1;b<fillers.length;b++)
 for(let c=b+1;c<fillers.length;c++)
  max=Math.max(max,cover([fillers[a],fillers[b],fillers[c]]));
 const actual=Math.max(...selected.teams.map(cover));
 assert.equal(actual,max,'the best complementary recipe candidate must not be lost');
});
test('v125: diverse state frontier retains both immediate berry energy and future cooking stock',()=>{
 const states=[
  {signature:'berry-a',energy:900,inventory:{apple:0,tomato:0}},
  {signature:'berry-b',energy:880,inventory:{apple:0,tomato:0}},
  {signature:'berry-c',energy:850,inventory:{apple:0,tomato:0}},
  {signature:'cook-ready',energy:150,inventory:{apple:12,tomato:12}},
  {signature:'partial',energy:200,inventory:{apple:12,tomato:2}},
  {signature:'skill',energy:300,inventory:{apple:6,tomato:5}}
 ];
 const result=diversity.selectStates({states,count:4,
  recipes:base.normalizeRecipes(recipes),rankEnergy:s=>s.energy,
  preferredCount:()=>0});
 assert.equal(result.status,'FRONTIER_READY',result.reason);
 assert(result.states.some(s=>s.signature==='berry-a'));
 assert(result.states.some(s=>s.signature==='cook-ready'));
 assert(result.lanes.recipe_0>0,'future-completion state is reserved');
 assert.equal(result.scoreIsWeeklyEnergy,false);
});
test('v125: real 29-window constrained search can prefer delayed high-energy cooking',()=>{
 const input={
  weekStart:'2026-11-23',asOf:'2026-11-20T10:00:00+09:00',
  eventMode:'NEUTRAL_REFERENCE_ONLY',eventSource:null,
  healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',sleepScore:100,
  primaryHealerId:'p0',secondaryHealerId:'p1',camp:false,
  fieldBonus:0,foodMode:'curry',potCapacity:57,bagCapacity:500,
  initialInventory:{apple:0,tomato:0},profiles:raw,recipes,
  autoSleep:false,nightTeams:Array.from({length:7},()=>['p0','p2','p3','p4','p5']),
  previousWeekCarryUnknown:true,previousWeekSleepTeam:[],
  beamWidth:12,dayCandidateCount:12,maxFinalists:8,
  candidateStrategy:'V125_DIVERSE'
 };
 const result=search.plan(input,{base,clock,policy,diversity,skillValues:known});
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert.equal(result.candidateStrategy,'V125_DIVERSE_STRATEGY_SCREEN');
 assert.equal(result.slots.length,29);
 assert.equal(result.weeklyEnergyCertified,false);
 assert(result.slots.filter(x=>x.recipeId==='high').length>=12,
  'high-energy cooking must remain competitive through all 29 windows');
 assert(result.slots[1].team.includes('p6')&&result.slots[1].team.includes('p7'));
 for(const x of result.slots.filter(x=>x.slot==='morning')){
  assert.equal(x.team[3],'p1');assert.equal(x.team[4],'p0');
 }
 for(const x of result.slots.filter(x=>x.slot==='noon'||x.slot==='evening')){
  assert.equal(x.team[4],'p0');assert(!x.team.includes('p1'));
 }
});
test('v125: unsupported assumptions stay blocked; no pseudo-energy or private data is output',()=>{
 const wrong=diversity.selectTeams({...common,slot:'sleep'});
 assert.equal(wrong.status,'BLOCKED');
 const ok=diversity.selectTeams({...common,slot:'noon'});
 assert.equal(ok.status,'CANDIDATES_READY');
 assert(ok.teams.every(t=>t.length===5&&t[4]==='p0'&&!t.includes('p1')));
 assert(!JSON.stringify(ok).includes('nickname'));
 assert.equal(ok.weeklyEnergyCertified,false);
});
test('v125: F4/F5 use one bounded screen and beam frontier without changing E7 owner state',()=>{
 const u3=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const runtime=read('e7-preview/e7-f4c-integrated-v112.js');
 const rank=read('f4/f4-c-item-aware-rank-v101.js');
 const f5=read('f5/f5-midweek-v119.js');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(u3,/src="\.\.\/f4\/f4-c-diverse-candidates-v125\.js"/);
 assert(u3.indexOf('f4-c-diverse-candidates-v125.js')<
  u3.indexOf('f4-c-healer-search-v100.js'));
 assert.match(runtime,/diversity:root\.PokeF4CStrategyDiversityV125/);
 assert.match(rank,/diversity:deps\.diversity/);
 assert.match(f5,/deps\.diversity\.selectTeams\(/);
 assert.match(f5,/deps\.diversity\.selectStates\(/);
 assert.match(sw,/'\.\.\/f4\/f4-c-diverse-candidates-v125\.js'/);
 assert.match(sw,/v125-diverse-candidates/);
 assert.match(read('e7-preview/e7-ingredient-size-v123.css'),/scale\(1\.13\)/);
});

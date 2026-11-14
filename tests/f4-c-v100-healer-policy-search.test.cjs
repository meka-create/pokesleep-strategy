'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),box,{filename:p,timeout:15000});
 return box.module.exports;
}
const policy=load('f4/f4-c-healer-policy-v100.js');
const search=load('f4/f4-c-healer-search-v100.js');
const base=load('f4/f4-chronological-core-v1.js');
const clock=load('f4/f4-b-game-week-v1.js');
const deps={policy,base,clock};
const clone=x=>JSON.parse(JSON.stringify(x));
const profile=(i,bonus=i===2)=>({
 id:'p'+i,source:'F1_B_PINNED_66_SPECIES',helpingBonus:bonus,
 healerRole:i<2?'TEAM_WIDE_HEALER':null,
 nickname:'SECRET_PRIVATE_NOT_IN_RESULT_'+i,
 ratesByTeammateBonus:Array.from({length:5},(_,b)=>({
  status:'BASE_RATES_AVAILABLE',helpSeconds:3600-b*20,
  berryEnergyPerHelp:i<2?1:80-i*10,
  ingredientCountsPerHelp:{apple:i===7?3:0.3}
 }))
});
const roster=Array.from({length:8},(_,i)=>profile(i));
const previous=['p0','p2','p3','p4','p5'];
const nights=Array.from({length:7},(_,i)=>[
 'p'+(i%2),'p2','p3','p4','p5'
]);
const make=other=>({
 weekStart:'2026-11-16',asOf:'2026-11-15T21:00:00+09:00',
 eventMode:'NEUTRAL_REFERENCE_ONLY',eventSource:null,
 healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',
 sleepScore:100,
 primaryHealerId:'p0',secondaryHealerId:'p1',
 camp:false,fieldBonus:20,foodMode:'curry',
 potCapacity:57,bagCapacity:400,initialInventory:{apple:50},
 profiles:roster,recipes:[
  {id:'apple',type:'curry',baseStrength:150,requirements:{apple:2}},
  {id:'large',type:'curry',baseStrength:1000,requirements:{apple:10}}],
 autoSleep:false,nightTeams:nights,previousWeekSleepTeam:previous,
 beamWidth:6,dayCandidateCount:6,...other
});
test('v100: day rosters have exactly two healers morning, only main noon and evening',()=>{
 const input=make(),before=JSON.stringify(input),result=search.plan(input,deps);
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert.equal(result.slotCount,29);assert.equal(result.totalHours,168);
 assert.equal(result.mealOpportunities,21);assert.equal(result.sleepSlots,7);
 assert.equal(result.sleepScoreAssumed,100);
 assert.equal(result.healthRecoveredActual,false);
 assert.equal(result.skillTriggersModeled,false);
 assert.equal(result.weeklyEnergyCertified,false);
 assert.equal(result.writesSavedData,false);
 assert.equal(result.energyProxy,result.mealEnergyProxy+result.berryEnergyProxy);
 assert.deepEqual([...result.slots[0].team],previous);
 assert.equal(result.slots[0].berryEnergyProxy,0);
 assert(result.slots[0].carryBerryExcludedProxy>0);
 for(let day=0;day<7;day++){
  const four=result.slots.slice(1+day*4,5+day*4);
  assert.deepEqual(Array.from(four,w=>w.slot),['morning','noon','evening','sleep']);
  assert.deepEqual([...four[3].team],nights[day]);
  assert.equal(four[0].team.at(-1),'p0');
  assert.equal(four[0].team.at(-2),'p1');
  assert.equal(new Set(four[0].team).size,5);
  for(const row of four.slice(1,3)){
   assert.equal(row.team.at(-1),'p0');
   assert(!row.team.includes('p1'));
   assert.equal(new Set(row.team).size,5);
  }
 }
 assert.equal(JSON.stringify(input),before);
 assert(!JSON.stringify(result).includes('SECRET_PRIVATE_NOT_IN_RESULT'));
});
test('v100: main team-wide healer and secondary healer must both be explicit and verified',()=>{
 const x=policy.validate({profiles:roster,primaryHealerId:'p0',
  secondaryHealerId:'p1',sleepScore:100});
 assert.equal(x.status,'POLICY_READY');
 assert.equal(x.morningHealers,2);assert.equal(x.noonHealers,1);
 assert.equal(policy.validate({profiles:roster,primaryHealerId:'p0',
  secondaryHealerId:'p2',sleepScore:100}).reason,'EXPLICIT_TWO_HEALERS_REQUIRED');
 assert.equal(policy.validate({profiles:roster,primaryHealerId:'p0',
  secondaryHealerId:'p0',sleepScore:100}).reason,'HEALER_POLICY_INPUT_INVALID');
 assert.equal(policy.validate({profiles:roster,primaryHealerId:'p0',
  secondaryHealerId:'p1',sleepScore:80}).reason,'HEALER_POLICY_INPUT_INVALID');
 const fewer=roster.slice(0,6).map((p,i)=>i===5?{...p,healerRole:'TEAM_WIDE_HEALER'}:p);
 assert.equal(policy.validate({profiles:fewer,primaryHealerId:'p0',
  secondaryHealerId:'p1',sleepScore:100}).reason,'FOUR_NON_HEALERS_REQUIRED');
});
test('v100: fixed overnight roster is protected, not forced to contain daytime healer',()=>{
 const noHealerNights=Array.from({length:7},()=>['p2','p3','p4','p5','p6']);
 const result=search.plan(make({nightTeams:noHealerNights}),deps);
 assert.equal(result.status,'PROVISIONAL',result.reason);
 for(let day=0;day<7;day++)
  assert.deepEqual([...result.slots[day*4+4].team],noHealerNights[day]);
 assert.equal(search.plan(make({autoSleep:true}),deps).reason,
  'SETTINGS_OR_SLEEP_MODE_INVALID');
});
test('v100: official and EX-like unverified sources, sleep score and scenario are not silently guessed',()=>{
 assert.equal(search.plan(make({eventSource:{id:'official'}}),deps).reason,
  'OFFICIAL_EVENT_NOT_MODELED');
 assert.equal(search.plan(make({eventSource:undefined}),deps).reason,
  'OFFICIAL_EVENT_NOT_MODELED');
 assert.equal(search.plan(make({sleepScore:90}),deps).reason,
  'USER_HEALER_SLEEP_SCENARIO_REQUIRED');
 assert.equal(search.plan(make({healthScenario:'OBSERVED_REAL_HEALTH'}),deps).reason,
  'USER_HEALER_SLEEP_SCENARIO_REQUIRED');
 assert.equal(search.plan(make({previousWeekSleepTeam:null}),deps).reason,
  'REAL_MANUAL_SLEEP_TEAMS_REQUIRED');
});
test('v100: recipe cannot use future help and no bag creates ingredients from nothing',()=>{
 const rows=roster.map((p,i)=>({
  ...p,ratesByTeammateBonus:p.ratesByTeammateBonus.map(r=>({
   ...r,ingredientCountsPerHelp:{apple:i>=6?5:0}
  }))
 }));
 const input=make({initialInventory:{apple:0},profiles:rows,
  recipes:[{id:'only',type:'curry',baseStrength:100,requirements:{apple:3}}]});
 const result=search.plan(input,deps);
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert.equal(result.slots[1].recipeId,null);
 assert(result.slots.some((w,i)=>i>1&&w.recipeId==='only'));
});
test('v100: known full-team recovery skill identifiers are pinned, never classify self recovery as team healer',()=>{
 const snapshot=JSON.parse(read('f1/f1-b-target-source-v1.json'));
 const byName=new Map(snapshot.targets.map(t=>[t.name,t]));
 for(const name of ['サーナイト','ニンフィア','パーモット','ツボツボ'])
  assert(/^Energy for Everyone S/.test(byName.get(name).sourceProfile.mainSkill));
 assert.equal(byName.get('カイリュー').sourceProfile.mainSkill,'Charge Energy S');
 const adapter=read('f4/f4-f1b-roster-adapter-v1.js');
 assert(adapter.includes("skill==='Energy for Everyone S'"));
 assert(adapter.includes("skill==='Energy for Everyone S (Berry Juice)'"));
});
test('v100: no persistent writes or private identifiers; existing UI not changed',()=>{
 for(const f of ['f4/f4-c-healer-policy-v100.js','f4/f4-c-healer-search-v100.js']){
  const js=read(f);
  for(const banned of ['localStorage','sessionStorage','fetch(','.setItem(',
   '.removeItem(','console.log','nickname','privateBoxRows'])
   assert(!js.includes(banned),f+': '+banned);
 }
 assert(!read('index.html').includes('f4-c-healer-search-v100.js'));
 assert(!read('e7-preview/index.html').includes('f4-c-healer-search-v100.js'));
});

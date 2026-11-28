'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(p){
 const mod={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',p),'utf8'),mod,
  {filename:p,timeout:15000});return mod.module.exports;
}
const lite=load('f4/f4-m1-lite-energy-v128.js'),
 cooking=load('f4/f4-c-cooking-skills-v102.js'),
 skillValues=load('f1/f1-c-skill-values-v1.js'),
 recipes=load('e7-preview/e7-recipes-v122.js'),
 ranker=load('f4/f4-c-item-aware-rank-v101.js'),
 search=load('f4/f4-c-healer-search-v100.js'),
 policy=load('f4/f4-c-healer-policy-v100.js'),
 base=load('f4/f4-chronological-core-v1.js'),
 clock=load('f4/f4-b-game-week-v1.js');
const deps={m1Lite:lite,cookingSkills:cooking,skillValues,search,policy,base,clock};
function fixture(dish){
 const profiles=Array.from({length:8},(_,i)=>({
  id:'p'+i,source:'F1_B_PINNED_66_SPECIES',helpingBonus:i===2,
  healerRole:i<2?'TEAM_WIDE_HEALER':null,carryLimit:40,
  skillSpecialty:'Skills',
  skillCode:i===3?'Tasty Chance S':i===2?'Charge Strength M':
   i<2?'Energy for Everyone S':'Charge Energy S',
  selectedMainSkillLevel:i===3?6:6,
  ratesByTeammateBonus:Array.from({length:5},(_,b)=>({
   status:'BASE_RATES_AVAILABLE',helpSeconds:3600-b*20,
   berryEnergyPerHelp:7,berryItemsPerHelp:.5,
   berryCountPerBerryHelp:1,ingredientCountsPerHelp:{apple:.1},
   skillProbabilityPerEligibleHelp:.1
  }))
 }));
 return {
  weekStart:'2026-11-16',asOf:'2026-11-15T21:00:00+09:00',
  eventSource:null,eventMode:'NEUTRAL_REFERENCE_ONLY',
  healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',sleepScore:100,
  primaryHealerId:'p0',secondaryHealerId:'p1',camp:false,
  fieldBonus:0,foodMode:'curry',potCapacity:57,bagCapacity:400,
  initialInventory:{apple:100},profiles,recipes,
  autoSleep:false,
  nightTeams:Array.from({length:7},()=>['p0','p2','p3','p4','p5']),
  previousWeekSleepTeam:['p0','p2','p3','p4','p5'],
  beamWidth:4,dayCandidateCount:4,
  collectionScenario:'ASSUMED_AT_0730_1200_1800',
  initialHeldScenario:'EMPTY_AT_0400_ASSUMED',
  skillScenario:'CAPPED_EXPECTED_DIRECT_ONLY',
  criticalScenario:'BASE_10_30_EXPECTATION',
  m1Mode:'M1_LIGHTWEIGHT_EVENT_V128',
  m1Event:{status:'EVENT_READY',official:dish!==1,sourceId:dish!==1?'synthetic':null,dish}
 };
}
test('M1 v128 F4 real 29-window reranker prices level70 meals and dish event multiplier',()=>{
 const common=ranker.rank(fixture(1),deps);
 assert.equal(common.status,'PROVISIONAL',common.reason);
 assert.equal(common.stage,'F4_C_M1_LIGHTWEIGHT_V128');
 assert.equal(common.slotCount,29);
 assert.equal(common.recipeEnergyMode,'ALL_RECIPES_LV70_FIXED_EVENT_AWARE');
 assert.equal(common.tastyChanceExpectedIncluded,true);
 assert(common.mealsExpected>0);
 assert(common.criticalEnergyExpected>0);
 const boosted=ranker.rank(fixture(1.5),deps);
 assert.equal(boosted.status,'PROVISIONAL',boosted.reason);
 assert.equal(boosted.slotCount,29);
 assert(boosted.mealsExpected>common.mealsExpected);
 assert(boosted.criticalEnergyExpected>common.criticalEnergyExpected);
 assert(boosted.energyExpected>common.energyExpected);
 assert.equal(boosted.m1EventDishMultiplier,1.5);
 assert.equal(boosted.weeklyEnergyCertified,false);
 assert.equal(boosted.writesSavedData,false);
});

test('v138: the bounded weekly search responds to cooking bonuses and verified direct skill value',()=>{
 const diversity=load('f4/f4-c-diverse-candidates-v125.js');
 function run(dish,chance){
  const input=fixture(dish);
  input.candidateStrategy='V125_DIVERSE';
  input.beamWidth=8;
  input.dayCandidateCount=8;
  input.initialInventory={};
  input.potCapacity=7;
  input.previousWeekCarryUnknown=true;
  input.previousWeekSleepTeam=[];
  input.nightTeams=Array.from({length:7},()=>['p0','p1','p2','p3','p4']);
  for(const [i,p] of input.profiles.entries()){
   p.helpingBonus=false;
   p.skillCode=i===7?'Charge Strength S (Random)':null;
   p.selectedMainSkillLevel=i===7?7:null;
   p.skillSpecialty=i===7?'Skills':i===6?'Ingredients':'Berries';
   for(const rate of p.ratesByTeammateBonus){
    rate.berryEnergyPerHelp=i<2?1:i<=5?200:2;
    rate.helpSeconds=3600;
    rate.ingredientCountsPerHelp={apple:i===6?0.75:0};
    rate.skillProbabilityPerEligibleHelp=i===7?chance:0;
   }
  }
  const result=ranker.rank(input,{...deps,diversity});
  assert.equal(result.status,'PROVISIONAL',result.reason);
  return result;
 }
 const normal=run(1,0),cookingEvent=run(4,0),skill=run(1,.9);
 const daytimeCount=(r,id)=>r.slots.filter(w=>w.slot!=='sleep'&&w.team.includes(id)).length;
 assert(daytimeCount(normal,'p6')<daytimeCount(cookingEvent,'p6'));
 assert(cookingEvent.mealsExpected>normal.mealsExpected);
 assert(daytimeCount(skill,'p7')>daytimeCount(normal,'p7'));
 assert(skill.directSkillEnergyExpected>0);
 assert.equal(normal.directSkillEnergyExpected,0);
});

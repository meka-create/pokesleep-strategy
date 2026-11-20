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

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),box,{filename:p,timeout:15000});
 return box.module.exports;
}
const ranker=load('f4/f4-c-item-aware-rank-v101.js');
const search=load('f4/f4-c-healer-search-v100.js');
const policy=load('f4/f4-c-healer-policy-v100.js');
const base=load('f4/f4-chronological-core-v1.js');
const clock=load('f4/f4-b-game-week-v1.js');
const skillValues=load('f1/f1-c-skill-values-v1.js');
const deps={search,policy,base,clock,skillValues};
const clone=x=>JSON.parse(JSON.stringify(x));
function input(extra={}){
 const profiles=Array.from({length:8},(_,i)=>({
  id:'p'+i,source:'F1_B_PINNED_66_SPECIES',
  helpingBonus:i===2,healerRole:i<2?'TEAM_WIDE_HEALER':null,
  carryLimit:i>=4?18:40,skillSpecialty:i<3?'Skills':'Berries',
  skillCode:i===2?'Charge Strength M':i<2?
   'Energy for Everyone S':'Charge Strength S',
  selectedMainSkillLevel:3,
  nickname:'PRIVATE_NEVER_LEAK_'+i,
  ratesByTeammateBonus:Array.from({length:5},(_,b)=>({
   status:'BASE_RATES_AVAILABLE',helpSeconds:3600-b*20,
   berryEnergyPerHelp:i<2?1:60-i*4,
   berryItemsPerHelp:.75,berryCountPerBerryHelp:1,
   ingredientCountsPerHelp:{apple:i>=5?.5:.12},
   skillProbabilityPerEligibleHelp:.12
  }))
 }));
 return {weekStart:'2026-11-16',asOf:'2026-11-15T21:00:00+09:00',
  eventSource:null,eventMode:'NEUTRAL_REFERENCE_ONLY',
  healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',
  sleepScore:100,primaryHealerId:'p0',secondaryHealerId:'p1',
  camp:false,fieldBonus:20,foodMode:'curry',potCapacity:57,
  bagCapacity:400,initialInventory:{apple:100},
  profiles,recipes:[
   {id:'apple',type:'curry',baseStrength:200,requirements:{apple:2}},
   {id:'large',type:'curry',baseStrength:900,requirements:{apple:10}}
  ],autoSleep:false,nightTeams:Array.from({length:7},(_,i)=>
   ['p'+(i%2),'p2','p3','p4','p5']),
  previousWeekSleepTeam:['p0','p2','p3','p4','p5'],
  beamWidth:6,dayCandidateCount:6,
  collectionScenario:'ASSUMED_AT_0730_1200_1800',
  initialHeldScenario:'EMPTY_AT_0400_ASSUMED',
  skillScenario:'CAPPED_EXPECTED_DIRECT_ONLY',
  criticalScenario:'BASE_10_30_EXPECTATION',...extra};
}
test('v101: independently reranks 29-window healer and cooking candidates, read-only',()=>{
 const v=input(),old=JSON.stringify(v),r=ranker.rank(v,deps);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert.equal(r.slotCount,29);assert(r.evaluatedCandidates>1);
 assert.equal(r.energyExpected,
  Math.round((r.mealsExpected+r.berryEnergyExpected+
   r.directSkillEnergyExpected)*1000)/1000);
 assert.equal(r.weeklyEnergyCertified,false);
 assert.equal(r.writesSavedData,false);
 assert.equal(r.collectionScenario,'ASSUMED_AT_0730_1200_1800');
 assert.equal(r.sleepScoreAssumed,100);
 assert.deepEqual([...r.slots[0].team],v.previousWeekSleepTeam);
 assert.equal(r.slots[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(r.slots[28].source,'FINAL_NIGHT_TRUNCATED');
 for(let day=0;day<7;day++){
  const slots=r.slots.slice(1+day*4,5+day*4);
  assert.equal(slots[0].team.at(-1),'p0');
  assert.equal(slots[0].team.at(-2),'p1');
  assert.equal(slots[1].team.at(-1),'p0');
  assert(!slots[1].team.includes('p1'));
  assert.equal(slots[2].team.at(-1),'p0');
  assert(!slots[2].team.includes('p1'));
  assert.deepEqual([...slots[3].team],v.nightTeams[day]);
 }
 assert.equal(JSON.stringify(v),old,'input mutated');
 assert(!JSON.stringify(r).includes('PRIVATE_NEVER_LEAK_'));
});
test('v101: item carrying, sneaky berries, forfeiture and uncollected end items accounted',()=>{
 const r=ranker.rank(input(),deps);
 assert.equal(r.status,'PROVISIONAL');
 assert(r.sneakyBerryEnergyExpected>0);
 assert(r.individualCarryOverflowWindows>0);
 assert(r.forfeitedHeldItemsExpected>0);
 assert(r.endingBagExpected<=400.01);
 assert(r.carryBerryExcludedExpected>=0);
 assert(r.ingredientBagOverflowExpected>=0);
 assert(r.slots.every(s=>s.bagAfter<=400.01));
 assert(r.slots.every(s=>s.overflowItemExpectation>=0));
});
test('v101: capped direct-strength expected skills only; healing is unpriced',()=>{
 const r=ranker.rank(input(),deps);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert(r.directSkillEnergyExpected>0);
 assert(r.otherSkillsNotPricedExpected>0);
 assert(r.skillActivationsExpected>0);
 assert.equal(r.healthRecoveredActual,false);
 assert.equal(r.unsupportedSkillEffectsPriced,false);
 const x=input();
 x.profiles.forEach(p=>{p.skillCode='Energy for Everyone S';});
 const noDirect=ranker.rank(x,deps);
 assert.equal(noDirect.status,'PROVISIONAL',noDirect.reason);
 assert.equal(noDirect.directSkillEnergyExpected,0);
 assert(noDirect.otherSkillsNotPricedExpected>0);
});
test('v101: cooking level and proposed critical chance only under explicit assumptions',()=>{
 const baseline=ranker.rank(input({criticalScenario:'NO_CRITICAL'}),deps);
 const critical=ranker.rank(input(),deps);
 assert.equal(baseline.status,'PROVISIONAL',baseline.reason);
 assert.equal(critical.status,'PROVISIONAL',critical.reason);
 assert.equal(baseline.criticalEnergyExpected,0);
 assert(critical.criticalEnergyExpected>0);
 assert(critical.mealsExpected>baseline.mealsExpected);
 const boosted=ranker.rank(input({
  displayedRecipeEnergies:{apple:400,large:1500}}),deps);
 assert.equal(boosted.status,'PROVISIONAL',boosted.reason);
 assert.equal(boosted.recipeEnergyMode,'MIXED_EXPLICIT_DISPLAY_ENERGY');
 assert(boosted.mealsExpected>critical.mealsExpected);
});
test('v101: event, guessed collection, skill scenario and malformed cooking are blocked',()=>{
 for(const patch of [
  {eventSource:{id:'official'}},{collectionScenario:undefined},
  {collectionScenario:'OBSERVED_WHENEVER'},{initialHeldScenario:undefined},
  {skillScenario:undefined},{criticalScenario:'RANDOM'},
  {healthScenario:'UNKNOWN'},{sleepScore:90},
  {displayedRecipeEnergies:{large:-1}},
  {displayedRecipeEnergies:{not_real:1000}},
  {autoSleep:true}
 ]){
  const x=ranker.rank(input(patch),deps);
  assert.equal(x.status,'BLOCKED',JSON.stringify(patch)+' '+x.reason);
 }
});
test('v101: missing source individual carry or expected skill rates fail closed',()=>{
 const x=input();
 delete x.profiles[0].carryLimit;
 assert.equal(ranker.rank(x,deps).reason,
  'INDIVIDUAL_CAPACITY_OR_SKILL_SOURCE_MISSING');
 const y=input();delete y.profiles[2].ratesByTeammateBonus[1].berryCountPerBerryHelp;
 assert.equal(ranker.rank(y,deps).reason,'ITEM_OR_SKILL_PROBABILITY_MISSING');
});
test('v101: existing root, private box and accepted E7 remain untouched',()=>{
 for(const f of ['f4/f4-c-item-aware-rank-v101.js']){
  const js=read(f);
  for(const banned of ['localStorage','sessionStorage','fetch(','.setItem(',
   '.removeItem(','console.log','nickname','privateBoxRows'])
   assert(!js.includes(banned),banned);
 }
 assert(!read('index.html').includes('f4-c-item-aware-rank-v101.js'));
 assert(!read('e7-preview/index.html').includes('f4-c-item-aware-rank-v101.js'));
});

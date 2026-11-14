'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),box,{filename:p,timeout:15000});
 return box.module.exports;
}
const k=load('f4/f4-c-cooking-skills-v102.js');
const values=load('f1/f1-c-skill-values-v1.js');
const ranker=load('f4/f4-c-item-aware-rank-v101.js');
const search=load('f4/f4-c-healer-search-v100.js');
const policy=load('f4/f4-c-healer-policy-v100.js');
const base=load('f4/f4-chronological-core-v1.js');
const clock=load('f4/f4-b-game-week-v1.js');
const deps={cookingSkills:k,skillValues:values,search,policy,base,clock};
const clone=x=>JSON.parse(JSON.stringify(x));
function input(extra={}){
 const profiles=Array.from({length:8},(_,i)=>({
  id:'p'+i,source:'F1_B_PINNED_66_SPECIES',helpingBonus:i===2,
  healerRole:i<2?'TEAM_WIDE_HEALER':null,carryLimit:40,
  skillSpecialty:'Skills',skillCode:i===2?'Cooking Power-Up S':
   i===3?'Tasty Chance S':i===4?'Ingredient Magnet S':
   i<2?'Energy for Everyone S':'Charge Strength S',
  selectedMainSkillLevel:1,nickname:'PRIVATE_NEVER_OUTPUT_'+i,
  ratesByTeammateBonus:Array.from({length:5},(_,b)=>({
   status:'BASE_RATES_AVAILABLE',helpSeconds:3600-b*20,
   berryEnergyPerHelp:5,berryItemsPerHelp:.5,
   berryCountPerBerryHelp:1,ingredientCountsPerHelp:{apple:.1},
   skillProbabilityPerEligibleHelp:.1
  }))
 }));
 return {weekStart:'2026-11-16',
  asOf:'2026-11-15T21:00:00+09:00',eventSource:null,
  eventMode:'NEUTRAL_REFERENCE_ONLY',
  healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',sleepScore:100,
  primaryHealerId:'p0',secondaryHealerId:'p1',
  camp:false,fieldBonus:0,foodMode:'curry',potCapacity:57,
  bagCapacity:400,initialInventory:{apple:100},
  profiles,recipes:[
   {id:'little',type:'curry',baseStrength:100,requirements:{apple:2}},
   {id:'giant',type:'curry',baseStrength:2000,requirements:{apple:60}}
  ],autoSleep:false,
  nightTeams:Array.from({length:7},()=>['p0','p2','p3','p4','p5']),
  previousWeekSleepTeam:['p0','p2','p3','p4','p5'],
  beamWidth:6,dayCandidateCount:6,
  collectionScenario:'ASSUMED_AT_0730_1200_1800',
  initialHeldScenario:'EMPTY_AT_0400_ASSUMED',
  skillScenario:'CAPPED_EXPECTED_DIRECT_ONLY',
  criticalScenario:'BASE_10_30_EXPECTATION',
  cookingSkillScenario:'EXPLICIT_TAP_EVENTS_V1',
  recipeChoicePolicy:'GREEDY_AWARE',
  initialCookingBuffs:{potExtra:0,tastyExtra:0},
  cookingSkillEvents:[
   {atWindowIndex:1,actorId:'p2',count:1},
   {atWindowIndex:1,actorId:'p3',count:1},
   {atWindowIndex:1,actorId:'p4',count:1}
  ],unlockedIngredientCodes:['apple','milk','sausage'],...extra};
}
test('v102: pot stacks, Sunday doubles base only, camp applies after skill, reset on meal',()=>{
 const first=k.initial({potExtra:0,tastyExtra:0});
 assert.equal(first.status,'STATE_READY');
 const add=k.cast(first,{skill:'Cooking Power-Up S',level:1,count:1},{skillValues:values});
 assert.equal(add.status,'APPLIED');
 assert.equal(add.state.potExtra,7);
 assert.equal(k.capacity(add.state,{basePot:33,sunday:false,camp:false}).capacity,40);
 assert.equal(k.capacity(add.state,{basePot:33,sunday:false,camp:true}).capacity,60);
 assert.equal(k.capacity(add.state,{basePot:33,sunday:true,camp:false}).capacity,73);
 assert.equal(k.capacity(add.state,{basePot:33,sunday:true,camp:true}).capacity,110);
 const meal=k.cook(add.state,{baseEnergy:1000,successEnergy:2000,day:0,useCritical:true});
 assert.equal(meal.status,'COOKED');
 assert.equal(meal.consumedPotBonus,7);
 assert.equal(meal.state.potExtra,0);
 const atCap=k.initial({potExtra:200,tastyExtra:0});
 assert.equal(k.cast(atCap,{skill:'Cooking Power-Up S',level:1,count:1},
  {skillValues:values}).reason,'POT_ALREADY_MAX');
 const nearCap=k.initial({potExtra:198,tastyExtra:0});
 const capped=k.cast(nearCap,{skill:'Cooking Power-Up S',level:1,count:1},
  {skillValues:values});
 assert.equal(capped.state.potExtra,200);
 assert.equal(capped.unappliedUnits,5);
});
test('v102: tasty chance carries on failure, resets probabilistically on success',()=>{
 const before=k.initial({potExtra:0,tastyExtra:0});
 const add=k.cast(before,{skill:'Tasty Chance S',level:1,count:1},
  {skillValues:values});
 assert.equal(add.status,'APPLIED');
 const first=k.cook(add.state,{baseEnergy:1000,successEnergy:2000,day:0,useCritical:true});
 assert.equal(first.criticalProbability,.14);
 assert.equal(first.energyExpected,1140);
 const second=k.cook(first.state,{baseEnergy:1000,successEnergy:2000,day:0,useCritical:true});
 assert.equal(second.energyExpected,1134.4);
 assert.equal(second.criticalProbability,.1344);
 const sunday=k.cook(add.state,{baseEnergy:1000,successEnergy:3000,day:6,useCritical:true});
 assert.equal(sunday.energyExpected,1680);
 const max=k.initial({potExtra:0,tastyExtra:70});
 assert.equal(k.cast(max,{skill:'Tasty Chance S',level:1,count:1},
  {skillValues:values}).reason,'TASTY_CAP_PATH_UNRESOLVED');
 const future=k.initial({potExtra:0,tastyExtra:68});
 assert.equal(k.cast(future,{skill:'Tasty Chance S',level:1,count:1},
  {skillValues:values}).state.tastyDistribution[70],1);
});
test('v102: ingredient magnet uses declared unlocked pool and respects bag capacity',()=>{
 const state=k.initial({potExtra:0,tastyExtra:0}),food=base.FOOD;
 const ev={skill:'Ingredient Magnet S',level:1,count:1,
  unlockedIngredientCodes:['apple','milk','sausage'],bagCapacity:20};
 const first=k.cast(state,ev,{skillValues:values,foodCodes:food},{apple:10,milk:0,sausage:0});
 assert.equal(first.status,'APPLIED');
 assert.equal(first.ingredientExpectedAdded,6);
 assert.equal(first.bag.apple,12);
 assert.equal(first.bag.milk,2);
 assert.equal(first.bag.sausage,2);
 assert.equal(k.cast(state,ev,{skillValues:values,foodCodes:food},
  {apple:20}).reason,'INGREDIENT_SKILL_BAG_FULL');
 assert.equal(k.cast(state,{...ev,unlockedIngredientCodes:['apple','milk']},
  {skillValues:values,foodCodes:food},{apple:10}).reason,
  'UNLOCKED_FOOD_AND_BAG_REQUIRED');
 assert.equal(k.cast(state,{...ev,skill:'Ingredient Draw S'},
  {skillValues:values,foodCodes:food},{apple:10}).status,'BLOCKED');
});
test('v102: 29-window reference integrates explicit pot, chance and magnet casts, healer policy unchanged',()=>{
 const scenario=input(),before=JSON.stringify(scenario);
 const result=ranker.rank(scenario,deps);
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert.equal(result.stage,'F4_C_V102_COOKING_STATE_REFERENCE');
 assert.equal(result.slotCount,29);
 assert.equal(result.sleepScoreAssumed,100);
 assert.equal(result.weeklyEnergyCertified,false);
 assert.equal(result.writesSavedData,false);
 assert.equal(result.explicitCookingSkillCasts,3);
 assert.equal(result.explicitCookingSkillCastsAreObserved,false);
 assert.equal(result.slots[1].potCapacityAtMeal,64);
 assert.equal(result.addedIngredientMeanExpected,6);
 assert(result.evaluatedCandidates>=2);
 assert.equal(result.slots[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(result.slots[28].source,'FINAL_NIGHT_TRUNCATED');
 for(let d=0;d<7;d++){
  const b=result.slots.slice(1+4*d,5+4*d);
  assert.equal(b[0].team.at(-1),'p0');
  assert.equal(b[0].team.at(-2),'p1');
  assert.equal(b[1].team.at(-1),'p0');
  assert(!b[1].team.includes('p1'));
  assert.deepEqual([...b[3].team],scenario.nightTeams[d]);
 }
 assert.equal(JSON.stringify(scenario),before);
 assert(!JSON.stringify(result).includes('PRIVATE_NEVER_OUTPUT_'));
});
test('v102: opt-in is isolated; v101 callers retain old stage and no new effects',()=>{
 const scenario=input();
 delete scenario.cookingSkillScenario;
 const result=ranker.rank(scenario,deps);
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert.equal(result.stage,'F4_C_V101_ITEM_AWARE_RERANK');
 assert.equal(result.explicitCookingSkillCasts,undefined);
});
test('v102: bad schedule, unknown actor, missing consent, bag overflow and live event fail closed',()=>{
 const cases=[
  [{cookingSkillScenario:undefined},null],
  [{cookingSkillScenario:'ANY'},'COOKING_SKILL_SCENARIO_INVALID'],
  [{cookingSkillEvents:[{atWindowIndex:0,actorId:'p2',count:1}]},
   'COOKING_SKILL_EVENTS_INVALID'],
  [{cookingSkillEvents:[{atWindowIndex:4,actorId:'p2',count:1}]},
   'COOKING_SKILL_EVENTS_INVALID'],
  [{cookingSkillEvents:[{atWindowIndex:1,actorId:'p99',count:1}]},
   'SKILL_ACTOR_NOT_PREVIOUS_PARTY'],
  [{cookingSkillEvents:[{atWindowIndex:1,actorId:'p2',count:2},
   {atWindowIndex:1,actorId:'p2',count:1}]},'DUPLICATE_COOKING_SKILL_EVENT'],
  [{initialCookingBuffs:{potExtra:201,tastyExtra:0}},
   'EXPLICIT_INITIAL_BUFFS_REQUIRED'],
  [{eventSource:{id:'event'}},'EXPLICIT_UNVERIFIED_SCENARIO_REQUIRED']
 ];
 for(const [patch,reason] of cases){
  const r=ranker.rank(input(patch),deps);
  assert.equal(r.status,reason?'BLOCKED':'PROVISIONAL');
  if(reason)assert.equal(r.reason,reason,JSON.stringify(patch));
 }
});
test('v102: no new public app writes or source leaks',()=>{
 const code=read('f4/f4-c-cooking-skills-v102.js');
 for(const token of ['localStorage','sessionStorage','.setItem(','fetch(',
  'console.log','nickname','privateBoxRows'])
  assert(!code.includes(token),'unexpected: '+token);
 assert(!read('index.html').includes('f4-c-cooking-skills-v102'));
 assert(!read('e7-preview/index.html').includes('f4-c-cooking-skills-v102'));
});

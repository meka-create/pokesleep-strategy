'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;
}
const rules=load('f4/f4-c-official-rules-v1.js');
const kernel=load('f4/f4-c-state-kernel-v1.js');
const gate=load('f4/f4-event-model-gate-v1.js');
const source=()=>({
 id:rules.ID,start:'2026-11-16',end:'2026-11-23',
 sourceKey:'bountiful banquet week vol1',upstreamRevision:'a'.repeat(40),
 verifiedTarget:{specialty:'Ingredients'},
 verifiedEffects:{ingredient:1,extraIng:'nuts',carryLimitAdd:10}
});
const DURING='2026-11-16T04:00:00+09:00';
const clone=x=>JSON.parse(JSON.stringify(x));
test('F4-C: official event scoped to exact source and JST 04:00 dates; no authenticity claim',()=>{
 const ok=rules.active(source(),DURING);
 assert.equal(ok.status,'RULES_MATCHED_ONLY');assert.equal(ok.ruleCount,7);
 assert.equal(ok.weeklyEnergyCertified,false);
 assert.equal(ok.sourceAuthenticityCertified,false);
 assert.equal(rules.active(source(),'2026-11-23T03:59:59+09:00').status,'RULES_MATCHED_ONLY');
 for(const at of ['2026-11-16T03:59:59+09:00','2026-11-23T04:00:00+09:00'])
  assert.equal(rules.active(source(),at).reason,'EVENT_NOT_ACTIVE_AT_INSTANT');
 assert.equal(rules.active(source(),'2026-11-16T04:00').reason,'INVALID_INSTANT');
 for(const s of [null,{}, {...source(),id:'manual:2026-11-16'},
  {...source(),upstreamRevision:'unverified'},
  {...source(),verifiedTarget:{specialty:'Berries'}}])
  assert.equal(rules.match(s).status,'BLOCKED');
 for(const s of [{...source(),verifiedEffects:{...source().verifiedEffects,ingredient:2}},
  {...source(),verifiedEffects:{...source().verifiedEffects,dish:1}}])
  assert.equal(rules.match(s).reason,'UNVERIFIED_OR_CHANGED_BONUS');
});
test('F4-C: ingredient help +1 original, +1 nuts, only on normal help and ingredient specialty',()=>{
 const s=source();
 const apple=rules.ingredientHelp(s,DURING,
  {kind:'ingredient',specialty:'Ingredients',ingredient:'apple',count:3});
 assert.equal(apple.status,'RULE_APPLIED');
 assert.equal(apple.ingredientCount,4);
 assert.equal(apple.extraNuts,1);
 assert.equal(apple.totalItems,5);
 assert.equal(apple.bonusItems,2);
 const alreadyNuts=rules.ingredientHelp(s,DURING,
  {kind:'ingredient',specialty:'Ingredients',ingredient:'nuts',count:2});
 assert.equal(alreadyNuts.ingredientCount+alreadyNuts.extraNuts,4);
 for(const [kind,specialty] of [['berry','Ingredients'],['ingredient','Berries'],
  ['skill','Ingredients'],['ingredient','Skills']]){
  const x=rules.ingredientHelp(s,DURING,{kind,specialty,count:1,ingredient:'apple'});
  assert.equal(x.extraNuts,0);
 }
 assert.equal(rules.ingredientHelp(s,DURING,
  {kind:'ingredient',specialty:'Ingredients',count:1}).reason,'HELP_INPUT_INVALID');
});
test('F4-C: carry bonus is +10 for ingredient specialists only, per individual',()=>{
 const s=source();
 assert.equal(rules.carryCapacity(s,DURING,
  {specialty:'Ingredients',baseCapacity:22}).capacity,32);
 assert.equal(rules.carryCapacity(s,DURING,
  {specialty:'Berries',baseCapacity:22}).capacity,22);
 assert.equal(rules.carryCapacity(s,DURING,
  {specialty:'Skills',baseCapacity:22}).capacity,22);
});
test('F4-C: event pot +30 without undocumented camp/Sunday bonus ordering',()=>{
 const s=source();
 assert.equal(rules.cookingPot(s,DURING,
  {baseCapacity:57,camp:false,sunday:false}).capacity,87);
 assert.equal(rules.cookingPot(s,DURING,
  {baseCapacity:57,camp:true,sunday:false}).reason,'POT_STACKING_ORDER_NOT_VERIFIED');
 assert.equal(rules.cookingPot(s,DURING,
  {baseCapacity:57,camp:false,sunday:true}).reason,'POT_STACKING_ORDER_NOT_VERIFIED');
});
test('F4-C: recipe required nuts multiplies ONLY recipe component, extra nuts separately',()=>{
 const s=source();
 const withNuts=rules.mealEnergyComponents(s,DURING,{
  requiredIngredients:{nuts:8,corn:15,pumpkin:16},
  displayedRecipeEnergy:10000,extraNutCount:3,nutUnitEnergy:100});
 assert.equal(withNuts.status,'RULE_APPLIED');
 assert.equal(withNuts.requiredEnergyAfterEvent,15000);
 assert.equal(withNuts.extraNutsEnergyAfterEvent,450);
 assert.equal(withNuts.subtotalBeforeFieldAndCritical,15450);
 assert.equal(withNuts.roundingUnverified,true);
 const without=rules.mealEnergyComponents(s,DURING,{
  requiredIngredients:{apple:7},
  displayedRecipeEnergy:10000,extraNutCount:3,nutUnitEnergy:100});
 assert.equal(without.requiredEnergyAfterEvent,10000);
 assert.equal(without.subtotalBeforeFieldAndCritical,10450);
 const plainRecipe=rules.mealEnergyComponents(s,DURING,{
  requiredIngredients:{apple:7},displayedRecipeEnergy:10000,
  extraNutCount:0,nutUnitEnergy:0});
 assert.equal(plainRecipe.subtotalBeforeFieldAndCritical,10000);
 for(const bad of [{requiredIngredients:{nuts:7},displayedRecipeEnergy:10000,
    extraNutCount:1,nutUnitEnergy:0},
  {requiredIngredients:{},displayedRecipeEnergy:10000,extraNutCount:0,nutUnitEnergy:100},
  {requiredIngredients:{nuts:-1},displayedRecipeEnergy:10000,extraNutCount:0,nutUnitEnergy:100}])
  assert.equal(rules.mealEnergyComponents(s,DURING,bad).status,'BLOCKED');
});
test('F4-C: real 19/78 catalog blocked; synthetic complete fixture is only coverage declared',()=>{
 const recipeCatalog=load('src/recipes.js');
 const legacy=['leek','mushroom','egg','potato','apple','herb','sausage','milk',
  'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado'];
 assert.equal(recipeCatalog.length,78);
 assert.equal(rules.coverage(source(),{
  ingredientCodes:legacy,recipes:recipeCatalog}, {eventGate:gate}).reason,
  'RELEASE_CATALOG_NOT_AVAILABLE');
 const fakeNuts=['curry','salad','dessert'].map(type=>({
  id:'SYNTHETIC_'+type,type,requirements:{nuts:1},baseStrength:100}));
 const params={ingredientCodes:[...legacy,'nuts'],
  recipes:[...recipeCatalog,...fakeNuts],
  catalogProvenance:{verifiedAgainstOfficialRelease:true,
   sourceCommit:'a'.repeat(40)}};
 const x=rules.coverage(source(),params,{eventGate:gate});
 assert.equal(x.status,'RULES_AND_CATALOG_DECLARED');
 assert.equal(x.weeklyEnergyCertified,false);
 assert.equal(x.sourceAuthenticityCertified,false);
 assert.equal(rules.coverage(source(),{
  ...params,catalogProvenance:{verifiedAgainstOfficialRelease:false,
  sourceCommit:'a'.repeat(40)}},{eventGate:gate}).reason,
 'RELEASE_CATALOG_UNVERIFIED');
 assert.equal(rules.coverage(source(),params).reason,'BONUS_GATE_MISSING');
});
test('F4-C: health tiers match verified 0.45/0.52/0.58/0.66/1.00 rate factors',()=>{
 for(const [energy,factor] of [[150,.45],[80.1,.45],[80,.52],[60.1,.52],
  [60,.58],[40.1,.58],[40,.66],[1.1,.66],[1,1],[.9,1],[.1,1],[0,1]])
  assert.equal(kernel.tier(energy).helpSecondsFactor,factor,'energy '+energy);
 for(const energy of [-1,151,NaN,Infinity])
  assert.equal(kernel.tier(energy).status,'BLOCKED','energy '+energy);
});
test('F4-C: awake 10m energy drain integrates across rate boundaries with no auto-recovery',()=>{
 const x=kernel.awakeTicks({initialEnergy:81,referenceHelpSeconds:3600,ticks:3});
 assert.equal(x.status,'PROVISIONAL_AWAKE_HELP');
 assert.equal(x.endingEnergy,78);
 assert.equal(x.elapsedMinutes,30);
 const expected=600/1620+2*600/1872;
 assert(Math.abs(x.expectedHelpOpportunities-expected)<1e-6);
 assert.equal(x.tickCountByTier['80+'],1);
 assert.equal(x.tickCountByTier['60+'],2);
 assert.equal(x.doesNotModelTimerCarry,true);
 const low=kernel.awakeTicks({initialEnergy:1,referenceHelpSeconds:3600,ticks:2});
 assert.equal(low.status,'PROVISIONAL_AWAKE_HELP');
 assert.equal(low.endingEnergy,0);
 assert.equal(low.tickCountByTier['0'],2);
 assert.equal(low.expectedHelpOpportunities,0.333333);
 assert.equal(kernel.awakeTicks({initialEnergy:100,referenceHelpSeconds:3600,ticks:1.5}).reason,
 'AWAKE_INPUT_INVALID');
});
test('F4-C: recovery requires observed external event, never assumes skill trigger',()=>{
 assert.equal(kernel.observedRecovery(95,18,'OBSERVED_SKILL').energy,113);
 assert.equal(kernel.observedRecovery(145,18,'OBSERVED_SLEEP').energy,150);
 assert.equal(kernel.observedRecovery(80,3,'OBSERVED_MEAL').energy,83);
 assert.equal(kernel.observedRecovery(80,5,'ASSUMED_SKILL').reason,
 'RECOVERY_SOURCE_REQUIRED');
});
test('F4-C: individual carry full requires collection schedule, not fake stock or free snacking',()=>{
 assert.equal(kernel.holdItems({capacity:30,held:28,newItems:2}).status,'CARRY_WITHIN_LIMIT');
 const full=kernel.holdItems({capacity:30,held:28,newItems:3});
 assert.equal(full.status,'NEEDS_COLLECTION_SCHEDULE');
 assert.equal(full.overflowItems,1);
 assert.equal(full.nextHeldUnverified,true);
 assert.equal(kernel.holdItems({capacity:30,held:31,newItems:0}).status,'BLOCKED');
});
test('F4-C source and models do not persist, log or expose private individual details',()=>{
 for(const p of ['f4/f4-c-official-rules-v1.js','f4/f4-c-state-kernel-v1.js']){
  const js=read(p);
  for(const fragment of ['localStorage','sessionStorage','fetch(','.setItem(',
   '.removeItem(','console.log','nickname','individualCsv'])
   assert(!js.includes(fragment),'unexpected side effect '+fragment);
 }
 const original=source(),before=JSON.stringify(original);
 rules.ingredientHelp(original,DURING,{kind:'ingredient',specialty:'Ingredients',ingredient:'nuts',count:2});
 assert.equal(JSON.stringify(original),before);
 assert.doesNotMatch(read('index.html'),/f4-c-official-rules-v1/);
});

'use strict';
/* Independent deterministic-ingredient arithmetic across the EXACT
 * frozen M01-M04 fixture family. This verifies the part of meal energy
 * backed by initial, user-confirmed ingredients. It neither validates
 * random ingredient drops nor a complete mixed seven-day score.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const {mixedInput}=require('./step2-m1-audit.cjs');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const simulate=context.globalThis.PokeSimulator.simulate;
const configurations={
 M01:x=>{x.options.recipeId='';},
 M02:x=>{const ids=['r0','r1','r2','g0','f0'];
  x.teams.morning=[...ids];x.teams.noon=[...ids];x.teams.evening=[...ids];},
 M03:x=>{const ids=['r0','r1','r2','r3','w0'];
  x.teams.morning=[...ids];x.teams.noon=[...ids];x.teams.evening=[...ids];},
 M04:x=>{
  x.options.initialIngredients={apple:7};x.options.bagCapacity=7;
  x.options.recipeId='';
  x.teams.morning=['r0','r1','r2','g0','f0'];
  x.teams.noon=['r0','r1','r2','r3','w0'];
  x.teams.evening=['r0','r1','r2','r3','t0'];
 }
};
const round=n=>Math.round(n*1e8)/1e8;
const FROZEN_RECIPE={
 id:'apple_curry',ingredient:'apple',unitsPerMeal:7,
 baseLevel70Strength:2678,fieldBonus:25,weeklySlots:21
};
function independentMealEnvelope(opts){
 if(opts.recipeMode!=='fixed'||opts.extraMode!=='none'||opts.successMode!=='none'||
    opts.foodMode!=='curry')throw Error('独立料理参照の制御条件が変わりました。');
 if(opts.fieldBonus!==FROZEN_RECIPE.fieldBonus)
  throw Error('M1のフィールド補正が凍結条件と異なります。');
 if(!opts.recipeId){
  return {recipeSelected:false,plannedMealSlots:0,guaranteedMeals:0,
   maxSourceDependentMeals:0,guaranteedCookingEnergy:0,
   maximumCookingEnergy:0,maxUncertainCookingEnergy:0,
   qualification:'NO_RECIPE_SELECTED'};
 }
 if(opts.recipeId!==FROZEN_RECIPE.id)
  throw Error('M1の料理が独立参照の対象外です。');
 const count=opts.initialIngredients?.[FROZEN_RECIPE.ingredient];
 if(!Number.isSafeInteger(count)||count<0)
  throw Error('確定した初期食材が不正です。');
 const slots=FROZEN_RECIPE.weeklySlots;
 // Use literal documented recipe data, not PokeSimulator.chooseRecipe,
 // simulate, meal provenance flags or runtime recipe-strength lookup.
 const guaranteed=Math.min(slots,Math.floor(count/FROZEN_RECIPE.unitsPerMeal));
 const perMeal=Math.floor(FROZEN_RECIPE.baseLevel70Strength*
  (1+FROZEN_RECIPE.fieldBonus/100)+1e-9);
 return {recipeSelected:true,plannedMealSlots:slots,
  guaranteedMeals:guaranteed,maxSourceDependentMeals:slots-guaranteed,
  guaranteedCookingEnergy:perMeal*guaranteed,
  maximumCookingEnergy:perMeal*slots,
  maxUncertainCookingEnergy:perMeal*(slots-guaranteed),
  qualification:'DETERMINISTIC_INITIAL_STOCK_ONLY'};
}
function reportMixedMealProvenance(){
 const cases=Object.entries(configurations).map(([id,configure])=>{
  const input=mixedInput();configure(input);
  const oracle=independentMealEnvelope(input.options);
  const actual=simulate(input);
  const planned=actual.meals.length;
  const selected=oracle.recipeSelected;
  if(!selected){
   assert.equal(planned,0,id+' without recipe cannot count a meal');
   assert.equal(actual.cooking,0,id+' without recipe cannot earn cooking Energy');
   assert.equal(actual.estimatedMeals,0);
   assert.equal(actual.expectedSourceMeals,0);
  }else{
   assert.equal(planned,oracle.plannedMealSlots,id+' currently models all 21 meals');
   assert.equal(actual.initialCoveredMeals,oracle.guaranteedMeals,id+' certain meals');
   assert.equal(actual.estimatedMeals,oracle.maxSourceDependentMeals,id+' expected-meal count');
   assert.equal(actual.expectedSourceMeals,oracle.maxSourceDependentMeals,id+' source dependent meals');
   assert.ok(Math.abs(actual.initialSourceMealEnergy-
     oracle.guaranteedCookingEnergy)<1e-7,id+' certain meal Energy');
   assert.ok(Math.abs(actual.expectedSourceMealEnergy-
     oracle.maxUncertainCookingEnergy)<1e-7,id+' uncertain modeled meal Energy');
   assert.ok(Math.abs(actual.cooking-
     oracle.maximumCookingEnergy)<1e-7,id+' upper cooking case');
   assert.equal(actual.consumedIngredients.apple,
     oracle.plannedMealSlots*FROZEN_RECIPE.unitsPerMeal,id+' modeled consumption');
  }
  return {id,grade:'B_LIMITED_INITIAL_INGREDIENT_AND_RECIPE_ARITHMETIC',
   independentReference:oracle,
   model:{meals:planned,cookingEnergy:round(actual.cooking),
    initialCoveredMeals:actual.initialCoveredMeals,
    sourceDependentMeals:actual.expectedSourceMeals,
    initialSourceMealEnergy:round(actual.initialSourceMealEnergy),
    expectedSourceMealEnergy:round(actual.expectedSourceMealEnergy)},
   componentDifference:round(actual.cooking-
    (selected?oracle.maximumCookingEnergy:0)),
   originalFullMixedWeekExternallyValidated:false};
 });
 return {schema:'step2-m1-mixed-meal-provenance-v1',
  grade:'B_COMPONENT_ONLY_NOT_GAME_MEAL_PROBABILITY',
  referenceRecipe:FROZEN_RECIPE,
  note:'Initial-stock guaranteed meal arithmetic only. 21st meal modeled using uncertain production; the theoretical additional cooking energy does not bound indirect meal-healing/help/skill effects. No external full-week result.',
  frozenBaselineEdited:false,mainMatrixCompared:10,mainMatrixTotal:14,
  mixedCasesGameValidated:0,rankingPairsGameValidated:0,actualGameWeeks:0,
  m1:'PARTIAL',m2:'PARTIAL',m3:'PARTIAL',m4:'NOT_STARTED',
  step2:'HOLD',step3:'NOT_STARTED',cases};
}
if(require.main===module)
 console.log('M1_MIXED_MEAL_PROVENANCE_JSON='+JSON.stringify(reportMixedMealProvenance()));
module.exports={reportMixedMealProvenance,independentMealEnvelope};

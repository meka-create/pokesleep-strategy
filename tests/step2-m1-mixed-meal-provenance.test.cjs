'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportMixedMealProvenance,independentMealEnvelope}=
 require('../scripts/step2-m1-mixed-meal-provenance.cjs');
const report=reportMixedMealProvenance();
console.log('M1_MIXED_MEAL_PROVENANCE_JSON='+JSON.stringify(report));
test('M01 and M04 explicitly select no meal; M02/M03 have independent 20 certain + 1 uncertain recipe source',()=>{
 assert.equal(report.cases.length,4);
 const byId=Object.fromEntries(report.cases.map(c=>[c.id,c]));
 for(const id of ['M01','M04']){
  const c=byId[id];
  assert.equal(c.independentReference.recipeSelected,false);
  assert.equal(c.model.meals,0);
  assert.equal(c.model.cookingEnergy,0);
  assert.equal(c.model.sourceDependentMeals,0);
 }
 for(const id of ['M02','M03']){
  const c=byId[id];
  assert.equal(c.independentReference.recipeSelected,true);
  assert.equal(c.independentReference.plannedMealSlots,21);
  assert.equal(c.independentReference.guaranteedMeals,20);
  assert.equal(c.independentReference.maxSourceDependentMeals,1);
  assert.equal(c.independentReference.guaranteedCookingEnergy,66940);
  assert.equal(c.independentReference.maximumCookingEnergy,70287);
  assert.equal(c.independentReference.maxUncertainCookingEnergy,3347);
  assert.equal(c.model.initialCoveredMeals,20);
  assert.equal(c.model.sourceDependentMeals,1);
  assert.equal(c.model.initialSourceMealEnergy,66940);
  assert.equal(c.model.expectedSourceMealEnergy,3347);
  assert.equal(c.model.cookingEnergy,70287);
 }
 assert.ok(report.cases.every(c=>c.componentDifference===0));
});
test('independent fixed meal bounds reject altered or invalid assumptions, and 147 certain apples remove meal source risk',()=>{
 const opts=stock=>({recipeMode:'fixed',extraMode:'none',successMode:'none',
  foodMode:'curry',fieldBonus:25,recipeId:'apple_curry',initialIngredients:{apple:stock}});
 const certain=independentMealEnvelope(opts(147));
 assert.equal(certain.guaranteedMeals,21);
 assert.equal(certain.maxSourceDependentMeals,0);
 assert.equal(certain.maxUncertainCookingEnergy,0);
 assert.equal(certain.guaranteedCookingEnergy,70287);
 for(const change of [
  x=>x.extraMode='fill',x=>x.successMode='expected',
  x=>x.recipeMode='best',x=>x.foodMode='salad',
  x=>x.fieldBonus=40,x=>x.recipeId='unknown',
  x=>x.initialIngredients.apple=-1
 ]){
  const x=opts(140);change(x);
  assert.throws(()=>independentMealEnvelope(x));
 }
});
test('M01-M04 component oracle is not an external full-week validation and never promotes ranks or STEP3',()=>{
 assert.equal(report.grade,'B_COMPONENT_ONLY_NOT_GAME_MEAL_PROBABILITY');
 assert.equal(report.mainMatrixCompared,10);
 assert.equal(report.mainMatrixTotal,14);
 assert.equal(report.mixedCasesGameValidated,0);
 assert.equal(report.rankingPairsGameValidated,0);
 assert.equal(report.actualGameWeeks,0);
 assert.equal(report.frozenBaselineEdited,false);
 assert.equal(report.step2,'HOLD');
 assert.equal(report.step3,'NOT_STARTED');
 assert.equal(report.m1,'PARTIAL');
});

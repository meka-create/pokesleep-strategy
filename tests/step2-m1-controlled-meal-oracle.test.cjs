'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {controlledMealReport}=require('../scripts/step2-m1-controlled-meal-oracle.cjs');
const r=controlledMealReport();
console.log('M1_CONTROLLED_MEAL_JSON='+JSON.stringify(r));
test('controlled fixed and rotating full-week meals match independent minute clock',()=>{
 assert.equal(r.cases.length,5);
 assert.deepEqual(r.cases.map(x=>x.id),['CM01','CM02','CM03','CM04','CM05']);
 for(const c of r.cases){
  assert.ok(c.reference.berries>0,'berry production must be present');
  assert.ok(c.reference.cooking>0,'successful meals must be present');
  assert.ok(c.reference.meals>=1&&c.reference.meals<=21);
  if(c.noAppleProduction)assert.equal(c.reference.ingredientsProduced,0);
  else assert.ok(c.reference.ingredientsProduced>0);
  assert.ok(c.reference.endingInventory>=0);
  assert.equal(c.reference.consumedApple,c.reference.meals*7);
  for(const key of ['total','berries','cooking','meals','ingredientsProduced','consumedApple','endingInventory'])
   assert.equal(c.model[key],c.reference[key],c.id+': '+key);
  assert.ok(Object.values(c.differences).every(x=>Math.abs(x)<1e-7));
  assert.equal(c.mealTrace.length,c.reference.meals);
  assert.ok(c.mealTrace.every(x=>x.energy>0&&x.day>=1&&x.day<=7));
 }
});
test('no initial apple allows skipped breakfast without phantom cooking',()=>{
 const first=r.cases[0],second=r.cases[1];
 assert.equal(first.mealTrace[0].day,1);
 assert.equal(first.mealTrace[0].slot,'朝');
 assert.ok(second.mealTrace.length);
 assert.equal(second.mealTrace.some(x=>x.day===1&&x.slot==='朝'),false);
});
test('controlled cooking does not certify actual mixed week M02 or M04',()=>{
 assert.equal(r.grade,'B_CONTROLLED_DETERMINISTIC_COOKING');
 assert.equal(r.realGameMixedAccuracyValidated,false);
 assert.equal(r.originalM02M04Validated,false);
 assert.equal(r.step2,'HOLD');
 assert.equal(r.m1,'PARTIAL');
 assert.equal(r.step3,'NOT_STARTED');
 const {buildReport}=require('../scripts/step2-m1-audit.cjs');
 const baseline=buildReport();
 for(const id of ['M01','M02','M03','M04']){
  const row=baseline.matrix.find(c=>c.id===id);
  assert.equal(row.evidenceGrade,'C',id);
  assert.equal(row.disposition,'UNVERIFIED_EXTERNAL',id);
 }
 assert.equal(baseline.counts.referenceCompared,10);
 assert.equal(baseline.counts.unverifiedCases,4);
 assert.equal(baseline.counts.externallyVerifiedRankingPairs,0);
});

test('CI-reproduced deterministic 21/20 meal baselines cannot change silently',()=>{
 const pinned=require('../docs/STEP2_M1_CONTROLLED_MEAL_BASELINE_20261018.json');
 assert.equal(pinned.ciProvenance.runId,39100112506);
 assert.equal(pinned.ciProvenance.verifiedTests,262);
 assert.equal(pinned.ciProvenance.failedTests,0);
 assert.equal(pinned.grade,'B_CONTROLLED_DETERMINISTIC_COOKING');
 assert.equal(pinned.realGameMixedAccuracyValidated,false);
 assert.equal(pinned.originalM02M04Validated,false);
 assert.deepEqual(r.cases.slice(0,2).map(x=>x.id),pinned.cases.map(x=>x.id));
 for(let i=0;i<2;i++){
  const actual=r.cases[i],saved=pinned.cases[i];
  assert.deepEqual(actual.reference,saved.reference);
  assert.deepEqual(actual.model,saved.model);
  assert.deepEqual(actual.differences,saved.differences);
  assert.deepEqual(actual.mealTrace,saved.mealTrace);
 }
 assert.deepEqual(pinned.cases.map(x=>[x.reference.meals,x.reference.total]),
  [[21,174427],[20,165619]]);
});

test('CM03 shared food bag cap seven retains food in a Pokemon pocket across meals',()=>{
 const c=r.cases.find(x=>x.id==='CM03');
 assert.ok(c);
 assert.equal(c.reference.endingInventory<=7,true);
 assert.equal(c.reference.consumedApple,c.reference.meals*7);
 assert.equal(c.reference.endingInventory+c.reference.consumedApple,
  7+c.reference.ingredientsProduced);
 assert.ok(c.reference.ingredientsProduced>0);
 assert.equal(c.model.endingInventory,c.reference.endingInventory);
 assert.ok(Object.values(c.differences).every(x=>Math.abs(x)<1e-7));
 assert.equal(r.realGameMixedAccuracyValidated,false);
 assert.equal(r.originalM02M04Validated,false);
});

test('CI-provenanced full seven-slot bag keeps original 21 meals and exact bounded stock',()=>{
 const pinned=require('../docs/STEP2_M1_CONTROLLED_FULL_BAG_BASELINE_20261018.json');
 assert.equal(pinned.ciProvenance.runId,39100626960);
 assert.equal(pinned.ciProvenance.verifiedTests,264);
 assert.equal(pinned.ciProvenance.failedTests,0);
 assert.equal(pinned.bagCapacity,7);
 assert.equal(pinned.initialApple,7);
 assert.equal(pinned.originalM04Validated,false);
 assert.equal(pinned.actualGameMixedValidated,false);
 const actual=r.cases.find(x=>x.id==='CM03');
 assert.deepEqual(actual.reference,pinned.reference);
 assert.deepEqual(actual.model,pinned.model);
 assert.deepEqual(actual.differences,pinned.differences);
 assert.deepEqual(actual.mealTrace,pinned.mealTrace);
 assert.deepEqual([pinned.reference.total,pinned.reference.meals,
  pinned.reference.ingredientsProduced,pinned.reference.consumedApple,
  pinned.reference.endingInventory],[174427,21,147,147,7]);
});

test('CM04/CM05 140 vs 147 controlled apples isolate the last Sunday evening meal and its indirect helper impact',()=>{
 const missing=r.cases.find(x=>x.id==='CM04'),present=r.cases.find(x=>x.id==='CM05');
 assert.ok(missing&&present);
 for(const c of [missing,present]){
  assert.equal(c.noAppleProduction,true);
  assert.equal(c.reference.ingredientsProduced,0);
  assert.equal(c.reference.endingInventory,0);
  assert.equal(c.model.ingredientsProduced,0);
  assert.equal(c.reference.consumedApple,c.reference.meals*7);
  assert.equal(c.model.consumedApple,c.reference.consumedApple);
  assert.equal(c.model.total,c.reference.total);
  assert.ok(Object.values(c.differences).every(d=>Math.abs(d)<1e-7));
 }
 assert.equal(missing.reference.meals,20);
 assert.equal(present.reference.meals,21);
 assert.equal(missing.mealTrace.some(m=>m.day===7&&m.slot==='夜'),false);
 assert.equal(present.mealTrace.at(-1).day,7);
 assert.equal(present.mealTrace.at(-1).slot,'夜');
 const delta=r.lastMealCounterfactual;
 assert.equal(delta.schema,'step2-m1-last-meal-sunday-evening-v1');
 assert.equal(delta.independentDelta.cooking,3347);
 assert.deepEqual(delta.productionDelta,delta.independentDelta);
 assert.equal(delta.indirectBerryDelta,delta.independentDelta.berries);
 assert.equal(delta.independentDelta.total,
  delta.independentDelta.cooking+delta.independentDelta.berries);
 assert.equal(delta.gameProbabilityOrRankingValidated,false);
 assert.equal(delta.weeklyTotalDifferenceNotAssumedToEqualMealStrength,true);
});

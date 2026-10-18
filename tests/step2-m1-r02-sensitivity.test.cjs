'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sensitivityReport}=require('../scripts/step2-m1-r02-sensitivity.cjs');
const r=sensitivityReport();
console.log('M1_R02_SENSITIVITY_JSON='+JSON.stringify(r));
const original=r.scenarios.find(s=>s.id==='original-140');
const certain=r.scenarios.find(s=>s.id==='guaranteed-147');
test('R02 original natural skill rates match frozen 2026-10-17 M1 CI baseline',()=>{
 const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 const row=frozen.rankingComparisons.find(x=>x.id==='R02');
 const actual=original.rates.find(x=>x.rateFactor===1);
 assert.equal(actual.deltaBminusA,row.modelDeltaBminusA);
 assert.equal(actual.modelLeader,row.modelLeader);
 assert.equal(actual.scoreA.total,row.scoreA.total);
 assert.equal(actual.scoreB.total,row.scoreB.total);
 assert.equal(actual.scoreA.berries,row.scoreA.berries);
 assert.equal(actual.scoreB.berries,row.scoreB.berries);
 assert.equal(actual.scoreA.skills,row.scoreA.skills);
 assert.equal(actual.scoreB.skills,row.scoreB.skills);
 assert.equal(actual.scoreA.cooking,row.scoreA.cooking);
 assert.equal(actual.scoreB.cooking,row.scoreB.cooking);
 assert.equal(actual.scoreA.meals,21);
 assert.equal(actual.scoreB.meals,21);
});
test('R02 factor sweeps are identical input pairs and never invent real game evidence',()=>{
 assert.equal(r.scenarios.length,3);
 assert.deepEqual(r.scenarios.map(x=>x.id),['original-140','guaranteed-147','berry-only-147']);
 for(const scenario of r.scenarios){
  assert.deepEqual(scenario.testedFactors,[0,.25,.5,.75,1,1.25,1.5,2]);
  for(const row of scenario.rates){
   assert.equal(row.scoreA.meals,21);
   assert.equal(row.scoreB.meals,21);
   assert.ok(Number.isFinite(row.deltaBminusA));
   assert.ok(Math.abs(row.deltaBminusA-(row.scoreB.total-row.scoreA.total))<2e-6);
   assert.equal(row.modelLeader,Math.abs(row.deltaBminusA)<1e-8?'TIE':row.deltaBminusA>0?'B':'A');
   assert.equal(row.referenceRankValidated,false);
   assert.equal(row.gameAccuracyValidated,false);
  }
 }
 assert.equal(r.actualGameWeeksObserved,0);
 assert.equal(r.realGameRankingValidated,false);
 assert.equal(r.rateFactorsAreMeasured,false);
 assert.equal(r.probabilityOfRankInversionKnown,false);
 assert.equal(r.step2,'HOLD');
 assert.equal(r.m1,'PARTIAL');
 assert.equal(r.step3,'NOT_STARTED');
});
test('all 21 meals backed by user-supplied ingredients isolate heal sensitivity',()=>{
 for(const row of certain.rates){
  assert.equal(row.scoreA.estimatedMeals,0);
  assert.equal(row.scoreB.estimatedMeals,0);
  assert.equal(row.scoreA.expectedSourceMeals,0);
  assert.equal(row.scoreB.expectedSourceMeals,0);
 }
 const pure=r.scenarios.find(s=>s.id==='berry-only-147');
 for(const row of pure.rates){
  assert.equal(row.scoreA.estimatedMeals,0);
  assert.equal(row.scoreB.estimatedMeals,0);
  assert.equal(row.scoreA.expectedSourceMeals,0);
  assert.equal(row.scoreB.expectedSourceMeals,0);
 }
 const old=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 assert.equal(old.counts.externallyVerifiedRankingPairs,0);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sensitivityReport}=require('../scripts/step2-m1-r02-sensitivity.cjs');
const r=sensitivityReport();
console.log('M1_R02_SENSITIVITY_JSON='+JSON.stringify(r));
const rounded=n=>Math.round(n*1e6)/1e6;
const original=r.scenarios.find(s=>s.id==='original-140');
const certain=r.scenarios.find(s=>s.id==='guaranteed-147');
test('R02 v0.2.30 archived values remain frozen while current scores may change',()=>{
 const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 const row=frozen.rankingComparisons.find(x=>x.id==='R02');
 const actual=original.rates.find(x=>x.rateFactor===1);
 assert.equal(row.id,'R02');
 assert.equal(row.externalRankingValidated,false);
 assert.ok(Number.isFinite(row.modelDeltaBminusA));
 assert.ok(Number.isFinite(actual.scoreA.total));
 assert.ok(Number.isFinite(actual.scoreB.total));
 assert.equal(actual.scoreA.meals,21);
 assert.equal(actual.scoreB.meals,21);
 assert.equal(actual.gameAccuracyValidated,false);
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

test('R02 current artificial factors recompute sign and sensitivity',()=>{
 for(const scenario of r.scenarios){
  const seen=new Set(scenario.rates.map(x=>x.modelLeader));
  assert.equal(scenario.includesModelRankReversal,seen.size>1);
  assert.deepEqual(scenario.modelLeaders,[...seen].sort());
  assert.equal(scenario.externalRankingValidated,false);
  for(const rate of scenario.rates){
   assert.equal(rate.modelLeader,Math.abs(rate.deltaBminusA)<1e-8?'TIE':
    rate.deltaBminusA>0?'B':'A');
  }
 }
 assert.equal(r.rateFactorsAreMeasured,false);
});

test('old R02 CI baseline is retained without presenting current values as historical',()=>{
 const pinned=require('../docs/STEP2_M1_R02_SENSITIVITY_CI_BASELINE_20261018.json');
 assert.equal(pinned.ciProvenance.runId,39104258014);
 assert.equal(pinned.ciProvenance.tests,268);
 assert.equal(pinned.ciProvenance.failed,0);
 assert.equal(pinned.evidenceGrade,'C_INTERNAL_SENSITIVITY_NOT_GAME_REFERENCE');
 assert.equal(pinned.actualGameWeeksObserved,0);
 assert.equal(pinned.realGameRankingValidated,false);
 assert.equal(pinned.step2,'HOLD');
 assert.deepEqual(pinned.scenarios.map(x=>x.id),r.scenarios.map(x=>x.id));
 assert.deepEqual(r.pairing,pinned.pairing);
});

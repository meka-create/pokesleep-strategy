'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sensitivityReport}=require('../scripts/step2-m1-r02-sensitivity.cjs');
const r=sensitivityReport();
console.log('M1_R02_SENSITIVITY_JSON='+JSON.stringify(r));
const rounded=n=>Math.round(n*1e6)/1e6;
const original=r.scenarios.find(s=>s.id==='original-140');
const certain=r.scenarios.find(s=>s.id==='guaranteed-147');
test('R02 original natural skill rates match frozen 2026-10-17 M1 CI baseline',()=>{
 const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 const row=frozen.rankingComparisons.find(x=>x.id==='R02');
 const actual=original.rates.find(x=>x.rateFactor===1);
 assert.equal(rounded(actual.deltaBminusA-(actual.scoreB.directStrengthRoundingCorrection-actual.scoreA.directStrengthRoundingCorrection)),row.modelDeltaBminusA);
 assert.equal(actual.modelLeader,row.modelLeader);
 assert.equal(rounded(actual.scoreA.total-actual.scoreA.directStrengthRoundingCorrection),row.scoreA.total);
 assert.equal(rounded(actual.scoreB.total-actual.scoreB.directStrengthRoundingCorrection),row.scoreB.total);
 assert.equal(actual.scoreA.berries,row.scoreA.berries);
 assert.equal(actual.scoreB.berries,row.scoreB.berries);
 assert.equal(rounded(actual.scoreA.skills-actual.scoreA.directStrengthRoundingCorrection),row.scoreA.skills);
 assert.equal(rounded(actual.scoreB.skills-actual.scoreB.directStrengthRoundingCorrection),row.scoreB.skills);
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

test('R02 internal model flips at 0.75 to 1 even with 21 certain meals',()=>{
 for(const id of ['original-140','guaranteed-147','berry-only-147']){
  const s=r.scenarios.find(x=>x.id===id);
  assert.equal(s.includesModelRankReversal,true,id);
  assert.deepEqual(s.modelLeaders,['A','B']);
  const below=s.rates.find(x=>x.rateFactor===.75);
  const natural=s.rates.find(x=>x.rateFactor===1);
  assert.equal(below.modelLeader,'A',id);
  assert.equal(natural.modelLeader,'B',id);
  assert.ok(below.deltaBminusA<0&&natural.deltaBminusA>0,id);
  assert.equal(s.externalRankingValidated,false);
 }
 const pure=r.scenarios.find(x=>x.id==='berry-only-147');
 assert.equal(pure.rates.find(x=>x.rateFactor===1.5).modelLeader,'B');
 assert.equal(pure.rates.find(x=>x.rateFactor===2).modelLeader,'A');
 // A second sign reversal in the artificial no-food mode warns against
 // treating healer scaling as a monotonic or measured in-game confidence bound.
 assert.equal(r.rateFactorsAreMeasured,false);
});
test('CI-provenanced R02 sensitivity values are stable and not rank certification',()=>{
 const pinned=require('../docs/STEP2_M1_R02_SENSITIVITY_CI_BASELINE_20261018.json');
 assert.equal(pinned.ciProvenance.runId,39104258014);
 assert.equal(pinned.ciProvenance.tests,268);
 assert.equal(pinned.ciProvenance.failed,0);
 assert.equal(pinned.evidenceGrade,'C_INTERNAL_SENSITIVITY_NOT_GAME_REFERENCE');
 assert.equal(pinned.actualGameWeeksObserved,0);
 assert.equal(pinned.realGameRankingValidated,false);
 assert.equal(pinned.step2,'HOLD');
 // The archived snapshot remains byte-for-byte unchanged; reproduce it by
 // stripping ONLY the upstream-verified per-activation rounding contribution.
 const historical=JSON.parse(JSON.stringify(r.scenarios));
 for(const scenario of historical)for(const sample of scenario.rates){
  for(const key of ['scoreA','scoreB']){
   const score=sample[key],correction=score.directStrengthRoundingCorrection;
   score.total=rounded(score.total-correction);
   score.skills=rounded(score.skills-correction);
   delete score.directStrengthRoundingCorrection;
  }
  sample.deltaBminusA=rounded(sample.scoreB.total-sample.scoreA.total);
  sample.modelLeader=Math.abs(sample.deltaBminusA)<1e-8?'TIE':sample.deltaBminusA>0?'B':'A';
 }
 assert.deepEqual(historical,pinned.scenarios);
 assert.deepEqual(r.pairing,pinned.pairing);
});

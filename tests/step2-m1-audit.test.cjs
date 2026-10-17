'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildReport}=require('../scripts/step2-m1-audit.cjs');
const report=buildReport();
console.log('M1_REPORT_JSON='+JSON.stringify(report));
test('M1 benchmark matrix has exactly six deterministic, four probability and four mixed cases',()=>{
 assert.equal(report.matrix.length,14);
 assert.equal(report.counts.deterministic,6);
 assert.equal(report.counts.probability,4);
 assert.equal(report.counts.mixed,4);
 assert.equal(new Set(report.matrix.map(x=>x.id)).size,14);
 assert.deepEqual(report.matrix.map(x=>x.group).reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{}),
   {deterministic:6,probability:4,mixed:4});
});
test('independent controlled B references must agree numerically; C comparisons must not claim game accuracy',()=>{
 for(const row of report.matrix){
  assert.ok(Number.isFinite(row.simulated));
  if(row.evidenceGrade==='B'){
   assert.equal(row.disposition,'MATCH_CONTROLLED');
   assert.ok(Number.isFinite(row.reference));
   assert.ok(Math.abs(row.simulated-row.reference)<1e-6);
  }else{
   assert.equal(row.evidenceGrade,'C');
   assert.equal(row.reference,null);
   assert.equal(row.disposition,'UNVERIFIED_EXTERNAL');
   assert.equal(row.absoluteDifference,null);
  }
 }
});
test('five daylight lineup comparisons hold the fixed sleep squad and do not invent ranking validation',()=>{
 assert.equal(report.rankingComparisons.length,5);
 for(const row of report.rankingComparisons){
  assert.equal(row.evidenceGrade,'C');
  assert.equal(row.externalRankingValidated,false);
  assert.equal(row.conclusion,'UNVERIFIED_RANKING');
  assert.ok(Number.isFinite(row.scoreA.total)&&Number.isFinite(row.scoreB.total));
  assert.ok(Math.abs((row.scoreB.total-row.scoreA.total)-row.modelDeltaBminusA)<2e-6);
 }
});
test('M1 remains PARTIAL until real-game mixed and ranking evidence is obtained',()=>{
 assert.equal(report.gate.step2,'HOLD');
 assert.equal(report.gate.step3,'NOT_STARTED');
 assert.equal(report.gate.m1,'PARTIAL');
 assert.equal(report.counts.externallyVerifiedRankingPairs,0);
 assert.ok(report.gate.blockers.length>=3);
});


test('CI-sourced v0.2.30 numeric baseline is archived with honest evidence grades',()=>{
 const snapshot=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 assert.equal(snapshot.baselineVersion,'0.2.30');
 assert.equal(snapshot.counts.matrix,14);
 assert.equal(snapshot.counts.rankingPairs,5);
 assert.equal(snapshot.counts.referenceCompared,9);
 assert.equal(snapshot.counts.unverifiedCases,5);
 assert.equal(snapshot.counts.externallyVerifiedRankingPairs,0);
 assert.deepEqual(snapshot.matrix.map(x=>x.id),report.matrix.map(x=>x.id));
 assert.deepEqual(snapshot.rankingComparisons.map(x=>x.id),report.rankingComparisons.map(x=>x.id));
 assert.ok(snapshot.matrix.filter(x=>x.disposition==='MATCH_CONTROLLED')
  .every(x=>x.reference!==null&&Math.abs(x.simulated-x.reference)<1e-7));
 assert.ok(snapshot.rankingComparisons.every(x=>x.externalRankingValidated===false));
});

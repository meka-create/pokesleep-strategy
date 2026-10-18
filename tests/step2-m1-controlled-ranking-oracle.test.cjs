'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {controlledRankings}=require('../scripts/step2-m1-controlled-ranking-oracle.cjs');
const report=controlledRankings();
console.log('M1_CONTROLLED_RANKING_JSON='+JSON.stringify(report));
test('all six berry-only controlled rosters match independent one-minute totals',()=>{
 const keys=['allBerry','oneHealer','twoHealer','food','mixed','switching'];
 assert.deepEqual(Object.keys(report.results).sort(),keys.sort());
 for(const value of Object.values(report.results)){
  assert.equal(value.reference,value.simulated);
  assert.equal(value.difference,0);
  assert.ok(Number.isSafeInteger(value.reference)&&value.reference>0);
  assert.equal(Object.values(value.byId).reduce((n,x)=>n+x.energy,0),value.reference);
  assert.equal(Object.keys(value.byId).length,10);
 }
});
test('controlled versions of R01-R05 agree in sign and delta, without validating real ranks',()=>{
 assert.deepEqual(report.pairs.map(x=>x.id),['R01','R02','R03','R04','R05']);
 for(const row of report.pairs){
  assert.equal(row.controlledOrderingAgrees,true);
  assert.equal(row.referenceDeltaBminusA,row.modelDeltaBminusA);
  assert.equal(row.referenceLeader,row.modelLeader);
  assert.equal(row.originalStochasticRankingValidated,false);
 }
 assert.equal(report.grade,'B_CONTROLLED_BERRY_ONLY');
 assert.equal(report.actualGameWeeklyValidated,false);
 assert.equal(report.originalStochasticRankingPairsValidated,false);
 assert.equal(report.m1,'PARTIAL');
 assert.equal(report.step2,'HOLD');
 assert.equal(report.step3,'NOT_STARTED');
});
test('original M1 full-ingredient and skill rankings remain explicitly unverified',()=>{
 const snapshot=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 assert.equal(snapshot.counts.referenceCompared,9);
 assert.equal(snapshot.counts.unverifiedCases,5);
 assert.equal(snapshot.counts.externallyVerifiedRankingPairs,0);
 assert.ok(snapshot.rankingComparisons.every(x=>x.externalRankingValidated===false));
});

test('CI-provenanced controlled pair values are stable without certifying stochastic rankings',()=>{
 const reference=require('../docs/STEP2_M1_CONTROLLED_RANKING_BASELINE_20261018.json');
 assert.equal(reference.ciProvenance.runId,39082387457);
 assert.equal(reference.ciProvenance.testCount,257);
 assert.equal(reference.ciProvenance.failed,0);
 assert.equal(reference.actualGameWeeklyValidated,false);
 assert.equal(reference.originalStochasticRankingPairsValidated,false);
 for(const [k,v] of Object.entries(reference.results)){
  assert.equal(report.results[k].reference,v.reference,k);
  assert.equal(report.results[k].simulated,v.simulated,k);
  assert.equal(report.results[k].difference,v.difference,k);
 }
 assert.deepEqual(report.pairs.map(x=>[x.id,x.referenceDeltaBminusA,x.referenceLeader]),
  reference.pairs.map(x=>[x.id,x.referenceDeltaBminusA,x.referenceLeader]));
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {jointOracle}=require('../scripts/step2-m2-e4-joint-state-oracle.cjs');
const report=jointOracle();
console.log('M2_E4_JOINT_ORACLE_JSON='+JSON.stringify(report));
test('two-tap joint-state oracle conserves probability and independently matches 16 event sequences',()=>{
 assert.equal(report.cases.length,4);
 for(const c of report.cases){
  assert.equal(c.taps,2);assert.equal(c.minutesBetweenTaps,1);
  assert.ok(c.terminalStates.length>=1&&c.terminalStates.length<=16);
  const mass=c.terminalStates.reduce((s,r)=>s+r.probability,0);
  assert.ok(Math.abs(mass-1)<1e-8);
  assert.ok(c.terminalStates.every(x=>x.probability>=0&&Number(x.state.split(':')[0])<=150));
  assert.equal(c.observedGameRates,false);
  assert.equal(c.independentlyValidatedWeekRanking,false);
 }
 assert.equal(report.evidenceGrade,'B_CONTROLLED_EXHAUSTIVE_JOINT_STATE');
 assert.equal(report.productionModelFixed,false);
 assert.equal(report.ratesMeasuredInGame,false);
 assert.equal(report.weekErrorQuantified,false);
 assert.equal(report.step2,'HOLD');
 assert.equal(report.step3,'NOT_STARTED');
});
test('two taps verify nonlinear cap and timer correlations cannot be repaired by a single expectation',()=>{
 const c=report.cases.find(x=>x.id==='cap-and-timer');
 assert.equal(c.independentMeanEnergy,147.7725);
 assert.equal(c.collapsedModelEnergy,150);
 assert.equal(c.modelMinusOracle,2.2275);
 assert.deepEqual(c.terminalStates.map(x=>x.state),['139:1','150:1','150:2']);
 const never=report.cases.find(x=>x.id==='never');
 const certain=report.cases.find(x=>x.id==='certain');
 assert.equal(never.modelMinusOracle,0);
 assert.equal(certain.modelMinusOracle,0);
 const rare=report.cases.find(x=>x.id==='rare-timer');
 assert.ok(rare.modelMinusOracle>.8);
});

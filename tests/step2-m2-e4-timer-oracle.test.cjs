'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runTimerOracle}=require('../scripts/step2-m2-e4-timer-oracle.cjs');
const report=runTimerOracle();
console.log('M2_E4_TIMER_ORACLE_JSON='+JSON.stringify(report));
test('independent four-branch clock oracle measures rare activation timer reset bias',()=>{
 assert.equal(report.cases.length,5);
 const byId=Object.fromEntries(report.cases.map(x=>[x.id,x]));
 for(const c of report.cases){
  assert.ok(Number.isFinite(c.exactBranchMeanEnergy));
  assert.ok(Number.isFinite(c.collapsedModelEnergy));
  assert.equal(c.startMinutePhase,9);
  assert.equal(c.gameAccuracyValidated,false);
  assert.ok(c.modeledMinusBranchMean>=0);
 }
 assert.equal(byId.none.modeledMinusBranchMean,0);
 assert.equal(byId['rare-one'].modeledMinusBranchMean,.99);
 assert.equal(byId['rare-two'].modeledMinusBranchMean,.9801);
 assert.equal(byId['even-two'].modeledMinusBranchMean,.25);
 assert.equal(byId['certain-one'].modeledMinusBranchMean,0);
 assert.equal(report.ratesAreGameMeasurements,false);
 assert.equal(report.fullWeekErrorBoundKnown,false);
 assert.equal(report.step2,'HOLD');
 assert.equal(report.step3,'NOT_STARTED');
});

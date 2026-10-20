'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportBlockedReopen,enumeratePaths,modelHistory}=
 require('../scripts/step2-p04-block-reopen-oracle.cjs');
const report=reportBlockedReopen();
console.log('P04_BLOCK_REOPEN_JSON='+JSON.stringify(report));
test('independent six-slot full-bag -> reopen oracle matches stock/pity production distributions',()=>{
 assert.equal(report.results.length,5);
 assert.equal(report.grade,'B_CONTROLLED_ARTIFICIAL_BERNOULLI_PATHS');
 for(const row of report.results){
  assert.deepEqual(row.eligibleHelpsByPeriod,[2,2,0,2]);
  assert.equal(row.activationsDuringFullBag,0);
  assert.equal(row.maximumInternalDifference,0);
  assert.equal(row.referenceProbabilityMass,1);
  assert.ok(row.pathCount>=1&&row.pathCount<=64);
  assert.equal(row.stateProbabilities.length,4);
  for(const checkpoint of row.stateProbabilities){
   const mass=checkpoint.states.reduce((sum,s)=>sum+s.probability,0);
   assert.ok(Math.abs(mass-1)<1e-8,row.id+': '+checkpoint.phase);
  }
  assert.equal(row.actualGameWaitingStockValidated,false);
  assert.ok(row.expectedReleaseWhenBagOpens>=0);
  assert.ok(row.expectedReleaseOnNextOpenTap>=0);
 }
});
test('blocked taps retain ready skill stock; cooking-created free space releases once without new help',()=>{
 const capped=report.results.find(x=>x.id==='cap-one-late-pity');
 assert.equal(capped.expectedReleaseWhenBagOpens,0.68359375);
 assert.equal(capped.stateProbabilities[2].states.every(x=>x.state.startsWith('0:')),true);
 const initial=report.results.find(x=>x.id==='certain-procs');
 assert.equal(initial.expectedReleaseWhenBagOpens,1);
 assert.equal(initial.expectedReleaseOnNextOpenTap,1);
 const never=report.results.find(x=>x.id==='no-activations');
 assert.equal(never.expectedReleaseWhenBagOpens,0);
 assert.equal(never.expectedReleaseOnNextOpenTap,0);
 // Check that the release DOES NOT erase consecutive failures/pity history.
 const s={id:'pity-persistence',rate:.25,threshold:3,cap:2};
 const oracle=enumeratePaths(s),model=modelHistory(s);
 const before=oracle.checkpoints[1],after=oracle.checkpoints[2];
 const missMarginal=(dist,miss)=>[...dist].reduce((sum,[key,p])=>
  sum+(Number(key.split(':')[1])===miss?p:0),0);
 for(let misses=0;misses<s.threshold;misses++)
  assert.ok(Math.abs(missMarginal(before,misses)-missMarginal(after,misses))<1e-12);
 assert.ok(Math.abs(oracle.firstRelease-model.firstRelease)<1e-11);
});
test('controlled P04 cannot be used to approve real-game queued skill rules or mixed-team ranking',()=>{
 assert.equal(report.p04OriginalFullWeekUnchanged,true);
 assert.equal(report.waitingStockGameRulesVerified,false);
 assert.equal(report.actualGameRatesMeasured,false);
 assert.equal(report.mixedWeeklyEnergyVerified,false);
 assert.equal(report.originalFiveRanksVerified,0);
 for(const key of ['m1','m2','m3'])assert.equal(report[key],'PARTIAL');
 assert.equal(report.m4,'NOT_STARTED');
 assert.equal(report.step2,'HOLD');
 assert.equal(report.step3,'NOT_STARTED');
});

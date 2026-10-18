'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportStockAndPity}=require('../scripts/step2-m2-e4-stock-pity-oracle.cjs');
const report=reportStockAndPity();
console.log('M2_E4_STOCK_PITY_JSON='+JSON.stringify(report));
test('two-tap joint skill stock pity Energy and timer probabilities reconcile',()=>{
 assert.equal(report.cases.length,6);
 for(const row of report.cases){
  assert.equal(row.eligibleHelpsPerTap,2);
  assert.equal(row.taps,2);
  assert.ok(row.terminalStates.length>0&&row.terminalStates.length<=16);
  assert.ok(Math.abs(row.terminalStates.reduce((s,r)=>s+r.mass,0)-1)<1e-8);
  assert.ok(row.terminalStates.every(x=>x.mass>=0));
  assert.ok(row.terminalStates.every(x=>x.state.split(':').length===5));
  assert.ok(Math.abs(row.expectedActualActivations-row.collapsedExpectedActivations)<1e-9);
  assert.equal(row.realGameMeasurements,false);
  assert.equal(row.weekRankValidated,false);
  assert.ok(Number.isFinite(row.exactMeanEnergy));
  assert.ok(Number.isFinite(row.modelMinusExact));
 }
 assert.equal(report.evidence,'B_ARTIFICIAL_EXHAUSTIVE_STOCK_PITY_ENERGY_CLOCK');
 assert.equal(report.ratesMeasured,false);
 assert.equal(report.gameErrorQuantified,false);
 assert.equal(report.step2,'HOLD');
 assert.equal(report.step3,'NOT_STARTED');
});
test('guaranteed and never skill rolls do not fabricate differences',()=>{
 const never=report.cases.find(x=>x.id==='no-procs');
 assert.equal(never.expectedActualActivations,0);
 assert.equal(never.exactMeanEnergy,139);
 assert.equal(never.collapsedModelEnergy,139);
 assert.equal(never.modelMinusExact,0);
 const certain=report.cases.find(x=>x.id==='all-procs');
 assert.equal(certain.expectedActualActivations,2);
 assert.equal(certain.exactMeanEnergy,150);
 assert.equal(certain.modelMinusExact,0);
});
test('stock and pity are verified as causal history, not independent marginals',()=>{
 const capped=report.cases.find(x=>x.id==='stochastic-cap');
 const twoStock=report.cases.find(x=>x.id==='stochastic-two-stock');
 const pity=report.cases.find(x=>x.id==='guaranteed-pity');
 assert.equal(capped.skillStockCap,1);
 assert.equal(twoStock.skillStockCap,2);
 assert.equal(pity.pityThreshold,3);
 assert.ok(capped.expectedActualActivations>0);
 assert.ok(twoStock.expectedActualActivations>0);
 assert.ok(pity.expectedActualActivations>0);
 assert.ok(pity.terminalStates.some(x=>Number(x.state.split(':')[2])>0));
 assert.ok(capped.terminalStates.some(x=>Number(x.state.split(':')[4])>0));
 assert.equal(report.m1,'PARTIAL');
 assert.equal(report.m2,'PARTIAL');
});

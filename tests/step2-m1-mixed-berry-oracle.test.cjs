'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildControlledReport}=require('../scripts/step2-m1-mixed-berry-oracle.cjs');
const r=buildControlledReport();
console.log('M1_CONTROLLED_JSON='+JSON.stringify(r));
test('mixed species independent one-minute controlled oracle matches berry-only week',()=>{
 assert.equal(r.cases.length,2);
 assert.equal(r.grade,'B_CONTROLLED_ONLY');
 for(const c of r.cases){
  assert.equal(c.absoluteDifference,0);
  assert.equal(c.expected,c.observed);
  assert.ok(c.expected>0&&Number.isInteger(c.expected));
  const pieces=Object.values(c.bySpecies);
  assert.equal(pieces.length,7);
  assert.equal(pieces.reduce((n,s)=>n+s.energy,0),c.expected);
  assert.ok(pieces.every(s=>Number.isInteger(s.completedHelps)&&s.completedHelps>=0));
 }
});
test('fixed and rotating controlled cases do not claim real-game mixed accuracy',()=>{
 assert.equal(r.actualGameWeeklyValidated,false);
 assert.equal(r.fullStochasticTeamComparisonValidated,false);
 assert.equal(r.step2,'HOLD');
 assert.equal(r.cases[0].rotates,false);
 assert.equal(r.cases[1].rotates,true);
 assert.ok(r.cases[1].bySpecies.p5.completedHelps>0);
 assert.ok(r.cases[1].bySpecies.p6.completedHelps>0);
 assert.equal(r.cases[0].bySpecies.p5.completedHelps,0);
 assert.equal(r.cases[0].bySpecies.p6.completedHelps,0);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportFivePairs}=require('../scripts/step2-m1-five-ranking-sensitivity.cjs');
const r=reportFivePairs();
console.log('M1_FIVE_RANKINGS_JSON='+JSON.stringify(r));
test('current five-pair scores keep frozen names and never claim externally validated rank',()=>{
 const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 assert.equal(r.cases.length,2);
 for(const mode of r.cases){
  assert.deepEqual(mode.comparisons.map(x=>x.id),['R01','R02','R03','R04','R05']);
  assert.deepEqual(mode.factors.map(x=>x.rateFactor),[.75,1]);
  for(const comp of mode.comparisons){
   const natural=mode.factors[1].pairs.find(x=>x.id===comp.id);
   assert.equal(natural.deltaBminusA,comp.at1);
   assert.equal(natural.modelLeader,comp.leaderAt1);
   assert.equal(comp.externallyValidated,false);
   const historical=frozen.rankingComparisons.find(x=>x.id===comp.id);
   assert.ok(historical&&Number.isFinite(historical.modelDeltaBminusA));
  }
 }
 assert.equal(r.actualGameRanksValidated,0);
 assert.equal(r.measuredSkillRateUncertainty,false);
 assert.equal(r.probabilitiesOfRankingErrorsEstimated,false);
});

test('all-five sensitivity tracks current changes without trusting archived rank flips',()=>{
 for(const mode of r.cases){
  const detected=mode.comparisons.filter(x=>x.modelLeaderChanges).map(x=>x.id);
  assert.deepEqual(mode.changedModelLeaders,detected);
  for(const c of mode.comparisons){
   assert.equal(c.triage,c.modelLeaderChanges?'P1_PRIORITY_VERIFY_SKILL_EVENTS':'UNVERIFIED_GAME_RANK');
   assert.equal(c.externallyValidated,false);
   assert.ok(['A','B','TIE'].includes(c.leaderAt075));
   assert.ok(['A','B','TIE'].includes(c.leaderAt1));
  }
  if(mode.apples===147)
   assert.ok(mode.factors.every(x=>Object.values(x.outputs)
    .every(y=>y.estimatedMeals===0&&y.meals===21)));
 }
 assert.equal(r.evidenceGrade,'C_INTERNAL_MODEL_SENSITIVITY');
 assert.equal(r.step2,'HOLD');assert.equal(r.m1,'PARTIAL');
 assert.equal(r.step3,'NOT_STARTED');
});

test('2026-10-18 archived C-grade sensitivity stays immutable, not current output',()=>{
 const snapshot=require('../docs/STEP2_M1_ALL_FIVE_RANKINGS_CI_BASELINE_20261018.json');
 assert.equal(snapshot.ciProvenance.runId,39105063029);
 assert.equal(snapshot.ciProvenance.tests,272);
 assert.equal(snapshot.ciProvenance.failed,0);
 assert.equal(snapshot.evidenceGrade,'C_INTERNAL_MODEL_SENSITIVITY');
 assert.equal(snapshot.actualGameRanksValidated,0);
 assert.equal(snapshot.measuredSkillRateUncertainty,false);
 assert.equal(snapshot.probabilitiesOfRankingErrorsEstimated,false);
 assert.deepEqual(snapshot.cases.map(x=>x.id),r.cases.map(x=>x.id));
 assert.equal(r.step2,'HOLD');
 assert.equal(r.step3,'NOT_STARTED');
});

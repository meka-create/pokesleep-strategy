'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportFivePairs}=require('../scripts/step2-m1-five-ranking-sensitivity.cjs');
const r=reportFivePairs();
console.log('M1_FIVE_RANKINGS_JSON='+JSON.stringify(r));
test('all five pair baselines reproduce frozen mixed-week leaderboard at natural rates',()=>{
 const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
 assert.equal(r.cases.length,2);
 for(const mode of r.cases){
  assert.deepEqual(mode.comparisons.map(x=>x.id),['R01','R02','R03','R04','R05']);
  assert.deepEqual(mode.factors.map(x=>x.rateFactor),[.75,1]);
  assert.equal(mode.comparisons.length,5);
  for(const comp of mode.comparisons){
   const natural=mode.factors[1].pairs.find(x=>x.id===comp.id);
   assert.equal(natural.deltaBminusA,comp.at1);
   assert.equal(natural.modelLeader,comp.leaderAt1);
   assert.equal(comp.externallyValidated,false);
   if(mode.id==='original-140'){
    const ref=frozen.rankingComparisons.find(x=>x.id===comp.id);
    assert.equal(comp.at1,ref.modelDeltaBminusA);
    assert.equal(comp.leaderAt1,ref.modelLeader);
   }
  }
 }
 assert.equal(r.actualGameRanksValidated,0);
 assert.equal(r.measuredSkillRateUncertainty,false);
 assert.equal(r.probabilitiesOfRankingErrorsEstimated,false);
});
test('all-five sensitivity identifies R02 as internally assumption-dependent without certifying ranks',()=>{
 for(const mode of r.cases){
  const r02=mode.comparisons.find(x=>x.id==='R02');
  assert.equal(r02.leaderAt075,'A');
  assert.equal(r02.leaderAt1,'B');
  assert.equal(r02.modelLeaderChanges,true);
  assert.equal(r02.triage,'P1_PRIORITY_VERIFY_SKILL_EVENTS');
  assert.ok(mode.changedModelLeaders.includes('R02'));
  for(const c of mode.comparisons){
   assert.equal(c.triage,c.modelLeaderChanges?'P1_PRIORITY_VERIFY_SKILL_EVENTS':'UNVERIFIED_GAME_RANK');
  }
  if(mode.apples===147)
   assert.ok(mode.factors.every(x=>Object.values(x.outputs)
    .every(y=>y.estimatedMeals===0&&y.meals===21)));
 }
 assert.equal(r.evidenceGrade,'C_INTERNAL_MODEL_SENSITIVITY');
 assert.equal(r.step2,'HOLD');assert.equal(r.m1,'PARTIAL');
 assert.equal(r.step3,'NOT_STARTED');
});

test('CI observed only R02 rank flip under this two-factor sweep; other pairs remain UNVERIFIED',()=>{
 for(const mode of r.cases){
  assert.deepEqual(mode.changedModelLeaders,['R02']);
  assert.equal(mode.comparisons.find(x=>x.id==='R02').triage,'P1_PRIORITY_VERIFY_SKILL_EVENTS');
  for(const other of mode.comparisons.filter(x=>x.id!=='R02')){
   assert.equal(other.modelLeaderChanges,false);
   assert.equal(other.externallyValidated,false);
   assert.equal(other.triage,'UNVERIFIED_GAME_RANK');
  }
 }
});
test('CI-provenanced five-pair ranks remain an internal model baseline, not accuracy evidence',()=>{
 const snapshot=require('../docs/STEP2_M1_ALL_FIVE_RANKINGS_CI_BASELINE_20261018.json');
 assert.equal(snapshot.ciProvenance.runId,39105063029);
 assert.equal(snapshot.ciProvenance.tests,272);
 assert.equal(snapshot.ciProvenance.failed,0);
 assert.equal(snapshot.evidenceGrade,'C_INTERNAL_MODEL_SENSITIVITY');
 assert.equal(snapshot.actualGameRanksValidated,0);
 assert.equal(snapshot.measuredSkillRateUncertainty,false);
 assert.equal(snapshot.probabilitiesOfRankingErrorsEstimated,false);
 assert.deepEqual(r.cases,snapshot.cases);
 assert.equal(r.step2,'HOLD');
 assert.equal(r.step3,'NOT_STARTED');
});

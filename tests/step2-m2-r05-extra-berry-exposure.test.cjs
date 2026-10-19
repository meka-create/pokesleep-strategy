'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {report}=require('../scripts/step2-m2-r05-extra-berry-exposure.cjs');
const r=report();
console.log('STEP2_M2_R05_EXTRA_BERRY_EXPOSURE_JSON='+JSON.stringify(r));
test('frozen R05 has no extra-help-generating skills, so previous queue warning does not calibrate R05',()=>{
 const ref=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json')
  .rankingComparisons.find(x=>x.id==='R05');
 assert.equal(r.frozenOriginalR05.deltaBminusA,ref.modelDeltaBminusA);
 assert.equal(r.frozenOriginalR05.modelLeader,ref.modelLeader);
 assert.equal(r.frozenOriginalR05.originalRosterHasExtraHelp,false);
 assert.equal(r.frozenOriginalR05.generatingExtraHelp,false);
 assert.equal(r.genuineR05RankingValidated,false);
});
test('R05-shaped EXTRA-help roster has measurable discarded berries but not proof of recoverability',()=>{
 const case1=r.controlledAlternative;
 assert.ok(case1.fixed.extraHelps>0);
 assert.ok(case1.rotating.extraHelps>0);
 assert.ok(case1.rotating.uncollectedExtraHelpItemsAtSwap>0);
 assert.ok(case1.rotating.uncollectedExtraHelpBerryEnergyAtSwap>0);
 for(const x of [case1.fixed,case1.rotating]){
  assert.ok(x.uncollectedExtraHelpItemsAtSwap>=0);
  assert.ok(x.uncollectedExtraHelpBerryEnergyAtSwap>=0);
  assert.ok(x.pendingExtraHelpBerryEnergy>=0);
 }
 assert.equal(case1.replaysCollectOrTeamSwitch,false);
 assert.equal(case1.recoversFood,false);
 assert.equal(case1.recomputesCooking,false);
 assert.equal(case1.recomputesSkills,false);
 assert.equal(case1.representsPlayableWeek,false);
 assert.equal(case1.externalRankingValidated,false);
});
test('berry-only accounting delta is the algebraic independent lost-energy difference, not rerun weekly accuracy',()=>{
 const c=r.controlledAlternative;
 const round=n=>Math.round(n*1e6)/1e6;
 assert.ok(Math.abs((c.rotating.uncollectedExtraHelpBerryEnergyAtSwap-
   c.fixed.uncollectedExtraHelpBerryEnergyAtSwap)-c.deltaFromUncollectedBerryEnergy)<1e-5);
 assert.ok(Math.abs((c.modeledDeltaBminusA+c.deltaFromUncollectedBerryEnergy)-
  c.accountingOnlyDeltaBminusA)<1e-5);
 assert.equal(c.modeledLeader,Math.abs(c.modeledDeltaBminusA)<1e-8?'TIE':c.modeledDeltaBminusA>0?'B':'A');
 assert.equal(c.accountingOnlyLeader,Math.abs(c.accountingOnlyDeltaBminusA)<1e-8?'TIE':
  c.accountingOnlyDeltaBminusA>0?'B':'A');
 assert.equal(r.evidenceGrade,'C_INTERNAL_ACCOUNTING_COUNTERFACTUAL');
 assert.equal(r.actualGameWeeksObserved,0);
 assert.equal(r.experimentalAlternativeRankingValidated,false);
 assert.equal(r.probabilityOfRankInversionKnown,false);
 assert.equal(r.step2,'HOLD');assert.equal(r.step3,'NOT_STARTED');
});

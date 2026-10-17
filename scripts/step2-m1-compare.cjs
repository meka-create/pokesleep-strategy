'use strict';
// Compare an evolving STEP2 model against the CI-verified v0.2.30 M1 snapshot.
// This is a CHANGE REPORT, not a verification that the changed values are
// closer to Pokémon Sleep. Independently validated outcomes are a separate gate.
const baseline=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
const {buildReport}=require('./step2-m1-audit.cjs');
function compare(current=buildReport()){
 const oldRows=new Map(baseline.matrix.map(x=>[x.id,x]));
 const matrix=current.matrix.map(row=>{
  const old=oldRows.get(row.id);
  if(!old)throw Error('M1 benchmark row missing from v0.2.30 baseline: '+row.id);
  return {id:row.id,group:row.group,evidenceGrade:row.evidenceGrade,
    baseline:old.simulated,current:row.simulated,modelChange:Math.round((row.simulated-old.simulated)*1e6)/1e6,
    independentReference:row.reference,independentlyValidated:row.evidenceGrade==='B'&&row.disposition==='MATCH_CONTROLLED'};
 });
 const oldPairs=new Map(baseline.rankingComparisons.map(x=>[x.id,x]));
 const rankingComparisons=current.rankingComparisons.map(row=>{
  const old=oldPairs.get(row.id);if(!old)throw Error('M1 ranking pair missing: '+row.id);
  return {id:row.id,baselineModelDelta:old.modelDeltaBminusA,
    currentModelDelta:row.modelDeltaBminusA,changedModelLeader:old.modelLeader!==row.modelLeader,
    independentRankingValidated:false};
 });
 return {baselineVersion:baseline.baselineVersion,currentCodeVersion:current.baselineVersion,
  purpose:'MODEL_CHANGE_DETECTION_ONLY',
  note:'A smaller model difference does not imply improved game accuracy. For five rankings, external ordering validation remains required.',
  matrix,rankingComparisons};
}
if(require.main===module)console.log(JSON.stringify(compare(),null,2));
module.exports={compare};

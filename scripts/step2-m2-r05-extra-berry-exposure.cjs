'use strict';
/* Controlled accounting-only R05-shaped sensitivity.
 * Not a model option, not a gameplay collection policy, not evidence of a
 * correct ordering: never credit uncollected items in the real model.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box=vm.createContext({module:{exports:{}},globalThis:{}});
for(const f of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../src',f),'utf8'),box,{filename:f});
const master=box.globalThis.PokeMaster,sim=box.globalThis.PokeSimulator;
const {fixture}=require('./step2-m1-five-ranking-sensitivity.cjs');
const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
const round=n=>Math.round(n*1e6)/1e6;
const leader=n=>Math.abs(n)<1e-8?'TIE':n>0?'B':'A';
function score(result){
 return {total:round(result.total),berries:round(result.berries),
  uncollectedExtraHelpItemsAtSwap:round(result.uncollectedExtraHelpItemsAtSwap),
  uncollectedExtraHelpBerryEnergyAtSwap:round(result.uncollectedExtraHelpBerryEnergyAtSwap),
  pendingExtraHelpBerryEnergy:round(result.pendingExtraHelpBerryEnergy),
  extraHelps:round(result.extraHelps),directStrengthRoundingCorrection:round(result.directStrengthRoundingCorrection)};
}
function extraFixture(name){
 const input=fixture(name,140);
 const species=master.species.find(s=>s.skill==='Extra Helpful S');
 assert.ok(species,'Controlled extra help species absent');
 const p=input.box.find(x=>x.id==='w0');
 assert.ok(p);
 p.pokemon=species.name;
 p.ingredients=[1,2,3].map(i=>{
  const selected=(species.mythIng||species.ings).find(s=>s&&s['c'+i]>0);
  return selected?master.ingredients[selected.name]:'';
 });
 return input;
}
function report(){
 const row=frozen.rankingComparisons.find(x=>x.id==='R05');
 assert.ok(row);
 const originalA=sim.simulate(fixture('oneHealer',140));
 const originalB=sim.simulate(fixture('switching',140));
 // The source v0.2.30 R05 scores are a frozen archival comparison.
 // Current engine scores include later full-pocket skill-roll rules; do not
 // pretend subtracting the unrelated rounding correction recreates v0.2.30.
 assert.ok(Number.isFinite(originalA.total)&&Number.isFinite(originalB.total));
 // The historical R05 roster has NO extra-help generating skill at all.
 for(const result of [originalA,originalB]){
  assert.equal(result.extraHelps,0);
  assert.equal(result.uncollectedExtraHelpItemsAtSwap,0);
  assert.equal(result.uncollectedExtraHelpBerryEnergyAtSwap,0);
 }
 const a=sim.simulate(extraFixture('oneHealer'));
 const b=sim.simulate(extraFixture('switching'));
 const modeledDelta=b.total-a.total;
 const berryOnlyDelta=(b.total+b.uncollectedExtraHelpBerryEnergyAtSwap)-
                      (a.total+a.uncollectedExtraHelpBerryEnergyAtSwap);
 return {
  schema:'step2-m2-r05-extra-help-berry-exposure-v1',
  frozenOriginalR05:{
   deltaBminusA:row.modelDeltaBminusA,
   modelLeader:row.modelLeader,
   generatingExtraHelp:false,
   originalRosterHasExtraHelp:false
  },
  controlledAlternative:{
   description:'Replace w0 (healer) with one species carrying Extra Helpful S in BOTH fixtures; no other config change',
   fixed:score(a),rotating:score(b),
   modeledDeltaBminusA:round(modeledDelta),
   modeledLeader:leader(modeledDelta),
   // Add back ONLY the berries from the already tracked dropped queues,
   // holding all other model state and energy calculations fixed. This is
   // NOT a second feasible collection path or a bound on game total energy.
   accountingOnlyDeltaBminusA:round(berryOnlyDelta),
   accountingOnlyLeader:leader(berryOnlyDelta),
   deltaFromUncollectedBerryEnergy:round(b.uncollectedExtraHelpBerryEnergyAtSwap-a.uncollectedExtraHelpBerryEnergyAtSwap),
   recoversFood:false,recomputesSkills:false,recomputesCooking:false,
   replaysCollectOrTeamSwitch:false,
   representsPlayableWeek:false,externalRankingValidated:false
  },
  evidenceGrade:'C_INTERNAL_ACCOUNTING_COUNTERFACTUAL',
  actualGameWeeksObserved:0,
  genuineR05RankingValidated:false,
  experimentalAlternativeRankingValidated:false,
  probabilityOfRankInversionKnown:false,
  step2:'HOLD',step3:'NOT_STARTED'
 };
}
if(require.main===module)console.log('STEP2_M2_EXTRA_QUEUE_EXPOSURE_JSON='+JSON.stringify(report()));
module.exports={report,extraFixture};

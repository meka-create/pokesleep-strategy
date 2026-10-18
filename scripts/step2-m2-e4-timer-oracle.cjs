'use strict';
/* Artificial one-minute finite 2-healer oracle. A local conditional
 * counterexample, NOT game proc rates or a certified full-week error bound.
 * Branch reference never calls simulator's Energy helpers.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context,{filename:file});
const sim=context.globalThis.PokeSimulator;
const controls=[
 {id:'none',p:0,q:0},
 {id:'rare-one',p:.01,q:0},
 {id:'rare-two',p:.01,q:.01},
 {id:'even-two',p:.5,q:.5},
 {id:'certain-one',p:1,q:0}
];
function exactBranchMinute(initialEnergy,initialPhase,heal,p,q){
 let total=0,probability=0;
 for(const a of [0,1])for(const b of [0,1]){
  const weight=(a?p:1-p)*(b?q:1-q);
  if(weight===0)continue;
  let e=initialEnergy,phase=initialPhase;
  for(const active of [a,b])if(active){
   const next=Math.min(150,e+heal);
   if(next>e)phase=0;
   e=next;
  }
  phase++;
  if(phase>=10){e=Math.max(0,e-1);phase-=10;}
  total+=weight*e;probability+=weight;
 }
 assert.ok(Math.abs(probability-1)<1e-12);
 return total;
}
function collapsedSimulatorMinute(initialEnergy,initialPhase,heal,p,q){
 const energies=new Map([['receiver',initialEnergy]]);
 const phases=new Map([['receiver',initialPhase]]);
 for(const probability of [p,q])
  sim.applyEnergyRecovery(energies,phases,'receiver',
   Math.min(150,energies.get('receiver')+probability*heal));
 const after=sim.advanceEnergyTimer(energies.get('receiver'),phases.get('receiver'),1);
 return {energy:after.energy,phase:after.phase};
}
function runTimerOracle(){
 const cases=controls.map(control=>{
  const initialEnergy=100,initialPhase=9,heal=18;
  const exact=exactBranchMinute(initialEnergy,initialPhase,heal,control.p,control.q);
  const collapsed=collapsedSimulatorMinute(initialEnergy,initialPhase,heal,control.p,control.q);
  const gap=collapsed.energy-exact;
  const referenceGap=control.p+control.q===0?0:(1-control.p)*(1-control.q);
  // In this no-cap scenario the only bias is unconditional resetting of
  // the Energy decay clock when mean healing is positive.
  assert.ok(Math.abs(gap-referenceGap)<1e-9,control.id+' independent difference');
  return {id:control.id,skillProcProbabilities:[control.p,control.q],
   startEnergy:initialEnergy,startMinutePhase:initialPhase,
   healPerProc:heal,minutesAfterTap:1,
   exactBranchMeanEnergy:Math.round(exact*1e9)/1e9,
   collapsedModelEnergy:Math.round(collapsed.energy*1e9)/1e9,
   modeledMinusBranchMean:Math.round(gap*1e9)/1e9,
   gameAccuracyValidated:false};
 });
 return {schema:'step2-m2-two-healer-energy-decay-timer-oracle-v1',
  evidence:'B_ARTIFICIAL_EXHAUSTIVE_BERNOULLI_BRANCHES',
  reference:'explicit four-branch healing outcomes and independent one-minute decay',
  ratesAreGameMeasurements:false,fullWeekErrorBoundKnown:false,
  step2:'HOLD',step3:'NOT_STARTED',cases};
}
if(require.main===module)
 console.log('M2_E4_TIMER_ORACLE_JSON='+JSON.stringify(runTimerOracle()));
module.exports={runTimerOracle};

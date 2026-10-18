'use strict';
/* Two-tap joint Energy/decay-phase finite-state oracle.
 * All rates and event times below are ARTIFICIAL. Not a game simulator.
 * The DP and brute paths enumerate branches separately, without using
 * production Energy helpers; production mean-field model is ONLY compared.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const vmctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const p of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',p),'utf8'),vmctx,{filename:p});
const simulator=vmctx.globalThis.PokeSimulator;
const scenarios=[
 {id:'cap-and-timer',energy:140,phase:9,heal:18,p:.4,q:.25,taps:2,minutesBetween:1},
 {id:'rare-timer',energy:100,phase:9,heal:18,p:.01,q:.01,taps:2,minutesBetween:1},
 {id:'never',energy:140,phase:9,heal:18,p:0,q:0,taps:2,minutesBetween:1},
 {id:'certain',energy:140,phase:9,heal:18,p:1,q:0,taps:2,minutesBetween:1}
];
const rounded=x=>Math.round(x*1e9)/1e9;
const sumStates=d=>[...d.values()].reduce((n,v)=>n+v,0);
function finiteStateDynamic(s){
 let state=new Map([[s.energy+':'+s.phase,1]]);
 for(let tap=0;tap<s.taps;tap++){
  const next=new Map();
  for(const [key,mass] of state){
   const [startingEnergy,startingPhase]=key.split(':').map(Number);
   for(let x=0;x<=1;x++)for(let y=0;y<=1;y++){
    const probability=mass*(x?s.p:1-s.p)*(y?s.q:1-s.q);
    if(!probability)continue;
    let energy=startingEnergy,phase=startingPhase;
    for(const active of [x,y]){
     if(active){
      const healed=Math.min(150,energy+s.heal);
      if(healed>energy)phase=0;
      energy=healed;
     }
    }
    for(let minute=0;minute<s.minutesBetween;minute++){
     phase+=1;
     if(phase===10){phase=0;energy=Math.max(0,energy-1);}
    }
    const dest=energy+':'+phase;
    next.set(dest,(next.get(dest)||0)+probability);
   }
  }
  state=next;
  assert.ok(Math.abs(sumStates(state)-1)<1e-12);
 }
 return state;
}
function exhaustiveSequence(s){
 const results=new Map();
 const possible=2**(2*s.taps);
 for(let mask=0;mask<possible;mask++){
  let chance=1,e=s.energy,t=s.phase;
  for(let step=0;step<s.taps;step++){
   for(let h=0;h<2;h++){
    const activated=(mask&(1<<(2*step+h)))!==0;
    const p=h===0?s.p:s.q;
    chance*=activated?p:1-p;
    if(activated){
     const newEnergy=Math.min(150,e+s.heal);
     if(newEnergy>e)t=0;
     e=newEnergy;
    }
   }
   const remaining=t+s.minutesBetween;
   e=Math.max(0,e-Math.floor(remaining/10));
   t=remaining%10;
  }
  if(chance===0)continue;
  const key=e+':'+t;
  results.set(key,(results.get(key)||0)+chance);
 }
 return results;
}
function collapsed(s){
 const e=new Map([['target',s.energy]]),timers=new Map([['target',s.phase]]);
 for(let step=0;step<s.taps;step++){
  for(const p of [s.p,s.q])
   simulator.applyEnergyRecovery(e,timers,'target',
    Math.min(150,e.get('target')+p*s.heal));
  const next=simulator.advanceEnergyTimer(e.get('target'),timers.get('target'),
   s.minutesBetween);
  e.set('target',next.energy);timers.set('target',next.phase);
 }
 return {energy:e.get('target'),phase:timers.get('target')};
}
function jointOracle(){
 const cases=scenarios.map(s=>{
  const dp=finiteStateDynamic(s),brute=exhaustiveSequence(s);
  assert.ok(Math.abs(sumStates(brute)-1)<1e-12);
  assert.deepEqual([...dp].sort(),[...brute].sort(),
   s.id+' independent enumerate vs state propagation');
  const exact=[...dp].reduce((n,[key,p])=>n+Number(key.split(':')[0])*p,0);
  const modeled=collapsed(s),difference=modeled.energy-exact;
  return {id:s.id,initialEnergy:s.energy,initialMinutePhase:s.phase,
   artificialProcRates:[s.p,s.q],heal:s.heal,taps:s.taps,
   minutesBetweenTaps:s.minutesBetween,
   terminalStates:[...dp].sort().map(([key,p])=>({state:key,probability:rounded(p)})),
   independentMeanEnergy:rounded(exact),
   collapsedModelEnergy:rounded(modeled.energy),modelMinusOracle:rounded(difference),
   observedGameRates:false,independentlyValidatedWeekRanking:false};
 });
 return {schema:'step2-m2-e4-two-tap-joint-energy-clock-v1',
  evidenceGrade:'B_CONTROLLED_EXHAUSTIVE_JOINT_STATE',
  productionModelFixed:false,step2:'HOLD',m2:'PARTIAL',
  step3:'NOT_STARTED',ratesMeasuredInGame:false,weekErrorQuantified:false,cases};
}
if(require.main===module)
 console.log('M2_E4_JOINT_ORACLE_JSON='+JSON.stringify(jointOracle()));
module.exports={jointOracle};

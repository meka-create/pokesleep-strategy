'use strict';
/* B-grade controlled finite-state E4 oracle.
 * One artificial skill user; exactly two eligible completed helps before
 * each of two collections. State carries Energy, 10-minute decay phase,
 * consecutive failures, queued stock and cumulative fired procs.
 * All rates artificial; this does not model actual in-game help timing.
 * The independent paths DO NOT reuse production helper functions.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx,{filename:file});
const sim=ctx.globalThis.PokeSimulator;
const scenarios=[
 {id:'stochastic-cap',energy:140,phase:9,rate:.2,threshold:5,cap:1,heal:18},
 {id:'stochastic-two-stock',energy:100,phase:9,rate:.25,threshold:5,cap:2,heal:18},
 {id:'guaranteed-pity',energy:135,phase:9,rate:.2,threshold:3,cap:1,heal:18},
 {id:'no-procs',energy:140,phase:9,rate:0,threshold:5,cap:1,heal:18},
 {id:'all-procs',energy:140,phase:9,rate:1,threshold:5,cap:1,heal:18},
 {id:'threshold-one',energy:100,phase:9,rate:.25,threshold:1,cap:2,heal:18}
];
const eligibleHelpsPerTap=2,taps=2,minutesBetween=1;
const stateKey=(s)=>[s.energy,s.phase,s.misses,s.stock,s.fired].join(':');
const stateFromKey=(s)=>{const [energy,phase,misses,stock,fired]=s.split(':').map(Number);return {energy,phase,misses,stock,fired};};
const round=v=>{const n=Math.round(v*1e10)/1e10;return Object.is(n,-0)?0:n;};
const totalMass=dist=>[...dist.values()].reduce((a,b)=>a+b,0);

function dynamicProgramming(s){
 let state=new Map([[stateKey({energy:s.energy,phase:s.phase,misses:0,stock:0,fired:0}),1]]);
 for(let tap=0;tap<taps;tap++){
  for(let help=0;help<eligibleHelpsPerTap;help++){
   const next=new Map();
   for(const [key,mass] of state){
    const old=stateFromKey(key);
    const successChance=old.stock===s.cap||s.rate===0?0:
      old.misses===s.threshold-1?1:s.rate;
    for(const successful of [false,true]){
     const p=successful?successChance:1-successChance;
     if(!p)continue;
     const changed={...old};
     if(old.stock===s.cap||s.rate===0){} // do not roll at capacity or zero rate
     else if(successful){changed.stock++;changed.misses=0;}
     else changed.misses++;
     const name=stateKey(changed);
     next.set(name,(next.get(name)||0)+mass*p);
    }
   }
   state=next;
  }
  const after=new Map();
  for(const [key,mass] of state){
   const v=stateFromKey(key),raw=v.energy+v.stock*s.heal,
    healed=Math.min(150,raw);
   if(healed>v.energy)v.phase=0;
   v.energy=healed;
   v.fired+=v.stock;
   v.stock=0;
   v.phase+=minutesBetween;
   while(v.phase>=10){v.phase-=10;v.energy=Math.max(0,v.energy-1);}
   const k=stateKey(v);after.set(k,(after.get(k)||0)+mass);
  }
  state=after;
  assert.ok(Math.abs(totalMass(state)-1)<1e-12,s.id+' mass after tap');
 }
 return state;
}

// Separate exhaustive enumeration of four Bernoulli *slots*; forced pity
// successes and capped stock provide a single permissible bit with mass 1.
function enumerateRawPaths(s){
 const paths=new Map(),attempts=eligibleHelpsPerTap*taps;
 for(let mask=0;mask<2**attempts;mask++){
  let mass=1,energy=s.energy,phase=s.phase,misses=0,stock=0,fired=0;
  for(let tap=0;tap<taps;tap++){
   for(let help=0;help<eligibleHelpsPerTap;help++){
    const j=tap*eligibleHelpsPerTap+help;
    const bit=(mask>>j)&1;
    const chance=stock===s.cap||s.rate===0?0:
      misses===s.threshold-1?1:s.rate;
    mass*=bit?chance:1-chance;
    if(bit){stock++;misses=0;}
    else if(stock!==s.cap&&s.rate>0)misses++;
   }
   const recovered=Math.min(150,energy+stock*s.heal);
   if(recovered>energy)phase=0;
   energy=recovered;fired+=stock;stock=0;
   for(let minute=0;minute<minutesBetween;minute++){
    phase++;
    if(phase===10){phase=0;energy=Math.max(0,energy-1);}
   }
  }
  if(mass===0)continue;
  const k=[energy,phase,misses,stock,fired].join(':');
  paths.set(k,(paths.get(k)||0)+mass);
 }
 assert.ok(Math.abs(totalMass(paths)-1)<1e-12,s.id+' raw sequence probability');
 return paths;
}

// Expected-stock simulator model is checked separately; the reference DP
// has never called any production skill/clock primitive.
function collapsedModel(s){
 let dist=sim.emptySkillProcState(s.threshold,s.cap);
 const energy=new Map([['target',s.energy]]),timer=new Map([['target',s.phase]]);
 let fired=0;
 for(let i=0;i<taps;i++){
  dist=sim.advanceSkillProcState(dist,eligibleHelpsPerTap,s.rate);
  const meanStock=sim.expectedSkillStock(sim.skillProcMarginal(dist));
  fired+=meanStock;
  sim.applyEnergyRecovery(energy,timer,'target',
   Math.min(150,energy.get('target')+meanStock*s.heal));
  const clock=sim.advanceEnergyTimer(energy.get('target'),timer.get('target'),minutesBetween);
  energy.set('target',clock.energy);timer.set('target',clock.phase);
  dist=sim.clearSkillProcStock(dist);
 }
 return {energy:energy.get('target'),phase:timer.get('target'),fired};
}
function reportStockAndPity(){
 const cases=scenarios.map(s=>{
  const dp=dynamicProgramming(s),enumerated=enumerateRawPaths(s);
  assert.deepEqual([...dp.keys()].sort(),[...enumerated.keys()].sort(),s.id+' states');
  for(const [key,p] of dp)
   assert.ok(Math.abs(p-enumerated.get(key))<1e-12,s.id+' state '+key);
  const exactEnergy=[...dp].reduce((sum,[key,p])=>sum+stateFromKey(key).energy*p,0);
  const expectedFired=[...dp].reduce((sum,[key,p])=>sum+stateFromKey(key).fired*p,0);
  const model=collapsedModel(s);
  assert.ok(Math.abs(expectedFired-model.fired)<1e-10,
   s.id+' expected stock count must match finite Bernoulli source');
  return {id:s.id,initialEnergy:s.energy,initialPhase:s.phase,
   artificialSkillRate:s.rate,pityThreshold:s.threshold,skillStockCap:s.cap,
   eligibleHelpsPerTap,taps,minutesBetween,healPerActivation:s.heal,
   terminalStates:[...dp].sort().map(([state,p])=>({state,mass:round(p)})),
   expectedActualActivations:round(expectedFired),
   collapsedExpectedActivations:round(model.fired),
   exactMeanEnergy:round(exactEnergy),collapsedModelEnergy:round(model.energy),
   modelMinusExact:round(model.energy-exactEnergy),
   realGameMeasurements:false,weekRankValidated:false};
 });
 return {schema:'step2-m2-e4-skill-stock-pity-joint-state-oracle-v1',
  evidence:'B_ARTIFICIAL_EXHAUSTIVE_STOCK_PITY_ENERGY_CLOCK',
  scope:'one skill user; four artificial completed helps across two taps',
  ratesMeasured:false,gameErrorQuantified:false,
  step2:'HOLD',m1:'PARTIAL',m2:'PARTIAL',step3:'NOT_STARTED',cases};
}
if(require.main===module)console.log('M2_E4_STOCK_PITY_JSON='+JSON.stringify(reportStockAndPity()));
module.exports={reportStockAndPity};

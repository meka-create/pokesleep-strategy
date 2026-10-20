'use strict';
/* P04 controlled blocked -> reopened ingredient skill evidence.
 * Independent brute-force Bernoulli path enumeration checks the production
 * stock/pity primitives over two blocked taps, one reopening tap (zero new
 * helps), and a later open-bag tap. Artificial skill chances, not game rates.
 * No actual-week ranking or in-game stock behavior is validated here.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const sim=ctx.globalThis.PokeSimulator;
const cases=[
 {id:'cap-two-with-pity',rate:.25,threshold:3,cap:2},
 {id:'cap-one-late-pity',rate:.25,threshold:5,cap:1},
 {id:'no-activations',rate:0,threshold:3,cap:2},
 {id:'certain-procs',rate:1,threshold:3,cap:1},
 {id:'early-pity',rate:.4,threshold:2,cap:2}
];
const EPS=1e-11;
const fmt=n=>{const result=Math.round(n*1e10)/1e10;return Object.is(result,-0)?0:result;};
const key=s=>s.stock+':'+s.misses;
function add(dist,s,mass){
 const k=key(s);dist.set(k,(dist.get(k)||0)+mass);
}
function enumeratePaths(s){
 const checkpoints=[new Map(),new Map(),new Map(),new Map()];
 let mass=0,firstRelease=0,secondRelease=0,validPaths=0;
 // Exactly 6 possible roll positions: two per collection interval.
 // An ineligible/full-stock roll contributes only the zero bit.
 for(let mask=0;mask<64;mask++){
  let stock=0,misses=0,weight=1;
  const run=(offset)=>{
   for(let i=0;i<2;i++){
    const success=(mask>>(offset+i))&1;
    const canRoll=stock<s.cap&&s.rate>0;
    const chance=!canRoll?0:(misses===s.threshold-1?1:s.rate);
    weight*=success?chance:1-chance;
    if(!canRoll)continue;
    if(success){stock++;misses=0;}else misses++;
   }
  };
  run(0);if(weight===0)continue;
  const first={stock,misses};
  run(2);if(weight===0)continue;
  const second={stock,misses};
  // The first TWO taps are blocked by the shared full bag: the queue is
  // not activated or cleared. A meal then creates space, with no new help.
  const released=stock;stock=0;
  const afterOpen={stock,misses};
  run(4);if(weight===0)continue;
  const afterNew={stock,misses},releasedNext=stock;
  validPaths++;mass+=weight;
  add(checkpoints[0],first,weight);
  add(checkpoints[1],second,weight);
  add(checkpoints[2],afterOpen,weight);
  add(checkpoints[3],afterNew,weight);
  firstRelease+=weight*released;
  secondRelease+=weight*releasedNext;
 }
 assert.ok(Math.abs(mass-1)<EPS,s.id+' reference path mass '+mass);
 return {checkpoints,firstRelease,secondRelease,validPaths,probabilityMass:mass};
}
function modelHistory(s){
 // Use the production state update/clear helpers only here, never in the
 // independent exhaustive enumeration.
 let state=sim.emptySkillProcState(s.threshold,s.cap);
 const checkpoints=[];
 const blocked=sim.blockedIngredientSkill('Ingredient Magnet S',5,5);
 const open=sim.blockedIngredientSkill('Ingredient Magnet S',5,4);
 assert.equal(blocked,true);
 assert.equal(open,false);
 state=sim.advanceSkillProcState(state,2,s.rate);
 checkpoints.push(state);
 state=sim.advanceSkillProcState(state,2,s.rate);
 checkpoints.push(state);
 const firstRelease=sim.expectedSkillStock(sim.skillProcMarginal(state));
 state=sim.clearSkillProcStock(state);
 checkpoints.push(state);
 state=sim.advanceSkillProcState(state,2,s.rate);
 checkpoints.push(state);
 const secondRelease=sim.expectedSkillStock(sim.skillProcMarginal(state));
 return {checkpoints,firstRelease,secondRelease};
}
function reportBlockedReopen(){
 const results=cases.map(s=>{
  const independent=enumeratePaths(s),model=modelHistory(s);
  let maxDifference=0;
  for(let i=0;i<4;i++){
   for(let stock=0;stock<=s.cap;stock++){
    for(let misses=0;misses<s.threshold;misses++){
     const k=stock+':'+misses;
     const got=model.checkpoints[i].dist[stock*s.threshold+misses];
     const expected=independent.checkpoints[i].get(k)||0;
     const diff=Math.abs(got-expected);
     maxDifference=Math.max(maxDifference,diff);
     assert.ok(diff<EPS,s.id+' checkpoint '+i+' '+k+
      ' production='+got+' oracle='+expected);
    }
   }
  }
  assert.ok(Math.abs(model.firstRelease-independent.firstRelease)<EPS);
  assert.ok(Math.abs(model.secondRelease-independent.secondRelease)<EPS);
  const phases=['after-first-blocked','after-second-blocked','after-open-release','after-new-eligible-helps'];
  return {
   id:s.id,artificialSkillRate:s.rate,pityThreshold:s.threshold,skillStockCap:s.cap,
   eligibleHelpsByPeriod:[2,2,0,2],
   activationsDuringFullBag:0,
   expectedReleaseWhenBagOpens:fmt(independent.firstRelease),
   expectedReleaseOnNextOpenTap:fmt(independent.secondRelease),
   stateProbabilities:phases.map((phase,i)=>({
    phase,
    states:[...independent.checkpoints[i]].sort(([a],[b])=>a.localeCompare(b))
     .map(([state,p])=>({state,probability:fmt(p)}))
   })),
   pathCount:independent.validPaths,
   referenceProbabilityMass:fmt(independent.probabilityMass),
   maximumInternalDifference:fmt(maxDifference),
   actualGameWaitingStockValidated:false
  };
 });
 return {
  schema:'step2-p04-block-reopen-oracle-v1',
  grade:'B_CONTROLLED_ARTIFICIAL_BERNOULLI_PATHS',
  source:'Independent enumeration of six artificial potential skill rolls; production tested only against that model',
  scope:'one skill user; full food bag during 2 taps; open bag without intervening help; 1 subsequent tap',
  p04OriginalFullWeekUnchanged:true,
  waitingStockGameRulesVerified:false,actualGameRatesMeasured:false,
  mixedWeeklyEnergyVerified:false,originalFiveRanksVerified:0,
  m1:'PARTIAL',m2:'PARTIAL',m3:'PARTIAL',m4:'NOT_STARTED',step2:'HOLD',step3:'NOT_STARTED',
  results
 };
}
if(require.main===module)console.log('P04_BLOCK_REOPEN_JSON='+JSON.stringify(reportBlockedReopen()));
module.exports={reportBlockedReopen,enumeratePaths,modelHistory};

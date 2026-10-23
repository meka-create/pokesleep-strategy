'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const sim=ctx.globalThis.PokeSimulator;
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`expected ${b}, got ${a}`);
const mass=m=>Array.from(m.values()).reduce((a,b)=>a+b,0);

// Enumerate all outcome strings without using the transition implementation.
function enumerate(cap,berryPerHelp,foodCount,rate,steps){
 const paths=[];
 function visit(occupancy,postFull,rolls,p,at){
  if(at===steps){paths.push({occupancy,postFull,rolls,p});return;}
  if(occupancy===cap){
   visit(occupancy,Math.min(4,postFull+1),rolls+(postFull<4?1:0),p,at+1);
  }else{
   const free=cap-occupancy;
   visit(occupancy+Math.min(berryPerHelp,free),0,rolls+1,p*(1-rate),at+1);
   visit(occupancy+Math.min(foodCount,free),0,rolls+1,p*rate,at+1);
  }
 }
 visit(0,0,0,1,0);
 const dist=new Map(),joint=new Map();
 for(const p of paths){
  dist.set(p.rolls,(dist.get(p.rolls)||0)+p.p);
  const key=p.occupancy*5+p.postFull;
  joint.set(key,(joint.get(key)||0)+p.p);
 }
 return {dist,joint,expected:Array.from(dist,([n,p])=>n*p).reduce((a,b)=>a+b,0)};
}

test('four extra after-full rolls occur once, not once per 15-minute tick',()=>{
 const start=new Map([[0,1]]),args=[2,2,0,[]];
 const all=sim.queuedFullPocketTransitions(start,10,...args);
 approx(all.eligible,5);
 approx(all.eligibleDistribution.get(5),1);
 approx(all.joint.get(2*5+4),1);
 let split=sim.queuedFullPocketTransitions(start,2,...args);
 approx(split.eligible,2);
 for(let i=0;i<8;i++){
  const step=sim.queuedFullPocketTransitions(split.joint,1,...args);
  if(i<3)approx(step.eligible,1);
  else approx(step.eligible,0);
  split=step;
 }
 approx(mass(split.joint),1);
 assert.deepEqual(Array.from(split.joint),Array.from(all.joint));
});

test('ingredient/berry full-time correlations match independent exhaustive paths',()=>{
 for(const steps of [1,2,4,6,9]){
  const produced=sim.queuedFullPocketTransitions(new Map([[0,1]]),steps,3,2,.4,[{key:'apple',count:1}]);
  const reference=enumerate(3,2,1,.4,steps);
  approx(produced.eligible,reference.expected);
  for(const [n,p] of reference.dist)approx(produced.eligibleDistribution.get(n)||0,p);
  for(const [n,p] of reference.joint)approx(produced.joint.get(n)||0,p);
  approx(mass(produced.joint),1);
  approx(mass(produced.eligibleDistribution),1);
 }
});

test('unchanged full pockets preserve exhausted queue; actual emptying restores eligibility',()=>{
 const full=new Map([[2*5+3,1]]);
 const occ=new Map([[2,1]]);
 const unchanged=sim.queuedFullPocketAfterCollection(full,occ,occ,0,0,2);
 assert.equal(unchanged.approximate,false);
 approx(unchanged.joint.get(13),1);
 const after=sim.queuedFullPocketTransitions(unchanged.joint,3,2,2,0,[]);
 approx(after.eligible,1);
 const emptied=sim.queuedFullPocketAfterCollection(full,occ,new Map([[0,1]]),0,2,2);
 assert.equal(emptied.approximate,false);
 approx(emptied.joint.get(0),1);
 const renewed=sim.queuedFullPocketTransitions(emptied.joint,6,2,2,0,[]);
 approx(renewed.eligible,5);
});

test('partly emptied uncertain full pocket does not fabricate a second four-roll allowance',()=>{
 const state=new Map([[2*5+2,1]]);
 const result=sim.queuedFullPocketAfterCollection(state,new Map([[2,1]]),new Map([[2,1]]),1,0,2);
 assert.equal(result.approximate,true);
 approx(result.joint.get(2*5+4),1);
 approx(sim.queuedFullPocketTransitions(result.joint,10,2,2,0,[]).eligible,0);
});

test('invalid queue probability state is rejected rather than changing weekly skill rate silently',()=>{
 for(const invalid of [new Map([[0,.5]]),new Map([[1,1]]),new Map([[-1,1]]),new Map([[15,1]])]){
  assert.throws(()=>sim.queuedFullPocketTransitions(invalid,1,2,2,0,[]),/キュー/);
 }
});

test('realistic 7-day simulation remains finite with skill queue and no fabricated instant collection',()=>{
 const ids=['a','b','c','d','e'];
 const box=ids.map(id=>({id,pokemon:'フワライド',nickname:id,level:20,skillLevel:1,
  ingredients:['ワカクサコーン','',''],subskills:['','','','',''],
  nature:'まじめ',sleepHours:0,shiny:false}));
 const options={map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:180,potSize:57,
  sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
  recipeId:'',initialIngredients:{},bagCapacity:0,camp:false,
  extraMode:'none',successMode:'none'};
 const res=sim.simulate({box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},options});
 assert.ok(res.skillEligibleHelps>0);
 assert.ok(res.skillEligibleHelps<=res.skillHelpCompletions+1e-8);
 assert.ok(res.skillTriggers>0&&Number.isFinite(res.total));
 approx(res.days.reduce((s,d)=>s+d.berries+d.cooking+d.skills,0),res.total);
 assert.equal(res.days.length,7);
});

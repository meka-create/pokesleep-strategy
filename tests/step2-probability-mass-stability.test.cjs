'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator,near=(a,b,tol=1e-8)=>
 assert.ok(Math.abs(a-b)<tol,`expected ${b}, got ${a}`);

test('10,000 collections do not slowly remove probability from Stockpile distribution',()=>{
 let state=sim.emptyStockpile();
 // A valid, rounded marginal with near-unit sum. Before normalization each
 // collect lost 1e-10 mass and eventually hit the unrelated 1e-8 gate.
 const ready=[.6,.4-1e-10];
 for(let i=0;i<10000;i++){
  const next=sim.advanceStockpileByReadyStock(state,ready,1);
  assert.ok(Number.isFinite(next.earned)&&next.earned>=0);
  state=next.state;
 }
 near(state.reduce((a,b)=>a+b,0),1,1e-12);
 assert.ok(state.every(p=>Number.isFinite(p)&&p>=0));
});

test('skill stock+pity remains normalized through repeated fractional help-count branches',()=>{
 let s=sim.emptySkillProcState(8,2);
 const chance=new Map([[0,.3],[1,.4],[2,.3]]);
 for(let i=0;i<400;i++){
  s=sim.advanceSkillProcStateByHelpCounts(s,chance,.22);
  near(s.dist.reduce((a,b)=>a+b,0),1,1e-12);
  s=sim.clearSkillProcStock(s);
  near(s.dist.reduce((a,b)=>a+b,0),1,1e-12);
 }
});

test('numeric stabilization does not accept actual missing probability mass',()=>{
 const missing=[.6,.39];
 assert.throws(()=>sim.advanceStockpileByReadyStock(sim.emptyStockpile(),missing,1),/分布/);
 const corrupt=sim.emptyStockpile();
 corrupt[0]=.999;
 assert.throws(()=>sim.advanceStockpileByReadyStock(corrupt,[.5,.5],1),/分布/);
 const badlyWeighted=new Map([[0,.6],[1,.3]]);
 assert.throws(()=>sim.advanceSkillProcStateByHelpCounts(sim.emptySkillProcState(4,2),badlyWeighted,.2),/質量/);
});

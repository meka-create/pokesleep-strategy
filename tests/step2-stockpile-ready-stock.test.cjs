'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator;
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`expected ${expected}, got ${actual}`);
const mass=state=>Array.from(state).reduce((total,x)=>total+x,0);

test('0/2 ready Stockpile activations use full independent branches, not the mean count',()=>{
 const initial=[1,...Array(10).fill(0)];
 const result=sim.advanceStockpileByReadyStock(initial,[.5,0,.5],1);
 // Path 0 = unchanged, reward 0.
 // Path 2 = first reward .25*600=150; second reward
 // .25*(.25*600)+.75*(.25*1020)=228.75.
 // 50:50 mixture yields 189.375, NOT the 150 awarded by mean=1.
 approx(result.earned,189.375);
 approx(sim.advanceStockpile(initial,1,1).earned,150);
 approx(result.state[0],.625);
 approx(result.state[1],.09375);
 approx(result.state[2],.28125);
 approx(mass(result.state),1);
});

test('ready-stock branches respect guaranteed 0, 1 and 2 activations at every skill level',()=>{
 for(const level of [1,3,7]){
  const state=Array(11).fill(0);state[2]=.4;state[10]=.6;
  for(const count of [0,1,2]){
   const probs=[0,0,0];probs[count]=1;
   const actual=sim.advanceStockpileByReadyStock(state,probs,level);
   const expected=sim.advanceStockpile(state,count,level);
   approx(actual.earned,expected.earned);
   for(let i=0;i<11;i++)approx(actual.state[i],expected.state[i]);
   approx(mass(actual.state),1);
  }
 }
});

test('stockpile cap and successive post-release activation use explicit outcome paths',()=>{
 const state=Array(11).fill(0);state[10]=1;
 const result=sim.advanceStockpileByReadyStock(state,[.25,.5,.25],1);
 // Ready 1 releases 12120; ready 2 releases 12120 then earns .25*600.
 approx(result.earned,.5*12120+.25*(12120+150));
 approx(result.state[0],.5+.25*.25);
 approx(result.state[1],.25*.75);
 approx(result.state[10],.25);
 approx(mass(result.state),1);
});

test('reject malformed ready-stock probabilities instead of inventing a mean',()=>{
 const state=[1,...Array(10).fill(0)];
 for(const bad of [[.5,.4],[.5,-.5,1],[NaN,1],[1],[0,0,0]])
  assert.throws(()=>sim.advanceStockpileByReadyStock(state,bad,1),/分布/);
});

test('weekly Stockpile simulation stays finite and retains current scope warnings',()=>{
 const ids=['a','b','c','d','e'];
 const box=ids.map(id=>({id,pokemon:'フワンテ',nickname:id,level:1,skillLevel:1,
  ingredients:['ワカクサコーン','',''],subskills:['','','','',''],
  nature:'まじめ',sleepHours:0,shiny:false}));
 const input={box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:150,potSize:57,
   sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
   recipeId:'',initialIngredients:{},bagCapacity:0,camp:false,
   extraMode:'none',successMode:'none'}};
 const output=sim.simulate(input);
 assert.ok(Number.isFinite(output.skills)&&output.skills>0);
 assert.ok(Number.isFinite(output.total));
 approx(output.total,output.berries+output.cooking+output.skills);
 assert.ok(output.warnings.some(x=>x.includes('たくわえる')));
 assert.equal(output.days.length,7);
});

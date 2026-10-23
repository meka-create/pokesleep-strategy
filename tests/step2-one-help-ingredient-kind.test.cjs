'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator,master=context.globalThis.PokeMaster;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`expected ${b}, got ${a}`);
const two=[{key:'apple',count:3},{key:'milk',count:1}];
function brute(rate,slots,carry,dist){
 const picked={},left={};let got=0,remain=0;
 for(const [free,p] of dist){
  for(const slot of slots){
   const n=Math.min(slot.count,carry),weight=rate/slots.length*p;
   const collected=Math.min(n,free);
   picked[slot.key]=(picked[slot.key]||0)+weight*collected;
   left[slot.key]=(left[slot.key]||0)+weight*(n-collected);
   got+=weight*collected;remain+=weight*(n-collected);
  }
 }
 return {picked,left,got,remain};
}
test('three apples OR one milk, free one: actual pickup .5/.5 rather than .75/.25',()=>{
 const dist=new Map([[1,1]]);
 const actual=sim.collectOneHelpIngredientKinds(1,two,10,dist);
 near(actual.accepted.apple,.5);
 near(actual.accepted.milk,.5);
 near(actual.retained.apple,1);
 near(actual.retained.milk,0);
 near(actual.totalAccepted,1);
 near(actual.totalRetained,1);
 const oldProportional=(1.5/(1.5+.5))*actual.totalAccepted;
 near(oldProportional,.75);
 assert.ok(Math.abs(actual.accepted.apple-oldProportional)>.2);
});

test('finite independent free-space worlds and capped carry match enumeration',()=>{
 for(const carry of [1,2,3,10])for(const rate of [.2,.5,1]){
  const freeDist=new Map([[0,.25],[1,.5],[2,.25]]);
  const actual=sim.collectOneHelpIngredientKinds(rate,two,carry,freeDist);
  const b=brute(rate,two,carry,freeDist);
  near(actual.totalAccepted,b.got);
  near(actual.totalRetained,b.remain);
  for(const key of ['apple','milk']){
   near(actual.accepted[key],b.picked[key]);
   near(actual.retained[key],b.left[key]);
  }
  const produced=rate*(Math.min(3,carry)+Math.min(1,carry))/2;
  near(actual.totalAccepted+actual.totalRetained,produced);
 }
});

test('when bag has enough slots pickup reverts to ordinary per-kind production',()=>{
 const r=sim.collectOneHelpIngredientKinds(1,two,10,new Map([[10,1]]));
 near(r.accepted.apple,1.5);
 near(r.accepted.milk,.5);
 near(r.totalRetained,0);
});

test('no ingredient outcome is possible and invalid probability masses are refused',()=>{
 const r=sim.collectOneHelpIngredientKinds(0,two,5,new Map([[1,1]]));
 near(r.totalAccepted,0);
 near(r.totalRetained,0);
 for(const invalid of [new Map([[1,.9]]),new Map([[-1,1]]),
  new Map([[1,NaN]]),new Map([[1,-.5],[2,1.5]])])
  assert.throws(()=>sim.collectOneHelpIngredientKinds(1,two,10,invalid),/分岐|確率/);
 assert.throws(()=>sim.collectOneHelpIngredientKinds(1.5,two,10,new Map([[1,1]])),/分岐/);
});

test('one-help type branch is exercised in the actual 7-day bounded-bag engine',()=>{
 const sp=master.species.find(x=>x.name==='ウパー (パルデア)');
 assert.ok(sp&&sp.frequency>=6000);
 const ids=['a','b','c','d','e'];
 const ingredients=['リラックスカカオ','めざましコーヒー',''];
 const box=ids.map(id=>({id,pokemon:sp.name,nickname:id,level:30,skillLevel:1,
  ingredients,subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false}));
 const input={box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:120,potSize:57,
   sleepScore:0,initialEnergy:0,foodMode:'curry',recipeMode:'fixed',
   recipeId:'',initialIngredients:{},bagCapacity:1,camp:false,
   extraMode:'none',successMode:'none'}};
 const result=sim.simulate(input);
 assert.ok(result.exactOneHelpKindCollections>0,
  'a slow level-30 Pokemon with 120-minute taps must exercise one-help pickup');
 assert.ok(Number.isFinite(result.total)&&result.total>=0);
 near(result.total,result.berries+result.cooking+result.skills);
 assert.equal(result.days.length,7);
});

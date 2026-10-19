'use strict';
/* M3 artificial one-tap/two-producer supply -> bag collection -> 2 recipes.
 * Reference branches are explicitly enumerated; NEVER claim game rates.
 * Collection immediately after each artificial help makes pocket carry zero.
 * Branch A delivers apple then milk in declared order, not an inferred game order.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({globalThis:{}});
for(const name of ['master.js','recipes.js','ingredient-distribution.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const api=ctx.globalThis.PokeIngredientDistribution;
const recipes=ctx.globalThis.PokeRecipes;
const curry=recipes.find(x=>x.id==='apple_curry');
const stew=recipes.find(x=>x.id==='white_stew');
assert.deepEqual(JSON.parse(JSON.stringify(curry.requirements)),{apple:7});
assert.deepEqual(JSON.parse(JSON.stringify(stew.requirements)),{milk:7});
const events=[
 [{probability:.5,items:[{ingredient:'apple',count:7},{ingredient:'milk',count:7}]},
  {probability:.5,items:[]}],
 [{ingredient:'milk',count:7,probability:.5},
  {ingredient:null,count:0,probability:.5}]
];
const steps=[
 {draws:[events[0]],requirements:curry.requirements,energyIfCooked:curry.strength70},
 {draws:[events[1]],requirements:stew.requirements,energyIfCooked:stew.strength70}
];
const stockKey=x=>JSON.stringify(Object.fromEntries(Object.entries(x).filter(([,v])=>v>0).sort(([a],[b])=>a.localeCompare(b))));
function brute(capacity){
 const terminal=new Map(),success=[0,0],consumed={},sources=[0,0];
 let expectedCooking=0,expectedMealCount=0;
 for(let first=0;first<=1;first++)for(let second=0;second<=1;second++){
  const inventory={};
  const deliver=items=>{
   for(const {ingredient,count} of items){
    const filled=Object.values(inventory).reduce((a,b)=>a+b,0);
    const accepted=Math.min(count,capacity-filled);
    inventory[ingredient]=(inventory[ingredient]||0)+accepted;
   }
  };
  const cook=(index,recipe)=>{
   if(!Object.entries(recipe.requirements).every(([k,n])=>(inventory[k]||0)>=n))return;
   success[index]+=.25;expectedMealCount+=.25;
   expectedCooking+=.25*recipe.strength70;
   for(const [key,count] of Object.entries(recipe.requirements)){
    inventory[key]-=count;consumed[key]=(consumed[key]||0)+count*.25;
   }
  };
  if(first)deliver([{ingredient:'apple',count:7},{ingredient:'milk',count:7}]);
  cook(0,curry);
  if(second)deliver([{ingredient:'milk',count:7}]);
  cook(1,stew);
  const key=stockKey(inventory);
  terminal.set(key,(terminal.get(key)||0)+.25);
 }
 return {success,expectedMealCount,expectedCooking,consumed,terminal};
}
function compare(capacity){
 const modeled=api.evaluateRecipeSequence(api.certainIngredientBag({},capacity),steps,capacity);
 const reference=brute(capacity);
 const actualSuccess=Array.from(modeled.meals,m=>m.successProbability);
 assert.deepEqual(actualSuccess,reference.success);
 assert.equal(modeled.expectedMealCount,reference.expectedMealCount);
 assert.equal(modeled.expectedCooking,reference.expectedCooking);
 for(const key of ['apple','milk'])
  assert.equal(modeled.expectedConsumed[key]||0,reference.consumed[key]||0);
 assert.deepEqual([...modeled.distribution].sort((a,b)=>a[0].localeCompare(b[0])),
  [...reference.terminal].sort((a,b)=>a[0].localeCompare(b[0])));
 assert.equal([...modeled.distribution.values()].reduce((a,b)=>a+b,0),1);
 return modeled;
}
test('M3 bounded 2-helper 2-meal E2E matches independent 4-world reference at bag cap 10',()=>{
 const r=compare(10);
 assert.deepEqual(Array.from(r.meals,m=>m.successProbability),[.5,.5]);
 assert.equal(r.expectedCooking,(curry.strength70+stew.strength70)/2);
 assert.equal(r.expectedConsumed.apple,3.5);
 assert.equal(r.expectedConsumed.milk,3.5);
});
test('M3 cap 14 retains correlated milk and changes second meal probability to .75',()=>{
 const r=compare(14);
 assert.deepEqual(Array.from(r.meals,m=>m.successProbability),[.5,.75]);
 assert.equal(r.expectedConsumed.milk,5.25);
 assert.equal(r.expectedCooking,.5*curry.strength70+.75*stew.strength70);
});
test('M3 mixed single and compound options inside one mutually exclusive event are rejected',()=>{
 const broken=[{probability:.5,items:[{ingredient:'apple',count:7}]},
  {ingredient:null,count:0,probability:.5}];
 assert.throws(()=>api.evaluateRecipeSequence(api.certainIngredientBag({}),[
  {draws:[broken],requirements:curry.requirements,energyIfCooked:curry.strength70}
 ],14),/混在/);
});
test('M3 compound pickup rejects invalid probability and never invents recipe energy',()=>{
 const broken=[{probability:.6,items:[{ingredient:'apple',count:7}]}];
 assert.throws(()=>api.evaluateRecipeSequence(api.certainIngredientBag({}),[
  {draws:[broken],requirements:curry.requirements,energyIfCooked:curry.strength70}
 ],14),/確率質量/);
});

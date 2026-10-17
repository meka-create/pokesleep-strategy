const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({globalThis:{}});
for(const file of ['master.js','ingredient-distribution.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx,{filename:file});
const {certainIngredientBag,addIngredientOutcomes,evaluateRecipeOutcomes}=ctx.globalThis.PokeIngredientDistribution;
const rows=x=>[...x].map(([key,p])=>[JSON.parse(key),p]);
const total=x=>[...x.values()].reduce((sum,p)=>sum+p,0);
test('empty or nonempty certain inventory produces a single integer scenario',()=>{
 assert.deepEqual(rows(certainIngredientBag({apple:7})),[[{apple:7},1]]);
 assert.deepEqual(rows(certainIngredientBag({milk:0})),[[{},1]]);
 assert.throws(()=>certainIngredientBag({apple:8},7),/容量/);
});
test('half apple and half milk yields 50% recipe feasibility, not expected-count certainty',()=>{
 const zero=certainIngredientBag({});
 const results=addIngredientOutcomes(zero,[
  {ingredient:'apple',count:8,probability:.5},
  {ingredient:'milk',count:8,probability:.5}
 ],20);
 assert.equal(results.expectedAdded,8);
 const dish=evaluateRecipeOutcomes(results.distribution,{apple:7},20);
 assert.equal(dish.successProbability,.5);
 assert.deepEqual(rows(dish.distribution).sort((a,b)=>JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0]))),
  [[{apple:1},.5],[{milk:8},.5]]);
 assert.equal(dish.expectedConsumed.apple,3.5);
 assert.equal(total(dish.distribution),1);
});
test('two ingredient requirements use joint inventory, not products of marginal means',()=>{
 const results=addIngredientOutcomes(certainIngredientBag({}),
  [{ingredient:'apple',count:7,probability:.5},
   {ingredient:'milk',count:7,probability:.5}],20);
 const dish=evaluateRecipeOutcomes(results.distribution,{apple:7,milk:7},20);
 assert.equal(dish.successProbability,0);
 assert.equal(dish.expectedConsumed.apple||0,0);
 assert.equal(total(dish.distribution),1);
});
test('multiple sequential helps build the joint distribution and cook success on complete branches',()=>{
 const roll=[{ingredient:'apple',count:7,probability:.5},{ingredient:'milk',count:7,probability:.5}];
 let state=certainIngredientBag({});
 state=addIngredientOutcomes(state,roll,20).distribution;
 state=addIngredientOutcomes(state,roll,20).distribution;
 const dish=evaluateRecipeOutcomes(state,{apple:7,milk:7},20);
 assert.equal(dish.successProbability,.5);
 assert.ok(Math.abs(total(dish.distribution)-1)<1e-12);
 assert.equal(dish.expectedConsumed.apple,3.5);
 assert.equal(dish.expectedConsumed.milk,3.5);
});
test('full bag clips each world BEFORE expectation: do not clip the mean',()=>{
 const state=certainIngredientBag({apple:4},5);
 const out=addIngredientOutcomes(state,[
  {ingredient:'milk',count:3,probability:.25},
  {ingredient:'apple',count:2,probability:.75}
 ],5);
 assert.equal(out.expectedAdded,1);
 assert.equal(out.expectedRejected,.25*2+.75*1);
 assert.equal(total(out.distribution),1);
 const dish=evaluateRecipeOutcomes(out.distribution,{apple:5},5);
 assert.equal(dish.successProbability,.75);
});
test('stochastic no-food outcome makes the empty branch fail while preserving its inventory',()=>{
 const out=addIngredientOutcomes(certainIngredientBag({}),[
  {ingredient:null,count:0,probability:.8},
  {ingredient:'apple',count:7,probability:.2}
 ],10);
 assert.ok(Math.abs(out.expectedAdded-1.4)<1e-12);
 const result=evaluateRecipeOutcomes(out.distribution,{apple:7},10);
 assert.ok(Math.abs(result.successProbability-.2)<1e-12);
 assert.equal(total(result.distribution),1);
 assert.deepEqual(rows(result.distribution),[[{},1]]);
});
test('an impossible recipe conserves 100% of the input bag distribution',()=>{
 const out=addIngredientOutcomes(certainIngredientBag({apple:2}),[
  {ingredient:'apple',count:1,probability:.3},
  {ingredient:null,count:0,probability:.7}
 ],10);
 const before=rows(out.distribution);
 const after=evaluateRecipeOutcomes(out.distribution,{apple:100},10);
 assert.equal(after.successProbability,0);
 assert.deepEqual(rows(after.distribution),before);
});
test('one recipe can be attempted sequentially and cannot consume from a failed branch',()=>{
 let d=addIngredientOutcomes(certainIngredientBag({}),[
  {ingredient:'apple',count:14,probability:.5},
  {ingredient:null,count:0,probability:.5}
 ],20).distribution;
 const first=evaluateRecipeOutcomes(d,{apple:7},20);
 assert.equal(first.successProbability,.5);
 const second=evaluateRecipeOutcomes(first.distribution,{apple:7},20);
 assert.equal(second.successProbability,.5);
 const third=evaluateRecipeOutcomes(second.distribution,{apple:7},20);
 assert.equal(third.successProbability,0);
});
test('all 19 ingredient identities can be represented without rounding or float inventory',()=>{
 const keys=Object.keys(ctx.globalThis.PokeMaster.ingredients);
 assert.equal(keys.length,19);
 const initial=Object.fromEntries(keys.map((key,i)=>[key,i+1]));
 const cap=Object.values(initial).reduce((a,b)=>a+b,0);
 const state=certainIngredientBag(initial,cap);
 assert.equal(rows(state).length,1);
 const rec=evaluateRecipeOutcomes(state,{[keys[0]]:1,[keys[18]]:19},cap);
 assert.equal(rec.successProbability,1);
 assert.equal(rec.expectedConsumed[keys[0]],1);
 assert.equal(rec.expectedConsumed[keys[18]],19);
});
test('invalid distributions and malformed source outcomes are rejected, never approximated',()=>{
 assert.throws(()=>certainIngredientBag({apple:.5}),/不正/);
 assert.throws(()=>certainIngredientBag({invalidFood:1}),/不正/);
 assert.throws(()=>addIngredientOutcomes(new Map([['{}',.5]]),[{ingredient:'apple',count:1,probability:1}],10),/確率質量/);
 assert.throws(()=>addIngredientOutcomes(certainIngredientBag({}),[{ingredient:'apple',count:1,probability:.5}],10),/確率質量/);
 assert.throws(()=>addIngredientOutcomes(certainIngredientBag({}),[{ingredient:'apple',count:1.5,probability:1}],10),/不正/);
 assert.throws(()=>evaluateRecipeOutcomes(new Map([['{\"apple\":1}',1]]),{apple:1},.5),/容量/);
});
test('branch explosion is rejected explicitly rather than silently truncating tiny probabilities',()=>{
 const roll=[{ingredient:'apple',count:1,probability:.5},{ingredient:'milk',count:1,probability:.5}];
 let state=certainIngredientBag({});
 state=addIngredientOutcomes(state,roll,100,3).distribution;
 state=addIngredientOutcomes(state,roll,100,3).distribution;
 assert.throws(()=>addIngredientOutcomes(state,roll,100,3),/上限/);
});
test('probabilities remain normalized through multiple capped additions and recipe consumption',()=>{
 let state=certainIngredientBag({milk:2},10);
 const outcomes=[
  {ingredient:'apple',count:3,probability:.3},
  {ingredient:'milk',count:2,probability:.4},
  {ingredient:null,count:0,probability:.3}
 ];
 for(let i=0;i<4;i++)state=addIngredientOutcomes(state,outcomes,10).distribution;
 const beforeTotal=total(state);
 assert.ok(Math.abs(beforeTotal-1)<1e-12);
 const after=evaluateRecipeOutcomes(state,{apple:3,milk:2},10);
 assert.ok(Math.abs(total(after.distribution)-1)<1e-12);
 assert.ok(after.successProbability>=0&&after.successProbability<=1);
 assert.ok(after.expectedConsumed.apple>=0&&after.expectedConsumed.apple<=3);
});


test('exact recipe sequence consumes 21 meals from definite stock, without fractional inventory',()=>{
 const d=certainIngredientBag({apple:147},147);
 const steps=Array.from({length:21},()=>({requirements:{apple:7},energyIfCooked:100}));
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(d,steps,147);
 assert.equal(r.meals.length,21);
 assert.equal(r.expectedMealCount,21);
 assert.equal(r.expectedCooking,2100);
 assert.equal(r.expectedConsumed.apple,147);
 assert.deepEqual(rows(r.distribution),[[{},1]]);
});
test('correlated initial outcomes give two possible meals, not three independent expected meals',()=>{
 const first=addIngredientOutcomes(certainIngredientBag({}),[
  {ingredient:'apple',count:14,probability:.5},
  {ingredient:null,count:0,probability:.5}
 ],20).distribution;
 const meals=[{requirements:{apple:7},energyIfCooked:100},
  {requirements:{apple:7},energyIfCooked:200},
  {requirements:{apple:7},energyIfCooked:300}];
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(first,meals,20);
 assert.deepEqual(r.meals.map(m=>m.successProbability),[.5,.5,0]);
 assert.equal(r.expectedCooking,150);
 assert.equal(r.expectedMealCount,1);
 assert.equal(r.expectedConsumed.apple,7);
 assert.deepEqual(rows(r.distribution),[[{},1]]);
});
test('separate between-meal draws allow independent conditional opportunities',()=>{
 const draw=[{ingredient:'apple',count:7,probability:.5},
  {ingredient:null,count:0,probability:.5}];
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(certainIngredientBag({}),[
  {draws:[draw],requirements:{apple:7},energyIfCooked:100},
  {draws:[draw],requirements:{apple:7},energyIfCooked:100}
 ],10);
 assert.deepEqual(r.meals.map(m=>m.successProbability),[.5,.5]);
 assert.equal(r.expectedCooking,100);
 assert.equal(r.expectedMealCount,1);
 assert.equal(r.expectedConsumed.apple,7);
});
test('a failed earlier dish preserves every ingredient for a later different recipe',()=>{
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(certainIngredientBag({milk:7}),[
  {requirements:{apple:7},energyIfCooked:999},
  {requirements:{milk:7},energyIfCooked:30}
 ],20);
 assert.deepEqual(r.meals.map(m=>m.successProbability),[0,1]);
 assert.equal(r.expectedCooking,30);
 assert.equal(r.expectedConsumed.milk,7);
 assert.deepEqual(rows(r.distribution),[[{},1]]);
});
test('compound evidence from multiple individually declared draws is retained through 21 meals',()=>{
 const a={ingredient:'apple',count:1,probability:1};
 const meals=Array.from({length:21},()=>({draws:[[a]],requirements:{apple:1},energyIfCooked:10}));
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(certainIngredientBag({}),meals,1);
 assert.equal(r.expectedCooking,210);
 assert.equal(r.expectedMealCount,21);
 assert.equal(total(r.distribution),1);
});
test('each pre-meal draw respects global bag cap before testing recipe feasibility',()=>{
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(certainIngredientBag({apple:4},5),[
  {draws:[[{ingredient:'apple',count:7,probability:1}]],requirements:{apple:5},energyIfCooked:40},
  {requirements:{apple:5},energyIfCooked:40}
 ],5);
 assert.deepEqual(r.meals.map(m=>m.successProbability),[1,0]);
 assert.equal(r.expectedCooking,40);
 assert.deepEqual(rows(r.distribution),[[{},1]]);
});
test('empty recipe sequence does not modify the starting distribution',()=>{
 const d=certainIngredientBag({apple:3},10);
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(d,[],10);
 assert.equal(r.expectedCooking,0);
 assert.equal(r.expectedMealCount,0);
 assert.deepEqual(rows(r.distribution),rows(d));
});
test('bounded two-week 42-meal horizon remains deterministic with supplied stock',()=>{
 const steps=Array.from({length:42},()=>({requirements:{apple:7},energyIfCooked:10}));
 const d=certainIngredientBag({apple:294},294);
 const r=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence(d,steps,294);
 assert.equal(r.meals.length,42);
 assert.equal(r.expectedMealCount,42);
 assert.equal(r.expectedCooking,420);
});
test('invalid future meal and 43rd step must fail rather than yield fabricated cooking Energy',()=>{
 const api=ctx.globalThis.PokeIngredientDistribution.evaluateRecipeSequence;
 const d=certainIngredientBag({});
 assert.throws(()=>api(d,[{requirements:{apple:1},energyIfCooked:NaN}]),/不正/);
 assert.throws(()=>api(d,[{requirements:{apple:1},energyIfCooked:-1}]),/不正/);
 assert.throws(()=>api(d,Array.from({length:43},()=>({requirements:{},energyIfCooked:0}))),/不正/);
 assert.throws(()=>api(d,[{draws:[[{ingredient:'apple',count:1,probability:.3}]],requirements:{apple:1},energyIfCooked:100}]),/確率質量/);
});

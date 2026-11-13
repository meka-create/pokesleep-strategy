'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* package.json is type:module; browser IIFEs are loaded with their UMD
 * wrapper in a sandbox, not require()'d as CommonJS. */
function browserModule(relative){
 const mod={exports:{}},context={module:mod};
 context.globalThis=context;
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8'),
  context,{filename:relative});
 return mod.exports;
}
const F3=browserModule('f3/f3-prep-optimizer-v1.js');
const recipeSource=browserModule('src/recipes.js');
const snapshot=JSON.stringify(recipeSource);
const mini=[
 {id:'high',name:'高エナジー',type:'curry',baseStrength:1000,
  requirements:{apple:9}},
 {id:'low',name:'低エナジー',type:'curry',baseStrength:9,
  requirements:{apple:1}},
 {id:'salad',name:'サラダ料理',type:'salad',baseStrength:950,
  requirements:{apple:5,soy:1}},
 {id:'dessert',name:'デザート料理',type:'dessert',baseStrength:920,
  requirements:{apple:5,egg:1}}
];
function run(overrides={}){
 return F3.plan({recipes:mini,categories:['curry','salad','dessert'],
  bagCapacity:60,potCapacity:57,camp:true,currentStock:{},
  ...overrides});
}
test('F3 recipe data contract, all 78 official input recipes and 19 ingredients untouched',()=>{
 assert.equal(recipeSource.length,78);
 const normalized=F3.normalizeRecipes(recipeSource);
 assert.equal(normalized.length,78);
 assert.deepEqual([...new Set(normalized.map(x=>x.type))].sort(),['curry','dessert','salad']);
 assert.equal(F3.INGREDIENT_CODES.length,19);
 assert.equal(JSON.stringify(recipeSource),snapshot);
 const r=F3.plan({recipes:recipeSource,categories:['curry','salad','dessert'],
  bagCapacity:600,potCapacity:57,camp:true,currentStock:{}});
 assert.equal(r.status,'PROVISIONAL',r.message);
 assert.equal(r.capacity.bag,600);
 assert(r.recipesUsed>0&&r.recipesUsed<=21);
 assert(Object.keys(r.goals).length===19);
 assert.equal(JSON.stringify(recipeSource),snapshot);
});
test('F3 goals use a single shared stockpile, never re-use the same apple for two meals',()=>{
 const r=run({bagCapacity:19,currentStock:{apple:2}});
 assert.equal(r.status,'PROVISIONAL',r.message);
 assert(r.categories.every(x=>x.meals>=1),'An equally prioritized category was needlessly starved');
 const totalDemand=Object.values(r.demand).reduce((a,b)=>a+b,0);
 const totalTopups=Object.values(r.topups).reduce((a,b)=>a+b,0);
 assert.equal(r.capacity.additional,totalTopups);
 assert.equal(r.capacity.used,2+totalTopups);
 assert(r.capacity.used<=19);
 assert.equal(r.goals.apple,r.demand.apple);
 assert.equal(r.topups.apple,Math.max(0,r.demand.apple-2));
 assert.equal(r.recipesUsed,r.categories.reduce((a,b)=>a+b.meals,0));
 assert.equal(r.recipesUsed,r.categories.reduce((a,b)=>a+
  b.dishes.reduce((n,x)=>n+x.count,0),0));
 const index=new Map(mini.map(x=>[x.id,x]));
 const reconstructed={};
 for(const c of r.categories){
  for(const x of c.dishes)for(const [ing,n] of Object.entries(index.get(x.id).requirements))
   reconstructed[ing]=(reconstructed[ing]||0)+n*x.count;
 }
 for(const key of F3.INGREDIENT_CODES)
  assert.equal(r.demand[key],reconstructed[key]||0,'reused ingredient: '+key);
 assert.equal(totalDemand,Object.values(reconstructed).reduce((a,b)=>a+b,0));
});
test('F3 energy prioritization does not blindly maximize dish quantity',()=>{
 const o=F3.plan({recipes:mini.slice(0,2),categories:['curry'],bagCapacity:18,
  potCapacity:20,camp:false,currentStock:{}});
 assert.equal(o.status,'PROVISIONAL',o.message);
 assert(o.categories[0].dishes.some(x=>x.id==='high'),JSON.stringify(o.categories));
 assert(o.energyProxy>180,'19+ tiny dishes should not outrank high energy meals');
 assert(o.recipesUsed<18,'Quantity-only objective accidentally won');
});
test('F3 handles prepared stock, non-target bag usage, optional future ingredient production',()=>{
 const base=run({bagCapacity:30,currentStock:{egg:5,soy:2,leek:7}});
 assert.equal(base.status,'PROVISIONAL',base.message);
 assert.equal(base.capacity.starting,14);
 assert(base.capacity.used<=30);
 const future=run({bagCapacity:30,currentStock:{egg:5,soy:2,leek:7},
  forecastProduction:{apple:9}});
 assert.equal(future.status,'PROVISIONAL',future.message);
 assert.equal(future.production.apple,9);
 assert.equal(future.goals.apple,Math.max(0,future.demand.apple-9));
 assert.equal(future.topups.apple,Math.max(0,future.goals.apple-0));
 assert(future.warnings.some(x=>x.includes('入手時刻')));
 assert(Object.values(future.topups).reduce((a,b)=>a+b,0)+14<=30);
});
test('F3 respects Sunday doubling of pot, camp pot bonus, and known energy multiplier inputs',()=>{
 const recipes=[{id:'long',name:'大鍋料理',type:'curry',baseStrength:5000,requirements:{apple:12}},
 {id:'short',name:'小鍋料理',type:'curry',baseStrength:10,requirements:{apple:3}}];
 const params={recipes,categories:['curry'],bagCapacity:100,potCapacity:7,
  camp:false,currentStock:{},mealSlots:21};
 const r=F3.plan(params);
 assert.equal(r.status,'PROVISIONAL',r.message);
 assert.equal(r.capacity.potWeekday,7);assert.equal(r.capacity.potSunday,14);
 assert(r.categories[0].dishes.some(x=>x.id==='long'),JSON.stringify(r.categories));
 const t=F3.plan({...params,tastyChance:.2,dishMultiplier:1.5,extraPot:2,camp:true});
 assert.equal(t.status,'PROVISIONAL',t.message);
 assert.equal(t.capacity.potWeekday,14);
 assert(t.energyProxy>r.energyProxy);
});
test('F3 incomplete, invalid, corrupt or event-overlapping inputs fail closed',()=>{
 const base={recipes:mini,categories:['curry'],bagCapacity:50,potCapacity:57,camp:true};
 for(const x of [
  {...base,bagCapacity:null},
  {...base,potCapacity:null},
  {...base,bagCapacity:0},
  {...base,bagCapacity:10,currentStock:{apple:11}},
  {...base,currentStock:{mystery:1}},
  {...base,currentStock:{apple:-1}},
  {...base,currentStock:{apple:1.5}},
  {...base,categories:['curry','curry']},
  {...base,categories:['curry','unknown']},
  {...base,categories:[]},
  {...base,recipes:[{...mini[0],baseStrength:Infinity}]},
  {...base,recipes:[{...mini[0],requirements:{apple:10.3}}]},
  {...base,forecastProduction:{apple:Infinity}},
  {...base,tastyChance:.75},
  {...base,extraPot:999},
  {...base,camp:'true'}
 ])assert.equal(F3.plan(x).status,'BLOCKED',JSON.stringify(x));
});
test('F3 output deterministic, readonly origin, and explicit no-source production assumptions',()=>{
 const params={recipes:mini,categories:['curry','salad','dessert'],bagCapacity:80,
  potCapacity:57,camp:true,currentStock:{apple:8}};
 const a=F3.plan(params),b=F3.plan(params);
 assert.deepEqual(a,b);
 assert.equal(a.status,'PROVISIONAL');
 assert.equal(a.scope,'F3_PREP_ONLY');
 assert.equal(a.method,'BOUNDED_BEAM_V1');
 assert.equal(a.assumptions.forecastProvided,false);
 assert.equal(a.assumptions.eventWeekProductionTiming,'F4 pending');
 assert.equal(a.assumptions.autoOptimization,'bounded proxy; not a guaranteed global maximum');
 assert.equal(params.currentStock.apple,8);
 assert.equal(JSON.stringify(recipeSource),snapshot);
});
test('F3 U2 integration is read-only, respects saved event ledger, and precaches all dependencies',()=>{
 const prep=fs.readFileSync(path.resolve(__dirname,'../e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html'),'utf8');
 const ui=fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-f3-prep-goals-v88.js'),'utf8');
 const sw=fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-sw-v50.js'),'utf8');
 assert.match(prep,/<script src="\.\.\/src\/recipes\.js"><\/script>/);
 assert.match(prep,/<script src="\.\.\/f3\/f3-prep-optimizer-v1\.js"><\/script>/);
 assert.match(prep,/<script src="e7-f3-prep-goals-v88\.js"><\/script>/);
 assert.match(ui,/const ledger=E1\.validateConditionLedger\(JSON\.parse\(ledgerRaw\)\)/);
 assert.match(ui,/\['CONFIRMED','MISSING'\]\.includes\(ledger\.confirmed\?\.status\)/);
 assert.match(ui,/const stockRaw=Scope\.read\(localStorage,week,id\)/);
 assert.match(ui,/const own=JSON\.parse\(raw\)/);
 assert.doesNotMatch(ui,/localStorage\.setItem|localStorage\.removeItem/);
 assert.match(sw,/\.\.\/src\/recipes\.js/);
 assert.match(sw,/\.\.\/f3\/f3-prep-optimizer-v1\.js/);
 assert.match(sw,/e7-f3-prep-goals-v88\.js/);
 assert.match(sw,/v88-f3-prep-20261113/);
 const root=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 assert.doesNotMatch(root,/f3-prep-optimizer|e7-f3-prep-goals/);
});

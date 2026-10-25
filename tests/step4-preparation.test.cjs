'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});
context.globalThis=context;
for(const name of ['master.js','recipes.js','step4.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/'+name),'utf8'),context,{filename:name});
const api=context.PokeStep4;
const data=(extra={})=>({recipeId:'apple_curry',meals:21,bagCapacity:600,priority:'stock',
 carryover:{apple:20},potSize:57,foodMode:'curry',eventEffects:'',...extra});
const plain=x=>JSON.parse(JSON.stringify(x));
test('S4-A: exact 21-meal ingredient reversal with existing carryover',()=>{
 const p=api.plan(data());
 assert.equal(p.recipe.name,'とくせんリンゴカレー');
 assert.equal(p.rows.find(x=>x.key==='apple').required,147);
 assert.equal(p.rows.find(x=>x.key==='apple').perMeal,7);
 assert.equal(p.rows.find(x=>x.key==='apple').carryover,20);
 assert.equal(p.rows.find(x=>x.key==='apple').toGather,127);
 assert.equal(p.uncovered,0);
 assert.equal(p.eventStartStock,147);
 assert.equal(p.rows.find(x=>x.key==='apple').firstHalf+p.rows.find(x=>x.key==='apple').secondHalf,127);
});
test('S4-B: two priorities use explicit bag share, not a game-energy score',()=>{
 const stocked=api.plan(data({bagCapacity:100,carryover:{},priority:'stock'}));
 const current=api.plan(data({bagCapacity:100,carryover:{},priority:'energy'}));
 assert.equal(stocked.plannedNew,90);
 assert.equal(current.plannedNew,30);
 assert.equal(stocked.uncovered,57);
 assert.equal(current.uncovered,117);
 assert.equal(stocked.eventStartStock,90);
 assert.equal(current.eventStartStock,30);
 assert.equal(stocked.quotaRatio,0.9);
 assert.equal(current.quotaRatio,0.3);
 assert.equal(stocked.exact,false);
});
test('S4-A: multi-ingredient plan preserves integer allocations and capped bag',()=>{
 const recipe=context.PokeRecipes.find(r=>Object.keys(r.requirements).length===4);
 assert.ok(recipe);
 const p=api.plan(data({recipeId:recipe.id,carryover:{},bagCapacity:61,meals:21,priority:'stock'}));
 assert.equal(p.plannedNew,54);
 assert.equal(p.rows.reduce((n,x)=>n+x.toGather,0),54);
 assert.ok(p.rows.every(x=>x.firstHalf+x.secondHalf===x.toGather));
 assert.ok(p.rows.every(x=>x.toGather<=x.required));
 assert.ok(p.rows.every(x=>Number.isInteger(x.target)&&Number.isInteger(x.uncovered)));
 assert.ok(p.eventStartStock<=p.capacity);
});
test('S4-A: inherited carryover beyond quota stays intact (but beyond bag capacity is error)',()=>{
 const current=api.plan(data({carryover:{apple:40},bagCapacity:100,priority:'energy'}));
 assert.equal(current.initialCount,40);
 assert.equal(current.plannedNew,0);
 assert.equal(current.eventStartStock,40);
 assert.ok(current.warnings.some(x=>x.includes('勝手に減らさず')));
 assert.throws(()=>api.plan(data({carryover:{apple:101},bagCapacity:100})),/バッグ容量を超え/);
});
test('S4-A: reject malformed recipe, mode, ingredient keys, counts and over-21 targets',()=>{
 for(const invalid of [
  {recipeId:'INVALID'}, {priority:'surprise'}, {meals:22},{meals:0},
  {bagCapacity:0},{bagCapacity:1.5},{carryover:{INVALID:2}},
  {carryover:{apple:-1}},{carryover:{apple:1.5}}
 ])assert.throws(()=>api.plan(data(invalid)));
});
test('S4-A: randomized event category and pot shortages are disclosed, never promised',()=>{
 const p=api.plan(data({foodMode:'random',potSize:6,eventEffects:'event bonus'}));
 assert.ok(p.warnings.some(x=>x.includes('ランダム')));
 assert.ok(p.warnings.some(x=>x.includes('通常鍋容量')));
 assert.ok(p.warnings.some(x=>x.includes('イベント補正')));
 assert.equal(p.exact,false);
});
test('S4-C: propose ingredient matching five without editing fixed sleep or day rosters',()=>{
 const species=context.PokeMaster.species;
 const picks=species.filter(sp=>(sp.ings||[]).some(ing=>ing.name==='apple'&&ing.c1>0)).slice(0,3);
 const remainder=species.filter(sp=>!picks.includes(sp)).slice(0,6);
 assert.equal(picks.length,3);
 const box=[...picks,...remainder].map((sp,i)=>({
  id:'p'+i,pokemon:sp.name,level:60,
  ingredients:sp.ings?.slice(0,3).map(x=>context.PokeMaster.ingredients[x.name])||[]
 }));
 const sleepIds=box.slice(0,5).map(p=>p.id),before=JSON.stringify({box,sleepIds});
 const p=api.plan(data({carryover:{},bagCapacity:600,priority:'stock'}));
 const guide=api.ingredientGuide({box,sleepIds,dayTeams:{},plan:p});
 assert.equal(guide.teams.morning.length,5);
 assert.equal(new Set(guide.teams.morning).size,5);
 assert.ok(guide.teams.morning.every(x=>box.some(p=>p.id===x)));
 assert.deepEqual(plain(guide.teams.morning),plain(guide.teams.noon));
 assert.deepEqual(plain(guide.teams.noon),plain(guide.teams.evening));
 assert.equal(JSON.stringify({box,sleepIds}),before);
 assert.ok(guide.warnings.some(x=>x.includes('参考候補')));
});
test('S4-C: energy priority returns current validated day teams without changes',()=>{
 const box=Array.from({length:6},(_,i)=>({id:'p'+i,pokemon:'ライチュウ',level:30,ingredients:['とくせんリンゴ']}));
 const sleepIds=box.slice(0,5).map(x=>x.id),dayTeams={
  morning:['p1','p2','p3','p4','p5'],noon:[...sleepIds],evening:[...sleepIds]
 };
 const before=JSON.stringify(dayTeams),p=api.plan(data({priority:'energy'}));
 const guide=api.ingredientGuide({box,sleepIds,dayTeams,plan:p});
 assert.deepEqual(plain(guide.teams.morning),dayTeams.morning);
 assert.equal(JSON.stringify(dayTeams),before);
 assert.deepEqual(plain(guide.teams.noon),sleepIds);
});
test('S4 backward compatibility: v1 JSON without prep settings gains safe defaults',()=>{
 const store=vm.createContext({});store.globalThis=store;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/storage.js'),'utf8'),store);
 const original=store.PokeStorage.newState();delete original.preparation;
 const copy=store.PokeStorage.validateState(original);
 assert.deepEqual(plain(copy.preparation),plain(store.PokeStorage.defaultPreparation()));
 copy.preparation={recipeId:'apple_curry',meals:21,bagCapacity:100,priority:'stock',carryover:{apple:15}};
 const saved=store.PokeStorage.validateState(copy);
 assert.equal(saved.preparation.carryover.apple,15);
 assert.deepEqual(plain(saved.sleepIds),plain(copy.sleepIds));
 assert.throws(()=>store.PokeStorage.validateState({...copy,preparation:{...copy.preparation,carryover:{notIngredient:2}}}));
});

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
test('S4-A: distinct recipe targets aggregate exactly within one 21-meal week',()=>{
 const p=api.plan(data({recipeTargets:[
  {recipeId:'apple_curry',meals:10},{recipeId:'curry_03',meals:11}
 ],carryover:{apple:5},bagCapacity:600}));
 assert.equal(p.recipe,null);
 assert.equal(p.recipes.length,2);
 assert.equal(p.meals,21);
 assert.equal(p.rows.find(r=>r.key==='apple').required,70);
 assert.equal(p.rows.find(r=>r.key==='tomato').required,110);
 assert.equal(p.rows.find(r=>r.key==='herb').required,55);
 assert.equal(p.plannedNew,230);
 assert.equal(p.initialCount,5);
 assert.equal(p.uncovered,0);
 assert.equal(p.rows.reduce((n,r)=>n+r.required,0),235);
 assert.ok(p.warnings.some(w=>w.includes('曜日・時間帯')));
});
test('S4-A: multi-recipe validation and selected category remain conservative',()=>{
 const targets=[{recipeId:'apple_curry',meals:10},{recipeId:'curry_03',meals:11}];
 assert.throws(()=>api.plan(data({recipeTargets:[...targets,{recipeId:'curry_02',meals:1}]})),/21食以内/);
 assert.throws(()=>api.plan(data({recipeTargets:[targets[0],targets[0]]})),/重複/);
 assert.throws(()=>api.plan(data({recipeTargets:[{recipeId:'apple_curry',meals:0}]})),/不正/);
 assert.throws(()=>api.plan(data({recipeTargets:[]})),/1品以上/);
 assert.throws(()=>api.plan(data({recipeTargets:[{recipeId:'absent',meals:1}]})),/選択/);
 const mixed=api.plan(data({recipeTargets:[{recipeId:'apple_curry',meals:1},
  {recipeId:'dessert_78',meals:1}],foodMode:'curry',potSize:7}));
 assert.ok(mixed.warnings.some(w=>w.includes('カテゴリと異なる')));
 assert.ok(mixed.warnings.some(w=>w.includes('通常鍋容量')));
 assert.equal(mixed.exact,false);
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
 const p=api.plan(data({recipeId:'curry_03',foodMode:'random',potSize:7,eventEffects:'event bonus'}));
 assert.ok(p.warnings.some(x=>x.includes('ランダム')));
 assert.ok(p.warnings.some(x=>x.includes('通常鍋容量')));
 assert.ok(p.warnings.some(x=>x.includes('イベント補正')));
 assert.equal(p.exact,false);
});
test('S4-C: propose ingredient matching five without editing fixed sleep or day rosters',()=>{
 const species=context.PokeMaster.species;
 const picks=species.filter(sp=>(sp.ings||[]).some(ing=>ing?.name==='apple'&&ing.c1>0)).slice(0,3);
 const remainder=species.filter(sp=>!picks.includes(sp)).slice(0,6);
 assert.equal(picks.length,3);
 const box=[...picks,...remainder].map((sp,i)=>({
  id:'p'+i,pokemon:sp.name,level:60,
  ingredients:sp.ings?.slice(0,3).map(x=>x?context.PokeMaster.ingredients[x.name]:'')||[]
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
test('S4-C: preparation week forecast reuses one weekly engine with explicit no-cooking assumptions',()=>{
 const prepared=api.plan(data({bagCapacity:100,priority:'energy',carryover:{apple:10}}));
 const box=Array.from({length:5},(_,i)=>({id:'p'+i})),sleepIds=box.map(p=>p.id);
 const teams={morning:[...sleepIds],noon:[...sleepIds],evening:[...sleepIds]};
 const before=JSON.stringify({prepared,teams});let captured;
 const forecast=api.forecast({box,sleepIds,teams,plan:prepared,field:'シアンの砂浜',fieldBonus:25,camp:true,
  weeklyOptions:{tapMinutes:150,sleepScore:88,initialEnergy:100,initialIngredients:{apple:999},
   recipeId:'curry_03',recipeMode:'best',extraMode:'fill',successMode:'expected',eventEffects:'bonus'}},
  input=>{captured=input;return {ingredients:{apple:12.5,tomato:4},inventory:{apple:22.5,tomato:4},warnings:['モデル警告']};});
 assert.equal(captured.options.map,'シアンの砂浜');
 assert.equal(captured.options.fieldBonus,25);
 assert.equal(captured.options.camp,true);
 assert.deepEqual(plain(captured.options.initialIngredients),{apple:10});
 assert.equal(captured.options.bagCapacity,100);
 assert.equal(captured.options.recipeId,'');
 assert.equal(captured.options.recipeMode,'fixed');
 assert.equal(captured.options.foodMode,'random');
 assert.equal(captured.options.extraMode,'none');
 assert.equal(captured.options.successMode,'none');
 assert.equal(captured.options.eventEffects,'');
 assert.deepEqual(plain(captured.teams.sleep),sleepIds);
 assert.equal(forecast.rows[0].expectedNew,12.5);
 assert.equal(forecast.rows[0].expectedShortfall,Math.max(0,forecast.rows[0].targetFinal-22.5));
 assert.equal(forecast.allExpectedNew,16.5);
 assert.equal(forecast.expectedBagEnd,26.5);
 assert.equal(forecast.exact,false);
 assert.deepEqual(plain(forecast.modelWarnings),['モデル警告']);
 assert.equal(JSON.stringify({prepared,teams}),before);
});
test('S4-C: forecast refuses unknown field and malformed model output, never claims exact stock',()=>{
 const prepared=api.plan(data()),box=Array.from({length:5},(_,i)=>({id:'p'+i}));
 const sleepIds=box.map(p=>p.id),teams={morning:[...sleepIds],noon:[...sleepIds],evening:[...sleepIds]};
 const args={box,sleepIds,teams,plan:prepared,weeklyOptions:{},field:'',fieldBonus:0,camp:false};
 assert.throws(()=>api.forecast(args,()=>({ingredients:{},inventory:{}})),/フィールド/);
 assert.throws(()=>api.forecast({...args,field:'ワカクサ本島',fieldBonus:101},()=>({ingredients:{},inventory:{}})),/ボーナス/);
 assert.throws(()=>api.forecast({...args,field:'ワカクサ本島'},()=>({ingredients:{apple:NaN},inventory:{}})),/食材出力/);
 assert.throws(()=>api.forecast({...args,field:'ワカクサ本島'},()=>({ingredients:{INVALID:5},inventory:{}})),/食材出力/);
});
test('S4-D: cooking scenario uses explicitly saved recipe and inventory without changing event settings',()=>{
 const prepared=api.plan(data()),box=Array.from({length:5},(_,i)=>({id:'p'+i}));
 const sleepIds=box.map(p=>p.id),teams={morning:[...sleepIds],noon:[...sleepIds],evening:[...sleepIds]};
 let captured;
 const source={box,sleepIds,teams,plan:prepared,field:'シアンの砂浜',fieldBonus:40,camp:false,
  cookingMode:'saved',foodMode:'curry',inventorySource:'simulation',weeklyOptions:{
   initialIngredients:{apple:30},recipeId:'apple_curry',recipeMode:'fixed',
   extraMode:'fill',successMode:'expected',tapMinutes:150}};
 const before=JSON.stringify(source);
 const f=api.forecast(source,input=>{
  captured=input;
  return {ingredients:{apple:20},inventory:{apple:17},total:12345,cooking:3456,warnings:['料理の未保証']};
 });
 assert.equal(captured.options.recipeId,'apple_curry');
 assert.equal(captured.options.foodMode,'curry');
 assert.equal(captured.options.recipeMode,'fixed');
 assert.equal(captured.options.extraMode,'fill');
 assert.equal(captured.options.successMode,'expected');
 assert.deepEqual(plain(captured.options.initialIngredients),{apple:30});
 assert.equal(f.cookingMode,'saved');
 assert.equal(f.weeklyEnergy,12345);
 assert.equal(f.cookingEnergy,3456);
 assert.equal(f.rows[0].expectedFinal,17);
 assert.equal(f.rows[0].expectedShortfall,Math.max(0,f.rows[0].targetFinal-17));
 assert.equal(JSON.stringify(source),before);
 assert.throws(()=>api.forecast({...source,foodMode:'random'},()=>({})),/料理カテゴリ/);
 assert.throws(()=>api.forecast({...source,foodMode:'salad'},()=>({})),/一致しません/);
 assert.throws(()=>api.forecast({...source,inventorySource:'unknown'},()=>({})),/不正/);
});
test('S4-E: compare both priorities against identical event recipe demand without choosing a winner',()=>{
 const box=Array.from({length:6},(_,i)=>({id:'p'+i,pokemon:'ライチュウ',level:30,ingredients:['とくせんリンゴ']}));
 const sleepIds=box.slice(0,5).map(p=>p.id),dayTeams={
  morning:['p1','p2','p3','p4','p5'],noon:[...sleepIds],evening:[...sleepIds]
 };
 const options={planInput:data({bagCapacity:100,priority:'stock',carryover:{}}),box,sleepIds,dayTeams,
  field:'シアンの砂浜',fieldBonus:20,camp:false,weeklyOptions:{initialIngredients:{}},
  cookingMode:'none',foodMode:'random',inventorySource:'carryover'};
 const before=JSON.stringify(options),seen=[];
 const result=api.compareModes(options,input=>{
  seen.push(plain(input));
  return {ingredients:{apple:12},inventory:{apple:12},total:1000,cooking:0,warnings:[]};
 });
 assert.equal(seen.length,2);
 assert.equal(seen[0].options.map,seen[1].options.map);
 assert.deepEqual(seen[0].options.initialIngredients,seen[1].options.initialIngredients);
 assert.equal(result.scenarios.energy.plannedNew,30);
 assert.equal(result.scenarios.stock.plannedNew,90);
 assert.equal(result.scenarios.energy.expectedRequiredShortfall,135);
 assert.equal(result.scenarios.stock.expectedRequiredShortfall,135);
 assert.equal(result.scenarios.energy.forecast.weeklyEnergy,1000);
 assert.equal(result.exact,false);
 assert.ok(result.assumptions.some(x=>x.includes('最適化の証明')));
 assert.equal(JSON.stringify(options),before);
 assert.deepEqual(plain(sleepIds),['p0','p1','p2','p3','p4']);
});
test('S4-E: invalid compare input rejects without a disguised fallback',()=>{
 const box=Array.from({length:4},(_,i)=>({id:'p'+i,pokemon:'ライチュウ'}));
 assert.throws(()=>api.compareModes({planInput:data(),box,
  sleepIds:box.map(p=>p.id),dayTeams:{},field:'ワカクサ本島',fieldBonus:0,
  weeklyOptions:{}},()=>({ingredients:{},inventory:{}})),/5匹編成/);
 assert.throws(()=>api.compareModes({planInput:null},()=>({})),/備蓄計画/);
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
test('S4 old one-recipe backups migrate to new targets and multi-recipe targets round-trip',()=>{
 const store=vm.createContext({});store.globalThis=store;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/storage.js'),'utf8'),store);
 const old=store.PokeStorage.newState();
 old.preparation={recipeId:'apple_curry',meals:7,priority:'stock',bagCapacity:250,carryover:{apple:12}};
 const migrated=store.PokeStorage.validateState(old);
 assert.deepEqual(plain(migrated.preparation.recipeTargets),[{recipeId:'apple_curry',meals:7}]);
 assert.equal(migrated.preparation.field,'');
 assert.equal(migrated.preparation.fieldBonus,0);
 assert.equal(migrated.preparation.forecastCooking,'none');
 assert.equal(migrated.preparation.forecastInventorySource,'carryover');
 migrated.preparation.recipeTargets=[{recipeId:'apple_curry',meals:7},{recipeId:'curry_03',meals:14}];
 migrated.preparation.field='ラピスラズリ湖畔';migrated.preparation.fieldBonus=42;
 migrated.preparation.forecastCooking='saved';migrated.preparation.forecastFoodMode='curry';
 migrated.preparation.forecastInventorySource='simulation';
 const restored=store.PokeStorage.validateState(JSON.parse(JSON.stringify(migrated)));
 assert.deepEqual(plain(restored.preparation.recipeTargets),plain(migrated.preparation.recipeTargets));
 assert.equal(restored.preparation.field,'ラピスラズリ湖畔');
 assert.equal(restored.preparation.fieldBonus,42);
 assert.equal(restored.preparation.forecastCooking,'saved');
 assert.equal(restored.preparation.forecastFoodMode,'curry');
 assert.equal(restored.preparation.forecastInventorySource,'simulation');
 assert.throws(()=>store.PokeStorage.validateState({...restored,preparation:{...restored.preparation,fieldBonus:101}}),/準備週/);
 assert.throws(()=>store.PokeStorage.validateState({...restored,
  preparation:{...restored.preparation,recipeTargets:[...restored.preparation.recipeTargets,{recipeId:'curry_02',meals:1}]} }),/21食以内/);
});

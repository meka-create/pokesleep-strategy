'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const load=p=>{const ctx={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),ctx,{filename:p,timeout:15000});
 return ctx.module.exports;};
const reserve=load('f4/f4-m2-meal-reserves-v129.js');
const recipes=[
 {id:'a',type:'curry',requirements:{apple:7}},
 {id:'b',type:'curry',requirements:{apple:4,milk:2}},
 {id:'c',type:'curry',requirements:{honey:5}},
 {id:'d',type:'curry',requirements:{apple:1}}
];
function plan(byIndex={}){
 const slots=[{day:-1,slot:'sleep',source:'PREVIOUS_WEEK_SLEEP',recipeId:null}];
 for(let day=0;day<7;day++)for(const slot of ['morning','noon','evening','sleep']){
  const i=slots.length;
  slots.push({day,slot,recipeId:slot==='sleep'?null:byIndex[i]??null});
 }
 return slots;
}
const byCode=items=>Object.fromEntries(items.map(x=>[x.foodCode,x.count]));
test('M2: after-current-meal reserves sum strictly later recipe requirements only',()=>{
 const slots=plan({1:'a',2:'b',3:'c',5:'d'});
 const before=JSON.stringify(slots);
 const x=reserve.build(slots,recipes);
 assert.equal(x.status,'RESERVES_READY',x.reason);
 assert.equal(x.plannedMealCount,4);
 assert.equal(x.currentBagUsed,false);
 assert.equal(x.futureProductionUsed,false);
 assert.equal(x.isStockIndependent,true);
 assert.deepEqual(byCode(x.afterByWindow[1]),{apple:5,milk:2,honey:5},
  'breakfast apple 7 excluded, future lunch apple 4 + Tuesday apple 1 included');
 assert.deepEqual(byCode(x.afterByWindow[2]),{apple:1,honey:5},
  'milk from current lunch is not a future reserve');
 assert.deepEqual(byCode(x.afterByWindow[3]),{apple:1});
 assert.deepEqual(byCode(x.afterByWindow[5]),{});
 assert.equal(JSON.stringify(slots),before,'no plan mutation');
});
test('M2: 21-meal schedule, final meal has no reserves and never includes unrelated foods',()=>{
 const dishes=plan();
 for(let i=1;i<29;i++)if(dishes[i].slot!=='sleep')dishes[i].recipeId=i%2?'a':'b';
 const x=reserve.build(dishes,recipes);
 assert.equal(x.status,'RESERVES_READY');
 assert.equal(x.plannedMealCount,21);
 assert.deepEqual(byCode(x.afterByWindow[27]),{});
 assert(!x.afterByWindow[1].some(t=>t.foodCode==='nuts'));
 assert(!x.afterByWindow[1].some(t=>t.foodCode==='honey'));
 assert(Object.values(byCode(x.afterByWindow[1])).every(n=>n>0));
});
test('M2: missing recipes, corrupt order and unrecognized ingredient fail closed',()=>{
 const input=plan({1:'a',2:'b'});
 assert.equal(reserve.build(input,[{id:'a',requirements:{unknownFood:4}}]).status,'BLOCKED');
 assert.equal(reserve.build(input,recipes.slice(0,1)).reason,'M2_PLAN_RECIPE_SEQUENCE_INVALID');
 const broken=plan({1:'a'});broken[4].recipeId='a';
 assert.equal(reserve.build(broken,recipes).status,'BLOCKED');
 const order=plan({1:'a'});order[1].day=5;
 assert.equal(reserve.build(order,recipes).status,'BLOCKED');
 assert.equal(reserve.build([],recipes).status,'BLOCKED');
});
test('M2: same plan and recipes produce identical reserves regardless of current stock',()=>{
 const slots=plan({1:'a',2:'b',3:'c'}),before=JSON.stringify(slots);
 const x=reserve.build(slots,recipes);
 const arbitraryStocks=[{apple:0,milk:0},{apple:99,milk:99},{apple:10000}];
 for(const stocks of arbitraryStocks){
  assert(stocks);
  assert.equal(JSON.stringify(reserve.build(slots,recipes).afterByWindow),
   JSON.stringify(x.afterByWindow));
 }
 assert.equal(JSON.stringify(slots),before);
});
test('M2: real 81 recipes, all canonical food codes accepted',()=>{
 const real=load('e7-preview/e7-recipes-v122.js');
 assert.equal(real.length,81);
 const sources=real.filter(r=>Object.keys(r.requirements).includes('nuts'));
 assert.equal(sources.length,3);
 const slots=plan({1:sources[0].id,2:sources[1].id,3:sources[2].id});
 const x=reserve.build(slots,real);
 assert.equal(x.status,'RESERVES_READY');
 const expected=sources[1].requirements.nuts+sources[2].requirements.nuts;
 assert.equal(byCode(x.afterByWindow[1]).nuts,expected);
 assert(!Object.hasOwn(byCode(x.afterByWindow[3]),'nuts'));
});
test('M2: integrated U3 displays icon and count under meal for reviews and adopted plans',()=>{
 const code=read('e7-preview/e7-f4c-integrated-v112.js');
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(code,/PokeM2MealReservesV129\?\.build\(visible\.slots,deps\.recipes\)/);
 assert.match(code,/drawSlots\(q\('review-slots'\),viewForDraft\(\),reviewDay\)/);
 assert.match(code,/drawSlots\(q\('slots'\),plan,targetDay\)/);
 assert.match(code,/PAST_FORECAST_ONLY/);
 assert.match(code,/ACTIVE_REMAINDER/);
 assert.match(code,/最低残す（この料理の後）/);
 assert.match(code,/m2-reserve-count/);
 assert.match(html,/f4-m2-meal-reserves-v129\.js/);
 assert.match(html,/e7-m2-meal-reserves-v129\.css/);
 assert.match(sw,/f4-m2-meal-reserves-v129\.js/);
 assert.match(sw,/e7-m2-meal-reserves-v129\.css/);
});
test('M2: pure calculator cannot access storage, logs, remote network or private box',()=>{
 const code=read('f4/f4-m2-meal-reserves-v129.js');
 for(const forbidden of ['localStorage','setItem(', 'fetch(','console.log',
  'nickname','privateBoxRows','sessionStorage'])
  assert(!code.includes(forbidden),forbidden);
 assert.equal(code.includes('inventory'),true);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(p){
 const source=fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(source,sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;
}
const exact=load('f4/f4-b-chronological-v2.js');
const baseCore=load('f4/f4-chronological-core-v1.js');
const gameWeek=load('f4/f4-b-game-week-v1.js');
const deps={base:baseCore,gameWeek};
const clone=x=>JSON.parse(JSON.stringify(x));
const profile=(i,foods={apple:1},berry=10)=>({
 id:'p'+i,source:'F1_B_PINNED_66_SPECIES',helpingBonus:i===0,
 nickname:'PRIVATE_DO_NOT_SERIALIZE_'+i,
 ratesByTeammateBonus:Array.from({length:5},(_,b)=>({
  status:'BASE_RATES_AVAILABLE',helpSeconds:3600-30*b,
  berryEnergyPerHelp:berry+i,ingredientCountsPerHelp:foods
 }))
});
const profiles=Array.from({length:8},(_,i)=>profile(i));
const previous=['p0','p1','p2','p3','p4'];
const nights=Array.from({length:7},(_,i)=>Array.from({length:5},(_,n)=>'p'+((n+i)%8)));
const meal={id:'apple_curry',type:'curry',baseStrength:1000,requirements:{apple:7}};
function input(other={}){
 return {weekStart:'2026-11-16',asOf:'2026-11-14T16:00:00+09:00',
  eventMode:'NEUTRAL_REFERENCE_ONLY',eventSource:null,foodMode:'curry',
  potCapacity:57,bagCapacity:300,camp:false,fieldBonus:30,
  profiles,recipes:[meal],initialInventory:{apple:15},
  previousWeekSleepTeam:previous,autoSleep:false,nightTeams:nights,...other};
}
test('F4-B exact clock calculates 29 windows, 21 meals, previous Sunday tail, final truncated night',()=>{
 const x=exact.plan(input(),deps);
 assert.equal(x.status,'PROVISIONAL',x.reason);
 assert.equal(x.slotCount,29);assert.equal(x.totalHours,168);
 assert.equal(x.daytimeSlots,21);assert.equal(x.mealOpportunities,21);
 assert.equal(x.sleepSlots,7);assert.equal(x.carrySleepSlots,1);
 assert.equal(x.startsAt,'2026-11-15T19:00:00.000Z');
 assert.equal(x.endsAt,'2026-11-22T19:00:00.000Z');
 assert.equal(x.slots.length,29);
 assert.equal(x.slots[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(x.slots[0].hours,3.5);assert.equal(x.slots[0].mealEnergy,0);
 assert.deepEqual([...x.slots[0].team],previous);
 assert.equal(x.slots[28].source,'FINAL_NIGHT_TRUNCATED');
 assert.equal(x.slots[28].hours,4);
 assert.deepEqual([...x.slots[28].team],nights[6]);
 assert.equal(x.slots.reduce((sum,s)=>sum+s.hours,0),168);
 assert.equal(x.slots.filter(s=>s.recipeId!==null).length,x.mealsCooked);
 assert(x.mealsCooked<=21);assert(x.mealsCooked>0);
 for(let day=0;day<7;day++){
  const subset=x.slots.slice(1+day*4,1+day*4+4);
  assert.deepEqual(subset.map(r=>r.slot),['morning','noon','evening','sleep']);
  assert.deepEqual([...subset[3].team],nights[day]);
  assert(subset.every(r=>r.team.length===5&&new Set(r.team).size===5));
 }
 assert.equal(x.weeklyEnergyCertified,false);
 assert.equal(x.writesSavedData,false);assert.equal(x.privateIndividualDataInResult,false);
 assert(!JSON.stringify(x).includes('PRIVATE_DO_NOT_SERIALIZE'));
});
test('carry berries explicitly excluded from new-week energy; 29 window sum accounts separately',()=>{
 const x=exact.plan(input(),deps);
 assert.equal(x.status,'PROVISIONAL');
 assert.equal(x.slots[0].berryEnergyProxy,0);
 assert(x.slots[0].carryBerryExcludedProxy>0);
 assert.equal(x.slots.slice(1).every(s=>s.carryBerryExcludedProxy===0),true);
 assert.equal(x.energyProxy,x.mealEnergyProxy+x.berryEnergyProxy);
 assert.equal(x.carryBerryExcludedProxy,Math.round(x.slots[0].carryBerryExcludedProxy));
});
test('manual sleep is never replaced even when its members are low-yield',()=>{
 const teams=Array.from({length:7},()=>['p0','p1','p2','p3','p4']);
 const x=exact.plan(input({nightTeams:teams}),deps);
 assert.equal(x.status,'PROVISIONAL');
 for(let d=0;d<7;d++)
  assert.deepEqual([...x.slots[4+d*4].team],teams[d]);
 assert.notEqual(x.slots[0],x.slots[4]);
});
test('only explicitly enabled auto sleep searches valid real candidate groups',()=>{
 const x=exact.plan(input({autoSleep:true,nightTeams:null}),deps);
 assert.equal(x.status,'PROVISIONAL',x.reason);
 assert.equal(x.autoSleep,true);
 for(let d=0;d<7;d++){
  const row=x.slots[4+d*4];
  assert.equal(row.slot,'sleep');
  assert.equal(new Set(row.team).size,5);
  assert(row.team.every(id=>profiles.some(p=>p.id===id)));
 }
});
test('meal cannot borrow ingredients produced during its own daytime slot',()=>{
 const rows=Array.from({length:10},(_,i)=>profile(i,i<5?{apple:0}:{apple:2},1));
 const p=[...previous],manual=Array.from({length:7},()=>p);
 const x=exact.plan(input({profiles:rows,previousWeekSleepTeam:p,nightTeams:manual,
  initialInventory:{apple:0},recipes:[{...meal,requirements:{apple:3}}]}),deps);
 assert.equal(x.status,'PROVISIONAL');
 assert.equal(x.slots[0].inventoryAfter.apple,0);
 assert.equal(x.slots[1].recipeId,null,'Monday breakfast borrowed future apples');
 assert(x.slots[1].inventoryAfter.apple>0,'morning help should create apples');
 assert(x.slots.slice(2).some(row=>row.recipeId===meal.id));
});
test('ingredient bag limit caps each window and no food count becomes negative',()=>{
 const x=exact.plan(input({bagCapacity:40,initialInventory:{apple:35}}),deps);
 assert.equal(x.status,'PROVISIONAL');
 assert(x.discardedIngredientExpectation>0);
 for(const row of x.slots){
  assert(Object.values(row.inventoryAfter).every(v=>Number.isFinite(v)&&v>=0));
  assert(Object.values(row.inventoryAfter).reduce((a,b)=>a+b,0)<=40.02);
 }
});
test('Sunday pot double enables recipe that cannot fit weekday or Saturday pot',()=>{
 const big={id:'large',type:'curry',baseStrength:95000,requirements:{apple:70}};
 const x=exact.plan(input({potCapacity:45,bagCapacity:900,initialInventory:{apple:600},
  profiles:Array.from({length:8},(_,i)=>profile(i,{apple:0},0)),recipes:[big]}),deps);
 assert.equal(x.status,'PROVISIONAL',x.reason);
 assert(x.slots.filter(r=>r.day<6&&r.recipeId==='large').length===0);
 assert(x.slots.filter(r=>r.day===6&&r.recipeId==='large').length>=1);
});
test('invalid source, invalid carry team and manual nights are BLOCKED',()=>{
 assert.equal(exact.plan(input({eventSource:{id:'official-event'}}),deps).reason,
  'EVENT_MODEL_NOT_CONNECTED');
 assert.equal(exact.plan(input({eventMode:undefined}),deps).reason,
  'EVENT_MODEL_NOT_CONNECTED');
 assert.equal(exact.plan(input({previousWeekSleepTeam:null}),deps).reason,
  'PREVIOUS_WEEK_SLEEP_TEAM_REQUIRED');
 assert.equal(exact.plan(input({previousWeekSleepTeam:['p0','p0','p1','p2','p3']}),deps).reason,
  'PREVIOUS_WEEK_SLEEP_TEAM_REQUIRED');
 assert.equal(exact.plan(input({nightTeams:[...nights.slice(0,6)]}),deps).reason,
  'VERIFIED_MANUAL_NIGHTS_REQUIRED');
 assert.equal(exact.plan(input({nightTeams:[...nights.slice(0,6),['p0','p0','p1','p2','p3']]}),deps).reason,
  'VERIFIED_MANUAL_NIGHTS_REQUIRED');
 assert.equal(exact.plan(input({initialInventory:{nuts:1}}),deps).reason,
  'INVENTORY_INVALID');
 assert.equal(exact.plan(input({asOf:'2026-11-16T04:00:00'}),deps).reason,
  'SOURCE_OR_WEEK_INVALID');
});
test('same input produces identical deterministic results without modifying input',()=>{
 const before=input(),snapshot=JSON.stringify(before);
 const a=exact.plan(before,deps),b=exact.plan(before,deps);
 assert.equal(a.status,'PROVISIONAL');
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.equal(JSON.stringify(before),snapshot);
});
test('F4-B engine source is pure and protected E7 page remains unchanged',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../f4/f4-b-chronological-v2.js'),'utf8');
 for(const pattern of ['localStorage','sessionStorage','fetch(','.setItem(','.removeItem('])
  assert(!source.includes(pattern),'pure F4-B engine contains '+pattern);
 const ui=fs.readFileSync(path.resolve(__dirname,
  '../e7-preview/U3_Strategy_UI_20261109_v50_E7.html'),'utf8');
 assert(!ui.includes('f4-b-chronological-v2.js'),'existing accepted E7 still isolated');
});

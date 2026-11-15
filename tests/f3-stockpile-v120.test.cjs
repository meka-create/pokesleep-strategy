'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Calc=require('../f3/f3-stockpile-v120.js');
const shop=(type,id,energy,requirements)=>({type,id,name:id,baseStrength:energy,requirements});
const RECIPES=[
 shop('curry','c1',1000,{apple:60}),shop('curry','c2',900,{apple:50}),
 shop('curry','c3',800,{apple:40}),shop('curry','c4',700,{apple:30}),
 shop('curry','c5',600,{apple:20}),shop('curry','c6',500,{apple:10}),
 shop('salad','s1',1000,{milk:50}),shop('dessert','d1',1000,{cacao:40})
];
const base={recipes:RECIPES,bagCapacity:200,potCapacity:80,camp:false,
 currentStock:{},categories:['curry'],selectedRecipes:{curry:'c1'}};
test('top five are energy ranked, feasible by weekday pot, sixth is never selectable',()=>{
 const a=Calc.catalog(RECIPES,'curry',80,false);
 assert.equal(a.length,5);assert.deepEqual(a.map(r=>r.id),['c1','c2','c3','c4','c5']);
 assert.equal(Calc.catalog(RECIPES,'curry',30,false)[0].id,'c4');
 assert.equal(Calc.make({...base,selectedRecipes:{curry:'c6'}}).reason,'RECIPE_SELECTION_STALE');
});
test('automatic meal count uses full bag only without fraction or overflow',()=>{
 const r=Calc.make(base);
 assert.equal(r.status,'PROVISIONAL');assert.equal(r.counts.curry,3);
 assert.equal(r.goals.apple,180);assert.equal(r.capacity.used,180);
 assert.deepEqual(Calc.mealOptions(base,'curry'),[1,2,3]);
 assert.equal(Calc.make({...base,targetMeals:{curry:4}}).reason,'NO_ROOM');
});
test('three chosen categories reserve at least one and never introduce fallback recipes',()=>{
 const a=Calc.make({...base,categories:['curry','salad','dessert'],
  selectedRecipes:{curry:'c1',salad:'s1',dessert:'d1'}});
 assert.equal(a.status,'PROVISIONAL');assert.equal(a.counts.curry,1);
 assert.equal(a.counts.salad,2);assert.equal(a.counts.dessert,1);
 assert.equal(a.capacity.used,200);assert.equal(a.goals.apple,60);
 assert.equal(a.goals.milk,100);assert.equal(a.goals.cacao,40);
 assert.equal(Object.keys(a.goals).filter(k=>a.goals[k]>0).length,3);
 assert.equal(Calc.make({...base,categories:['curry','salad','dessert'],
  selectedRecipes:{curry:'c1',salad:'s1',dessert:'d1'},
  targetMeals:{curry:2,salad:1,dessert:1}}).reason,'NO_ROOM');
});
test('current unrelated stock occupies real bag capacity, no false available slots',()=>{
 const a=Calc.make({...base,currentStock:{milk:190}});
 assert.equal(a.reason,'NO_ROOM');
 const r=Calc.make({...base,currentStock:{apple:110}});
 assert.equal(r.status,'PROVISIONAL');assert.equal(r.counts.curry,3);
 assert.equal(r.topups.apple,70);assert.equal(r.capacity.used,180);
});
test('time-aware deficit never borrows post-meal production',()=>{
 const p=Calc.requiredOpeningStock({
  meals:[{apple:10},{apple:10},{apple:10}],
  yields:[{apple:7},{apple:7},{apple:7}]});
 assert.equal(p.status,'PROVISIONAL');assert.equal(p.goals.apple,16);
 assert.equal(Calc.requiredOpeningStock({meals:[{apple:10}],yields:[]}).status,'BLOCKED');
});
test('UI, source, event deletion and F4/F5 recipe priorities are connected',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const ui=read('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 assert.match(ui,/e7-prep-settings-v120\.js/);
 assert.match(ui,/f3-stockpile-v120\.js/);
 const selector=read('e7-preview/e7-prep-settings-v120.js');
 assert.match(selector,/mealOptions/);assert.match(selector,/allocatedMeals:res\.counts/);
 assert.match(selector,/stopImmediatePropagation/);
 const goal=read('e7-preview/e7-f3-prep-goals-v88.js');
 assert.match(goal,/Opt\.make/);assert.doesNotMatch(goal,/Opt\.plan/);
 const del=read('e7-preview/e7-event-delete-v71.js');
 assert.match(del,/F3_STOCKPILE_PREF_V120/);
 const f4=read('f4/f4-c-healer-search-v100.js');
 assert.match(f4,/preferredMealCounts/);
 const f5=read('f5/f5-midweek-v119.js');
 assert.match(f5,/remainingBudget/);
 const store=read('f4/f4-c-real-storage-v112.js');
 assert.match(store,/prepPreferenceRevision/);
});

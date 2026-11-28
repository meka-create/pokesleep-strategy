'use strict';
/* M4 v135: prepare for one of three weekly food categories, not all
 * categories simultaneously. Uses pinned public 81 recipes, never Box data.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>{const env={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),env,{filename:p,timeout:20000});
 return env.module.exports;};
const opt=load('f3/f3-stockpile-v120.js'),recipes=load('e7-preview/e7-recipes-v122.js');
const projection=load('f3/f3-m4-food-preference-v133.js');
const cats=['curry','salad','dessert'],selectedRecipes={
 curry:'curry_25',salad:'salad_51',dessert:'dessert_78'};
const mealCounts=(n)=>({curry:n,salad:n,dessert:n});
const input=(count,extra={})=>({recipes,categories:cats,
 selectedRecipes,targetMeals:mealCounts(count),
 potCapacity:150,bagCapacity:1000,camp:true,currentStock:{},
 preparationMode:'ALTERNATIVE_WEEKLY_FOOD',...extra});
const total=arr=>Object.values(arr||{}).reduce((a,b)=>a+b,0);
test('v135: pinned individual recipes are 112 curry, 95 salad, 115 waffle',()=>{
 assert.equal(recipes.length,81);
 assert.deepEqual(cats.map(cat=>total(recipes.find(r=>r.id===selectedRecipes[cat]).requirements)),[112,95,115]);
});
test('v135: exact screenshot: one of three meals is 277; additive old mode is 322',()=>{
 const r=opt.make(input(1));
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert.equal(r.method,'ALTERNATIVE_WEEKLY_FOOD_MAX');
 assert.equal(r.preparationMode,'ALTERNATIVE_WEEKLY_FOOD');
 assert.equal(r.recipesUsed,1);
 assert.equal(r.alternativeCategories,3);
 assert.equal(total(r.goals),277);
 assert.equal(r.goals.mushroom,31);
 assert.equal(r.goals.corn,28);
 assert.equal(r.goals.ginger,39);
 assert.equal(r.goals.honey,38);
 const sum=opt.make(input(1,{preparationMode:'ALL_MEALS'}));
 assert.equal(sum.status,'PROVISIONAL');
 assert.equal(total(sum.goals),322);
 assert.equal(sum.goals.mushroom,58);
 assert.equal(sum.goals.corn,46);
 assert.equal(total(sum.goals)-total(r.goals),45);
});
test('v135: two alternatives 554, three 831; bag 800 limits 3 but not 2',()=>{
 assert.equal(total(opt.make(input(2)).goals),554);
 const three=opt.make(input(3));
 assert.equal(three.status,'PROVISIONAL');
 assert.equal(total(three.goals),831);
 assert.equal(opt.make(input(3,{bagCapacity:800})).reason,'NO_ROOM');
 assert.equal(total(opt.make(input(2,{bagCapacity:800})).goals),554);
});
test('automatic servings stay equal across two or three alternatives',()=>{
 const settings=input('auto',{bagCapacity:800});
 const three=opt.make(settings);
 assert.deepEqual({...three.counts},mealCounts(2));
 assert.equal(three.capacity.used,554);
 assert.deepEqual({...opt.make({...settings,bagCapacity:831}).counts},mealCounts(3));
 for(const categories of [['curry','salad'],['salad','curry']]){
  const two=opt.make({...settings,categories});
  assert.deepEqual({...two.counts},{curry:4,salad:4});
  assert.equal(two.capacity.used,720);
 }
 const mixed=opt.make({...settings,targetMeals:{curry:'auto',salad:4,dessert:'auto'}});
 assert.deepEqual({...mixed.counts},{curry:2,salad:4,dessert:2});
});
test('v135: real bag occupancy includes ALL unrelated stock, not only 277 target',()=>{
 const r=opt.make(input(1,{bagCapacity:800,currentStock:{apple:550}}));
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'NO_ROOM');
 const fits=opt.make(input(1,{bagCapacity:800,currentStock:{apple:500}}));
 assert.equal(fits.status,'PROVISIONAL');
 assert.equal(fits.capacity.used,777);
 assert.equal(fits.capacity.additional,277);
 assert.equal(fits.capacity.starting,500);
 assert.equal(fits.capacity.free,23);
});
test('v135: original recipes and stock never mutate; all-food event still sums',()=>{
 const input0=input(1),copy=JSON.stringify(input0);
 const one=opt.make(input0),all=opt.make({...input0,preparationMode:'ALL_MEALS'});
 assert.equal(one.status,'PROVISIONAL');
 assert.equal(all.status,'PROVISIONAL');
 assert.equal(JSON.stringify(input0),copy);
 assert.equal(total(all.goals),322);
});
test('v135: exclusive per-category 21 allowed, all-food event still max 21 combined',()=>{
 const p={categories:cats,selectedRecipes,targetCounts:{curry:10,salad:10,dessert:10}};
 assert.equal(projection.project({...p,food:'curry'}).status,'READY');
 assert.equal(projection.project({...p,food:'all'}).status,'BLOCKED');
 const n=opt.make(input(10,{bagCapacity:5000}));
 assert.equal(n.status,'PROVISIONAL',n.reason);
 assert.equal(n.recipesUsed,10);
 assert.equal(total(n.goals),2770);
 const a=opt.make(input(10,{preparationMode:'ALL_MEALS',bagCapacity:5000}));
 assert.equal(a.reason,'NO_ROOM');
});
test('v135: F3 UI and F4 checks explicitly use one food mode and caveat',()=>{
 const f3=read('e7-preview/e7-f3-prep-goals-v88.js');
 const prefs=read('e7-preview/e7-prep-settings-v120.js');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 const sw=read('e7-preview/e7-sw-v50.js');
 for(const s of [f3,prefs,ui])assert.match(s,/ALTERNATIVE_WEEKLY_FOOD/);
 assert.doesNotMatch(f3,/料理内訳/);
 assert.match(f3,/base\.preparationMode==='ALTERNATIVE_WEEKLY_FOOD'/);
 assert.match(prefs,/備蓄後の空き/);
 assert.match(ui,/preparationMode:c\.fields\.food==='all'/);
 assert.match(sw,/v135-exclusive-food-max/);
 assert.doesNotMatch(read('f3/f3-stockpile-v120.js'),/localStorage|setItem\(/);
});

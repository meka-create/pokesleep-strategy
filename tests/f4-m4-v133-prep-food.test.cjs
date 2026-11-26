'use strict';
/* M4 v133 regression: preparing three possible dish types must not block
 * a week whose cooking type later becomes exactly one of those types.
 * This test uses public recipes only; no user box or saved inventory.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(rel){
 const ctx={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',rel),'utf8'),
  ctx,{filename:rel,timeout:15000});
 return ctx.module.exports;
}
const projection=load('f3/f3-m4-food-preference-v133.js');
const stockpile=load('f3/f3-stockpile-v120.js');
const recipes=load('e7-preview/e7-recipes-v122.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const cats=['curry','salad','dessert'];
const chosen=Object.fromEntries(cats.map(cat=>[
 cat,stockpile.catalog(recipes,cat,57,false).at(-1)?.id]));
assert(Object.values(chosen).every(Boolean),'81-recipe catalog must support all types');
function all(){
 return {categories:[...cats],selectedRecipes:{...chosen},
  targetCounts:{curry:1,salad:2,dessert:1},food:'all'};
}
test('M4 v133: all 3 saved F3 categories remain valid for prep, one food for F4/F5',()=>{
 const src=all();
 const before=JSON.stringify(src);
 const prep=stockpile.make({
  recipes,categories:src.categories,selectedRecipes:src.selectedRecipes,
  targetMeals:src.targetCounts,potCapacity:57,bagCapacity:5000,camp:false,
  currentStock:{}});
 assert.equal(prep.status,'PROVISIONAL',prep.reason);
 for(const food of cats){
  const x=projection.project({...src,food});
  assert.equal(x.status,'READY',x.reason);
  assert.deepEqual(Object.keys(x.selectedRecipes),[food]);
  assert.deepEqual(Object.keys(x.targetCounts),[food]);
  assert.equal(x.selectedRecipes[food],src.selectedRecipes[food]);
  assert.equal(x.targetCounts[food],src.targetCounts[food]);
  assert.deepEqual(Array.from(x.excludedCategories),cats.filter(c=>c!==food));
  assert.equal(x.preparedMealCount,4);
  assert.equal(x.eligibleMealCount,src.targetCounts[food]);
  assert.equal(x.sourcePreferencePreserved,true);
  assert.equal(x.writesSavedData,false);
 }
 assert.equal(JSON.stringify(src),before,'saved 3-category target must never be overwritten');
});
test('M4 v133: all-categories event retains 3; no prepared recipe for cooked type permits free choice',()=>{
 const full=projection.project(all());
 assert.equal(full.status,'READY',full.reason);
 assert.deepEqual(Object.keys(full.selectedRecipes),cats);
 assert.equal(full.excludedCategories.length,0);
 const only=projection.project({...all(),categories:['salad'],
  selectedRecipes:{salad:chosen.salad},targetCounts:{salad:3},food:'curry'});
 assert.equal(only.status,'READY');
 assert.equal(Object.keys(only.selectedRecipes).length,0);
 assert.equal(Object.keys(only.targetCounts).length,0);
 assert.equal(only.excludedCategories[0],'salad');
});
test('M4 v133: malformed saved targets cannot be used to bypass safety guards',()=>{
 for(const patch of [
  {food:''},{food:'mystery'},{targetCounts:{curry:22,salad:1,dessert:1}},
  {selectedRecipes:{curry:chosen.curry,salad:chosen.salad}},
  {categories:['curry','curry']},{categories:['other']},
  {targetCounts:{curry:15,salad:10,dessert:1}}
 ]){
  const bad=projection.project({...all(),...patch});
  assert.equal(bad.status,'BLOCKED',JSON.stringify(patch));
 }
});
test('M4 v133: F3 goals and F4/F5 entry points use projected preferences, without modifying original F3 key',()=>{
 const f3=read('e7-preview/e7-f3-prep-goals-v88.js');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 const f4=read('f4/f4-c-auto-v112.js');
 const f5=read('f5/f5-midweek-v119.js');
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.doesNotMatch(f3,/chosenCategories\.some\(c=>c!==fields\.food\)/);
 assert.doesNotMatch(ui,/c\.fields\.food!=='all'&&c\.fields\.food!==cat/);
 assert.match(ui,/PokeM4PrepFoodPreferenceV133\?\.project/);
 assert.match(ui,/targetMeals:p\.allocatedMeals/,'all F3 targets still checked against bag');
 assert.match(ui,/excludedPrepCategories/);
 assert.match(ui,/preference:pref\.status==='READY'&&Object\.keys\(pref\.selectedRecipes\)\.length/);
 assert.match(f4,/input\.preferredRecipes=options\.prepPreference\.selectedRecipes/);
 assert.match(f5,/const pref=deps\.prepPreference\?\.selectedRecipes/);
 const p=html.indexOf('f3-m4-food-preference-v133.js'),u=html.indexOf('e7-f4c-integrated-v112.js');
 assert(p>0&&u>p,'projector must load before the UI');
 assert.match(sw,/'\.\.\/f3\/f3-m4-food-preference-v133\.js'/);
 assert.doesNotMatch(read('f3/f3-m4-food-preference-v133.js'),/localStorage|setItem\(/);
});

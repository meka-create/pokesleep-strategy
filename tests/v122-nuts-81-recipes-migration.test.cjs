'use strict';
/* v122 immutable-data and lossless 19->20 ingredient compatibility contract. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>{
 const ctx={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),ctx,{filename:p});
 return ctx.module.exports;
};
const recipes=load('e7-preview/e7-recipes-v122.js'),master=load('e7-preview/e7-master-v122.js');
const calc=load('f3/f3-stockpile-v120.js');
const e={window:{}};
vm.runInNewContext(read('e7-preview/e7-e1-core-v84.js'),e,{filename:'e7-e1-core-v84.js'});
const E1=e.window.PokeE7E1;
const newDishes=[
 ['curry_nut_naan_20261116','curry','タネばくだんナンカレー',7950,{corn:12,pumpkin:12,nuts:15},39],
 ['salad_nut_wrap_20261116','salad','くさむすびサラダラップ',26350,{tomato:33,ginger:36,avocado:22,nuts:30},121],
 ['dessert_nut_tail_roll_20261116','dessert','おいしいシッポロールケーキ',19846,{soy:22,egg:33,tail:10,nuts:26},91]
];
test('v122: preview-specific 20-food/81-recipe data keeps production STEP2 19/78 untouched',()=>{
 assert.equal(load('src/recipes.js').length,78);
 assert.equal(Object.keys(load('src/master.js').ingredients).length,19);
 assert.equal(Object.keys(master.ingredients).length,20);
 assert.equal(Object.keys(master.strength).length,20);
 assert.equal(master.ingredients.nuts,'ひとくちナッツ');
 assert.equal(master.strength.nuts,112);
 assert.equal(recipes.length,81);
 assert.equal(new Set(recipes.map(x=>x.id)).size,81);
 assert.deepEqual([...E1.INGREDIENT_NAMES].slice(-4),[
  'めざましコーヒー','ずっしりカボチャ','つやつやアボカド','ひとくちナッツ']);
 assert.deepEqual([...calc.FOODS].slice(-4),['coffee','pumpkin','avocado','nuts']);
});
test('v122: new cooking recipes match pinned energy and ingredient quantities',()=>{
 for(const [id,type,name,energy,req,size] of newDishes){
  const r=recipes.find(x=>x.id===id);
  assert(r,'missing '+id);
  assert.equal(r.type,type);assert.equal(r.name,name);
  assert.equal(r.baseStrength,energy);
  assert.deepEqual(JSON.parse(JSON.stringify(r.requirements)),req);
  assert.equal(Object.values(r.requirements).reduce((a,b)=>a+b,0),size);
  const listed=calc.catalog([r],type,Math.max(7,size),false);
  assert(listed.some(x=>x.id===id),'new meal must participate in selectable recipe ranking');
 }
});
test('v122: old 19 food event snapshot is read-only normalized to nuts=0 without changing old bytes',()=>{
 const week='2026-11-16',all=[...E1.INGREDIENT_NAMES],old=all.slice(0,19);
 const values=Object.fromEntries(old.map((name,i)=>[name,i+1]));
 const before=JSON.stringify(values);
 const row={version:2,weekStart:week,preparationLatest:null,startInventory:null,
  currentInventory:{weekStart:week,savedAt:'2026-11-17T10:00:00+09:00',revision:'old',
   values}};
 const stored=JSON.stringify(row);
 const normalized=E1.validateInventoryTimeline(row,week);
 assert.equal(JSON.stringify(row),stored);
 assert.equal(JSON.stringify(values),before);
 assert.equal(normalized.currentInventory.values['ひとくちナッツ'],0);
 assert.equal(Object.keys(normalized.currentInventory.values).length,20);
 for(const [k,v] of Object.entries(values))assert.equal(normalized.currentInventory.values[k],v);
 const extra={...row,currentInventory:{...row.currentInventory,
  values:{...values,'ひとくちナッツ':7},revision:'new'}};
 assert.equal(E1.validateInventoryTimeline(extra,week).currentInventory.values['ひとくちナッツ'],7);
 const missing={...values};delete missing['あじわいキノコ'];
 assert.throws(()=>E1.validateInventoryTimeline({...row,currentInventory:{
  ...row.currentInventory,values:missing}},week),/ingredient names required/);
});
test('v122: explicit in-event save upgrades 19-food timeline and retains its event owner externally',()=>{
 const week='2026-11-16',values=Object.fromEntries(
  [...E1.INGREDIENT_NAMES].slice(0,19).map(n=>[n,1]));
 const original={version:2,weekStart:week,eventId:'manual:2026-11-16',
  preparationLatest:null,startInventory:null,currentInventory:{
   weekStart:week,savedAt:'2026-11-17T10:00:00+09:00',
   revision:'old19',values}};
 const oldJSON=JSON.stringify(original);
 const upgraded=E1.applyInventorySave(original,{
  savedAt:'2026-11-18T10:00:00+09:00',revision:'new20',
  values:{...values,'ひとくちナッツ':5}});
 assert.equal(upgraded.currentInventory.values['ひとくちナッツ'],5);
 assert.equal(upgraded.startInventory,null);
 assert.equal(JSON.stringify(original),oldJSON,'pre-existing owner record must not be mutated');
 const stocked=calc.make({recipes:recipes.filter(r=>r.id==='curry_nut_naan_20261116'),
  categories:['curry'],bagCapacity:250,
  camp:false,potCapacity:39,currentStock:{nuts:5},
  selectedRecipes:{curry:'curry_nut_naan_20261116'}});
 assert.equal(stocked.status,'PROVISIONAL',stocked.message);
 assert(stocked.goals.nuts>=15);
 assert.equal(stocked.topups.nuts,Math.max(0,stocked.goals.nuts-5));
});
test('v122: both 5x4 tiles put nuts immediately to the right of avocado',()=>{
 const html=read('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const goal=html.match(/<div class="grid goal-grid">([\s\S]*?)<\/div><div class="row total">/)[1];
 const stock=html.match(/<div class="grid actual-grid">([\s\S]*?)<\/div><div class="row total">/)[1];
 const extract=fragment=>Array.from(fragment.matchAll(/<span class="name">([^<]+)<\/span>/g),x=>x[1]);
 const g=extract(goal),s=extract(stock);
 assert.equal(g.length,20);assert.equal(s.length,20);
 assert.deepEqual(g,s);assert.deepEqual(g.slice(-4),[
  'めざましコーヒー','ずっしりカボチャ','つやつやアボカド','ひとくちナッツ']);
 assert.match(stock,/data-item="nuts"/);
 assert.match(stock,/data-key="nuts"/);
 const image=fs.readFileSync(path.join(root,'e7-preview/assets/ingredients/ingredient-20.png'));
 assert.equal(image.toString('hex',0,8),'89504e470d0a1a0a');
 assert.equal(image.readUInt32BE(16),256);assert.equal(image.readUInt32BE(20),256);
 const hash=require('node:crypto').createHash('sha1');
 hash.update(Buffer.from('blob '+image.length+'\0','utf8'));hash.update(image);
 assert.equal(hash.digest('hex'),'29cd95052c370da268108d319f2017c147517056','Use verified online image, never screenshot crop');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(sw,/Array.from\(\{length:20\}/);
});
test('v122: F4 and F5 are wired to 20 codes and 81 recipes without claiming event bonus',()=>{
 assert.match(read('f4/f4-chronological-core-v1.js'),/'avocado','nuts'/);
 assert.match(read('f4/f4-b-e7-readonly-v1.js'),/'avocado','nuts'/);
 assert.match(read('f5/f5-midweek-v119.js'),/foods\.length===20&&deps\.recipes\.length===81/);
 assert.match(read('f4/f4-c-auto-v112.js'),/\[78,81\]/);
 assert.match(read('f4/f4-event-model-gate-v1.js'),/OFFICIAL_EVENT_RULES_NOT_MODELED/);
});

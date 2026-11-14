'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const context={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),context,{filename:p,timeout:15000});
 return context.module.exports;
}
const gate=load('f4/f4-c-banquet-release-v103.js');
const effect=load('f4/f4-c-banquet-preview-v103.js');
const rules=load('f4/f4-c-official-rules-v1.js');
const baselineRecipes=load('src/recipes.js');
const master=load('src/master.js');
const bridge=load('f4/f4-b-e7-readonly-v1.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const eventId='pokesleep-tool:bountiful banquet week vol1:2026-11-16';
const eventSource={
 id:eventId,start:'2026-11-16',
 sourceKey:'bountiful banquet week vol1',upstreamRevision:'a'.repeat(40),
 verifiedTarget:{specialty:'Ingredients'},
 verifiedEffects:{ingredient:1,extraIng:'nuts',carryLimitAdd:10}
};
// All quantities and strengths below are SYNTHETIC TEST VALUES.
// They must NEVER enter a production recipe, source pin or official forecast.
function candidate(){
 const add=[
  {id:'synthetic_2026_curry',type:'curry',name:'合成テストカレー',
   baseStrength:1234,requirements:{corn:15,pumpkin:12,nuts:12}},
  {id:'synthetic_2026_salad',type:'salad',name:'合成テストサラダ',
   baseStrength:5678,requirements:{ginger:30,tomato:28,avocado:30,nuts:33}},
  {id:'synthetic_2026_dessert',type:'dessert',name:'合成テストデザート',
   baseStrength:9101,requirements:{egg:20,tail:18,soy:18,nuts:35}}
 ];
 return {
  baselineIngredientNames:master.ingredients,
  releaseIngredientNames:{...master.ingredients,nuts:'ひとくちナッツ'},
  baselineStrengths:master.strength,
  releaseStrengths:{...master.strength,nuts:314},
  baselineRecipes,releaseRecipes:[...baselineRecipes,...add],
  provenance:{repository:'nitoyon/pokesleep-tool',
   sourceCommit:'a'.repeat(40),
   releaseObservedAt:'2026-11-16T04:00:00+09:00',
   verifiedAgainstOfficialRelease:true},
  eventSource
 };
}
const stock=()=>Object.fromEntries(Object.values(master.ingredients).map((label,i)=>[label,i+1]));
function ledger(currentAt='2026-11-15T20:00:00+09:00'){
 const prep={weekStart:'2026-11-16',
  savedAt:'2026-11-15T20:00:00+09:00',
  revision:'synthetic-prep-1',values:stock()};
 return {version:2,eventId,weekStart:'2026-11-16',
  preparationLatest:clone(prep),startInventory:clone(prep),
  currentInventory:{...clone(prep),savedAt:currentAt,
   revision:currentAt===prep.savedAt?prep.revision:'synthetic-latest-2'}
 };
}
const migration=x=>gate.inventoryPreview({
 timeline:x,weekStart:'2026-11-16',eventId,
 baselineIngredientNames:master.ingredients
});
test('v103: current production master remains 19 ingredient/78 recipe baseline',()=>{
 assert.equal(Object.keys(master.ingredients).length,19);
 assert.equal(baselineRecipes.length,78);
 assert.equal(gate.LEGACY.length,19);
 assert.equal(gate.FOOD.length,20);
 assert.equal(gate.FOOD_LABEL,'ひとくちナッツ');
 assert.equal(gate.PINNED_RELEASE_SHA,null);
 assert.equal(gate.RELEASE_START,'2026-11-16T04:00:00+09:00');
 assert.deepEqual(Array.from(gate.RECIPE_SPECS,x=>x.total),[39,121,91]);
});
test('v103: fake but structurally valid 20/81 cannot be activated or certify energy',()=>{
 const input=candidate();
 const x=gate.preflight(input);
 assert.equal(x.status,'STRUCTURE_READY_NOT_AUTHENTICATED',x.reason);
 assert.equal(x.sourceAuthenticityCertified,false);
 assert.equal(x.weeklyEnergyCertified,false);
 assert.equal(x.writesSavedData,false);
 assert.equal(gate.activate(input,{officialRules:rules}).reason,
  'RELEASE_COMMIT_NOT_PINNED');
});
test('v103: no legacy formula, food, recipe name or requirement may silently change',()=>{
 const input=candidate();
 const bad=clone(input);
 bad.releaseRecipes[0].baseStrength++;
 assert.equal(gate.preflight(bad).reason,'LEGACY_RECIPE_REGRESSION');
 const food=clone(input);
 food.releaseStrengths.apple++;
 assert.equal(gate.preflight(food).reason,'LEGACY_FOOD_MUTATED');
 const missing=clone(input);
 missing.releaseRecipes.pop();
 assert.equal(gate.preflight(missing).reason,'CATALOG_INPUT_INCOMPLETE');
 const wrongTotal=clone(input);
 wrongTotal.releaseRecipes[78].requirements.nuts++;
 assert.equal(gate.preflight(wrongTotal).reason,'NEW_RECIPE_TOTAL_MISMATCH');
 const changedIngredients=clone(input);
 delete changedIngredients.releaseRecipes[79].requirements.avocado;
 changedIngredients.releaseRecipes[79].requirements.corn=30;
 assert.equal(gate.preflight(changedIngredients).reason,
  'NEW_RECIPE_INGREDIENT_SET_MISMATCH');
});
test('v103: unverified provenance, release time, or missing nut unit energy blocked',()=>{
 const x=clone(candidate());
 x.provenance.releaseObservedAt='2026-11-15T19:00:00+09:00';
 assert.equal(gate.preflight(x).reason,'RELEASE_PROVENANCE_NOT_VERIFIED');
 const y=clone(candidate());
 delete y.releaseStrengths.nuts;
 assert.equal(gate.preflight(y).reason,'FOOD_CODE_SET_CHANGED');
 const z=clone(candidate());
 z.releaseStrengths.nuts=0;
 assert.equal(gate.preflight(z).reason,'NUT_STRENGTH_NOT_VERIFIED');
 const other=clone(candidate());
 other.provenance.sourceCommit='0'.repeat(39)+'z';
 assert.equal(gate.preflight(other).reason,'RELEASE_PROVENANCE_NOT_VERIFIED');
});
test('v103: read-only event-owned inventory preview preserves every one of 19 amounts',()=>{
 const original=ledger(),before=JSON.stringify(original);
 const x=migration(original);
 assert.equal(x.status,'PREVIEW_REQUIRES_EXPLICIT_COMMIT',x.reason);
 assert.equal(x.writesSavedData,false);
 assert.equal(x.requiresExplicitCommit,true);
 assert.equal(x.requiresE7SchemaUpdate,true);
 for(const key of ['preparationLatest','startInventory','currentInventory']){
  assert.equal(x.timeline[key].revision,original[key].revision);
  assert.equal(x.timeline[key].savedAt,original[key].savedAt);
  assert.equal(x.timeline[key].values['ひとくちナッツ'],0);
  for(const [name,amount] of Object.entries(original[key].values))
   assert.equal(x.timeline[key].values[name],amount);
 }
 assert.equal(JSON.stringify(original),before);
});
test('v103: after release, do not invent a zero nut count or overwrite baseline',()=>{
 const input=ledger('2026-11-17T10:00:00+09:00');
 assert.equal(migration(input).reason,'POST_RELEASE_NUT_COUNT_REQUIRED');
 const result=gate.inventoryPreview({
  timeline:input,weekStart:'2026-11-16',eventId,
  baselineIngredientNames:master.ingredients,explicitCurrentNuts:4
 });
 assert.equal(result.status,'PREVIEW_REQUIRES_EXPLICIT_COMMIT');
 assert.equal(result.timeline.currentInventory.values['ひとくちナッツ'],4);
 assert.equal(result.timeline.startInventory.values['ひとくちナッツ'],0);
 assert.equal(result.timeline.preparationLatest.values['ひとくちナッツ'],0);
 const foreign=clone(input);
 foreign.eventId='manual:2026-11-16';
 assert.equal(migration(foreign).reason,'INVENTORY_OWNER_NOT_CONFIRMED');
 const mixed=clone(input);
 mixed.currentInventory.values['ひとくちナッツ']=4;
 assert.equal(migration(mixed).reason,'MIXED_FOOD_TIMELINE_UNSAFE');
});
test('v103: partial official arithmetic applies only known source-matched effects',()=>{
 const input={source:eventSource,
  instant:'2026-11-17T12:00:00+09:00',
  help:{specialty:'Ingredients',kind:'ingredient',count:2,ingredient:'corn'},
  capacity:{specialty:'Ingredients',baseCapacity:25},
  pot:{baseCapacity:33,camp:false,sunday:false},
  meal:{requiredIngredients:{corn:15,pumpkin:12,nuts:12},
   displayedRecipeEnergy:10000,nutUnitEnergy:100,extraNutCount:2}
 };
 const r=effect.evaluate(input,{officialRules:rules});
 assert.equal(r.status,'PARTIAL_OFFICIAL_RULES_ONLY',r.reason);
 assert.equal(r.bonusOriginalIngredientCount,3);
 assert.equal(r.bonusExtraNuts,1);
 assert.equal(r.carryCapacityAfterBonus,35);
 assert.equal(r.ordinaryPotOnly,63);
 assert.equal(r.recipeEnergyBeforeFieldAndCritical,15300);
 assert.equal(r.weeklyEnergyCertified,false);
 assert.equal(r.sourceAuthenticityCertified,false);
 const sunday=effect.evaluate({...input,pot:{...input.pot,sunday:true}},
  {officialRules:rules});
 assert.equal(sunday.status,'PARTIAL_OFFICIAL_RULES_ONLY');
 assert.equal(sunday.ordinaryPotOnly,null);
 assert.equal(sunday.potSundayCampStackingVerified,false);
 assert.equal(effect.evaluate({...input,source:{...eventSource,id:'wrong'}},
  {officialRules:rules}).reason,'OFFICIAL_SOURCE_NOT_MATCHED');
});
test('v103: accepted E7 plan/data and public root remain unchanged; release gateway fail closed',()=>{
 assert.equal(typeof bridge.banquetReleaseReadiness,'function');
 assert.equal(bridge.banquetReleaseReadiness(null,{},{}).reason,
  'BANQUET_RELEASE_DEPENDENCIES_MISSING');
 const code=read('f4/f4-c-banquet-release-v103.js')+
  read('f4/f4-c-banquet-preview-v103.js');
 for(const s of ['localStorage','sessionStorage','fetch(','.setItem(',
  '.removeItem(','console.log','privateBoxRows','nickname'])
  assert(!code.includes(s),'unexpected unsafe symbol: '+s);
 assert(!read('index.html').includes('f4-c-banquet-release-v103.js'));
 assert(!read('e7-preview/index.html').includes('f4-c-banquet-release-v103.js'));
});

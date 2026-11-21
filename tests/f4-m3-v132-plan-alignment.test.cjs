'use strict';
/* M3 v132: synthetic, public-only 81-recipe alignment and source regression. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(p){const env={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),env,{filename:p,timeout:20000});
 return env.module.exports;}
const model=load('f4/f4-m3-plan-alignment-v132.js');
const recipes=load('e7-preview/e7-recipes-v122.js');
const clock=load('f4/f4-b-game-week-v1.js');
const lite=load('f4/f4-m1-lite-energy-v128.js');
const cooking=load('f4/f4-c-cooking-skills-v102.js');
const W='2026-11-23',ID='manual:'+W;
const chosen=recipes.find(r=>r.type==='curry');
const outside=recipes.find(r=>r.type==='curry'&&r.id!==chosen.id);
function fixture(){
 const timeline=clock.build(W,'2026-11-21T10:00:00+09:00');
 assert.equal(timeline.windowCount,29);
 const slots=timeline.windows.map(w=>({
  day:w.day,slot:w.slot,recipeId:null
 }));
 slots[1].recipeId=chosen.id;slots[2].recipeId=chosen.id;
 const preference={status:'READY',selectedRecipes:{curry:chosen.id},
  targetCounts:{curry:2}};
 return {weekStart:W,eventId:ID,planOwner:{weekStart:W,eventId:ID},
  slots,recipes,preference,bagCapacity:5000,effectivePot:5000,
  camp:false,phase:'BEFORE',currentStock:{apple:3,nuts:2}};
}
test('M3: 29 windows, two preferred meals, 19 deliberately empty meals are explicit',()=>{
 const x=model.report(fixture());
 assert.equal(x.status,'ALIGNMENT_READY',x.reason);
 assert.equal(x.match,'EXACT');
 assert.equal(x.target,2);assert.equal(x.matched,2);
 assert.equal(x.missing,0);assert.equal(x.outside,0);
 assert.equal(x.scheduledMeals,2);assert.equal(x.emptyMeals,19);
 assert.equal(x.targets[0].planned,2);
 assert.equal(x.readOnly,true);assert.equal(x.writesSavedData,false);
 assert.equal(x.observedMeals,0);
 const expected=Object.values(chosen.requirements).reduce((a,b)=>a+b,0)*2;
 assert.equal(Object.values(x.targetDemand).reduce((a,b)=>a+b,0),expected);
 assert(x.bagOccupied>=expected);
});
test('M3: an additional different dish never masquerades as the chosen F3 target',()=>{
 const f=fixture();f.slots[3].recipeId=outside.id;
 const x=model.report(f);
 assert.equal(x.status,'ALIGNMENT_READY',x.reason);
 assert.equal(x.match,'DIFFERENT');assert.equal(x.matched,2);
 assert.equal(x.outside,1);assert.equal(x.emptyMeals,18);
 const second=fixture();second.slots[1].recipeId=null;
 const y=model.report(second);
 assert.equal(y.match,'DIFFERENT');assert.equal(y.missing,1);
 assert.equal(y.outside,0);
});
test('M3: only opening F3 reserves are capacity-constrained, not total weekly demand',()=>{
 const f=fixture(),one=Object.values(chosen.requirements).reduce((a,b)=>a+b,0);
 f.bagCapacity=one*2-1;
 const x=model.report(f);
 assert.equal(x.status,'ALIGNMENT_READY');assert.equal(x.bagCompatible,false);
 const y=fixture(),large=y.slots[3].recipeId=outside.id;
 for(let i=4;i<22;i++)if(y.slots[i].slot!=='sleep')y.slots[i].recipeId=outside.id;
 const z=model.report(y);
 assert.equal(z.status,'ALIGNMENT_READY',z.reason);
 assert.equal(z.bagCompatible,true,'future weekly production is not all stored at opening');
 assert(z.scheduledMeals>2);
});
test('M3: ownership, cooking pot, unknown recipes and tampered timeline fail closed',()=>{
 const other=fixture();other.planOwner.eventId='manual:2026-11-30';
 assert.equal(model.report(other).reason,'M3_FOREIGN_EVENT_PLAN');
 const invalid=fixture();invalid.slots[1].recipeId='missing_recipe';
 assert.equal(model.report(invalid).reason,'M3_PLAN_SEQUENCE_OR_RECIPE_INVALID');
 const broken=fixture();broken.slots[2].day=3;
 assert.equal(model.report(broken).reason,'M3_PLAN_SEQUENCE_OR_RECIPE_INVALID');
 const pot=fixture();pot.effectivePot=7;
 if(Object.values(chosen.requirements).reduce((a,b)=>a+b,0)>7)
  assert.equal(model.report(pot).reason,'M3_PLAN_POT_CAPACITY_CONFLICT');
 const bad=fixture();bad.preference.targetCounts.curry=22;
 assert.equal(model.report(bad).reason,'M3_PREP_RECIPE_OR_TARGET_INVALID');
});
test('M3: F5 PAST and ACTIVE remain forecasts, never user-observed meals',()=>{
 const f=fixture();
 f.phase='DURING';f.currentStock=null;
 f.slots=f.slots.map((w,i)=>({...w,
  windowPhase:i<6?'PAST_FORECAST_ONLY':i===6?'ACTIVE_REMAINDER':'FUTURE_FORECAST'}));
 const x=model.report(f);
 assert.equal(x.status,'ALIGNMENT_READY',x.reason);
 assert.equal(x.pastForecastWindows,6);
 assert.equal(x.activeForecastWindows,1);
 assert.equal(x.observedMeals,0);assert.equal(x.match,'EXACT');
 assert.equal(x.bagOccupied,null,'midweek snapshot is not the opening bag');
});
test('M3: shared M1 recipe/cooking energy model under verified dish bonus',()=>{
 const first=cooking.initial({potExtra:0,tastyExtra:0});
 assert.equal(first.status,'STATE_READY');
 const normal=lite.cook(first,chosen,0,1,0,cooking);
 const event=lite.cook(first,chosen,0,1.5,0,cooking);
 assert.equal(normal.status,'COOKED');assert.equal(event.status,'COOKED');
 assert(event.energyExpected>normal.energyExpected);
 const f4=read('f4/f4-c-item-aware-rank-v101.js');
 const f5=read('f5/f5-midweek-v119.js');
 assert.match(f4,/deps\.m1Lite\.cook\(cooking,lv70ById\.get\(dish\.id\)/);
 assert.match(f5,/deps\.m1Lite\.cook\(state\.tasty,level70ById\.get\(dish\.id\)/);
 assert.match(f4,/input\.m1Event\.dish/);
 assert.match(f5,/fieldBonus,event\.dish,w\.day/);
});
test('M3: UI and offline assets use one report without adding a storage sidecar',()=>{
 const strategy=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(strategy,/f4-m3-plan-alignment-v132\.js/);
 assert.match(ui,/function mealAlignment\(visible,c\)/);
 assert.match(ui,/mealAlignment\(draft,data\)/);
 assert.match(ui,/mealAlignment\(plan,data\)/);
 assert.match(ui,/if\(mealAlignment\(draft,c\)\.status!=='ALIGNMENT_READY'\)/);
 assert.match(ui,/fingerprint!==dataFingerprint\(ctx\(\)\)/);
 assert.match(ui,/targetMeals:p\.allocatedMeals/);
 assert.match(sw,/'\.\.\/f4\/f4-m3-plan-alignment-v132\.js'/);
 assert.doesNotMatch(read('f4/f4-m3-plan-alignment-v132.js'),/localStorage|setItem\(/);
});

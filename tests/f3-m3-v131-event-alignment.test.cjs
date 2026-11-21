'use strict';
/* M3 v131: event source validation, prep projection and F5 candidate alignment. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(dir,p),'utf8');
function load(p){const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),sandbox,{filename:p});return sandbox.module.exports;}
const m3=load('f3/f3-m3-event-v131.js');
const m1=load('f4/f4-m1-lite-energy-v128.js');
const v124=load('f3/f3-adopted-opening-v124.js');
const stockpile=load('f3/f3-stockpile-v120.js');
const weekClock=load('f4/f4-b-game-week-v1.js');
const week='2026-11-23',eventId='pokesleep-tool:official:2026-11-23';
const official=(effects,target={specialty:'Ingredients'})=>({
 id:eventId,start:week,upstreamRevision:'fixed-source',
 verifiedEffects:effects,verifiedTarget:target,unknownEffects:false});
const stable=i=>'f4c_'+String(i).padStart(32,'0');
function scenario(){
 const meal={id:'two_apples',type:'curry',baseStrength:100,requirements:{apple:12}};
 const ctx={status:'CONTEXT_READY',weekStart:week,eventId,
  clock:weekClock.build(week,'2026-11-19T10:00:00+09:00')};
 const ids=Array.from({length:5},(_,i)=>stable(i));
 const slots=ctx.clock.windows.map((w,i)=>({
  day:w.day,slot:w.slot,source:w.source,startsAt:w.startsAt,endsAt:w.endsAt,
  teamIds:i===0?[]:[...ids],recipeId:i===1||i===2?meal.id:null
 }));
 const profiles=ids.map((_,i)=>({id:'p'+i,skillSpecialty:i===0?'Ingredients':'Berries',
  helpingBonus:false,ratesByTeammateBonus:Array.from({length:5},()=>({
   helpSeconds:3600,carryLimit:30,berryItemsPerHelp:0,
   skillProbabilityPerEligibleHelp:.1,ingredientProbabilityPerHelp:.5,
   ingredientCountsPerHelp:{apple:i===0?1:0}
  }))}));
 const base=stockpile.make({recipes:[meal],categories:['curry'],
  potCapacity:30,bagCapacity:120,camp:false,currentStock:{},
  selectedRecipes:{curry:meal.id},targetMeals:{curry:2}});
 assert.equal(base.status,'PROVISIONAL');
 return {ctx,plan:{kind:'REAL_BOX_PLAN_V112',weekStart:week,eventId,
  sourceCommit:'a'.repeat(40),previousWeekCarryUnknown:true,slots},
  identity:{status:'IDENTITIES_READY',byId:new Map(ids.map((id,i)=>[id,i]))},
  roster:{sourceCommit:'a'.repeat(40),profiles},recipes:[meal],base,
  bagCapacity:120,currentStock:Object.fromEntries(v124.FOODS.map(f=>[f,0]))};
}
test('M3 potSize: shared verified event source, conservative capacity, no false event default',()=>{
 const result=m3.resolve({weekStart:week,eventId,potCapacity:40,
  source:official({potSize:1.5,ingredient:1})},m1);
 assert.equal(result.status,'EVENT_READY',result.reason);
 assert.equal(result.effectivePot,60);
 assert.equal(result.event.ingredient,1);
 assert.equal(result.productionCertified,false);
 assert.equal(m3.resolve({weekStart:week,eventId,
  source:official({unknownEX:3}),potCapacity:40},m1).status,'BLOCKED');
 assert.equal(m3.resolve({weekStart:week,eventId:'manual:'+week,
  source:null,potCapacity:40},m1).effectivePot,40);
 assert.equal(m3.resolve({weekStart:week,eventId,
  source:official({potSize:20}),potCapacity:400},m1).status,'BLOCKED');
 assert.equal(m3.resolve({weekStart:week,eventId:'pokesleep-tool:other:2026-11-23',
  source:official({ingredient:1}),potCapacity:40},m1).status,'BLOCKED');
});
test('M3: use verified ingredient rate only for adopted forecast, raw roster unchanged',()=>{
 const input=scenario(),raw=v124.calculate(input);
 assert.equal(raw.status,'PROVISIONAL',raw.reason);
 const event=m3.resolve({weekStart:week,eventId,potCapacity:40,
  source:official({ingredient:1})},m1);
 const adjusted=m3.adjust(input.roster.profiles,event.event,m1,
  {skillValue:()=>({status:'BASE_VALUE_ONLY'})});
 assert.equal(adjusted.status,'ROSTER_READY',adjusted.reason);
 assert.equal(input.roster.profiles[0].ratesByTeammateBonus[0].ingredientCountsPerHelp.apple,1);
 assert.equal(adjusted.profiles[0].ratesByTeammateBonus[0].ingredientCountsPerHelp.apple,1.5);
 assert.equal(adjusted.profiles[1].ratesByTeammateBonus[0].ingredientCountsPerHelp.apple,0);
 const result=v124.calculate({...input,roster:{...input.roster,profiles:adjusted.profiles}});
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert(result.goals.apple<=raw.goals.apple,'verified expected yield should not raise opening targets');
 assert.equal(result.productionCertified,false);
 assert.equal(m3.adjust(input.roster.profiles,{status:'BLOCKED'},m1,
  {skillValue:()=>null}).status,'BLOCKED');
});
test('M3 UI: load before prep settings and keep asynchronous event and inventory protection',()=>{
 const html=read('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const settings=read('e7-preview/e7-prep-settings-v120.js');
 const goals=read('e7-preview/e7-f3-prep-goals-v88.js');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert(html.indexOf('f3-m3-event-v131.js')<html.indexOf('e7-prep-settings-v120.js'));
 assert.match(settings,/PokeF3M3EventV131\?\.resolve/);
 assert.match(goals,/PokeF3M3EventV131\?\.adjust/);
 assert.match(goals,/roster:\{\.\.\.roster,profiles:adjusted.profiles\}/);
 assert.match(goals,/const fresh=readContext\(\)/);
 assert.match(sw,/'\.\.\/f3\/f3-m3-event-v131\.js'/);
});
test('M3 F5 diverse candidate uses the same event-adjusted roster as its scoring',()=>{
 const f5=read('f5/f5-midweek-v119.js');
 assert.match(f5,/rawProfiles:liveProfiles,recipes,foods,inventory/);
 assert.doesNotMatch(f5,/rawProfiles:roster\.profiles,recipes,foods,inventory/);
 assert.match(f5,/deps\.m1Lite\.withEvent\(roster\.profiles,event/);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(p){
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',p),'utf8'),
  sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;
}
const replay=load('f4/f4-c-window-replay-v1.js');
const state=load('f4/f4-c-state-kernel-v1.js');
const base=load('f4/f4-chronological-core-v1.js');
const gameWeek=load('f4/f4-b-game-week-v1.js');
const deps={stateKernel:state,baseCore:base,gameWeek};
const MONDAY='2026-11-16',START='2026-11-16T04:00:00+09:00';
const team=['p0','p1','p2','p3','p4'];
const clone=o=>JSON.parse(JSON.stringify(o));
function make(extra={}){
 const clock=gameWeek.build(MONDAY,START);
 const profiles=team.map((id,i)=>({id,source:'F1_B_PINNED_66_SPECIES',
  helpingBonus:false,carryLimit:2000,
  nickname:'PRIVATE_NICKNAME_MUST_NOT_LEAK_'+i,
  ratesByTeammateBonus:Array.from({length:5},()=>({
   status:'BASE_RATES_AVAILABLE',helpSeconds:3600,
   berryItemsPerHelp:1,berryEnergyPerHelp:10,
   ingredientCountsPerHelp:{apple:1}
  }))
 }));
 const reference={status:'PROVISIONAL',model:'ORDERED_29_WINDOW_NEUTRAL_REFERENCE',
  weeklyEnergyCertified:false,writesSavedData:false,weekStart:MONDAY,
  startsAt:clock.startsAt,endsAt:clock.endsAt,slotCount:29,
  slots:clock.windows.map(w=>({day:w.day,slot:w.slot,source:w.source,
   startsAt:w.startsAt,endsAt:w.endsAt,recipeId:null,team:[...team]}))};
 const initialEnergy=Object.fromEntries(team.map(id=>[id,0]));
 const initialHeld=Object.fromEntries(team.map(id=>[id,{
  ingredients:{},berryCount:0,berryEnergy:0
 }]));
 const endCollection=[{at:clock.endsAt,ids:[...team]}];
 return {scenarioConsent:'EXPLICIT_OBSERVATIONS_AND_SLEEP_PROXY',
  eventSource:null,reference,profiles,
  recipes:[{id:'soup',type:'curry',baseStrength:100,requirements:{apple:1}}],
  bagCapacity:5000,potCapacity:57,fieldBonus:0,camp:false,
  initialInventory:{apple:0},initialEnergy,initialHeld,
  collections:endCollection,recoveries:[],...extra};
}
test('v99: 29-window exact clock replay keeps pre-week berry provenance separate',()=>{
 const input=make();
 const before=JSON.stringify(input),r=replay.replay(input,deps);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert.equal(r.stage,'F4_C_V99_STATEFUL_REPLAY');
 assert.equal(r.slotCount,29);assert.equal(r.totalHours,168);
 assert.equal(r.energyProxy,8225);
 assert.equal(r.berryEnergyProxy,8225);
 assert.equal(r.carryBerryExcludedProxy,175);
 assert.equal(r.mealEnergyProxy,0);
 assert.equal(r.endingBagExpected,840);
 assert.equal(r.explicitCollections,1);
 assert.equal(r.writesSavedData,false);
 assert.equal(r.weeklyEnergyCertified,false);
 assert.equal(r.optimizedForHealth,false);
 assert.equal(JSON.stringify(input),before,'source mutated');
 assert(!JSON.stringify(r).includes('PRIVATE_NICKNAME_MUST_NOT_LEAK'));
});
test('v99: no assumed automatic tap; carry overflows fail closed',()=>{
 const x=make({collections:[]});
 x.profiles.forEach(p=>p.carryLimit=30);
 const r=replay.replay(x,deps);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'COLLECTION_SCHEDULE_REQUIRED');
});
test('v99: explicit observed recovery can affect 10-minute helping tiers',()=>{
 const x=make();
 const baseResult=replay.replay(x,deps);
 const clock=gameWeek.build(MONDAY,START);
 x.initialEnergy=Object.fromEntries(team.map(id=>[id,100]));
 // Observed recovery at each sleep start after daytime depletion.
 x.recoveries=clock.windows.filter(w=>w.day>=0&&w.slot==='sleep')
  .flatMap(w=>team.map(id=>({at:w.startsAt,id,points:100,origin:'OBSERVED_SKILL'})));
 const r=replay.replay(x,deps);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert(r.expectedHelpOpportunities>baseResult.expectedHelpOpportunities);
 assert(r.explicitRecoveries===35);
 assert.equal(r.weeklyEnergyCertified,false);
});
test('v99: item collection cannot exceed real bag; no silent discard/transfer',()=>{
 const x=make({bagCapacity:100});
 assert.equal(replay.replay(x,deps).reason,'BAG_TRANSFER_OVER_CAPACITY');
});
test('v99: recipe consumes only inventory at its own window start',()=>{
 const x=make();
 x.reference.slots[1].recipeId='soup';
 assert.equal(replay.replay(x,deps).reason,'RECIPE_UNAVAILABLE_AT_SLOT');
 x.initialInventory.apple=1;
 const ok=replay.replay(x,deps);
 assert.equal(ok.status,'PROVISIONAL');
 assert.equal(ok.mealsCooked,1);
 assert.equal(ok.mealEnergyProxy,100);
});
test('v99: reject stale conditions, event model, malformed teams and clock',()=>{
 let x=make();x.eventSource={id:'official'};
 assert.equal(replay.replay(x,deps).reason,'UNVERIFIED_EVENT_OR_SCENARIO');
 x=make();x.scenarioConsent='';
 assert.equal(replay.replay(x,deps).reason,'UNVERIFIED_EVENT_OR_SCENARIO');
 x=make();x.reference.slots[0].team=['p0','p0','p1','p2','p3'];
 assert.equal(replay.replay(x,deps).reason,'PATH_WINDOW_OR_ROSTER_MISMATCH');
 x=make();x.collections[0].at='2026-11-23T04:01:00+09:00';
 assert.equal(replay.replay(x,deps).reason,'COLLECTION_SCHEDULE_INVALID');
 x=make();x.initialHeld.p0.berryCount=1;
 assert.equal(replay.replay(x,deps).reason,'PREWEEK_HELD_BERRY_PROVENANCE_UNKNOWN');
 x=make();x.profiles[0].ratesByTeammateBonus[0].berryItemsPerHelp=undefined;
 assert.equal(replay.replay(x,deps).reason,'ITEM_RATE_NOT_PINNED');
});
test('v99: no side effects, no private data, and old canonical root untouched',()=>{
 const s=fs.readFileSync(path.resolve(__dirname,'../f4/f4-c-window-replay-v1.js'),'utf8');
 for(const token of ['localStorage','sessionStorage','fetch(','.setItem(',
  '.removeItem(','console.log','nickname','privateBoxRows'])
  assert(!s.includes(token),'unexpected side-effect or private label: '+token);
 assert(!fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8')
  .includes('f4-c-window-replay-v1'));
 assert(!fs.readFileSync(path.resolve(__dirname,'../e7-preview/index.html'),'utf8')
  .includes('f4-c-window-replay-v1'));
});

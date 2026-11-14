'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=p=>{const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',p),'utf8'),sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;};
const auto=load('f4/f4-c-auto-v112.js');
const safe=load('f4/f4-c-real-storage-v112.js');
const records=Array.from({length:29},(_,i)=>{
 const d=i===0?-1:Math.floor((i-1)/4),
  k=i===0?'sleep':['morning','noon','evening','sleep'][(i-1)%4];
 return {day:d,slot:k,source:i===0?'PREVIOUS_WEEK_SLEEP':
  i===28?'FINAL_NIGHT_TRUNCATED':'WEEK',
  startsAt:'win-'+i,endsAt:'end-'+i};
});
const player={pot:57,bag:600,bonuses:{'シアンの砂浜':60}};
const getCtx=()=>({
 status:'CONTEXT_READY',weekStart:'2026-11-16',
 eventId:'manual:2026-11-16',conditionRevision:'cond-a',
 inventoryRevision:'stock-a',autoSleep:true,
 fields:{food:'all',camp:true,field:'シアンの砂浜',source:null},
 privateBoxRows:Array.from({length:6},(_,i)=>({pokemon:'TEST_'+i,level:50})),
 player,clock:{status:'TIMELINE_READY',phase:'BEFORE',windowCount:29,totalHours:168,
  startsAt:'2026-11-16T04:00',endsAt:'2026-11-23T04:00',windows:records}
});
const names=['alpha','beta','F1','F2','F3','F4'];
function profiles(fav){
 return names.map((_,i)=>({
  id:'p'+i,source:'F1_B_PINNED_66_SPECIES',healerRole:i<2?'TEAM_WIDE_HEALER':null,
  skillCode:i<2?'Energy for Everyone S':null,
  selectedMainSkillLevel:i===0?6:1,helpingBonus:false,
  ratesByTeammateBonus:[{
   berryEnergyPerHelp:i===0?(fav[0]==='grass'?30:3):
    i===1?(fav[0]==='water'?30:3):1,
   ingredientCountsPerHelp:{apple:1},
   helpSeconds:3600,skillProbabilityPerEligibleHelp:.02
  }]
 }));
}
function fake(){
 const state={checked:[],source:null,favorites:[],nights:[]};
 let active=null;
 const deps={
  master:{types:{water:'みず',fairy:'フェアリー',flying:'ひこう',
   grass:'くさ',fire:'ほのお',normal:'ノーマル'}},
  roster:{adapt:({favoriteTypes})=>{state.favorites=favoriteTypes;
   active=profiles(favoriteTypes);
   return {status:'READY',profiles:active};}},
  bridge:{buildNeutralInput:(ctx,opt)=>{
   state.source=ctx.fields.source;state.nights=opt.realNightTeamIndices;
   return {status:'READY',sourceCommit:'a'.repeat(40),input:{
    autoSleep:false,eventSource:null,recipes:Array.from({length:78},
     (_,i)=>({id:'recipe'+i})),profiles:active,
    weekStart:ctx.weekStart,nightTeams:opt.realNightTeamIndices.map(t=>t.map(i=>'p'+i)),
    previousWeekSleepTeam:opt.previousWeekSleepIndices.map(i=>'p'+i)
   }};
  }},
  itemRank:{rank:(inp)=>{
   state.checked.push([inp.primaryHealerId,inp.secondaryHealerId]);
   const p=inp.primaryHealerId,secondary=inp.secondaryHealerId;
   const get=i=>active[Number(i.slice(1))];
   const energy=1000*get(p).ratesByTeammateBonus[0].berryEnergyPerHelp+
    100*get(secondary).ratesByTeammateBonus[0].berryEnergyPerHelp;
   const slots=records.map((r,i)=>({
    ...r,team:i===0?(inp.previousWeekCarryUnknown?[]:inp.previousWeekSleepTeam):r.slot==='sleep'?
    inp.nightTeams[r.day]:r.slot==='morning'?
    ['p2','p3','p4',secondary,p]:['p2','p3','p4','p5',p],
    cookedRecipeId:r.slot==='sleep'?null:'recipe1',recipeId:r.slot==='sleep'?null:'recipe1'
   }));
   return {status:'PROVISIONAL',slots,energyExpected:energy,
    weeklyEnergyCertified:false,slotCount:29};
  }},
  healerSearch:{plan:()=>{}},healerPolicy:{validate:()=>{}},
  skillValues:{skillValue:(code,level)=>({unit:'TEAM_ENERGY_POINTS_EACH',value:level===6?18:5})},
  baseCore:{normalizeProfiles:()=>{}},weekClock:{build:()=>{}}
 };
 return {deps,state};
}
test('field favorite berry energy can beat higher-healing Pokemon for primary healer',()=>{
 const {deps,state}=fake(),c=getCtx();
 const a=auto.propose(c,{previousWeekSleepIndices:null},{...deps});
 assert.equal(a.status,'PROVISIONAL',a.reason);
 assert.equal(a.selectedPrimary,'p1','preferred water healer should beat strong healer p0');
 assert.deepEqual(Array.from(state.favorites),['water','fairy','flying']);
 assert.equal(state.source,null);
 assert.equal(a.previousWeekCarryUnknown,true);
 assert.equal(a.slots[0].team.length,0,'historical sleep never fabricated');
 assert.equal(a.slots.length,29);
 assert.equal(a.weeklyEnergyCertified,false);
 assert.equal(a.canAdopt,true);
 assert(state.checked.some(([m,s])=>m==='p0'&&s==='p1'));
 assert(state.checked.some(([m,s])=>m==='p1'&&s==='p0'));
});
test('a berry favorite change can restore the recovery-strong primary healer',()=>{
 const {deps}=fake(),c=getCtx();
 c.savedBerrySetup={types:['grass','fire','normal']};
 const p=auto.propose(c,{},deps);
 assert.equal(p.status,'PROVISIONAL',p.reason);
 assert.equal(p.selectedPrimary,'p0');
 assert.deepEqual(Array.from(p.favoriteTypes),['grass','fire','normal']);
});
test('unverified favorite berry combinations fail without guessing',()=>{
 const {deps}=fake(),c=getCtx();
 c.fields.field='ワカクサ本島';c.player.bonuses['ワカクサ本島']=60;
 assert.equal(auto.propose(c,{},deps).reason,'EVENT_FAVORITE_BERRIES_UNKNOWN');
});
const opaque=i=>'f4c_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000';
test('adoption replaces pN refs with stable opaque IDs and validates owner/revisions',()=>{
 const c=getCtx(),{deps}=fake();
 const proposal=auto.propose(c,{},deps);
 assert.equal(proposal.status,'PROVISIONAL');
 const map=new Map(Array.from({length:6},(_,i)=>[opaque(i),i]));
 const identity={status:'IDENTITIES_READY',ids:[...map.keys()],byId:map,
  digests:Array.from({length:6},(_,i)=>String(i).padStart(64,'0')),
  boxRaw:'{"version":1,"items":[]}',ledgerRevision:'{"version":1}'};
 const made=safe.createRecord(c,proposal,identity);
 assert.equal(made.status,'PLAN_READY',made.reason);
 assert(made.plan.slots.every(s=>s.teamIds.every(x=>x.startsWith('f4c_'))));
 assert.equal(made.plan.slots[0].teamIds.length,0);
 const body=JSON.stringify(made.plan);
 assert(!body.includes('TEST_')&&!body.includes('nickname')&&!body.includes('p0'));
 const raw=new Map([
 ['pokesleep-strategy-e7-box-v1',identity.boxRaw],
 [safe.LEDGER,identity.ledgerRevision]
 ]);
 const storage={getItem:k=>raw.has(k)?raw.get(k):null,
  setItem:(k,v)=>raw.set(k,v),removeItem:k=>raw.delete(k)};
 const read=safe.adopt(storage,c,proposal,identity,'a'.repeat(40),
  Array.from({length:78},(_,i)=>({id:'recipe'+i})),c.clock);
 assert.equal(read.status,'ADOPTED',read.reason);
 assert.equal(read.slots.length,29);
 const altered={...c,inventoryRevision:'stock-new'};
 const stale=safe.readPlan(storage,altered,identity,'a'.repeat(40),
  Array.from({length:78},(_,i)=>({id:'recipe'+i})),c.clock);
 assert.equal(stale.status,'STALE_ADOPTED');
 assert.equal(stale.slots.length,29);
 assert.equal(stale.reason,'SAVED_PLAN_INPUTS_CHANGED');
 const changedPlayer={...c,player:{...c.player,pot:90}};
 const playerStale=safe.readPlan(storage,changedPlayer,identity,'a'.repeat(40),
  Array.from({length:78},(_,i)=>({id:'recipe'+i})),c.clock);
 assert.equal(playerStale.status,'STALE_ADOPTED');
 assert.equal(playerStale.reason,'PLAYER_OR_BERRY_SETTINGS_CHANGED');
 const changedBerry={...c,savedBerrySetup:{types:['grass','fire','normal']}};
 assert.equal(safe.readPlan(storage,changedBerry,identity,'a'.repeat(40),
  Array.from({length:78},(_,i)=>({id:'recipe'+i})),c.clock).status,'STALE_ADOPTED');
});

test('explicit user-confirmed Sunday lineup is pinned to real Box IDs and changes adopted-plan revision',()=>{
 const c=getCtx(),{deps}=fake(),p=auto.propose(c,{},deps);
 const map=new Map(Array.from({length:6},(_,i)=>[opaque(i),i]));
 const identity={status:'IDENTITIES_READY',ids:[...map.keys()],byId:map,
  digests:Array.from({length:6},(_,i)=>String(i).padStart(64,'0')),
  boxRaw:'{"version":1,"items":[]}',ledgerRevision:'{"version":1}'};
 const raw=new Map([['pokesleep-strategy-e7-box-v1',identity.boxRaw],
  [safe.LEDGER,identity.ledgerRevision]]);
 const storage={getItem:k=>raw.has(k)?raw.get(k):null,setItem:(k,v)=>raw.set(k,v)};
 const recipes=Array.from({length:78},(_,i)=>({id:'recipe'+i}));
 assert.equal(safe.adopt(storage,c,p,identity,'a'.repeat(40),recipes,c.clock).status,'ADOPTED');
 assert.equal(safe.readCarry(storage,c,identity).status,'EMPTY');
 assert.equal(safe.saveCarry(storage,c,identity,[0,2,3,4,5]).status,'CARRY_SAVED');
 const confirmed=safe.readCarry(storage,c,identity);
 assert.equal(confirmed.status,'CARRY_READY');
 assert.deepEqual([...confirmed.team],[0,2,3,4,5]);
 assert.equal(JSON.parse(storage.getItem(safe.key('carry',c.weekStart,c.eventId))).previousSunday,
   '2026-11-15');
 const changed={...c,previousCarryRevision:confirmed.revision};
 assert.equal(safe.readPlan(storage,changed,identity,'a'.repeat(40),recipes,c.clock).status,
  'STALE_ADOPTED');
 const newProposal=auto.propose(changed,{previousWeekSleepIndices:confirmed.team},deps);
 assert.equal(newProposal.status,'PROVISIONAL',newProposal.reason);
 assert.equal(newProposal.previousWeekCarryUnknown,false);
 assert.deepEqual(Array.from(newProposal.slots[0].team),['p0','p2','p3','p4','p5']);
 const next=safe.adopt(storage,changed,newProposal,identity,'a'.repeat(40),recipes,c.clock);
 assert.equal(next.status,'ADOPTED',next.reason);
 assert.equal(next.slots[0].teamIds.length,5);
 const other={...changed,eventId:'manual:2026-11-23'};
 assert.equal(safe.readCarry(storage,other,identity).status,'EMPTY','event-owned data does not leak');
 const corruptedRaw=JSON.parse(storage.getItem(safe.key('carry',c.weekStart,c.eventId)));
 corruptedRaw.eventId='manual:other';
 storage.setItem(safe.key('carry',c.weekStart,c.eventId),JSON.stringify(corruptedRaw));
 assert.equal(safe.readCarry(storage,changed,identity).status,'BLOCKED');
});
test('real Strategy modal loads the same F1-B numerical source as Box, not placeholder values',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../e7-preview/U3_Strategy_UI_20261109_v50_E7.html'),'utf8');
 const ui=fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-f4c-integrated-v112.js'),'utf8');
 assert(html.includes('e7-box-individual-stats-v105.js'));
 assert(ui.includes('root.PokeE7BoxStats?.calculate?.(item)'));
 assert(ui.includes('eligibleIndices.has(i)'));
 assert(ui.includes("store.readCarry(localStorage,c,refs)"));
});

test('v115 parallel real-Box identity initialization converges on one ledger and stable IDs',async()=>{
 const crypto=require('node:crypto');
 const idEngine=load('f4/f4-c-stable-box-ids-v1.js');
 const secure={subtle:crypto.webcrypto.subtle,
  randomUUID:()=>crypto.randomUUID(),
  getRandomValues:a=>crypto.randomFillSync(a)};
 const rows=Array.from({length:7},(_,i)=>({
  nickname:'private'+i,pokemon:'fixture'+i,level:50,skillLevel:3,
  ing1:'apple',ing2:'milk',ing3:'oil',mainSkill:'test',nature:'てれや',
  mint:false,lv10:'a',lv25:'b',lv50:'c',lv70:'d',lv80:'e',
  ribbon:0,shiny:false,favorite:''
 }));
 const box=JSON.stringify({version:1,items:rows});
 const values=new Map([['pokesleep-strategy-e7-box-v1',box]]);
 const storage={getItem:k=>values.has(k)?values.get(k):null,
  setItem:(k,v)=>values.set(k,v)};
 const results=await Promise.all(Array.from({length:8},()=>safe.identities(
  storage,rows,{identity:idEngine,crypto:secure})));
 for(const result of results){
  assert.equal(result.status,'IDENTITIES_READY',result.reason);
  assert.equal(result.boxRaw,box);
  assert.equal(result.ids.length,7);
  assert.equal(result.ledgerRevision,results[0].ledgerRevision);
  assert.deepEqual([...result.ids],[...results[0].ids]);
 }
 assert.equal(new Set(results[0].ids).size,7);
 assert.equal(storage.getItem(safe.LEDGER),results[0].ledgerRevision);
});

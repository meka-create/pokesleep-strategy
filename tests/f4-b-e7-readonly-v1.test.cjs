'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function moduleAt(p){
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;
}
function browserAt(p){
 const sandbox={window:{},globalThis:{}};
 vm.runInNewContext(read(p),sandbox,{filename:p,timeout:15000});
 return sandbox.window.PokeE7E1||sandbox.window.PokeE7InventoryScope;
}
const clock=moduleAt('f4/f4-b-game-week-v1.js');
const f4b=moduleAt('f4/f4-b-e7-readonly-v1.js');
const e1=browserAt('e7-preview/e7-e1-core-v84.js');
const scope=browserAt('e7-preview/e7-inventory-scope-v78.js');
const W='2026-11-16',FIELD='ワカクサ本島';
const names=[
 'ふといながねぎ','あじわいキノコ','とくせんエッグ','ほっこりポテト',
 'とくせんリンゴ','げきからハーブ','マメミート','モーモーミルク',
 'あまいミツ','ピュアなオイル','あったかジンジャー','あんみんトマト',
 'リラックスカカオ','おいしいシッポ','ワカクサ大豆','ワカクサコーン',
 'めざましコーヒー','ずっしりカボチャ','つやつやアボカド'
];
const codes=['leek','mushroom','egg','potato','apple','herb','sausage','milk',
 'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado'];
const dict=Object.fromEntries(codes.map((c,i)=>[c,names[i]]));
const master={ingredients:dict,types:{water:'みず',fire:'ほのお',grass:'くさ'}};
const copy=x=>JSON.parse(JSON.stringify(x));
const instant='2026-11-15T12:00:00+09:00';
const deps={e1,scope,weekClock:clock};
function storage(){
 const data=new Map(),writes=[];
 return {getItem:k=>data.has(k)?data.get(k):null,
  setItem:(k,v)=>{writes.push(k);data.set(k,v);},
  snapshot:()=>new Map(data),writes};
}
function put(store,key,x){store.setItem(key,JSON.stringify(x));}
function fixture({id='manual:'+W,source=null,plan=true,auto=false,field=FIELD}={}){
 const store=storage();
 const sel={id,weekStart:W};
 const fields={field,food:'curry',camp:false,source};
 let ledger=e1.newConditionLedger(sel);
 ledger=e1.stageConditionEdits(ledger,{fields,revision:'cond1',
  savedAt:instant,missingFields:[]});
 ledger=e1.confirmEventConditions(ledger,{userConfirmed:true});
 put(store,'pokesleep-strategy-u3-e3-v1:selected',sel);
 put(store,f4b.keyFor(W,id,'conditions'),ledger);
 put(store,'pokesleep-strategy-e7-box-v1',
  {version:1,items:Array.from({length:6},(_,i)=>({
   pokemon:'モック個体'+i,nickname:'SECRET-'+i,level:50,skillLevel:3}))});
 put(store,'pokesleep-strategy-e7-player-v1',
  {version:1,pot:57,bag:600,bonuses:{[FIELD]:40}});
 const vals=Object.fromEntries(names.map(k=>[k,k==='とくせんリンゴ'?20:0]));
 const inv=e1.applyInventorySave(e1.newInventoryTimeline(W),{
  savedAt:instant,revision:'inv1',values:vals});
 put(store,scope.scopedKey(W,id),{...inv,eventId:id});
 if(plan)put(store,f4b.keyFor(W,id,'plan'),{
  version:1,weekStart:W,eventInfo:{start:W,field,food:'curry',camp:false,
   source,berrySetup:{types:['みず','ほのお','くさ']}},
  manualSleep:Array.from({length:7},()=>['mockA','mockB','mockC','mockD','mockE']),
  autoSleep:auto});
 // The fixture writer is not part of the tested F4 read-only implementation.
 store.writes.length=0;
 return store;
}
test('F4-B JST 04:00 is a 168h week, including distinct previous-Sunday and truncated final-night windows',()=>{
 const x=clock.build(W,'2026-11-16T04:00:00+09:00');
 assert.equal(x.status,'TIMELINE_READY');assert.equal(x.totalHours,168);
 assert.equal(x.windowCount,29);assert.equal(x.daytimeWindows,21);
 assert.equal(x.mealOpportunities,21);assert.equal(x.currentWeekSleepWindows,7);
 assert.equal(x.startsAt,'2026-11-15T19:00:00.000Z');
 assert.equal(x.endsAt,'2026-11-22T19:00:00.000Z');
 assert.equal(x.windows[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(x.windows[0].day,-1);assert.equal(x.windows[0].hours,3.5);
 assert.equal(x.windows.at(-1).source,'FINAL_NIGHT_TRUNCATED');
 assert.equal(x.windows.at(-1).hours,4);
 assert.equal(x.windows[0].state,'FUTURE');
 assert.equal(x.phase,'DURING');
 assert.equal(x.windows.reduce((v,w)=>v+w.hours,0),168);
 assert.equal(x.requiresPreviousWeekSleep,true);
 assert.equal(x.weeklyEnergyCertified,false);
});
test('04:00 phase and in-window clock edges do not use UTC date or midnight',()=>{
 assert.equal(clock.build(W,'2026-11-16T03:59:59+09:00').phase,'BEFORE');
 assert.equal(clock.build(W,'2026-11-16T04:00:00+09:00').phase,'DURING');
 assert.equal(clock.build(W,'2026-11-23T03:59:59+09:00').phase,'DURING');
 assert.equal(clock.build(W,'2026-11-23T04:00:00+09:00').phase,'ENDED');
 const x=clock.build(W,'2026-11-20T09:00:00+09:00');
 assert.equal(x.windows.filter(w=>w.state==='ACTIVE').length,1);
 assert.equal(clock.build('2026-11-17',instant).reason,'INVALID_WEEK');
 assert.equal(clock.build('2026-02-30',instant).reason,'INVALID_WEEK');
 assert.equal(clock.build(W,'2026-11-16T04:00:00').reason,'INVALID_INSTANT');
 assert.equal(clock.build(W,'nonsense').reason,'INVALID_INSTANT');
});
test('valid E7 event, boxed individual data and owner-scoped inventory are read without writes',()=>{
 const store=fixture(),before=JSON.stringify([...store.snapshot()]);
 const ctx=f4b.readContext(store,deps,instant);
 assert.equal(ctx.status,'CONTEXT_READY',ctx.message);
 assert.equal(ctx.weekStart,W);assert.equal(ctx.inventoryValues['とくせんリンゴ'],20);
 assert.equal(ctx.clock.phase,'BEFORE');assert.equal(ctx.illustrativeSleepOnly,true);
 assert.equal(ctx.privateBoxRows[0].nickname,'SECRET-0');
 const report=f4b.publicStatus(ctx);
 assert.equal(report.registeredIndividuals,6);
 assert(!JSON.stringify(report).includes('SECRET-'));
 assert(!JSON.stringify(report).includes('privateBoxRows'));
 assert.equal(JSON.stringify([...store.snapshot()]),before);
 assert.equal(store.writes.length,0);
});
test('foreign event stock is never borrowed and corrupted owner prevents calculation',()=>{
 const store=fixture(),owner='manual:'+W;
 const same=JSON.parse(store.getItem(scope.scopedKey(W,owner)));
 put(store,scope.scopedKey(W,owner),{...same,eventId:'manual:foreign'});
 store.writes.length=0;
 assert.equal(f4b.readContext(store,deps,instant).reason,'EVENT_INVENTORY_MISSING');
 assert.equal(store.writes.length,0);
 // A week-only historical entry belonging to a different event is also ignored.
 const other=fixture();
 const inv=JSON.parse(other.getItem(scope.scopedKey(W,owner)));
 other.setItem(scope.legacyKey(W),JSON.stringify({...inv,eventId:'manual:foreign'}));
 other.setItem(scope.scopedKey(W,owner),'broken');
 assert.equal(f4b.readContext(other,deps,instant).status,'BLOCKED');
});
test('official saved event is BLOCKED before any model adapter, even in neutral opt-in',()=>{
 const id='pokesleep-tool:bountiful banquet week vol1:'+W;
 const src={id,sourceKey:'bountiful banquet week vol1',
  start:W,verifiedEffects:{extraIng:'nuts',ingredient:1,carryLimitAdd:10}};
 const store=fixture({id,source:src});
 const ctx=f4b.readContext(store,deps,instant);
 assert.equal(ctx.status,'CONTEXT_READY');
 const result=f4b.buildNeutralInput(ctx,{neutralReferenceOnly:true},
  {roster:{adapt:()=>{throw Error('must not reach roster!')}}});
 assert.equal(result.reason,'EVENT_MODEL_NOT_CONNECTED');
 assert.equal(result.weeklyEnergyCertified,false);
});
test('mock U3 sleep team is not interpreted as a real box selection',()=>{
 const store=fixture();
 const ctx=f4b.readContext(store,deps,instant);
 const fakeRoster={adapt:()=>({status:'READY',sourceCommit:'a'.repeat(40),
  profiles:Array.from({length:6},(_,i)=>({id:'p'+i}))})};
 const options={neutralReferenceOnly:true,favoriteTypes:['water','fire','grass']};
 const params={roster:fakeRoster,master,recipes:[{id:'test'}]};
 assert.equal(f4b.buildNeutralInput(ctx,options,params).reason,'REAL_NIGHTS_REQUIRED');
 const rows=Array.from({length:7},()=>[0,1,2,3,4]);
 const ok=f4b.buildNeutralInput(ctx,{...options,realNightTeamIndices:rows},params);
 assert.equal(ok.status,'READY',ok.message);
 assert.equal(ok.input.nightTeams.length,7);
 assert.deepEqual([...ok.input.nightTeams[0]],['p0','p1','p2','p3','p4']);
 assert.equal(ok.input.initialInventory.apple,20);
 assert.equal(ok.input.eventSource,null);assert.equal(ok.weeklyEnergyCertified,false);
 assert.equal(f4b.buildNeutralInput(ctx,{...options,realNightTeamIndices:
  Array.from({length:7},()=>[0,0,1,2,3])},params).reason,'REAL_NIGHTS_REQUIRED');
});
test('saved auto ON can use real roster without manual nights; previous sleep remains uncertified',()=>{
 const store=fixture({auto:true}),ctx=f4b.readContext(store,deps,instant);
 const fakeRoster={adapt:()=>({status:'READY',sourceCommit:'a'.repeat(40),
  profiles:Array.from({length:6},(_,i)=>({id:'p'+i}))})};
 const result=f4b.reference(store,{instant,neutralReferenceOnly:true,
  favoriteTypes:['water','fire','grass']},{
  ...deps,roster:fakeRoster,master,recipes:[{id:'test'}],
  core:{plan:i=>({status:'PROVISIONAL',mode:i.eventMode,
   autoSleep:i.autoSleep,weeklyEnergyCertified:false,slots:[]})}});
 assert.equal(result.status,'PROVISIONAL',result.message);
 assert.equal(result.result.autoSleep,true);
 assert.equal(result.gameWeek.fullyModeled,false);
 assert.equal(result.weeklyEnergyCertified,false);
 assert.equal(result.writesSavedData,false);assert.equal(store.writes.length,0);
 assert(!JSON.stringify(result).includes('SECRET-'));
});
test('missing sleep, player values, unknown foods and plan owner mismatch fail closed',()=>{
 const noSleep=fixture({plan:false});
 assert.equal(f4b.buildNeutralInput(f4b.readContext(noSleep,deps,instant),
  {neutralReferenceOnly:true},{master}).reason,'SLEEP_SETTING_NOT_SAVED');
 const store=fixture(),key='pokesleep-strategy-e7-player-v1';
 const bad=JSON.parse(store.getItem(key));bad.bag=null;put(store,key,bad);
 assert.equal(f4b.buildNeutralInput(f4b.readContext(store,deps,instant),
  {neutralReferenceOnly:true},{master}).reason,'PLAYER_VALUES_UNCONFIRMED');
 const other=fixture(),k=f4b.keyFor(W,'manual:'+W,'plan');
 const entry=JSON.parse(other.getItem(k));entry.eventInfo.food='salad';
 put(other,k,entry);
 assert.equal(f4b.readContext(other,deps,instant).reason,'SAVED_PLAN_OWNER_MISMATCH');
});
test('F4-B is isolated from protected E7 views and main root',()=>{
 const ui=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 assert(!ui.includes('f4-b-e7-readonly-v1.js'));
 const source=read('f4/f4-b-e7-readonly-v1.js');
 for(const banned of ['.setItem(','.removeItem(','.clear('])
  assert(!source.includes(banned),'F4-B new bridge must not write persistence: '+banned);
 assert(!source.includes('localStorage.'));
});


test('F4-B rejects future stock and current midweek stock as full-week initial inventory',()=>{
 const owner='manual:'+W,k=scope.scopedKey(W,owner);
 const upcoming=fixture();
 assert.equal(f4b.readContext(upcoming,deps,'2026-11-15T11:59:59+09:00').reason,
  'INVENTORY_FROM_FUTURE');
 const mid=fixture(),before=JSON.parse(mid.getItem(k)),values=copy(before.currentInventory.values);
 values['とくせんリンゴ']=13;
 const changed=e1.applyInventorySave(before,{
  savedAt:'2026-11-17T11:00:00+09:00',revision:'inv2',values});
 put(mid,k,{...changed,eventId:owner});
 mid.writes.length=0;
 const ctx=f4b.readContext(mid,deps,'2026-11-17T12:00:00+09:00');
 assert.equal(ctx.status,'CONTEXT_READY',ctx.message);
 const x=f4b.buildNeutralInput(ctx,{neutralReferenceOnly:true},{master});
 assert.equal(x.reason,'MIDWEEK_STOCK_NOT_WEEK_START');
 assert.equal(mid.writes.length,0);
});
test('F4-B isolated read-only browser diagnostics reference only approved assets',()=>{
 const page=read('f4b-preview/index.html');
 assert(page.includes('f4-b-e7-readonly-v1.js'));
 assert(page.includes('f4-b-game-week-v1.js'));
 assert(page.includes('e7-e1-core-v84.js'));
 assert(!page.includes('localStorage.setItem'));
 assert(!page.includes('localStorage.removeItem'));
 assert(!page.includes('privateBoxRows'));
});

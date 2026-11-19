'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=p=>{
 const env={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',p),'utf8'),
  env,{filename:p,timeout:20000});
 return env.module.exports;
};
const clock=load('f4/f4-b-game-week-v1.js');
const core=load('f4/f4-chronological-core-v1.js');
const policy=load('f4/f4-c-healer-policy-v100.js');
const mid=load('f5/f5-midweek-v119.js');
const store=load('f4/f4-c-real-storage-v112.js');
const W='2026-11-16',ID='manual:'+W,COMMIT='a'.repeat(40);
const anchor='2026-11-18T13:35:00+09:00';
const now='2026-11-18T13:40:00+09:00';
const opaque=i=>'f4c_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000';
const byId=new Map(Array.from({length:7},(_,i)=>[opaque(i),i]));
const identity={status:'IDENTITIES_READY',ids:[...byId.keys()],byId,
 digests:Array.from({length:7},(_,i)=>String(i).padStart(64,'0')),
 boxRaw:'{"version":1,"items":[]}',ledgerRevision:'{"version":1}'};
const profiles=Array.from({length:7},(_,i)=>({
 id:'p'+i,source:'F1_B_PINNED_66_SPECIES',
 healerRole:i<2?'TEAM_WIDE_HEALER':null,helpingBonus:false,
 ratesByTeammateBonus:Array.from({length:5},(_,j)=>({
  status:'BASE_RATES_AVAILABLE',helpSeconds:3600,
  berryEnergyPerHelp:i<2?10+i*2:100-i*8,
  ingredientCountsPerHelp:{apple:i<2?0:1}
 }))
}));
const dict=Object.fromEntries(core.FOOD.map(c=>[c,'F5_NAME_'+c]));
const recipes=Array.from({length:81},(_,i)=>({
 id:'recipe_'+i,type:'curry',baseStrength:100+i,
 requirements:{apple:i%3+1}
}));
const deps={weekClock:clock,roster:{adapt:()=>({
 status:'READY',sourceCommit:COMMIT,profiles})},
 base:core,policy,master:{ingredients:dict},recipes,
 auto:{favorites:()=>['water','fairy','flying'],
 rankingScore:(r,p)=>({score:r.energyExpected*(p[0]==='p0'?0.95:1),recoveryProxyPoints:20})},
 skillValues:{skillValue:()=>({status:'BASE_VALUE_ONLY'})},
 snapshot:{upstream:{commit:COMMIT}},traits:{},legal:{},rates:{},store};
function make(){
 const raw=new Map([['pokesleep-strategy-e7-box-v1',identity.boxRaw],
  [store.LEDGER,identity.ledgerRevision]]);
 const storage={getItem:k=>raw.has(k)?raw.get(k):null,
  setItem:(k,v)=>raw.set(k,v),removeItem:k=>raw.delete(k),raw};
 const wk=clock.build(W,now);
 const ctx={status:'CONTEXT_READY',weekStart:W,eventId:ID,
  clock:wk,inventorySavedAt:anchor,
  inventoryRevision:'inv-new',conditionRevision:'cond-1',autoSleep:true,
  previousCarryRevision:null,
  fields:{field:'シアンの砂浜',food:'curry',camp:false,source:null},
  savedBerrySetup:{types:['water','fairy','flying']},
  player:{pot:57,bag:500,bonuses:{'シアンの砂浜':50}},
  privateBoxRows:Array.from({length:7},(_,i)=>({pokemon:'SECRET_TEST_'+i})),
  inventoryValues:Object.fromEntries(core.FOOD.map(f=>[dict[f],f==='apple'?25:0]))};
 const week=clock.build(W,'2026-11-15T12:00:00+09:00');
 const slots=week.windows.map((w,i)=>{
  const team=i===0?[]:w.slot==='sleep'?
   [2,3,4,5,6]:w.slot==='morning'?[2,3,4,1,0]:[2,3,4,5,0];
  return {day:w.day,slot:w.slot,source:w.source,
   startsAt:w.startsAt,endsAt:w.endsAt,
   teamIds:team.map(k=>identity.ids[k]),
   teamIndices:team,recipeId:w.slot==='sleep'?null:'recipe_1'};
 });
 const full={kind:'REAL_BOX_PLAN_V112',revision:'root-rev',weekStart:W,
  eventId:ID,slots};
 const rootRaw=JSON.stringify(full);
 storage.setItem(store.key('plan',W,ID),rootRaw);
 const previous={status:'STALE_ADOPTED',plan:full,slots,revision:rootRaw};
 return {storage,ctx,previous};
}
const build=(f)=>mid.reference(f.ctx,f.previous,identity,{...deps,storage:f.storage});
test('F5: 29 windows use only the fresh stock snapshot, never turn prior forecast into observed history',()=>{
 const f=make(),writes=f.storage.raw.size;
 const p=build(f);
 assert.equal(p.status,'PROVISIONAL',p.reason);
 assert.equal(f.storage.raw.size,writes,'preview is read-only');
 assert.equal(p.slots.length,29);
 assert.equal(p.pastEvidence,'UNOBSERVED_ADOPTED_FORECAST_ONLY');
 assert.equal(p.actualObservedCount,0);
 assert.equal(p.weeklyEnergyCertified,false);
 assert(p.anchorIndex>0&&p.anchorIndex<28);
 const timeline=clock.build(W,anchor);
 const active=p.slots[p.anchorIndex];
 assert.equal(active.windowPhase,'ACTIVE_REMAINDER');
 assert.equal(active.remainingHours,timeline.windows[p.anchorIndex].hours-
  timeline.windows[p.anchorIndex].elapsedHours);
 for(let i=0;i<p.anchorIndex;i++){
  assert.equal(p.slots[i].windowPhase,'PAST_FORECAST_ONLY');
  assert.equal(p.slots[i].recipeId,f.previous.slots[i].recipeId);
  assert.deepEqual([...p.slots[i].team],f.previous.slots[i].teamIndices.map(i=>'p'+i));
 }
 assert.deepEqual([...active.team],f.previous.slots[p.anchorIndex].teamIndices.map(i=>'p'+i));
 assert.equal(active.recipeId,f.previous.slots[p.anchorIndex].recipeId);
 for(let i=p.anchorIndex+1;i<29;i++){
  const w=p.slots[i];assert.equal(w.windowPhase,'FUTURE_FORECAST');
  if(w.slot==='morning'){
   assert.equal(w.team[3],p.selectedSecondary);
   assert.equal(w.team[4],p.selectedPrimary);
  }
  if(w.slot==='noon'||w.slot==='evening'){
   assert.equal(w.team[4],p.selectedPrimary);
   assert(!w.team.includes(p.selectedSecondary));
  }
 }
});
test('F5: adoption saves only stable IDs; restores, respects event owner and stock revisions',()=>{
 const f=make(),p=build(f);
 assert.equal(p.status,'PROVISIONAL',p.reason);
 const first=mid.adopt(f.storage,f.ctx,p,identity,COMMIT,recipes,f.ctx.clock,store);
 assert.equal(first.status,'ADOPTED',first.reason);
 const saved=f.storage.getItem(mid.key(f.ctx));
 assert(saved);
 assert(!saved.includes('SECRET_TEST')&&!saved.includes('"nickname"'));
 assert(!saved.includes('"team":["p'));
 const other={...f.ctx,eventId:'manual:2026-11-23'};
 assert.equal(mid.read(f.storage,other,identity,COMMIT,recipes,f.ctx.clock,store).status,'EMPTY');
 assert.equal(first.slots.length,29);
 const changed={...f.ctx,inventoryRevision:'inv-newer'};
 const stale=mid.read(f.storage,changed,identity,COMMIT,recipes,changed.clock,store);
 assert.equal(stale.status,'STALE_ADOPTED');
 const replay={ctx:changed,storage:f.storage,previous:stale};
 replay.ctx={...changed,inventorySavedAt:'2026-11-18T13:38:00+09:00'};
 const next=build(replay);
 assert.equal(next.status,'PROVISIONAL',next.reason);
 for(let i=0;i<=next.anchorIndex;i++){
  assert.equal(next.slots[i].recipeId,stale.slots[i].recipeId);
  assert.deepEqual([...next.slots[i].team],[...stale.slots[i].teamIndices].map(i=>'p'+i));
 }
 assert.equal(mid.adopt(f.storage,replay.ctx,next,identity,COMMIT,recipes,
  replay.ctx.clock,store).status,'ADOPTED');
});
test('F5: stale review, tampered past or current slot, changed root, and stale stock fail without clobbering records',()=>{
 const f=make(),p=build(f),key=mid.key(f.ctx);
 const bad={...p,slots:p.slots.map((w,i)=>i===2?
  {...w,team:['p0','p2','p3','p4','p5']}:w)};
 assert.equal(mid.adopt(f.storage,f.ctx,bad,identity,COMMIT,recipes,
  f.ctx.clock,store).status,'BLOCKED');
 assert.equal(f.storage.getItem(key),null);
 const taken=mid.adopt(f.storage,f.ctx,p,identity,COMMIT,recipes,f.ctx.clock,store);
 assert.equal(taken.status,'ADOPTED',taken.reason);
 const current=f.storage.getItem(key);
 const oldReview=mid.adopt(f.storage,f.ctx,p,identity,COMMIT,recipes,f.ctx.clock,store);
 assert.equal(oldReview.reason,'F5_ADOPTION_CHANGED_SINCE_REVIEW');
 assert.equal(f.storage.getItem(key),current);
 const crossed={...f.ctx,inventorySavedAt:'2026-11-18T11:55:00+09:00',
  clock:clock.build(W,'2026-11-18T12:05:00+09:00')};
 assert.equal(build({...f,ctx:crossed}).reason,'F5_INVENTORY_WINDOW_CHANGED');
 const oldStock={...f.ctx,inventorySavedAt:'2026-11-18T10:00:00+09:00'};
 assert.equal(build({...f,ctx:oldStock}).reason,'FRESH_MIDWEEK_INVENTORY_REQUIRED');
 f.storage.setItem(store.key('plan',W,ID),JSON.stringify({
  ...JSON.parse(f.storage.getItem(store.key('plan',W,ID))),revision:'other-rev'}));
 assert.equal(mid.read(f.storage,f.ctx,identity,COMMIT,recipes,f.ctx.clock,store).status,'BLOCKED');
});
test('F5: preview load, SW cache and event deletion include the exact-owner partial record',()=>{
 const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 const sw=read('e7-preview/e7-sw-v50.js');
 const del=read('e7-preview/e7-event-delete-v71.js');
 assert(html.includes('../f5/f5-midweek-v119.js'));
 assert(ui.includes('mid.reference(')&&ui.includes('mid.adopt(')&&ui.includes('mid.read('));
 assert(ui.includes('PAST_FORECAST_ONLY'));
 assert(sw.includes('../f5/f5-midweek-v119.js'));
 assert(del.includes("F5+week+':'+encoded"));
 assert(!read('index.html').includes('f5-midweek-v119'));
});
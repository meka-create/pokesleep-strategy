'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const box={module:{exports:{}},globalThis:{},TextEncoder};
 vm.runInNewContext(read(p),box,{filename:p,timeout:15000});
 return box.module.exports;
}
const local=load('f4/f4-c-local-draft-v104.js');
const ids=load('f4/f4-c-stable-box-ids-v1.js');
const clock=load('f4/f4-b-game-week-v1.js');
const deps={crypto:webcrypto,identity:ids,clock};
const week='2026-11-16',eventId='manual:'+week;
const instant='2026-11-15T23:00:00+09:00';
function box(){
 return Array.from({length:8},(_,i)=>({
  nickname:'SECRET_NICKNAME_'+i,pokemon:'テストポケモン'+i,
  level:20+i,skillLevel:3,ing1:'apple',ing2:'milk',ing3:'apple',
  mainSkill:i<2?'Energy for Everyone S':'Charge Strength M',
  nature:'Hardy',mint:false,lv10:'Helping Bonus',lv25:null,lv50:null,
  lv70:null,lv80:null,ribbon:0,shiny:false,favorite:false
 }));
}
function fakeStorage(){
 const values=new Map();
 return {values,getItem:k=>values.has(k)?values.get(k):null,
  setItem:(k,v)=>{values.set(k,v);},removeItem:k=>values.delete(k)};
}
function scenario(over={}){
 const rows=box(),now=clock.build(week,instant);
 const base={status:'CONTEXT_READY',weekStart:week,eventId,
  fields:{source:null},autoSleep:false,clock:now,
  conditionRevision:'condition-rev-v1',
  inventoryRevision:'stock-rev-v1',
  privateBoxRows:rows};
 const profiles=rows.map((_,i)=>({id:'p'+i,
  healerRole:i<2?'TEAM_WIDE_HEALER':null,
  source:'F1_B_PINNED_66_SPECIES'}));
 const night=['p0','p2','p3','p4','p5'];
 const prepared={status:'READY',sourceCommit:'a'.repeat(40),
  input:{weekStart:week,eventSource:null,eventMode:'NEUTRAL_REFERENCE_ONLY',
   autoSleep:false,profiles,recipes:[{id:'apple',type:'curry',
    requirements:{apple:2},baseStrength:200}],
   previousWeekSleepTeam:night,
   nightTeams:Array.from({length:7},()=>[...night])}};
 const path=now.windows.map(w=>{
  const team=w.slot==='sleep'?night:
   w.slot==='morning'?['p2','p3','p4','p1','p0']:
   ['p2','p3','p4','p5','p0'];
  return {day:w.day,slot:w.slot,source:w.source,
   startsAt:w.startsAt,endsAt:w.endsAt,team:[...team],
   recipeId:w.slot==='sleep'?null:'apple',
   cookedRecipeId:w.slot==='sleep'?null:'apple'};
 });
 const plan={status:'PROVISIONAL',
  stage:'F4_C_V101_ITEM_AWARE_RERANK',weekStart:week,
  startsAt:now.startsAt,endsAt:now.endsAt,slotCount:29,
  sleepScoreAssumed:100,weeklyEnergyCertified:false,
  writesSavedData:false,privateIndividualDataInResult:false,
  slots:path};
 const opts={explicitReferenceConsent:'SAVE_PROVISIONAL_LOCAL_DRAFT',
  primaryHealerIndex:0,secondaryHealerIndex:1,expectedRevision:null};
 return {storage:fakeStorage(),context:base,prepared,plan,options:opts,...over};
}
test('v104: default no-write and explicit opt-in saves only an anonymous sidecar',async()=>{
 const a=scenario(),before=JSON.stringify(a.context.privateBoxRows);
 assert.equal(local.summary(a.storage,ids).status,'EMPTY');
 assert.equal((await local.saveLocalReference({...a,
  options:{...a.options,explicitReferenceConsent:undefined}},deps)).status,'BLOCKED');
 assert.equal(a.storage.values.size,0);
 const saved=await local.saveLocalReference(a,deps);
 assert.equal(saved.status,'REFERENCE_DRAFT_SAVED',saved.reason);
 assert.equal(saved.officialPlanAdopted,false);
 assert.equal(saved.referenceWindowCount,29);
 assert.equal(a.storage.values.size,1);
 assert(a.storage.values.has(local.KEY));
 const raw=a.storage.getItem(local.KEY);
 assert(!raw.includes('SECRET_NICKNAME_'));
 assert(!raw.includes('テストポケモン'));
 assert(!raw.includes('pokesleep-strategy-u3-e3-v1'));
 assert(!raw.includes('"teamIndices"'));
 assert.equal(JSON.stringify(a.context.privateBoxRows),before);
 const data=JSON.parse(raw);
 assert.equal(data.drafts[0].slots[1].teamIds.at(-1),data.ledger.entries[0].id);
 assert.equal(data.drafts[0].slots[1].teamIds.at(-2),data.ledger.entries[1].id);
});
test('v104: full 29-window restore works after a unique CSV reorder with stable IDs',async()=>{
 const a=scenario(),s=await local.saveLocalReference(a,deps);
 assert.equal(s.status,'REFERENCE_DRAFT_SAVED',s.reason);
 const restored=await local.restoreLocalReference(a,deps);
 assert.equal(restored.status,'REFERENCE_DRAFT_RESTORED',restored.reason);
 assert.equal(restored.slots.length,29);
 assert.deepEqual(Array.from(restored.slots[1].teamIndices),[2,3,4,1,0]);
 const b=scenario({storage:a.storage});
 const order=[2,3,4,5,6,7,0,1];
 b.context.privateBoxRows=order.map(i=>a.context.privateBoxRows[i]);
 b.prepared.input.profiles=order.map((i,newIdx)=>({...a.prepared.input.profiles[i],id:'p'+newIdx}));
 b.prepared.input.previousWeekSleepTeam=['p6','p0','p1','p2','p3'];
 b.prepared.input.nightTeams=Array.from({length:7},()=>['p6','p0','p1','p2','p3']);
 const after=await local.restoreLocalReference(b,deps);
 assert.equal(after.status,'REFERENCE_DRAFT_RESTORED',after.reason);
 assert.equal(after.primaryHealerIndex,6);
 assert.equal(after.secondaryHealerIndex,7);
 assert.deepEqual(Array.from(after.slots[1].teamIndices),[0,1,2,7,6]);
 assert.deepEqual(Array.from(after.slots[4].teamIndices),[6,0,1,2,3]);
 assert.equal(a.storage.values.size,1,'restore must never mutate');
});
test('v104: source, event, and inventory revisions make the saved draft stale',async()=>{
 const a=scenario();
 assert.equal((await local.saveLocalReference(a,deps)).status,'REFERENCE_DRAFT_SAVED');
 for(const edit of [
  b=>b.context.conditionRevision='new-condition',
  b=>b.context.inventoryRevision='latest-stock',
  b=>b.context.eventId='manual:2026-11-23',
  b=>b.prepared.sourceCommit='b'.repeat(40),
  b=>b.context.privateBoxRows[2].level++
 ]){
  const b=scenario({storage:a.storage});
  edit(b);
  assert.equal((await local.restoreLocalReference(b,deps)).status,
   'BLOCKED','must block stale '+edit.toString());
 }
});
test('v104: selected identical Pokémon builds can never be persisted by row position',async()=>{
 const a=scenario();
 a.context.privateBoxRows[3]={...a.context.privateBoxRows[2]};
 const saved=await local.saveLocalReference(a,deps);
 assert.equal(saved.reason,'SELECTED_INDIVIDUAL_IDENTITY_AMBIGUOUS');
 assert.equal(a.storage.values.size,0);
});
test('v104: stale optimistic revision and cross-tab mutation do not overwrite a local draft',async()=>{
 const a=scenario(),first=await local.saveLocalReference(a,deps);
 assert.equal(first.status,'REFERENCE_DRAFT_SAVED',first.reason);
 assert.equal((await local.saveLocalReference(a,deps)).reason,
  'LOCAL_REFERENCE_CONFLICT');
 const second={...a,options:{...a.options,expectedRevision:first.revision}};
 const written=await local.saveLocalReference(second,deps);
 assert.equal(written.status,'REFERENCE_DRAFT_SAVED',written.reason);
 assert.notEqual(written.revision,first.revision);
 const changed=scenario();
 const old=a.storage.getItem(local.KEY);
 changed.storage.setItem(local.KEY,old);
 changed.storage.setItem(local.KEY,'{broken');
 assert.equal(local.summary(changed.storage,ids).reason,'LOCAL_STATE_CORRUPTED');
});
test('v104: invalid timeline, forged healer parties, recipes and wrong sleep teams are blocked',async()=>{
 for(const edit of [
  a=>{a.plan.slots[1].team[4]='p2';},
  a=>{a.plan.slots[2].team[1]='p1';},
  a=>{a.plan.slots[4].team[0]='p6';},
  a=>{a.plan.slots[1].recipeId='fake';a.plan.slots[1].cookedRecipeId='fake';},
  a=>{a.plan.slots[1].startsAt='2026-11-16T01:00:00.000Z';},
  a=>{a.plan.stage='OFFICIAL_CERTIFIED';},
  a=>{a.plan.weeklyEnergyCertified=true;},
  a=>{a.context.fields.source={id:'verified-event'};},
  a=>{a.context.autoSleep=true;}
 ]){
  const a=scenario();
  edit(a);
  const r=await local.saveLocalReference(a,deps);
  assert.equal(r.status,'BLOCKED',edit.toString()+' :'+r.reason);
  assert.equal(a.storage.values.size,0);
 }
});
test('v104: storage never touches accepted E7 records and source code is network-free',()=>{
 const text=read('f4/f4-c-local-draft-v104.js');
 for(const x of ['fetch(', 'indexedDB.open','console.log(',
  'document.cookie','history.replaceState'])
  assert(!text.includes(x),x);
 assert(!read('e7-preview/index.html').includes('f4-c-local-draft-v104.js'));
 assert(!read('index.html').includes('f4-c-local-draft-v104.js'));
 assert.equal(local.KEY,'pokesleep-strategy-f4c-v104:local-reference-only');
});

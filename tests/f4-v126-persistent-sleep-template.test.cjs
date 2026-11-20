'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=p=>{const sandbox={module:{exports:{}},globalThis:{},TextEncoder};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',p),'utf8'),
  sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;};
const store=load('f4/f4-c-real-storage-v112.js');
const root={};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-event-delete-v71.js'),'utf8'),
 {globalThis:root},{timeout:15000});
const deletion=root.PokeE7EventDeletion;
const opaque=i=>'f4c_'+String(i).padStart(8,'0')+'-0000-4000-8000-000000000000';
const BOX='pokesleep-strategy-e7-box-v1',week1='2026-11-16',week2='2026-11-23';
const ctx=(week=week1,id='manual:'+week)=>({status:'CONTEXT_READY',weekStart:week,eventId:id,
 conditionRevision:'c',inventoryRevision:'i',autoSleep:false});
const identity={
 status:'IDENTITIES_READY',ids:Array.from({length:8},(_,i)=>opaque(i)),
 byId:new Map(Array.from({length:8},(_,i)=>[opaque(i),i])),
 digests:Array.from({length:8},(_,i)=>(''+i).padStart(64,'0')),
 boxRaw:'{"version":1,"items":[]}',ledgerRevision:'{"version":1}'
};
function storage(){
 const db=new Map([[BOX,identity.boxRaw],[store.LEDGER,identity.ledgerRevision]]);
 return {getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>db.set(k,v),
  removeItem:k=>db.delete(k),key:i=>[...db.keys()][i]??null,
  get length(){return db.size;},db};
}
const mon=[0,1,2,3,4],tue=[0,2,3,4,5],fri=[1,2,3,4,5];
const week=()=>[[...mon],[...tue],null,null,[...fri],null,null];
const copy=a=>a.map(x=>x===null?null:[...x]);
test('v126: saving manually keeps latest seven nights across weeks and events',()=>{
 const s=storage(),a=ctx(),b=ctx(week2);
 assert.equal(store.readSleep(s,a,identity).status,'EMPTY');
 assert.equal(store.saveSleep(s,a,identity,week()).status,'SLEEP_SAVED');
 assert.equal(s.getItem(store.key('sleep',a.weekStart,a.eventId)),null,
  'new save must not be an event-owned preference');
 const persisted=JSON.parse(s.getItem(store.SLEEP_GLOBAL));
 assert.equal(persisted.kind,'GLOBAL_MANUAL_SLEEP_V126');
 assert.equal(JSON.stringify(persisted).includes('nickname'),false);
 assert.equal(JSON.stringify(persisted).includes(a.eventId),false);
 assert.deepEqual(JSON.parse(JSON.stringify(store.readSleep(s,b,identity).teams)),week());
 const newer=copy(week());newer[2]=[0,1,3,4,6];newer[4]=null;
 assert.equal(store.saveSleep(s,b,identity,newer).status,'SLEEP_SAVED');
 assert.deepEqual(JSON.parse(JSON.stringify(store.readSleep(s,a,identity).teams)),newer,
  'last saved pattern must be authoritative even when an old event is opened');
});
test('v126: deleting event-scoped data cannot erase player-global sleep pattern',()=>{
 const s=storage(),a=ctx(),b=ctx(week2);
 assert.equal(store.saveSleep(s,a,identity,week()).status,'SLEEP_SAVED');
 const oldKey=store.key('sleep',a.weekStart,a.eventId);
 s.setItem(oldKey,JSON.stringify({version:1,weekStart:a.weekStart,eventId:a.eventId,
  revision:'legacy',teams:week().map(x=>x&&x.map(i=>identity.ids[i]))}));
 const base='pokesleep-strategy-u3-e3-v1:'+a.weekStart+':'+encodeURIComponent(a.eventId)+':';
 s.setItem(base+'conditions',JSON.stringify({weekStart:a.weekStart,eventId:a.eventId,
  confirmed:{weekStart:a.weekStart,eventId:a.eventId}}));
 s.setItem(base+'plan',JSON.stringify({version:1,weekStart:a.weekStart,
  eventInfo:{start:a.weekStart,source:null}}));
 const snapshot=deletion.snapshot(s,{weekStart:a.weekStart,id:a.eventId});
 assert(snapshot.keys.includes(oldKey),'old event-owned save is deleted');
 assert(!snapshot.keys.includes(store.SLEEP_GLOBAL),'global preference must NOT be part of delete transaction');
 deletion.remove(s,snapshot);
 assert.equal(s.getItem(oldKey),null);
 assert(s.getItem(store.SLEEP_GLOBAL));
 assert.deepEqual(JSON.parse(JSON.stringify(store.readSleep(s,b,identity).teams)),week());
});
test('v126: verified pre-v126 event-owned nights are migrated once without loss',()=>{
 const s=storage(),a=ctx(),b=ctx(week2);
 const key=store.key('sleep',a.weekStart,a.eventId);
 s.setItem(key,JSON.stringify({version:1,weekStart:a.weekStart,eventId:a.eventId,
  teams:week().map(x=>x&&x.map(i=>identity.ids[i]))}));
 const first=store.migrateSleep(s,a,identity);
 assert.equal(first.status,'SLEEP_READY',first.reason);
 assert.equal(first.source,'GLOBAL');
 assert.deepEqual(JSON.parse(JSON.stringify(first.teams)),week());
 assert.equal(store.migrateSleep(s,b,identity).source,'GLOBAL');
 const pinned=s.getItem(store.SLEEP_GLOBAL);
 s.setItem(key,JSON.stringify({version:1,weekStart:a.weekStart,eventId:a.eventId,
  teams:Array.from({length:7},()=>mon.map(i=>identity.ids[i]))}));
 assert.equal(store.migrateSleep(s,a,identity).source,'GLOBAL');
 assert.equal(s.getItem(store.SLEEP_GLOBAL),pinned,'legacy data must not override global');
});
test('v126: when new event is opened before old event, recover newest unique legacy week',()=>{
 const s=storage(),a=ctx(),b=ctx(week2);
 s.setItem(store.key('sleep',a.weekStart,a.eventId),
  JSON.stringify({version:1,weekStart:a.weekStart,eventId:a.eventId,
   teams:week().map(x=>x&&x.map(i=>identity.ids[i]))}));
 const next=store.migrateSleep(s,b,identity);
 assert.equal(next.status,'SLEEP_READY',next.reason);
 assert.equal(next.source,'GLOBAL');
 assert.deepEqual(JSON.parse(JSON.stringify(next.teams)),week());
});
test('v126: ambiguous legacy same-week events fail safely rather than guessing last',()=>{
 const s=storage(),a=ctx(),b=ctx(week2);
 const add=(id)=>s.setItem(store.key('sleep',a.weekStart,id),
  JSON.stringify({version:1,weekStart:a.weekStart,eventId:id,
   teams:week().map(x=>x&&x.map(i=>identity.ids[i]))}));
 add('event:A');add('event:B');
 const recovered=store.migrateSleep(s,b,identity);
 assert.equal(recovered.status,'BLOCKED');
 assert.equal(recovered.reason,'LEGACY_SLEEP_MULTIPLE_EVENTS_AMBIGUOUS');
 assert.equal(s.getItem(store.SLEEP_GLOBAL),null);
});
test('v126: invalid box/ledger identity and corrupt preference fail without overwriting',()=>{
 const s=storage(),a=ctx();
 assert.equal(store.saveSleep(s,a,identity,week()).status,'SLEEP_SAVED');
 const saved=s.getItem(store.SLEEP_GLOBAL);
 const changed={...identity,byId:new Map([...identity.byId].slice(0,5))};
 assert.equal(store.readSleep(s,a,changed).status,'BLOCKED');
 assert.equal(s.getItem(store.SLEEP_GLOBAL),saved);
 s.setItem(BOX,'{"version":1,"items":[1]}');
 assert.equal(store.saveSleep(s,a,identity,week()).reason,'BOX_CHANGED_BEFORE_SLEEP_SAVE');
 assert.equal(s.getItem(store.SLEEP_GLOBAL),saved);
 s.setItem(BOX,identity.boxRaw);
 s.setItem(store.SLEEP_GLOBAL,'{"version":1,"kind":"INVALID"}');
 assert.equal(store.readSleep(s,a,identity).reason,'GLOBAL_SLEEP_SAVE_INVALID');
 assert.equal(store.saveSleep(s,a,identity,week()).reason,'GLOBAL_SLEEP_SAVE_INVALID');
 assert.equal(s.getItem(store.SLEEP_GLOBAL),'{"version":1,"kind":"INVALID"}');
});
test('v126: copied nights, manual mode, deletion and preview use the same player-wide source',()=>{
 const real=fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-f4c-integrated-v112.js'),'utf8');
 const mock=fs.readFileSync(path.resolve(__dirname,'../e7-preview/U3_Strategy_UI_20261109_v50_E7.html'),'utf8');
 const sw=fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-sw-v50.js'),'utf8');
 assert.match(real,/store\.migrateSleep\(localStorage,c,refs\)/);
 assert.match(real,/store\.saveSleep\(localStorage,c,bound,teams\)/);
 assert.match(mock,/const MANUAL_SLEEP_GLOBAL='pokesleep-strategy-u3-e3-v1:manual-sleep-template-v126'/);
 assert.match(mock,/let manualSleep=readGlobalManualSleep\(\)/);
 assert.match(mock,/if\(!storeSleepPreference\(\)\)/);
 assert.match(sw,/v126-persistent-sleep/);
 assert(!fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-event-delete-v71.js'),'utf8')
  .includes('sleep-template-global-v126'),'event deletion cannot target global sleep');
});

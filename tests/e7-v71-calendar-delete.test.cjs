'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../e7-preview');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const script=read('e7-event-delete-v71.js');
function engine(){
 const win={};
 vm.runInNewContext(script,{window:win,Date,JSON,encodeURIComponent});
 return win.PokeE7EventDeletion;
}
function storage(initial={}){
 const m=new Map(Object.entries(initial));
 return {m,get length(){return m.size;},key(i){return [...m.keys()][i]||null;},
  getItem(k){return m.has(k)?m.get(k):null;},
  setItem(k,v){m.set(k,String(v));},
  removeItem(k){m.delete(k);}};
}
const WEEK='2026-11-09',PREFIX='pokesleep-strategy-u3-e3-v1:',
  SELECTED=PREFIX+'selected';
function record(eventId,week=WEEK){
 const source=eventId.startsWith('manual:')?null:{id:eventId,name:'公式イベント'};
 const suffix=week+':'+encodeURIComponent(eventId)+':';
 const condition={version:1,weekStart:week,eventId,
  confirmed:{weekStart:week,eventId,status:'CONFIRMED',
   fields:{field:'シアンの砂浜',food:'all',camp:true,source},
   revision:'r1',savedAt:'2026-11-11T00:00:00Z',missingFields:[]}};
 const plan={version:1,weekStart:week,eventInfo:{start:week,source}};
 return {[PREFIX+suffix+'conditions']:JSON.stringify(condition),
  [PREFIX+suffix+'plan']:JSON.stringify(plan),
  ['pokesleep-strategy-u2-e6-prep-v1:'+week+':'+encodeURIComponent(eventId)]:
   JSON.stringify({version:1,weekStart:week,eventId,prep:{count:3,categories:['curry','salad','dessert']}})};
}
function values(store){return Object.fromEntries(store.m);}
test('E7 v76: snapshots are read-only, only selected manual event is removed',()=>{
 const e=engine(),manual={id:'manual:'+WEEK,weekStart:WEEK},official='saved-event';
 const future='2026-11-16';
 const initial={...record(manual.id),...record(official),...record('later',future),
  [SELECTED]:JSON.stringify(manual),
  ['pokesleep-strategy-u2-e2-v1:'+WEEK+':timeline']:
   JSON.stringify({version:1,weekStart:WEEK,eventId:official,currentInventory:{values:{}}}),
  ['other-project:unrelated']:'untouched'};
 const s=storage(initial);
 const snapshot=e.snapshot(s,manual,{requireSelected:true});
 assert.deepEqual(values(s),initial,'opening a confirmation cannot mutate data');
 const result=e.remove(s,snapshot);
 assert.equal(result.selected,true);
 assert.equal(result.deletedKeys.length,4,'conditions, plan, prep, pointer only');
 for(const key of result.deletedKeys)assert.equal(s.getItem(key),null,key);
 for(const key of Object.keys(initial).filter(k=>!result.deletedKeys.includes(k)))
  assert.equal(s.getItem(key),initial[key],key);
});
test('E7 v76: only the target-owned week inventory may be removed',()=>{
 const e=engine(),id='official:2026/11',selection={id,weekStart:WEEK};
 const stockKey='pokesleep-strategy-u2-e2-v1:'+WEEK+':timeline';
 const s=storage({...record(id),...record('manual:'+WEEK),
  [SELECTED]:JSON.stringify(selection),
  [stockKey]:JSON.stringify({weekStart:WEEK,eventId:id})});
 const result=e.remove(s,e.snapshot(s,selection,{requireSelected:true}));
 assert(result.deletedKeys.includes(stockKey));
 assert(s.getItem(PREFIX+WEEK+':'+encodeURIComponent('manual:'+WEEK)+':conditions'));
});
test('E7 v76: stale snapshot or changed selection fails closed without deletion',()=>{
 const e=engine(),selection={id:'manual:'+WEEK,weekStart:WEEK};
 const s=storage({...record(selection.id),[SELECTED]:JSON.stringify(selection)});
 const previous=e.snapshot(s,selection,{requireSelected:true});
 s.setItem(PREFIX+WEEK+':'+encodeURIComponent(selection.id)+':plan',
  JSON.stringify({version:1,weekStart:WEEK,eventInfo:{start:WEEK},changed:true}));
 const changed=values(s);
 assert.throws(()=>e.remove(s,previous),/変更/);
 assert.deepEqual(values(s),changed);
 const next=e.snapshot(s,selection,{requireSelected:true});
 s.setItem(SELECTED,JSON.stringify({id:'different',weekStart:WEEK}));
 const foreign=values(s);
 assert.throws(()=>e.remove(s,next),/選択中のイベントが変更/);
 assert.deepEqual(values(s),foreign);
});
test('E7 v76: mixed or corrupt owner keys never cause a cross-event deletion',()=>{
 const e=engine(),selection={id:'manual:'+WEEK,weekStart:WEEK},
  prepKey='pokesleep-strategy-u2-e6-prep-v1:'+WEEK+':'+encodeURIComponent(selection.id);
 const s=storage({...record(selection.id),[SELECTED]:JSON.stringify(selection)});
 s.setItem(prepKey,JSON.stringify({eventId:'other',weekStart:WEEK}));
 assert.throws(()=>e.snapshot(s,selection,{requireSelected:true}),/所有イベント/);
 assert.equal(s.m.size,4);
 s.setItem(prepKey,'{bad-json');
 assert.throws(()=>e.snapshot(s,selection,{requireSelected:true}),/壊れています/);
 assert.equal(s.m.size,4);
});
test('E7 v76: a failed storage write rolls back all removed records',()=>{
 const e=engine(),selection={id:'manual:'+WEEK,weekStart:WEEK};
 const s=storage({...record(selection.id),[SELECTED]:JSON.stringify(selection)});
 const start=values(s),before=e.snapshot(s,selection,{requireSelected:true});
 const original=s.removeItem.bind(s);
 let failed=false;
 s.removeItem=(key)=>{
  if(key===SELECTED&&!failed){failed=true;throw Error('quota');}
  original(key);
 };
 assert.throws(()=>e.remove(s,before),/元の保存内容を復元/);
 assert.deepEqual(values(s),start);
});
test('E7 v76: rollback does not materialize an originally absent prep key',()=>{
 const e=engine(),selection={id:'manual:'+WEEK,weekStart:WEEK};
 const initial={...record(selection.id),[SELECTED]:JSON.stringify(selection)};
 const prep='pokesleep-strategy-u2-e6-prep-v1:'+WEEK+':'+encodeURIComponent(selection.id);
 delete initial[prep];
 const s=storage(initial),before=e.snapshot(s,selection,{requireSelected:true});
 const original=s.removeItem.bind(s);let failed=false;
 s.removeItem=(key)=>{
  if(key===SELECTED&&!failed){failed=true;throw Error('quota');}
  original(key);
 };
 assert.throws(()=>e.remove(s,before),/元の保存内容を復元/);
 assert.deepEqual(values(s),initial);
 assert.equal(s.getItem(prep),null);
});
test('E7 v76: UI, shell, service worker and legacy paths use scoped deletion',()=>{
 const u3=read('U3_Strategy_UI_20261109_v50_E7.html');
 const u2=read('U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const parent=read('index.html'),sw=read('e7-sw-v50.js');
 assert.match(u3,/id="e7-event-delete"/);
 // Save and Delete must share exactly one row, never separate rows or simultaneous display.
 assert.equal((u3.match(/id="event-save"/g)||[]).length,1);
 assert.equal((u3.match(/id="e7-event-delete"/g)||[]).length,1);
 assert.match(u3,/id="e7-event-action-row" hidden><button[^>]+id="event-save" hidden>保存<\/button><button[^>]+id="e7-event-delete"[^>]*>削除<\/button><\/div>/);
 assert.match(u3,/\.e7-event-action-row\{display:flex;flex-direction:row;justify-content:flex-end;align-items:center;min-height:44px;/);
 assert.match(u3,/#e7-event-delete\{height:32px;min-height:32px;/);
 assert.match(u3,/#e7-event-action-row'\)\.hidden=!\(canDelete\|\|canSave\)/);
 assert.match(u3,/#event-save'\)\.hidden=!canSave/);
 assert.match(u3,/#e7-event-delete'\)\.hidden=!canDelete/);
 assert.match(u3,/const canSave=!canDelete&&\(\!\!e3Selected\|\|e7HasDraftInput\(\)\)/);
 assert.match(u3,/function e7CanDeleteCurrentEvent\(\)/);
 assert.match(u3,/if\(eventBlockers\(\)\.includes\('イベント条件の保存'\)\)return false/);
 assert.match(u3,/if\(!e3Conditions\(\)\)return false/);
 assert.match(u3,/function e7RefreshEventActions\(\)/);
 assert.match(u3,/#event-details'\)\.addEventListener\('input'/);
 assert.match(u3,/e7RefreshEventActions\(\);/);
 assert.match(u3,/if\(!e7CanDeleteCurrentEvent\(\)\)/);
 assert.match(u3,/if\(!e7CanDeleteCurrentEvent\(\)\|\|e3Selected\?\.weekStart/);
 assert.match(u3,/PokeE7EventDeletion\.snapshot\(localStorage,selected,\{requireSelected:true\}\)/);
 assert.match(u3,/action:'event-deleted'/);
 assert.match(parent,/event\.data\.action==='event-deleted'/);
 assert.match(parent,/PokeE7EventDeletion\.remove\(localStorage,before\)/);
 assert.match(parent,/win\.__pokesleepE7ResetRevoked=true/);
 assert.match(u2,/PokeE7EventDeletion\.remove\(localStorage,before\)/);
 assert.match(u3,/旧形式の週一括初期化リンクは無効/);
 assert.match(u2,/旧形式の週一括初期化リンクは無効/);
 for(const f of [u2,u3,parent])assert.match(f,/e7-event-delete-v71\.js/);
 assert.match(sw,/'e7-event-delete-v71\.js'/);
 assert.match(sw,/pokesleep-strategy-e7-v76-maskable-safe-margin-20261112/);
 assert.match(parent,/<title>ポケスリ作戦室 E7 v76<\/title>/);
 for(const file of [u2,u3,parent]){
  for(const match of file.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
   assert.doesNotThrow(()=>new vm.Script(match[1]),'inline syntax error');
 }
});

test('E7 v76 Chromium: delete event without deleting another event in the same week',
 {timeout:180000},()=>{
 require('node:child_process').execFileSync('python3',
 [path.resolve(__dirname,'preview_browser_e7_v71.py')],
 {cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:175000});
});

'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const api=import(pathToFileURL(path.resolve(__dirname,'../src/ux-phase-state.js')).href);
const WEEK='2026-11-09';
const EVENT={id:'meal-prep-week-1',weekStart:WEEK};
const B=(awaitNotUsed)=>awaitNotUsed;
const inventory=(M,week=WEEK)=>Object.fromEntries(M.INGREDIENT_NAMES.map(k=>[k,0]));
const saved=(M,values,when,revision='r1',timeline=M.newInventoryTimeline(WEEK))=>
  M.applyInventorySave(timeline,{savedAt:when,revision,values});
const COND={status:'CONFIRMED',revision:'event-c1',missingFields:[],dirty:false,weekStart:WEEK,eventId:EVENT.id};
const adopted={status:'ADOPTED',weekStart:WEEK,eventId:EVENT.id,conditionsRevision:'event-c1',inventoryRevision:'r1'};
const props=(extra={})=>{
 const state={selectedEvent:EVENT,nowISO:'2026-11-10T12:00:00+09:00',conditions:COND,...extra};
 if(state.conditions&&state.conditions.weekStart===undefined)
   state.conditions={...state.conditions,weekStart:WEEK,eventId:EVENT.id};
 return state;
};

test('E1 exposes exactly 19 stable names from U2 v29, 0 is a legitimate amount',async()=>{
 const M=await api;
 assert.equal(M.INGREDIENT_NAMES.length,19);
 assert.equal(new Set(M.INGREDIENT_NAMES).size,19);
 assert.equal(M.INGREDIENT_NAMES[0],'ふといながねぎ');
 assert.equal(M.INGREDIENT_NAMES.at(-1),'つやつやアボカド');
 assert.deepEqual(Object.values(inventory(M)).reduce((a,b)=>a+b),0);
});

test('date validator rejects invalid weekday, nonexistent day and Unicode ambiguities',async()=>{
 const M=await api;
 for(const valid of ['2026-11-09','2027-01-04','2024-02-26','2025-12-29'])
   assert.equal(M.validWeekStart(valid),true,valid);
 for(const invalid of ['',null,'2026-11-10','2026-02-30','2026-11-9','2026-11-09T00:00',' 2026-11-09'])
   assert.equal(M.validWeekStart(invalid),false,String(invalid));
});

test('JST 04:00 is the authoritative game-day boundary, independent of ISO offset',async()=>{
 const M=await api;
 const scenarios=[
  ['2026-11-09T03:59:59+09:00','2026-11-08',null],
  ['2026-11-09T04:00:00+09:00','2026-11-09',0],
  ['2026-11-10T00:00:00+09:00','2026-11-09',0],
  ['2026-11-10T03:59:59+09:00','2026-11-09',0],
  ['2026-11-10T04:00:00+09:00','2026-11-10',1],
  ['2026-11-11T15:00:00+09:00','2026-11-11',2],
  ['2026-11-15T23:59:00+09:00','2026-11-15',6],
  ['2026-11-16T03:59:59+09:00','2026-11-15',6],
  ['2026-11-16T04:00:00+09:00','2026-11-16',null],
  ['2026-11-09T19:00:00Z','2026-11-10',1]
 ];
 for(const [iso,date,i] of scenarios){
  assert.equal(M.gameDateInJST(iso),date,iso);
  assert.equal(M.gameWeekdayIndex(WEEK,iso),i,iso);
 }
 for(const invalid of ['2026-11-10','2026-11-10T03:59:00','x',null])
   assert.throws(()=>M.gameDateInJST(invalid),/Timestamp|Invalid/);
});

test('month and year boundary and leap day in JST game calendar',async()=>{
 const M=await api;
 assert.equal(M.gameDateInJST('2027-01-01T03:59:00+09:00'),'2026-12-31');
 assert.equal(M.gameDateInJST('2027-01-01T04:00:00+09:00'),'2027-01-01');
 assert.equal(M.gameDateInJST('2024-03-01T03:59:00+09:00'),'2024-02-29');
 assert.equal(M.gameWeekdayIndex('2025-12-29','2026-01-04T22:00:00+09:00'),6);
});

test('selection is explicit; archived/demo event is never inferred',async()=>{
 const M=await api;
 assert.equal(M.phaseForEvent(null,'2026-11-10T12:00:00+09:00'),'UNSELECTED');
 for(const event of [{id:'',weekStart:WEEK},{id:'x',weekStart:'2026-11-10'},{}])
   assert.throws(()=>M.phaseForEvent(event,'2026-11-10T12:00:00+09:00'));
 const p=M.getPrimaryViewState({nowISO:'2026-11-10T12:00:00+09:00'});
 assert.equal(p.phase,'UNSELECTED');
 assert.equal(p.primaryAction,'SELECT_EVENT');
 assert.equal(p.canPropose,false);
 assert.equal(p.gameDayIndex,null);
});

test('one-week event phase is Monday 04:00 to next Monday 04:00 JST',async()=>{
 const M=await api;
 for(const [when,result] of [
  ['2026-11-09T03:59:59+09:00','BEFORE'],
  ['2026-11-09T04:00:00+09:00','DURING'],
  ['2026-11-15T23:59:00+09:00','DURING'],
  ['2026-11-16T03:59:59+09:00','DURING'],
  ['2026-11-16T04:00:00+09:00','ENDED']])
  assert.equal(M.phaseForEvent(EVENT,when),result,when);
});

test('preparation latest correction becomes baseline and newest current stock',async()=>{
 const M=await api;
 const a=inventory(M),b=inventory(M);
 a[M.INGREDIENT_NAMES[0]]=100;b[M.INGREDIENT_NAMES[0]]=150;
 let s=M.newInventoryTimeline(WEEK);
 const zero=M.newInventoryTimeline(WEEK);
 s=saved(M,a,'2026-11-08T16:00:00+09:00','p1',s);
 s=saved(M,b,'2026-11-09T03:59:59+09:00','p2',s);
 assert.deepEqual(s.preparationLatest.values,b);
 assert.deepEqual(s.startInventory.values,b);
 assert.deepEqual(s.currentInventory.values,b);
 assert.equal(s.currentInventory.revision,'p2');
 assert.equal(zero.currentInventory,null);
});

test('first post-start save freezes baseline, never overwrites it',async()=>{
 const M=await api;
 const a=inventory(M),b=inventory(M);
 a[M.INGREDIENT_NAMES[1]]=10;b[M.INGREDIENT_NAMES[1]]=20;
 let s=saved(M,a,'2026-11-09T03:50:00+09:00','prep');
 s=saved(M,b,'2026-11-09T04:00:00+09:00','during',s);
 assert.equal(s.startInventory.revision,'prep');
 assert.equal(s.preparationLatest.revision,'prep');
 assert.equal(s.currentInventory.revision,'during');
 assert.equal(s.startInventory.values[M.INGREDIENT_NAMES[1]],10);
 assert.equal(s.currentInventory.values[M.INGREDIENT_NAMES[1]],20);
});

test('when no pre-start record exists, an event save must NOT invent start stock',async()=>{
 const M=await api;
 let s=saved(M,inventory(M),'2026-11-09T05:00:00+09:00','current');
 assert.equal(s.preparationLatest,null);
 assert.equal(s.startInventory,null);
 assert.equal(s.currentInventory.values[M.INGREDIENT_NAMES[0]],0);
});

test('invalid inventory and corrupt timelines fail closed with no partial mutation',async()=>{
 const M=await api;
 let base=M.newInventoryTimeline(WEEK);
 const correct=inventory(M);
 for(const invalid of [
  {...correct,[M.INGREDIENT_NAMES[0]]:-1},
  {...correct,[M.INGREDIENT_NAMES[0]]:1.5},
  {...correct,[M.INGREDIENT_NAMES[0]]:10001},
  {...correct,[M.INGREDIENT_NAMES[0]]:9000,[M.INGREDIENT_NAMES[1]]:2000},
  {apple:42},
  {...correct,evil:0}
 ]){
  assert.throws(()=>saved(M,invalid,'2026-11-08T22:00:00+09:00','z',base));
  assert.equal(base.currentInventory,null);
 }
 const inconsistent={...base,startInventory:{weekStart:WEEK,revision:'bad',savedAt:'2026-11-08T18:00:00+09:00',values:correct}};
 assert.throws(()=>M.validateInventoryTimeline(inconsistent),/Start stock/);
 assert.throws(()=>M.validateInventoryTimeline({...base,version:1}),/Unsupported/);
});

test('reject stale/equal timestamp conflicting saves; accept idempotent repeat',async()=>{
 const M=await api;
 const a=inventory(M),b=inventory(M);
 b[M.INGREDIENT_NAMES[0]]=1;
 const s=saved(M,a,'2026-11-08T18:00:00+09:00','a');
 assert.throws(()=>saved(M,b,'2026-11-08T17:00:00+09:00','older',s),/Stale/);
 assert.throws(()=>saved(M,b,'2026-11-08T18:00:00+09:00','b',s),/Conflicting/);
 assert.deepEqual(saved(M,a,'2026-11-08T18:00:00+09:00','a',s),s);
 assert.throws(()=>saved(M,b,'2026-11-16T04:00:00+09:00','end',s),/Ended/);
});

test('reject event-week contamination in snapshot and legacy v3 records',async()=>{
 const M=await api;
 const values=inventory(M);
 const record={version:3,weekStart:WEEK,source:'inventory',savedAt:'2026-11-08T22:00:00Z',
  initialValues:values,values};
 assert.throws(()=>M.previewLegacyU2V3(record,'2026-11-16'),/different/);
 assert.throws(()=>M.validateInventoryTimeline({...M.newInventoryTimeline(WEEK),weekStart:'2026-11-16'},WEEK),/Unsupported/);
 assert.throws(()=>M.previewLegacyU2V3({...record,values:{...values,bad:0}},WEEK),/incomplete/);
 const incomplete={...values};delete incomplete[M.INGREDIENT_NAMES[0]];
 assert.throws(()=>M.previewLegacyU2V3({...record,values:incomplete},WEEK),/incomplete/);
});

test('legacy v3 before event imports read-only; do not trust its first initialValues',async()=>{
 const M=await api;
 const first=inventory(M),last=inventory(M);
 first[M.INGREDIENT_NAMES[0]]=5;last[M.INGREDIENT_NAMES[0]]=10;
 const record={version:3,weekStart:WEEK,source:'inventory',savedAt:'2026-11-08T20:00:00+09:00',values:last,initialValues:first};
 const preview=M.previewLegacyU2V3(record,WEEK);
 assert.equal(preview.requiresExplicitCommit,true);
 assert.equal(preview.timeline.startInventory.values[M.INGREDIENT_NAMES[0]],10);
 assert.equal(preview.timeline.currentInventory.values[M.INGREDIENT_NAMES[0]],10);
 assert.deepEqual(preview.warnings,[]);
 assert.equal(record.initialValues[M.INGREDIENT_NAMES[0]],5);
});

test('legacy v3 event-time save does not make false baseline from initialValues',async()=>{
 const M=await api;
 const record={version:3,weekStart:WEEK,source:'inventory',savedAt:'2026-11-10T09:00:00+09:00',values:inventory(M),initialValues:inventory(M)};
 const result=M.previewLegacyU2V3(record,WEEK);
 assert.equal(result.timeline.startInventory,null);
 assert.equal(result.timeline.preparationLatest,null);
 assert.deepEqual(result.warnings,['START_STOCK_UNKNOWN_FROM_LEGACY']);
});

test('pre-event screen always preparation, proposal disabled (known or unknown stock)',async()=>{
 const M=await api;
 const s=saved(M,inventory(M),'2026-11-08T12:00:00+09:00','r1');
 const state=M.getPrimaryViewState({...props({inventoryTimeline:s}),nowISO:'2026-11-08T12:30:00+09:00'});
 assert.equal(state.phase,'BEFORE');
 assert.equal(state.screen,'PREPARATION');
 assert.equal(state.primaryAction,'NONE');
 assert.equal(state.canPropose,false);
});

test('phase/required conditions/saved inventory choose exactly one primary action',async()=>{
 const M=await api;
 const s=saved(M,inventory(M),'2026-11-08T22:00:00+09:00','r1');
 const missing=M.getPrimaryViewState(props({conditions:{status:'MISSING',missingFields:['料理カテゴリ','EX条件']},inventoryTimeline:s}));
 assert.equal(missing.primaryAction,'SET_EVENT');
 assert.deepEqual(missing.lockReasons,['料理カテゴリ','EX条件']);
 const candidate=M.getPrimaryViewState(props({conditions:{status:'CANDIDATE',missingFields:[],revision:'suggested'},inventoryTimeline:s}));
 assert.equal(candidate.primaryAction,'SET_EVENT');
 assert.equal(candidate.canPropose,false);
 const edited=M.getPrimaryViewState(props({conditions:{...COND,dirty:true},inventoryTimeline:s}));
 assert.equal(edited.primaryAction,'SET_EVENT');
 const noStock=M.getPrimaryViewState(props({inventoryTimeline:null}));
 assert.equal(noStock.primaryAction,'SET_INVENTORY');
 assert.equal(noStock.canPropose,false);
 const confirmed=M.getPrimaryViewState(props({inventoryTimeline:s}));
 assert.equal(confirmed.primaryAction,'PROPOSE');
 assert.equal(confirmed.canPropose,true);
 assert.equal(confirmed.screen,'PENDING_PLAN');
});

test('existing adopted plan remains visible even with missing conditions or altered stock',async()=>{
 const M=await api;
 const s=saved(M,inventory(M),'2026-11-08T22:00:00+09:00','r1');
 const base=M.getPrimaryViewState(props({inventoryTimeline:s,adoptedPlan:adopted}));
 assert.equal(base.primaryAction,'NONE');
 assert.equal(base.screen,'ADOPTED_PLAN');
 assert.equal(base.canRepropose,true);
 const changed=M.getPrimaryViewState(props({inventoryTimeline:s,adoptedPlan:adopted,
   dirtyFlags:{sleepChanged:true}}));
 assert.equal(changed.primaryAction,'REPROPOSE');
 assert.equal(changed.screen,'ADOPTED_PLAN');
 const unconfirmed=M.getPrimaryViewState(props({inventoryTimeline:s,adoptedPlan:adopted,
   conditions:{status:'EDITING',revision:'c2',missingFields:[]}}));
 assert.equal(unconfirmed.primaryAction,'SET_EVENT');
 assert.equal(unconfirmed.screen,'ADOPTED_PLAN');
 assert.equal(unconfirmed.canRepropose,false);
 const changedStock=saved(M,inventory(M),'2026-11-10T10:00:00+09:00','r2',s);
 const stockUpdated=M.getPrimaryViewState(props({inventoryTimeline:changedStock,adoptedPlan:adopted}));
 assert.equal(stockUpdated.primaryAction,'REPROPOSE');
 assert.equal(stockUpdated.screen,'ADOPTED_PLAN');
});

test('draft remains unadopted; old conditions/stock/sleep revisions cannot be adopted',async()=>{
 const M=await api;
 const s=saved(M,inventory(M),'2026-11-08T12:00:00+09:00','r1');
 const draft={status:'DRAFT',weekStart:WEEK,eventId:EVENT.id,conditionsRevision:'event-c1',inventoryRevision:'r1'};
 const fresh=M.getPrimaryViewState(props({inventoryTimeline:s,draft}));
 assert.equal(fresh.adoption,'DRAFT');
 assert.equal(fresh.canAdoptDraft,true);
 for(const changes of [{dirtyFlags:{sleepChanged:true}}, {dirtyFlags:{conditionsChanged:true}},
   {conditions:{...COND,revision:'event-c2'}},
   {inventoryTimeline:saved(M,inventory(M),'2026-11-10T08:00:00+09:00','r2',s)}]){
  assert.equal(M.getPrimaryViewState(props({inventoryTimeline:s,draft,...changes})).canAdoptDraft,false);
 }
});

test('end of event always read only, never offer proposal/repropose/adopt',async()=>{
 const M=await api;
 const s=saved(M,inventory(M),'2026-11-08T22:00:00+09:00','r1');
 const base={inventoryTimeline:s,nowISO:'2026-11-16T04:00:00+09:00'};
 const ended=M.getPrimaryViewState(props(base));
 assert.equal(ended.screen,'EVENT_ENDED');
 assert.equal(ended.primaryAction,'NONE');
 assert.equal(ended.canPropose,false);
 const applied=M.getPrimaryViewState(props({...base,adoptedPlan:adopted}));
 assert.equal(applied.screen,'ADOPTED_PLAN');
 assert.equal(applied.primaryAction,'NONE');
 assert.equal(applied.canRepropose,false);
});

test('wrong event adopted plan does not leak into new event',async()=>{
 const M=await api;
 const s=saved(M,inventory(M),'2026-11-08T12:00:00+09:00','r1');
 const x=M.getPrimaryViewState(props({inventoryTimeline:s,
   adoptedPlan:{...adopted,eventId:'different-event'}}));
 assert.equal(x.screen,'PENDING_PLAN');
 assert.equal(x.adoption,'NONE');
 assert.equal(x.primaryAction,'PROPOSE');
});


test('event source is only candidate; explicit apply and save required',async()=>{
 const M=await api;
 let ledger=M.newConditionLedger(EVENT);
 const fetched={fields:{start:WEEK,field:'シアンの砂浜',food:'curry'},
   revision:'c1',savedAt:'2026-11-08T12:00:00+09:00'};
 ledger=M.stageConditionCandidate(ledger,fetched);
 assert.equal(ledger.confirmed,null);
 assert.equal(ledger.editing,null);
 assert.throws(()=>M.applyConditionCandidate(ledger),/explicitly/);
 assert.throws(()=>M.confirmEventConditions(ledger,{userConfirmed:true}),/explicitly/);
 ledger=M.applyConditionCandidate(ledger,{userApplied:true});
 assert.equal(ledger.confirmed,null);
 assert.equal(M.conditionViewFromLedger(ledger).dirty,true);
 ledger=M.confirmEventConditions(ledger,{userConfirmed:true});
 assert.equal(ledger.confirmed.status,'CONFIRMED');
 assert.equal(ledger.editing,null);
 assert.equal(M.conditionViewFromLedger(ledger).dirty,false);
 assert.equal(M.getPrimaryViewState(props({conditions:M.conditionViewFromLedger(ledger)})).canPropose,false);
 assert.equal(ledger.candidate.fields.food,'curry'); // source not lost
});

test('partial event conditions remain MISSING even if saved; cannot create proposal',async()=>{
 const M=await api;
 let ledger=M.newConditionLedger(EVENT);
 ledger=M.stageConditionEdits(ledger,{fields:{field:'シアンの砂浜'},
   missingFields:['料理カテゴリ','確定きのみ'],revision:'part1',savedAt:'2026-11-08T13:00:00+09:00'});
 ledger=M.confirmEventConditions(ledger,{userConfirmed:true});
 assert.equal(ledger.confirmed.status,'MISSING');
 assert.deepEqual(ledger.confirmed.missingFields,['料理カテゴリ','確定きのみ']);
 assert.equal(M.conditionViewFromLedger(ledger).status,'MISSING');
 const stock=saved(M,inventory(M),'2026-11-08T14:00:00+09:00','r1');
 const v=M.getPrimaryViewState(props({conditions:M.conditionViewFromLedger(ledger),inventoryTimeline:stock}));
 assert.equal(v.primaryAction,'SET_EVENT');
 assert.equal(v.canPropose,false);
});

test('candidate fetch never overwrites previously confirmed event, or edit draft',async()=>{
 const M=await api;
 let ledger=M.newConditionLedger(EVENT);
 ledger=M.stageConditionEdits(ledger,{fields:{food:'curry'},revision:'c1',savedAt:'2026-11-08T07:00:00+09:00'});
 ledger=M.confirmEventConditions(ledger,{userConfirmed:true});
 const previous=structuredClone(ledger.confirmed);
 ledger=M.stageConditionCandidate(ledger,{fields:{food:'salad'},revision:'c2',savedAt:'2026-11-08T08:00:00+09:00'});
 assert.deepEqual(ledger.confirmed,previous);
 assert.equal(ledger.candidate.fields.food,'salad');
 ledger=M.applyConditionCandidate(ledger,{userApplied:true});
 assert.deepEqual(ledger.confirmed,previous);
 assert.equal(M.conditionViewFromLedger(ledger).dirty,true);
 ledger=M.confirmEventConditions(ledger,{userConfirmed:true});
 assert.equal(ledger.confirmed.fields.food,'salad');
 assert.equal(ledger.confirmed.revision,'c2');
});

test('reject mismatched event ledger and revision collisions',async()=>{
 const M=await api;
 let ledger=M.newConditionLedger(EVENT);
 assert.throws(()=>M.validateConditionLedger({...ledger,eventId:'wrong',candidate:{
   weekStart:WEEK,eventId:EVENT.id,status:'CANDIDATE',fields:{},revision:'rev',
   missingFields:[],savedAt:'2026-11-08T08:00:00+09:00'}}),/Invalid candidate/);
 ledger=M.stageConditionEdits(ledger,{fields:{food:'curry'},revision:'same',savedAt:'2026-11-08T07:00:00+09:00'});
 ledger=M.confirmEventConditions(ledger,{userConfirmed:true});
 ledger=M.stageConditionEdits(ledger,{fields:{food:'salad'},revision:'same',savedAt:'2026-11-08T08:00:00+09:00'});
 assert.throws(()=>M.confirmEventConditions(ledger,{userConfirmed:true}),/Revision collision/);
 assert.equal(ledger.confirmed.fields.food,'curry');
});

test('conditions reject non-JSON/unbounded/unsafe keys and do not change original',async()=>{
 const M=await api;
 const ledger=M.newConditionLedger(EVENT);
 for(const fields of [
  {x:Infinity},
  JSON.parse('{"__proto__":{"polluted":true}}'),
  {huge:'x'.repeat(17000)}
 ]){
  assert.throws(()=>M.stageConditionCandidate(ledger,{fields,revision:'c',
    savedAt:'2026-11-08T12:00:00+09:00'}));
 }
 assert.equal(ledger.candidate,null);
});

test('same week/date but a different explicitly selected event id does not reuse adopted plan',async()=>{
 const M=await api;
 const stock=saved(M,inventory(M),'2026-11-08T12:00:00+09:00','r1');
 const newer={id:'other-2026',weekStart:WEEK};
 const x=M.getPrimaryViewState({...props({inventoryTimeline:stock,adoptedPlan:adopted}),selectedEvent:newer});
 assert.equal(x.adoption,'NONE');
 assert.equal(x.screen,'PENDING_PLAN');
 assert.equal(x.primaryAction,'SET_EVENT'); // another event requires its OWN confirmed conditions
});

test('the nineteen Japanese ingredient keys match BOTH frozen U2 and U3 v29 assets exactly',async()=>{
 const M=await api;
 const fs=require('node:fs');
 const dir=path.resolve(__dirname,'../previews');
 const u2=fs.readFileSync(path.join(dir,'U2_Prep_Local_Ingredients_20261104_v29.html'),'utf8');
 const u3=fs.readFileSync(path.join(dir,'U3_Strategy_UI_20261104_v29.html'),'utf8');
 const u2Names=[...u2.matchAll(/<span class="name">([^<]+)<\/span>/g)].map(m=>m[1]);
 const u3Names=[...u3.matchAll(/"([^"]+)":"data:image\/png;base64,/g)].map(m=>m[1]);
 assert.equal(u2Names.length,38); // target + stock each have 19 in the same game order
 assert.deepEqual(u2Names.slice(0,19),M.INGREDIENT_NAMES);
 assert.deepEqual(u2Names.slice(19),M.INGREDIENT_NAMES);
 assert.deepEqual(u3Names,M.INGREDIENT_NAMES);
});

test('all E1 transitions are pure and do not modify UI state or passed records',async()=>{
 const M=await api;
 const original=M.newInventoryTimeline(WEEK),values=inventory(M);
 const before=JSON.stringify(original);
 const savedTimeline=saved(M,values,'2026-11-08T22:00:00+09:00','r1',original);
 assert.equal(JSON.stringify(original),before);
 const event={...EVENT};
 const d=M.getPrimaryViewState({...props({inventoryTimeline:savedTimeline}),selectedEvent:event});
 assert.equal(d.primaryAction,'PROPOSE');
 assert.deepEqual(event,EVENT);
 assert.equal(values[M.INGREDIENT_NAMES[0]],0);
 assert.equal(original.currentInventory,null);
});

test('new changed inventory cannot reuse old revision and silently suppress re-proposal',async()=>{
 const M=await api;
 const a=inventory(M),b=inventory(M);
 b[M.INGREDIENT_NAMES[3]]=7;
 const first=saved(M,a,'2026-11-08T12:00:00+09:00','initial');
 assert.throws(()=>saved(M,b,'2026-11-10T12:00:00+09:00','initial',first),/new revision/);
 const next=saved(M,b,'2026-11-10T12:00:00+09:00','updated',first);
 const plan={...adopted,inventoryRevision:'initial'};
 assert.equal(M.getPrimaryViewState(props({inventoryTimeline:next,adoptedPlan:plan})).primaryAction,'REPROPOSE');
});

test('confirmed conditions from another event or another week are rejected',async()=>{
 const M=await api;
 const stock=saved(M,inventory(M),'2026-11-08T12:00:00+09:00','r1');
 for(const bad of [{...COND,eventId:'different-event'},{...COND,weekStart:'2026-11-16'}]){
  const v=M.getPrimaryViewState({...props({inventoryTimeline:stock}),conditions:bad});
  assert.equal(v.primaryAction,'SET_EVENT');
  assert.equal(v.canPropose,false);
  assert.equal(v.lockReasons[0],'EVENT_CONDITIONS_UNCONFIRMED');
 }
});

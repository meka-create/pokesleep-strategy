'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../e7-preview');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const CORE=read('e7-e1-core-v84.js'),FOOTER=read('e7-footer-nav-v84.js');
const files={
 prep:read('U2_Prep_Local_Ingredients_20261109_v50_E7.html'),
 plan:read('U3_Strategy_UI_20261109_v50_E7.html'),
 box:read('U4_Box_Preview_20261109_v50_E7.html')
};
function loadCore(){
 const env={window:{}};vm.runInNewContext(CORE,env,{filename:'e7-e1-core-v84.js'});
 return env.window.PokeE7E1;
}
test('E7 v84 exports the superset of former U2/U3 E1 functions with unchanged game-day boundaries',()=>{
 const e=loadCore();
 for(const name of ['INGREDIENT_NAMES','validWeekStart','phaseForEvent','newInventoryTimeline',
  'validateInventoryTimeline','applyInventorySave','previewLegacyU2V3',
  'getPrimaryViewState','newConditionLedger','validateConditionLedger','stageConditionEdits',
  'confirmEventConditions','conditionViewFromLedger'])assert(name in e,name);
 assert.equal(e.INGREDIENT_NAMES.length,19);
 assert.equal(e.validWeekStart('2026-11-16'),true);
 assert.equal(e.validWeekStart('2026-11-17'),false);
 const ev={id:'manual:2026-11-16',weekStart:'2026-11-16'};
 assert.equal(e.phaseForEvent(null,'2026-11-16T04:00:00+09:00'),'UNSELECTED');
 assert.equal(e.phaseForEvent(ev,'2026-11-16T03:59:59+09:00'),'BEFORE');
 assert.equal(e.phaseForEvent(ev,'2026-11-16T04:00:00+09:00'),'DURING');
 assert.equal(e.phaseForEvent(ev,'2026-11-23T03:59:59+09:00'),'DURING');
 assert.equal(e.phaseForEvent(ev,'2026-11-23T04:00:00+09:00'),'ENDED');
 assert.equal(e.getPrimaryViewState({nowISO:'2026-11-16T04:00:00+09:00'}).primaryAction,'SELECT_EVENT');
 const led=e.newConditionLedger(ev);
 assert.equal(led.confirmed,null);
 assert.throws(()=>e.confirmEventConditions(led,{userConfirmed:true}),/explicitly save|User must/);
});
test('E7 v84 shared inventory is fail-closed for stale saves and keeps the preparation baseline',()=>{
 const e=loadCore(),week='2026-11-16';
 const values=Object.fromEntries(e.INGREDIENT_NAMES.map(n=>[n,0]));
 values['とくせんリンゴ']=27;
 const init=e.newInventoryTimeline(week);
 const prep=e.applyInventorySave(init,{savedAt:'2026-11-15T21:00:00+09:00',values,revision:'r1'});
 assert.equal(prep.preparationLatest.values['とくせんリンゴ'],27);
 assert.equal(prep.startInventory.values['とくせんリンゴ'],27);
 assert.throws(()=>e.applyInventorySave(prep,{
  savedAt:'2026-11-15T19:00:00+09:00',values,revision:'r0'
 }),/Stale inventory/);
 const next=e.applyInventorySave(prep,{savedAt:'2026-11-17T09:00:00+09:00',
  values:{...values,'とくせんリンゴ':13},revision:'r2'});
 assert.equal(next.currentInventory.values['とくせんリンゴ'],13);
 assert.equal(next.startInventory.values['とくせんリンゴ'],27);
 assert.throws(()=>e.applyInventorySave(next,{savedAt:'2026-11-17T09:00:00+09:00',
  values:{...values,'とくせんリンゴ':40},revision:'r3'}),/Conflicting inventory/);
});
test('E7 v84 only the intended pages load canonical E1 and all 3 mount the shared footer',()=>{
 for(const mode of ['prep','plan','box']){
  const html=files[mode];
  assert.match(html,/<script src="e7-footer-nav-v84\.js"><\/script>/);
  assert(html.includes("PokeE7FooterNav.attach('"+mode+"')"));
  assert.doesNotMatch(html,/function refreshReproposalDot\(/);
  assert.doesNotMatch(html,/function watchPacket\(/);
  assert.doesNotMatch(html,/function goto\(which\)/);
  if(mode!=='box'){
   assert.match(html,/<script src="e7-e1-core-v84\.js"><\/script>/);
   assert.match(html,/const E1=window\.PokeE7E1;/);
   assert.doesNotMatch(html,/const E1=\(\(\)=>\{/);
   assert(html.indexOf('e7-e1-core-v84.js')<html.indexOf('const E1=window.PokeE7E1'));
  }else assert.doesNotMatch(html,/e7-e1-core-v84\.js/);
 }
 assert.match(FOOTER,/mode==='prep'/);
 assert.match(FOOTER,/chosen\.weekStart===week&&chosen\.eventId===eventId/);
 assert.match(FOOTER,/watchPacket\(\)/);
 assert.match(FOOTER,/refreshReproposalDot\(\)/);
 const sw=read('e7-sw-v50.js');
 for(const f of ['e7-e1-core-v84.js','e7-footer-nav-v84.js'])
  assert(sw.includes("'"+f+"'"),f);
 assert.match(sw,/pokesleep-strategy-e7-v84-shared-e1-footer-20261113/);
 for(const js of [CORE,FOOTER])new vm.Script(js);
});
function navigation(mode,selection,query,more={}){
 const handlers=new Map(),links=new Map();
 for(const tab of ['plan','prep','box']){
  const link={dataset:{},attrs:{},
   setAttribute(key,v){this.attrs[key]=v},
   addEventListener(name,fn){if(name==='click')handlers.set(tab,fn)}
  };
  links.set('#e6-footer-'+tab,link);
 }
 const localMap=new Map([['pokesleep-strategy-u3-e3-v1:selected',JSON.stringify(selection)],
  ...Object.entries(more)]);
 const store={getItem:k=>localMap.has(k)?localMap.get(k):null};
 let assigned=null;
 const location={
  href:'https://example.com/e7-preview/'+({prep:'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
    plan:'U3_Strategy_UI_20261109_v50_E7.html',box:'U4_Box_Preview_20261109_v50_E7.html'}[mode])+query,
  search:query,assign:url=>{assigned=url}
 };
 const doc={querySelector:q=>links.get(q)||null};
 const win={addEventListener(){}};
 vm.runInNewContext(FOOTER,{window:win,document:doc,location,localStorage:store,URL,URLSearchParams,Date},
  {filename:'e7-footer-nav-v84.js'});
 win.PokeE7FooterNav.attach(mode);
 return {
  click(tab){const h=handlers.get(tab);assert(h,'missing link '+tab);
   h({preventDefault(){}});return new URL(assigned);},
  link:tab=>links.get('#e6-footer-'+tab)
 };
}
test('E7 v84 standalone footer retains Prep URL precedence, others selected-event precedence',()=>{
 const selected={weekStart:'2026-11-23',id:'manual:2026-11-23'};
 const url='?eventStart=2026-11-16&eventId=manual%3A2026-11-16';
 for(const mode of ['prep','plan','box']){
  const view=navigation(mode,selected,url);
  const dest=view.click(mode==='prep'?'plan':'prep');
  const expectedWeek=mode==='prep'?'2026-11-16':'2026-11-23';
  assert.equal(dest.searchParams.get('eventStart'),expectedWeek);
  assert.equal(dest.searchParams.get('eventId'),'manual:'+expectedWeek);
 }
});
test('E7 v84 Prep standalone transfer uses only saved preference belonging to selected event',()=>{
 const owner='manual:2026-11-16',week='2026-11-16';
 const selection={weekStart:week,id:owner};
 const key='pokesleep-strategy-u2-e6-prep-v1:'+week+':'+encodeURIComponent(owner);
 const chosen={version:1,weekStart:week,eventId:owner,categories:['curry']};
 const nav=navigation('prep',selection,'?eventStart='+week+'&eventId='+encodeURIComponent(owner),
  {[key]:JSON.stringify(chosen)});
 assert.equal(nav.click('plan').searchParams.get('pokesleepPrep'),JSON.stringify(chosen));
 const foreign=navigation('prep',selection,'?eventStart='+week+'&eventId='+encodeURIComponent(owner),
  {[key]:JSON.stringify({...chosen,eventId:'other-event'})});
 assert.equal(foreign.click('plan').searchParams.has('pokesleepPrep'),false);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const sandbox={module:{exports:{}},globalThis:{}};
vm.runInNewContext(read('f4/f4-c-baseline-proposal-v110.js'),sandbox);
const api=sandbox.module.exports;
const week=(()=>{const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read('f4/f4-b-game-week-v1.js'),box);
 return box.module.exports.build('2026-11-16','2026-11-15T12:00:00+09:00');})();
const rows=Array.from({length:7},(_,i)=>({id:'p'+i,
 healerRole:i<2?'TEAM_WIDE_HEALER':null}));
const profiles=rows.map(x=>({...x,source:'F1_B_PINNED_66_SPECIES'}));
const options=()=>({favoriteTypes:['grass','water','fire'],
 primaryHealerIndex:0,secondaryHealerIndex:1,
 previousWeekSleepIndices:[0,2,3,4,5],sleepTeamIndices:[0,2,3,4,5],
 explicitBaselineConsent:false});
const context=()=>({status:'CONTEXT_READY',weekStart:'2026-11-16',
 eventId:'manual:2026-11-16',conditionRevision:'condition1',inventoryRevision:'stock1',
 autoSleep:false,fields:{food:'all',field:'ワカクサ本島',source:null},clock:week});
const fakeRows=()=>week.windows.map(w=>({
 day:w.day,slot:w.slot,source:w.source,
 startsAt:w.startsAt,endsAt:w.endsAt,
 team:w.slot==='sleep'?['p0','p2','p3','p4','p5']:
  w.slot==='morning'?['p2','p3','p4','p1','p0']:
  ['p2','p3','p4','p5','p0'],
 recipeId:w.slot==='sleep'?null:'recipe1',cookedRecipeId:w.slot==='sleep'?null:'recipe1'
}));
const recipes=Array.from({length:78},(_,i)=>({id:'recipe'+i}));
const fixture=()=>{
 const captured={calls:0,arithmetic:null,input:null};
 const deps={
  bridge:{buildNeutralInput:(ctx,opts)=>{
   captured.arithmetic=ctx;captured.input=opts;
   return {status:'READY',sourceCommit:'a'.repeat(40),
    input:{weekStart:ctx.weekStart,asOf:week.asOf,eventSource:null,
     eventMode:'NEUTRAL_REFERENCE_ONLY',autoSleep:false,
     recipes,profiles,nightTeams:opts.realNightTeamIndices,
     previousWeekSleepTeam:opts.previousWeekSleepIndices.map(i=>'p'+i)}};}},
  itemRank:{rank:()=>{captured.calls++;return{
   status:'PROVISIONAL',slotCount:29,slots:fakeRows(),startsAt:week.startsAt,endsAt:week.endsAt,
   weeklyEnergyCertified:false,writesSavedData:false,privateIndividualDataInResult:false,
   energyExpected:12345,mealsExpected:4567};}},
  healerSearch:{plan:()=>{}},healerPolicy:{validate:()=>{}},
  baseCore:{normalizeProfiles:()=>{}},weekClock:{build:()=>{}},
  skillValues:{skillValue:()=>{}}
 };
 return {captured,deps};
};
test('v110 manual baseline: exact 29 real-box teams and recipes, never writes or adopts',()=>{
 const {deps,captured}=fixture(),r=api.propose(context(),options(),deps);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert.equal(r.stage,'F4_C_BASELINE_V110');assert.equal(r.slots.length,29);
 assert.equal(r.energyExpected,12345);assert.equal(r.canAdopt,false);
 assert.equal(r.writesSavedData,false);assert.equal(r.officialEventEnergyCertified,false);
 assert.equal(r.slots[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(r.slots.at(-1).source,'FINAL_NIGHT_TRUNCATED');
 assert.equal(captured.calls,1);
 assert.equal(captured.input.neutralReferenceOnly,true);
 assert.equal(captured.input.realNightTeamIndices.length,7);
 assert.equal(r.privateIndividualDataInResult,false);
});
test('v110 official event is gated by explicit exclusion, with owner/provenance intact',()=>{
 const input=context(),originalSource={id:'pokesleep-tool:event:2026-11-16',
  changesBerries:true};
 input.fields.source=originalSource;input.eventId=originalSource.id;
 const before=JSON.stringify(input),{deps,captured}=fixture();
 assert.equal(api.propose(input,options(),deps).reason,
  'OFFICIAL_BONUS_EXCLUSION_CONSENT_REQUIRED');
 assert.equal(captured.calls,0);
 const r=api.propose(input,{...options(),explicitBaselineConsent:true},deps);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert.equal(r.eventId,originalSource.id);
 assert.equal(r.officialEffectsExcluded,true);
 assert.equal(r.weeklyEnergyCertified,false);
 assert.equal(captured.arithmetic.fields.source,null);
 assert.equal(input.fields.source,originalSource);
 assert.equal(JSON.stringify(input),before,'official event metadata must be unmodified');
});
test('v110 midweek/EX/auto sleep/invalid teams/unpinned healer all block',()=>{
 for(const mutate of [
  (c,o)=>{c.clock={...week,phase:'DURING'};},
  (c,o)=>{c.autoSleep=true;},
  (c,o)=>{c.fields.field='ワカクサEX';},
  (c,o)=>{o.sleepTeamIndices=[0,0,3,4,5];},
  (c,o)=>{o.previousWeekSleepIndices=null;},
  (c,o)=>{o.favoriteTypes=['grass','grass','fire'];},
  (c,o)=>{o.primaryHealerIndex=3;}
 ]){
  const c=context(),o=options(),{deps,captured}=fixture();mutate(c,o);
  const r=api.propose(c,o,deps);
  assert.equal(r.status,'BLOCKED',mutate.toString());
  assert.equal(captured.calls,0);
 }
});
test('v110 forged chronology and healer teams fail closed, not shown as real plans',()=>{
 const c=context(),o=options();
 for(const modify of [
  rows=>rows[0].source='CURRENT_WEEK',
  rows=>rows[4].team=['p2','p3','p4','p5','p6'],
  rows=>rows[1].team[4]='p4',
  rows=>rows[1].recipeId='unverified',
  rows=>rows[2].startsAt='2026-11-16T00:00:00.000Z',
  rows=>rows.pop()
 ]){
  const {deps}=fixture();deps.itemRank.rank=()=>({
   status:'PROVISIONAL',slotCount:29,slots:(()=>{const x=fakeRows();modify(x);return x;})(),
   startsAt:week.startsAt,endsAt:week.endsAt,weeklyEnergyCertified:false,
   writesSavedData:false,privateIndividualDataInResult:false});
  assert.equal(api.propose(c,o,deps).status,'BLOCKED',modify.toString());
 }
});
test('v112 E7 uses ONLY existing proposal-review-adoption and sleep UI',()=>{
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const sw=read('e7-preview/e7-sw-v50.js');
 const viewer=read('e7-preview/e7-f4c-integrated-v112.js');
 for(const id of ['e3-primary','e3-next','review-dialog','review-adopt',
  'sleep-open','auto-sleep','sleep-dialog','edit-dialog','week-content'])
  assert(html.includes('id="'+id+'"'));
 assert(!html.includes('id="f4c-real-card"'));
 assert(!html.includes('id="f4c-real-consent"'));
 assert(!html.includes('e7-f4c-baseline-v110.js'));
 assert(html.includes('e7-f4c-integrated-v112.js'));
 assert(html.includes('f4-c-auto-v112.js'));
 assert(html.includes('f4-c-real-storage-v112.js'));
 assert(html.includes("const nodes=[primary,week,sleep,conditions,calendar,actions,intro]"));
 for(const p of ['../f4/f4-c-auto-v112.js','../f4/f4-c-real-storage-v112.js',
  'e7-f4c-integrated-v112.js'])assert(sw.includes("'"+p+"'"));
 assert.match(viewer,/hijack\('e3-next',async/);
 assert.match(viewer,/hijack\('review-adopt',adopt/);
 assert.match(viewer,/hijack\('sleep-open',openSleep/);
 assert.doesNotMatch(viewer,/localStorage\.setItem/);
 new vm.Script(viewer);
});
test('v112 real Box E7 Chromium: propose, adopt, restore without fake plan', {timeout:180000},()=>{
 const cp=require('node:child_process');
 cp.execFileSync('python3',[path.resolve(__dirname,'preview_browser_f4c_v112.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:175000});
});

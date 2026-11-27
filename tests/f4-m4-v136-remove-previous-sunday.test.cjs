'use strict';
/* M4 v136: remove user-supplied prior Sunday from lightweight mode.
 * Preserve historical records for backups and retain the 29-window timeline.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(p){
 const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),box,{filename:p,timeout:20000});
 return box.module.exports;
}
test('v136: both actual sleep UI and handlers have zero prior-Sunday entry controls',()=>{
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 for(const old of ['f4c-carry-trigger','f4c-carry-entry','f4c-carry-edit',
  'f4c-carry-preview']){
  assert(!html.includes(old),'old HTML control still present: '+old);
  assert(!ui.includes(old),'old UI handler still present: '+old);
 }
 for(const old of ['sleepViewCarry','editingCarry','beginCarryEdit',
  'openCarry','carryTeam','carryIssue','store.readCarry(','store.saveCarry(']){
  assert(!ui.includes(old),'old integration path still present: '+old);
 }
 assert.match(html,/id="sleep-day-nav"/);
 assert.match(html,/id="sleep-copy"/);
 assert.match(html,/id="auto-sleep"/);
 assert.match(ui,/previousWeekSleepIndices:null/);
 assert.match(ui,/previousCarryRevision:null/);
 assert.match(ui,/PREVIOUS_SUNDAY_INPUT_RETIRED/);
 assert.match(ui,/store\.migrateSleep\(localStorage,c,refs\)/);
});
test('v136: exactly 29 windows and 168h, with a 3.5h unobserved boundary',()=>{
 const clock=load('f4/f4-b-game-week-v1.js');
 const w=clock.build('2026-11-16','2026-11-15T23:00:00+09:00');
 assert.equal(w.status,'TIMELINE_READY',w.reason);
 assert.equal(w.windowCount,29);
 assert.equal(w.totalHours,168);
 assert.equal(w.windows[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(w.windows[0].hours,3.5);
 assert.equal(w.windows[0].day,-1);
});
test('v136: preserve legacy records as rollback-only, never erase or adopt by UI',()=>{
 const store=read('f4/f4-c-real-storage-v112.js');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 assert.match(store,/function readCarry\(/);
 assert.match(store,/function saveCarry\(/);
 assert.match(ui,/legacy record for backup/);
 assert.doesNotMatch(ui,/localStorage\.removeItem\([^)]*carry/);
 assert.doesNotMatch(ui,/store\.key\('carry'/);
});
test('v136: PWA offline cache includes simplified sleep UI revision',()=>{
 const cache=read('e7-preview/e7-sw-v50.js');
 assert.match(cache,/v136-no-prior-sunday-input/);
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(html,/e7-f4c-integrated-v112\.js/);
});

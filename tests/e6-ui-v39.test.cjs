'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm'),assert=require('node:assert/strict');
const root=resolve(__dirname,'..'),dir=resolve(root,'previews');
const names=['U2_Prep_Local_Ingredients_20261107_v39_E6.html',
 'U3_Strategy_UI_20261107_v39_E6.html',
 'U4_Box_Preview_20261107_v39_E6.html'];
test('E6 v39: old UI text removed, user-controlled 3/2/1, bonus bullets, ended filter, syntax',()=>{
 for(const name of names){
  const s=readFileSync(resolve(dir,name),'utf8');
  for(const file of names)assert.ok(s.includes(file));
  assert.doesNotMatch(s,/20261107_v38_E6\.html/);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
 const s=readFileSync(resolve(dir,names[1]),'utf8');
 for(const x of ['id="event-source-status"','id="e6-bonus-status"','id="e6-bonus-value"',
  'id="e6-bonus-source"','備蓄の基本方針','data-pending="true"','（選択中）'])
  assert.ok(!s.includes(x),x);
 assert.equal((s.match(/data-stock-count="/g)||[]).length,3);
 assert.match(s,/let prepDraft=null/);
 assert.match(s,/const prep=checkedPrep\(\);/);
 assert.match(s,/source:manualSourceRequested\?null:pendingEventSource\?clone\(pendingEventSource\)/);
 assert.match(s,/Date\.parse\(x\.end\+'T04:00:00\+09:00'\)>now/);
 assert.match(s,/id="e6-bonus-list"/);
 assert.match(s,/id="e6-event-heading"/);
});
test('E6 v39: Chromium UI and event-specific stockpile Save gate',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e6_v39_minimal.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm'),assert=require('node:assert/strict');
const root=resolve(__dirname,'..'),dir=resolve(root,'previews');
const names=['U2_Prep_Local_Ingredients_20261107_v38_E6.html',
 'U3_Strategy_UI_20261107_v38_E6.html','U4_Box_Preview_20261107_v38_E6.html'];
test('E6 v38: auto fetch + select immediate preview + Save-gated commit without buttons',()=>{
 for(const name of names){
  const s=readFileSync(resolve(dir,name),'utf8');
  names.forEach(x=>assert.ok(s.includes(x),name+' missing '+x));
  assert.doesNotMatch(s,/20261107_v37_E6\.html/);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
 const u3=readFileSync(resolve(dir,names[1]),'utf8');
 assert.match(u3,/id="event-source-select"/);
 assert.doesNotMatch(u3,/event-source-fetch|event-source-apply/);
 assert.match(u3,/raw\.githubusercontent\.com\/nitoyon\/pokesleep-tool\/main\/src\/data\/event\.json/);
 assert.match(u3,/autoLoadEventCandidates\(\);/);
 assert.match(u3,/source:manualSourceRequested\?null:pendingEventSource\?clone\(pendingEventSource\)/);
 assert.match(u3,/if\(pendingEventSource&&pendingEventSource\.start!==d\)/);
 assert.match(u3,/manualSourceRequested\|\|!!pendingEventSource/);
 assert.match(u3,/候補：同梱データ/);
 assert.match(u3,/const EVENT_EMBEDDED_SNAPSHOT=/);
 assert.match(u3,/保存済みの作戦・在庫は維持/);
});
test('E6 v38: real Chrome source preview Save-commit integration',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e6_v38_event_auto.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

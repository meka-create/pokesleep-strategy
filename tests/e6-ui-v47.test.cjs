'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=path.join(root,'previews');
const files=['U2_Prep_Local_Ingredients_20261109_v47_E6.html',
'U3_Strategy_UI_20261109_v47_E6.html','U4_Box_Preview_20261109_v47_E6.html'];
const [u2,u3,u4]=files.map(x=>fs.readFileSync(path.join(base,x),'utf8'));
test('v47 footer links across all three screens and script syntax use same v47 artifacts',()=>{
 for(const [i,s] of [u2,u3,u4].entries()){
  for(const f of files)assert.ok(s.includes(f),'v47 cross-link missing: '+i+' '+f);
  assert.doesNotMatch(s,/href="U[234]_[^"]*(?:20261108_v4[0-6]|20261109_v4[0-6])_E6\.html"/);
  assert.ok(s.slice(s.indexOf('<title>'),s.indexOf('</title>')).includes('v47'));
  assert.match(s,/#e6-footer-plan\[data-reproposal="true"\]::after/);
  assert.match(s,/M17 2c-2\.25 0-3\.55 2\.3/,'retains cutlery');
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
});
test('v47 time labels differ only in copy; sleep title uses the ordinary slot typography',()=>{
 assert.match(u3,/const SLOT_TIMES=\{morning:'7:30–12:00',noon:'12:00–18:00',evening:'18:00–0:00',sleep:'睡眠中'\}/);
 assert.doesNotMatch(u3,/18:00–就寝前|sleep:'就寝前'/);
 assert.match(u3,/\.slot-title\{font-size:13px;font-weight:740;color:#c3d3e3\}/);
 assert.doesNotMatch(u3,/#week-content \.slot\[data-slot="sleep"\] \.slot-title\{color:/);
 assert.match(u3,/#week-content \.slot\[data-slot="sleep"\]\{border-color:#60798c;background:#21384c\}/);
 assert.match(u3,/title\.textContent=SLOT_TIMES\[slot\]/);
 assert.match(u3,/function e6DuplicateBerryControlIds\(\)/,'v46 duplicate-save guard retained');
 assert.match(u3,/border:0;border-left:3px solid #91aabc/,'v46 bonus information style retained');
});
test('v47 Android-size Chromium verifies proposal preview labels and matching styles',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v47.py')],{cwd:root,stdio:'pipe',timeout:170000});
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),preview=path.join(root,'previews');
const names=['U2_Prep_Local_Ingredients_20261109_v48_E6.html',
'U3_Strategy_UI_20261109_v48_E6.html','U4_Box_Preview_20261109_v48_E6.html'];
const [u2,u3,u4]=names.map(n=>fs.readFileSync(path.join(preview,n),'utf8'));
test('v48 all three preview files use v48 links, syntax and retained navigation',()=>{
 for(const [i,s] of [u2,u3,u4].entries()){
  const title=s.slice(s.indexOf('<title>'),s.indexOf('</title>'));
  assert.match(title,/v48/);
  for(const n of names)assert.ok(s.includes(n),'mixed navigation '+i+' '+n);
  assert.doesNotMatch(s,/href="U[234]_[^"]*_v4[0-7]_E6\.html"/);
  assert.match(s,/#e6-footer-plan\[data-reproposal="true"\]::after/);
  for(const m of s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 }
});
test('v48 sleep label and midnight past-slot boundary preserve 4am event rollover',()=>{
 assert.match(u3,/const SLOT_TIMES=\{morning:'7:30–12:00',noon:'12:00–18:00',evening:'18:00–0:00',sleep:'睡眠枠'\}/);
 assert.doesNotMatch(u3,/sleep:'睡眠中'|sleep:'就寝前'|sleep:'22:00'/);
 assert.match(u3,/const SLOT_STARTS=\{morning:'07:30',noon:'12:00',evening:'18:00',sleep:'00:00'\}/);
 assert.match(u3,/const calendarDay=slot==='sleep'\?day\+1:day;/);
 assert.match(u3,/return nowInJapan\(\)>=dateFor\(calendarDay\)\+'T'\+SLOT_STARTS\[slot\];/);
 assert.match(u3,/if\(nowInJapan\(\)>=dateFor\(7\)\+'T04:00'\)return 'ended'/);
 assert.match(u3,/return isPastSlot\(selectedSleepDay,'sleep'\)|const unavailable=isPastSlot\(selectedSleepDay,'sleep'\)/);
 assert.match(u3,/if\(slot!=='sleep'\|\|isPastSlot\(day,'sleep'\)/);
 assert.match(u3,/function e6DuplicateBerryControlIds\(\)/,'v46 duplicate-save guard retained');
 assert.match(u3,/border:0;border-left:3px solid #91aabc/,'v46 passive bonus retained');
});
test('v48 Chromium checks midnight edges, weekly boundary and proposed-slot labeling',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v48.py')],{cwd:root,stdio:'pipe',timeout:170000});
});

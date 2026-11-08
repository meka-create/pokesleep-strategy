'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'previews');
const names=["U2_Prep_Local_Ingredients_20261109_v49_E6.html","U3_Strategy_UI_20261109_v49_E6.html","U4_Box_Preview_20261109_v49_E6.html"];
const files=names.map(n=>fs.readFileSync(path.join(dir,n),'utf8'));
test('v49 isolated screens have coherent versioned links, syntax and no old UI regression',()=>{
 for(const [idx,s] of files.entries()){
  assert.match(s.slice(s.indexOf('<title>'),s.indexOf('</title>')),/v49/);
  for(const name of names)assert.ok(s.includes(name),'stale navigation '+idx+' -> '+name);
  assert.doesNotMatch(s,/href="U[234]_[^"]*_v4[0-8]_E6\.html"/);
  for(const m of s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 }
 const u3=files[1];
 assert.match(u3,/sleep:'00:00'/);
 assert.match(u3,/calendarDay=slot==='sleep'\?day\+1:day/);
 assert.match(u3,/dateFor\(7\)\+'T04:00'/);
 assert.match(u3,/e6DuplicateBerryControlIds\(\)/);
 assert.match(u3,/function validStoredState\(/);
 assert.match(u3,/url\.searchParams\.set\('eventId',e3Selected\.id\)/);
 const a=u3.indexOf('if(!storeState())throw Error(\'Plan write failed\')');
 const b=u3.indexOf('localStorage.setItem(ledgerKey,JSON.stringify(confirmed))');
 const c=u3.indexOf('localStorage.setItem(E3_SELECTED_KEY,JSON.stringify(selection))');
 assert.ok(a>0&&a<b&&b<c,'selector must be committed after dependent records');
});
test('v49 real browser storage-failure and identity cases',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v49_audit.py')],{cwd:root,timeout:170000,stdio:'pipe'});
});
test('v49 sleep midnight and Monday 04:00 browser regression',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v49_midnight.py')],{cwd:root,timeout:170000,stdio:'pipe'});
});

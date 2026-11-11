'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../e7-preview');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const pages=['index.html','U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html','U4_Box_Preview_20261109_v50_E7.html'];
const native=/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;

test('E7 v66: no browser-native JS dialogs anywhere in the four-screen preview',()=>{
 for(const p of pages){
  const code=read(p);
  assert.deepEqual([...code.matchAll(native)].map(m=>m.index),[],p);
  assert.match(code,/e7-feedback-v66\.js/);
  assert.match(code,/e7-feedback-v66\.css/);
  for(const m of code.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
   assert.doesNotThrow(()=>new vm.Script(m[1]),p);
 }
 const settings=read('e7-settings-v56.js');
 assert.deepEqual([...settings.matchAll(native)],[]);
 for(const f of ['e7-settings-v56.js','e7-feedback-v66.js'])
  assert.doesNotThrow(()=>new vm.Script(read(f)));
});
test('E7 v66: common confirm is async, default-safe and supports both shell and child modal hosts',()=>{
 const lib=read('e7-feedback-v66.js');
 assert.match(lib,/dialog\.addEventListener\('cancel'/);
 assert.match(lib,/function confirm\(message,options=\{\}\)/);
 assert.match(lib,/modal\.showModal\(\)/);
 assert.match(lib,/if\(active\.type==='confirm'\)cancel\.focus\(\)/);
 assert.match(lib,/dialog\.addEventListener\('click'/);
 assert.match(lib,/window\.PokeUI=Object\.freeze/);
 assert.match(lib,/const host=open\.at\(-1\)\|\|document\.body/);
 const U3=read(pages[2]),U4=read(pages[3]),shell=read(pages[0]),settings=read('e7-settings-v56.js');
 assert.match(shell,/async function resetDev\(tab\)/);
 assert.match(U3,/async function copySleepNights\(day\)/);
 assert.match(U3,/async function e7OpenSavedEvent\(selection\)/);
 assert.match(U4,/addEventListener\('click',async\(\)=>\{/);
 assert.match(settings,/await PokeUI\.alert\('バックアップから復元しました/);
 assert.match(settings,/if\(!same\(readStore\(\),before\)\)throw/);
});
test('E7 v66: temporary results use toast; user-editable and persistent issues stay inline',()=>{
 const U2=read(pages[1]),U3=read(pages[2]),U4=read(pages[3]);
 assert.match(U2,/function toast\(message,err=false\)\{PokeUI\.toast/);
 assert.match(U3,/function showToast\(message,isError=false\)\{PokeUI\.toast/);
 assert.match(U4,/const message=\(msg,error=false\)=>\{PokeUI\.toast/);
 assert.doesNotMatch(U4,/id="e7-message"/);
 assert.match(U4,/id="e7-player-error" role="alert"/);
 assert.match(U2,/id="error" class="msg" role="alert"/);
 assert.match(U4,/id="e7-blocked" hidden role="alert"/);
 assert.match(read('e7-settings-v56.js'),/node\.textContent=error\?message:''/);
 const sw=read('e7-sw-v50.js');
 assert.match(sw,/pokesleep-strategy-e7-v70-shared-event-header-20261111/);
 assert.match(sw,/'e7-feedback-v66\.js','e7-feedback-v66\.css'/);
 assert.match(read('index.html'),/<title>ポケスリ作戦室 E7 v70<\/title>/);
});
test('E7 v66 Chromium: custom modal/toast and cancellation regression',{timeout:170000},()=>{
 require('node:child_process').execFileSync('python3',
 [path.resolve(__dirname,'preview_browser_e7_v66.py')],
 {cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:165000});
});

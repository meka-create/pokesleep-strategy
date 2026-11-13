'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('F4-B v93 isolated UI loads all verified local sources and preserves E7 storage',()=>{
 const html=fs.readFileSync(path.join(root,'f4b-preview/index.html'),'utf8');
 const assets=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
 const expected=['../e7-preview/e7-inventory-scope-v78.js','../e7-preview/e7-e1-core-v84.js',
  '../f1/f1-b-legal-build-v2.js','../f1/f1-b-base-rates-v1.js',
  '../src/master.js','../src/recipes.js','../f4/f4-chronological-core-v1.js',
  '../f4/f4-f1b-roster-adapter-v1.js','../f4/f4-b-game-week-v1.js',
  '../f4/f4-b-chronological-v2.js','../f4/f4-b-e7-readonly-v1.js',
  '../f4/f4-event-model-gate-v1.js','../f4/f4-c-official-rules-v1.js',
  '../f4/f4-c-state-kernel-v1.js','f4-b-ui-v93.js'];
 assert.deepEqual(assets,expected);
 for(const asset of assets)
  assert(fs.existsSync(path.resolve(root,'f4b-preview',asset)),asset);
 const js=fs.readFileSync(path.join(root,'f4b-preview/f4-b-ui-v93.js'),'utf8');
 assert.doesNotThrow(()=>new Function(js));
 for(const banned of ['localStorage.setItem','localStorage.removeItem','sessionStorage.setItem',
  'indexedDB.open','console.log','history.replaceState'])
  assert(!js.includes(banned),'do not persist or leak user Box: '+banned);
 assert(html.includes('id="team-dialog"'));
 assert(html.includes('id="favorites"'));
 assert(html.includes('id="run"'));
 assert(html.includes('F4-Cでまだ未接続の要素'));
 assert.match(js,/PokeF4COfficialRules\?\.match\(c\.fields\.source\)/);
 assert(!html.includes('iframe'),'E7 existing shell must not be altered');
});
test('F4-B v93 Chromium: 8 real teams, neutral 29 windows, no writes and official block',
 {timeout:150000},()=>{
 cp.execFileSync('python3',[path.join(root,'tests/preview_browser_f4b_v93.py')],{
  cwd:root,stdio:'pipe',timeout:140000});
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../e7-preview'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('E7 v68 header uses the saved validated event and U3 Japanese translation once',()=>{
 const bridge=read('e7-unified-bridge-v51.js'),u3=read('U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(u3,/window\.__e7CurrentEventHeader=\(\)=>\{/);
 assert.match(u3,/const selection=e3Selected,confirmed=e3Ledger\(\)\?\.confirmed/);
 assert.match(u3,/eventDisplayName\(source\)/);
 assert.match(bridge,/const isEventTab=\/\^U\[234\]_\//);
 assert.match(bridge,/copy\.append\(eventNode\)/);
 assert.match(bridge,/wrap\.append\(more,menu\);header\.append\(wrap\)/);
 assert.match(bridge,/const result=plan\?\.__e7CurrentEventHeader\?\.\(\)/);
 assert.match(bridge,/result\.weekStart===selected\.weekStart/);
 assert.match(bridge,/caption\.textContent=name\|\|'for Pokémon Sleep'/);
 assert.match(bridge,/text-overflow:ellipsis/);
 assert.match(bridge,/document\.addEventListener\('click',e=>\{/);
 assert.match(bridge,/sibling\?\.addEventListener\('load',refreshEventHeader\)/);
 assert.doesNotMatch(bridge,/localStorage\.setItem\([^)]*header/);
 assert.doesNotThrow(()=>new vm.Script(bridge));
 for(const m of u3.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
  assert.doesNotThrow(()=>new vm.Script(m[1]));
});
test('E7 v68 renders two-page header and preserves old three-dot menu, full root app remains frozen',()=>{
 assert.match(read('index.html'),/<title>ポケスリ作戦室 E7 v77<\/title>/);
 assert.match(read('e7-sw-v50.js'),/pokesleep-strategy-e7-v77-install-label-20261112/);
 assert.match(read('e7-sw-v50.js'),/'e7-unified-bridge-v51\.js'/);
 const bridge=read('e7-unified-bridge-v51.js');
 assert.match(bridge,/eventNode\.title='現在のイベント：'\+name/);
 assert.match(bridge,/calendar\.toggleAttribute\('hidden',!name\)/);
});
test('E7 v68 Chromium: plan/prep event labels and header geometry',
 {timeout:170000},()=>{
 require('node:child_process').execFileSync('python3',
 [path.resolve(__dirname,'preview_browser_e7_v68.py')],
 {cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:165000});
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../e7-preview');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('E7 v77: one selected-event subtitle resolver for all three tabs',()=>{
 const bridge=read('e7-unified-bridge-v51.js');
 assert.match(bridge,/const isEventTab=\/\^U\[234\]_\//);
 assert.match(bridge,/const name=isEventTab\?selectedEventHeader\(\)\.trim\(\)\.slice\(0,160\):''/);
 assert.match(bridge,/caption\.textContent=name\|\|'for Pokémon Sleep'/);
 assert.match(bridge,/calendar\.toggleAttribute\('hidden',!name\)/);
 assert.match(bridge,/if\(\/\^U\[24\]_\//); // Prep and Box await canonical U3.
 assert.match(bridge,/sibling\?\.addEventListener\('load',refreshEventHeader\)/);
 assert.match(bridge,/const result=plan\?\.__e7CurrentEventHeader\?\.\(\)/);
 assert.match(bridge,/result\?\.id===selected\.id&&result\.weekStart===selected\.weekStart/);
 assert.match(bridge,/eventNode\.setAttribute\('aria-label','現在のイベント：'\+name\)/);
 assert.match(bridge,/eventNode\.setAttribute\('aria-label','for Pokémon Sleep'\)/);
 assert.doesNotMatch(bridge,/localStorage\.setItem\([^)]*header/);
 assert.doesNotThrow(()=>new vm.Script(bridge));
});
test('E7 v77: versioned offline assets and supplied header icon',()=>{
 assert.match(read('index.html'),/<title>ポケスリ作戦室 E7 v77<\/title>/);
 assert.match(read('e7-sw-v50.js'),/pokesleep-strategy-e7-v77-install-label-20261112/);
 assert.match(read('e7-sw-v50.js'),/'icons\/icon-header-96\.png'/);
 assert.match(read('e7-unified-bridge-v51.js'),/icon\.src='icons\/icon-header-96\.png'/);
 const manifest=JSON.parse(read('e7-manifest-v50.webmanifest'));
 assert.equal(manifest.icons[0].src,'icons/icon-192.png');
});

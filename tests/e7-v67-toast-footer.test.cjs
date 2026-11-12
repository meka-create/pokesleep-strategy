'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const load=file=>fs.readFileSync(path.join(base,file),'utf8');
test('E7 v67 normal toast computes exact 1px gap without double footer offset',()=>{
 const css=load('e7-feedback-v66.css'),js=load('e7-feedback-v66.js');
 assert.match(css,/#e7-feedback-toast\{[\s\S]*?bottom:var\(--e7-toast-bottom,1px\)/);
 assert.match(css,/#e7-feedback-dialog #e7-feedback-toast\{bottom:12px/);
 assert.match(js,/window\.frameElement\?\.matches\('iframe\.view'\)\)return 1/);
 assert.match(js,/window\.innerHeight-footer\.getBoundingClientRect\(\)\.top\+1/);
 assert.match(js,/else node\.style\.setProperty\('--e7-toast-bottom',toastFooterOffset\(\)\+'px'\)/);
 assert.match(js,/if\(host\.tagName==='DIALOG'\)node\.style\.removeProperty/);
 assert.doesNotMatch(css,/^#e7-feedback-toast\{[^}]*bottom:max\(86px/m);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(load('index.html'),/<title>ポケスリ作戦室 E7 v74<\/title>/);
 assert.match(load('e7-sw-v50.js'),/pokesleep-strategy-e7-v74-supplied-icons-20261112/);
});
test('E7 v67 Chromium: footer-edge geometry on mobile and standalone, modal unchanged',
 {timeout:180000},()=>{
 require('node:child_process').execFileSync('python3',
 [path.resolve(__dirname,'preview_browser_e7_v67.py')],
 {cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:175000});
});

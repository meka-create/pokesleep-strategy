'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const get=p=>fs.readFileSync(path.join(base,p),'utf8');
test('E7 v64 card parity and six-character picker contract',()=>{
 const u3=get('U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(u3,/#event-details\.card,\.sleep-settings\.card\{width:100%;min-width:0\}/);
 assert.match(u3,/#event-details\.card:not\(\[open\]\)\{padding:4px 10px;min-height:54px\}/);
 assert.match(u3,/main\[data-has-proposed="true"\] #event-details\[open\]\{padding:4px 10px\}/);
 assert.match(u3,/main\[data-has-proposed="true"\] #event-details\[open\]>summary\{height:40px;min-height:40px;padding:0;line-height:1.35\}/);
 const u4=get('U4_Box_Preview_20261109_v50_E7.html');
 assert.match(u4,/#e7-import-panel>summary::after\{content:""/);
 assert.match(u4,/#e7-import-panel\[open\]>summary::after\{transform:rotate\(225deg\)/);
 assert.match(u3,/\.event-details\[open\]>summary::after\{transform:rotate\(225deg\)/);
 assert.match(u3,/main\[data-has-proposed="true"\] #event-details\[open\]>.event-fields\{margin-top:8px;padding-top:18px;border-top-color:#394e65\}/);
 assert.match(u3,/#pick-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(u3,/#pick-grid \.pick-select \.selected-check\{position:absolute;right:3px;top:3px/);
 assert.match(u3,/#pick-grid \.pick-select \.pick-name\{font-size:clamp\(10px,2\.8vw,11px\)/);
 assert.match(u3,/#pick-grid \.pick-select \.selected-check:empty\{display:none\}/);
 assert.match(u3,/<section class="card sleep-settings" aria-label="睡眠編成の設定">/);
 assert.doesNotMatch(u3,/<details class="card sleep-settings"/);
 for(const m of u3.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
  assert.doesNotThrow(()=>new vm.Script(m[1]));
});
test('E7 v64 Chromium: card geometry, divider spacing, full-width names',{timeout:120000},()=>{
 require('node:child_process').execFileSync('python3',[path.resolve(__dirname,'preview_browser_e7_v64.py')],{cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:115000});
});

test('E7 v64 calendar looks proportionate without enlarging nav targets',()=>{
 const html=get('index.html');
 const pos=html.indexOf('id="tab-plan"');
 const svg=html.slice(html.indexOf('<svg',pos),html.indexOf('</svg>',pos)+6);
 assert.match(svg,/viewBox="60 60 392 392"/);
 assert.match(svg,/stroke-width="23"/);
 assert.match(svg,/x="103" y="125" width="306" height="272"/);
 for(const filename of ['U2_Prep_Local_Ingredients_20261109_v50_E7.html','U3_Strategy_UI_20261109_v50_E7.html','U4_Box_Preview_20261109_v50_E7.html']){
  const source=get(filename),p=source.indexOf('id="e6-footer-plan"');
  const fragment=source.slice(source.indexOf('<svg',p),source.indexOf('</svg>',p)+6);
  assert.match(fragment,/viewBox="60 60 392 392"/,filename);
 }
});

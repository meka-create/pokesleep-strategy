'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'e7-preview');
const read=x=>fs.readFileSync(path.join(dir,x),'utf8');
test('E7 v63 calendar footer artwork uses the same geometry as PWA icon',()=>{
 const app=read('e7-icon-v50.svg');
 const group=app.match(/<g fill="none" stroke="#f1cd85"[^>]*>([\s\S]*?)<\/g>/)?.[1];
 assert.ok(group,'PWA calendar outline group missing');
 assert.match(group,/rect x="103" y="125" width="306" height="272" rx="34"/);
 const dots=['178,270','257,270','335,270','178,337','257,337'];
 for(const page of ['index.html','U3_Strategy_UI_20261109_v50_E7.html',
  'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
  'U4_Box_Preview_20261109_v50_E7.html']){
  const source=read(page);
  const anchor=page==='index.html'?'id="tab-plan"':'id="e6-footer-plan"';
  const from=source.indexOf(anchor),start=source.indexOf('<svg',from),end=source.indexOf('</svg>',start);
  assert.ok(from>=0&&start>from&&end>start,page);
  const icon=source.slice(start,end);
  for(const expected of ['viewBox="0 0 512 512"','x="103" y="125" width="306" height="272" rx="34"',
   'M170 92v62m172-62v62M107 200h301'])assert.ok(icon.includes(expected),page);
  for(const coord of dots){
   const [cx,cy]=coord.split(',');
   assert.ok(icon.includes('cx="'+cx+'" cy="'+cy+'" r="19"'),page+' missing dot '+coord);
  }
 }
});
test('E7 v63 strategy compacts closed panels and preserves accessible controls',()=>{
 const s=read('U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(s,/<section class="card sleep-settings" aria-label="睡眠編成の設定"><div class="section-head"><h2>睡眠編成<\/h2>/);
 assert.doesNotMatch(s,/<details class="card sleep-settings"/);
 assert.match(s,/#event-details>summary\{min-height:0;padding:5px 0;font-size:13px/);
 assert.match(s,/\.sleep-settings\.card\{padding:4px 10px\}/);
 assert.match(s,/\.sleep-settings \.section-head\{margin:0;gap:6px;min-height:44px\}/);
 assert.match(s,/id="auto-sleep"/);
 assert.match(s,/id="sleep-open"/);
 assert.match(s,/className='pick-meta'/);
 assert.match(s,/className='pick-level'/);
 assert.match(s,/MOCK_STATUS\[p\.id\]\?\.\[0\]/);
 assert.match(s,/meta\.append\(level,name\)/);
 assert.match(s,/\.pick-select \.pick-meta\{display:flex;flex:1 1 auto/);
 for(const x of s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(x[1]));
});
test('E7 v63 prep font and header geometry are identical',()=>{
 const s=read('U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 assert.match(s,/#goal-panel>\.card:first-child>\.card-heading,#inventory-panel>\.card:first-child>\.card-heading\{min-height:30px;height:30px/);
 assert.match(s,/#goal-panel>\.card:first-child>\.card-heading h2,#inventory-panel>\.card:first-child>\.card-heading h2\{font-size:15px;line-height:1\.25\}/);
});
test('E7 v63 Chromium: calendar, aligned food tiles, compact cards, picker level',{timeout:120000},()=>{
 require('node:child_process').execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v63.py')],{
   cwd:root,timeout:115000,stdio:'pipe'
 });
});

test('E7 v63: short screens use exactly the same ingredient-card padding',()=>{
 const u2=read('U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 assert.match(u2,/@media\(max-height:800px\)\{#goal-panel>\.card:first-child,#inventory-panel>\.card:first-child\{padding:9px 9px 7px\}\}/);
});

'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=resolve(__dirname,'..');
const u2=readFileSync(resolve(root,'previews/U2_Prep_Local_Ingredients_20261107_v34_E6.html'),'utf8');
const u3=readFileSync(resolve(root,'previews/U3_Strategy_UI_20261107_v34_E6.html'),'utf8');
test('E6 v34: no stale v33 links, development-only controls and script syntax',()=>{
 for(const html of [u2,u3]){
  assert.match(html,/<details id="e6-dev" open>/);
  for(const stage of ['prep','start','during'])assert.match(html,new RegExp('data-e6-stage="'+stage+'"'));
  for(const page of ['u2','u3'])assert.match(html,new RegExp('data-e6-page="'+page+'"'));
  assert.match(html,/e6Reset/);
  assert.doesNotMatch(html,/U3_Strategy_UI_20261105_v33\.html/);
  assert.doesNotMatch(html,/U2_Prep_Local_Ingredients_20261105_v33\.html/);
  const scripts=[...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,3);
  scripts.forEach(m=>new vm.Script(m[1]));
 }
 assert.match(u3,/const activePlan=hasApplied&&appliedEventStart===eventInfo\.start&&phase!=='before';/);
 assert.match(u2,/const values=\(phase\(\)==='BEFORE'\?timeline\.startInventory\?\.values:timeline\.currentInventory\?\.values\)\?\?zeros\(\);/);
});
test('E6 v34: Chromium stage navigation and preserved adopted-plan regression',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e6_v34.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

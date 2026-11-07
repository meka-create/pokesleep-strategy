'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {execFileSync}=require('node:child_process');
const {Script}=require('node:vm');
const assert=require('node:assert/strict');
const root=resolve(__dirname,'..','previews');
const filenames=['U2_Prep_Local_Ingredients_20261107_v36_E6.html','U3_Strategy_UI_20261107_v36_E6.html','U4_Box_Preview_20261107_v36_E6.html'];
const htmls=filenames.map(x=>readFileSync(resolve(root,x),'utf8'));
test('E6 v36: only 3 timestamp buttons in developer menu, no duplicate navigation',()=>{
 for(const [i,html] of htmls.entries()){
  assert.equal((html.match(/<nav id="e6-footer"/g)||[]).length,1,filenames[i]);
  assert.doesNotMatch(html,/20261107_v35_E6\.html/);
  for(const fname of filenames)assert.ok(html.includes(fname),fname);
  const nav=html.match(/<nav id="e6-footer"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
  const scripts=[...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)];
  scripts.forEach(m=>new Script(m[1]));
 }
 for(const html of htmls.slice(0,2)){
  assert.equal((html.match(/data-e6-stage="/g)||[]).length,3);
  assert.doesNotMatch(html,/data-e6-page=|準備画面へ<\/button>|作戦画面へ<\/button>/);
  assert.match(html,/data-e6-stage="start">月曜・開始直後</);
  assert.match(html,/data-e6-stage="during">水曜・週途中</);
  assert.match(html,/const url=new URL\(location\.href\);/);
  assert.match(html,/保存済みの作戦・在庫は維持/);
  assert.match(html,/id="e6-reset"/);
  assert.match(html,/<details id="e6-dev">/);
  assert.doesNotMatch(html,/<details id="e6-dev" open>/);
 }
});
test('E6 v36: stage change stays in current footer tab (real Chrome)',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:resolve(__dirname,'..'),stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e6_v36_devmenu.py')],{cwd:resolve(__dirname,'..'),stdio:'pipe',timeout:120000});
});

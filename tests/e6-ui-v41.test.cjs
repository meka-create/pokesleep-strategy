'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),previews=path.join(root,'previews');
const files=['U2_Prep_Local_Ingredients_20261108_v41_E6.html','U3_Strategy_UI_20261108_v41_E6.html','U4_Box_Preview_20261108_v41_E6.html'];
test('E6 v41: compact footer, stockpile moved below goals, shared berry controls, preproposal visibility',{timeout:20000},()=>{
 const [u2,u3,u4]=files.map(f=>fs.readFileSync(path.join(previews,f),'utf8'));
 for(const s of [u2,u3,u4]){
  for(const filename of files)assert.ok(s.includes(filename),'footer target missing '+filename);
  assert.doesNotMatch(s,/<small>(?:当日編成|目標・在庫|個体管理)<\/small>/);
  assert.doesNotMatch(s,/20261107_v40_E6/);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
 const grid=u2.indexOf('class="grid goal-grid"');
 const panel=u2.indexOf('id="e6-prep-category-card"');
 const inventory=u2.indexOf('<section id="inventory-panel"');
 assert.ok(grid>0&&panel>grid&&panel<inventory,'prep categories follow the target ingredient list, not above the inventory list');
 assert.match(u2,/data-stock-count="3"/);
 assert.match(u2,/data-stock-count="2"/);
 assert.match(u2,/data-stock-count="1"/);
 assert.match(u2,/pokesleep-strategy-u2-e6-prep-v1:/);
 assert.match(u2,/pokesleepPrep/);
 assert.match(u2,/#goal-panel>\.card>\.card-heading,#inventory-panel>\.card>\.card-heading/);
 assert.doesNotMatch(u3,/class="field wide e6-stock-config"/);
 assert.match(u3,/importPrepFromU2\(\)/);
 assert.match(u3,/data-has-proposed="true"/);
 assert.match(u3,/hasProposed=true/);
 assert.match(u3,/好みのきのみ<\/span>/);
 assert.doesNotMatch(u3,/好みのきのみ（タイプ）/);
 assert.doesNotMatch(u3,/<label>[①②③]<select/);
 for(const id of ['e6-berry-main','e6-berry-sub1','e6-berry-sub2'])
  assert.ok(u3.includes("['"+id+"','好みのきのみ"),'custom select '+id);
 assert.match(u3,/data-berry-type/);
 assert.match(u3,/berry-type-color/);
 assert.match(u3,/\[week,sleep,actions,conditions,intro\]/);
 assert.match(u3,/main\.dataset\.hasProposed=String\(hasProposed\)/);
 assert.match(u3,/const CLOCKS=\{prep:dateAt\(-1,'16:00'\),start:dateAt\(0,'06:00'\)/);
});
test('E6 v41: chromium two-way navigation, storage, berry color and category layout',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[path.resolve(__dirname,'preview_browser_e6_v41.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

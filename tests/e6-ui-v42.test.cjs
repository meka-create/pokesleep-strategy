'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const folder=path.join(root,'previews');
const names=['U2_Prep_Local_Ingredients_20261108_v42_E6.html','U3_Strategy_UI_20261108_v42_E6.html','U4_Box_Preview_20261108_v42_E6.html'];
const [u2,u3,u4]=names.map(n=>fs.readFileSync(path.join(folder,n),'utf8'));
const actionSource=u3.slice(u3.indexOf('function resolveE6PrimaryAction('),u3.indexOf('const e3PreviousRender=render;',u3.indexOf('function resolveE6PrimaryAction(')));
const resolve=vm.runInNewContext(actionSource+';resolveE6PrimaryAction;');
const base={phase:'BEFORE',selected:true,adopted:false,conditionsReady:true,stockSaved:true,changed:false,draftReady:false,hasFuture:true};
function decide(changes){return resolve({...base,...changes});}
test('E6 v42: one pure primary-action rule before/after event; clocks never cause an unnecessary change',()=>{
 for(const phase of ['BEFORE','DURING']){
  assert.equal(decide({phase,adopted:true}), 'NONE','adopted unchanged: '+phase);
  assert.equal(decide({phase,adopted:true,changed:true}),'REPROPOSE','actual saved condition change: '+phase);
  assert.equal(decide({phase,adopted:true,changed:true,conditionsReady:false}),'SET_EVENT','unsaved conditions take precedence: '+phase);
  assert.equal(decide({phase,adopted:true,draftReady:true}),'RESUME_DRAFT');
  assert.equal(decide({phase,adopted:true,stockSaved:false}),'SET_INVENTORY');
  assert.equal(decide({phase,adopted:false,stockSaved:true}),'PROPOSE');
 }
 assert.equal(decide({phase:'BEFORE',stockSaved:false}),'PROPOSE','preweek can preview without stock');
 assert.equal(decide({phase:'DURING',stockSaved:false}),'SET_INVENTORY','event week needs recorded stock');
 assert.equal(decide({phase:'ENDED',adopted:true,changed:true}),'NONE');
 assert.equal(decide({phase:'DURING',adopted:true,hasFuture:false,changed:true}),'NONE');
 assert.equal(decide({selected:false,hasFuture:false}),'SELECT_EVENT');
});
test('E6 v42: no duplicate or preparation-only primary button; single stable card order',()=>{
 assert.equal((u3.match(/id="e3-primary"/g)||[]).length,1);
 assert.match(u3,/const nodes=activePlan\?\[week,primary,sleep,conditions,actions,intro\]:\s*\[conditions,primary,sleep,week,actions,intro\]/);
 assert.match(u3,/const layout=activePlan\?'roster':'setup'/);
 assert.match(u3,/card\.hidden=action==='NONE'/);
 assert.doesNotMatch(u3,/earlyReady\?\s*\(hasApplied\?'REPROPOSE':'PROPOSE'\)/);
 assert.doesNotMatch(u3,/\$\('#week-content'\)\.after\(card\)|main\.prepend\(card\)/);
 assert.match(u3,/REPROPOSE:state\.phase==='BEFORE'\?'7日間の作戦を再提案':'残り期間を再提案'/);
 assert.match(u3,/inventory:hasInventory&&JSON\.stringify\(importedStock\)!==JSON\.stringify\(stockConfirmed\)/);
 assert.match(u3,/sleep:applied\.autoSleep!==autoSleep/);
 assert.match(u3,/conditions:JSON\.stringify\(appliedEventInfo\)!==JSON\.stringify\(eventInfo\)/);
});
test('E6 v42: preserve v41 UX contract while switching only one versioned preview group',()=>{
 const titles=['U2 v42','U3 v42','U4 E6 v42'];
 for(const [i,s] of [u2,u3,u4].entries()){
  assert.ok(s.slice(s.indexOf('<title>'),s.indexOf('</title>')).includes(titles[i]));
  for(const name of names)assert.ok(s.includes(name),'broken navigation '+name);
  assert.doesNotMatch(s,/20261107_v40_E6\.html|20261108_v41_E6\.html/);
  assert.doesNotMatch(s,/<small>(?:当日編成|目標・在庫|個体管理)<\/small>/);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
 assert.ok(u2.indexOf('class="grid goal-grid"')<u2.indexOf('id="e6-prep-category-card"'));
 assert.match(u2,/id="e6-prep-save"/);
 assert.match(u2,/pokesleep-strategy-u2-e6-prep-v1:/);
 assert.match(u3,/function importPrepFromU2\(\)/);
 assert.doesNotMatch(u3,/\bprepDraft\b|\bcheckedPrep\b|\brenderPrep\s*\(/);
 assert.match(u3,/id="e6-ex-effect"/);
 assert.match(u3,/<option value="all">すべて<\/option>/);
 assert.match(u3,/main\.dataset\.hasProposed=String\(hasProposed\)/);
 assert.match(u3,/const CLOCKS=\{prep:dateAt\(-1,'16:00'\),start:dateAt\(0,'06:00'\)/);
});
test('E6 v42: actual preview behavior before/after and saved-unchanged inventory',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[path.resolve(__dirname,'preview_browser_e6_v42.py')],{cwd:root,stdio:'pipe',timeout:145000});
});

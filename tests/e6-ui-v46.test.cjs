'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),preview=path.join(root,'previews');
const files=['U2_Prep_Local_Ingredients_20261108_v46_E6.html',
'U3_Strategy_UI_20261108_v46_E6.html','U4_Box_Preview_20261108_v46_E6.html'];
const [u2,u3,u4]=files.map(f=>fs.readFileSync(path.join(preview,f),'utf8'));
test('v46 navigation is one release with no mixed v45 preview, all scripts parse',()=>{
 for(const [i,html] of [u2,u3,u4].entries()){
  for(const n of files)assert.ok(html.includes(n),'missing v46 footer link: '+i+' '+n);
  assert.match(html,/#e6-footer-plan\[data-reproposal="true"\]::after/);
  assert.match(html,/M17 2c-2\.25 0-3\.55 2\.3/);
  assert.doesNotMatch(html,/href="U[234]_[^"]*20261108_v4[0-5]_E6\.html"/);
  assert.ok(html.slice(html.indexOf('<title>'),html.indexOf('</title>')).includes('v46'));
  [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
});
test('v46 rejects saved duplicates BEFORE any mutation of existing event or inventory',()=>{
 assert.match(u3,/function e6DuplicateBerryControlIds\(\)/);
 assert.match(u3,/const repeatedBerries=e6DuplicateBerryControlIds\(\)/);
 const save=u3.slice(u3.indexOf("\$".replace('\$','$')+"('#event-save').onclick=()=>"));
 assert.ok(save.indexOf('const repeatedBerries=')<save.indexOf('importPrepFromU2();'));
 assert.ok(save.indexOf('const repeatedBerries=')<save.indexOf('localStorage.setItem(E3_SELECTED_KEY'));
 assert.match(save,/showToast\('同じきのみは選択できません。異なるきのみを選んでください。',true\)/);
 assert.match(u3,/duplicated=new Set\(\[\.\.\.byType\.values\(\)\]\.filter\(group=>group\.length>1\)\.flat\(\)\)/);
 assert.match(u3,/dataset\.validate='berry-duplicate'/);
 assert.match(u3,/if\(!repeated\.length\)\$\('#event-details'\)\.dataset\.validate='false'/);
 assert.match(u3,/if\(needBerryEntry\(\)\&\&!validBerrySetup\(eventInfo\.berrySetup\)\)/);
});
test('v46 bonus is a passive information strip, not a button-shaped filled control',()=>{
 assert.match(u3,/.e6-bonus-panel\{background:linear-gradient/);
 assert.match(u3,/border:0;border-left:3px solid #91aabc/);
 assert.match(u3,/box-shadow:none;cursor:default/);
 assert.match(u3,/id="e6-bonus-panel" role="group"/);
 assert.match(u3,/<ul id="e6-bonus-list"><\/ul>/);
 assert.doesNotMatch(u3,/\.e6-bonus-panel\{background:#263c51;border:1px solid #55718a/);
 assert.match(u3,/panel\.hidden=list\.children\.length===0/);
 assert.match(u3,/id="e6-field-art" class="field wide e6-field-art" hidden aria-hidden="true"><\/div>/);
});
test('v46 Android-sized Chromium save and bonus regression',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v46.py')],{cwd:root,stdio:'pipe',timeout:170000});
});

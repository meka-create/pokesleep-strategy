'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'previews');
const names=['U2_Prep_Local_Ingredients_20261108_v44_E6.html','U3_Strategy_UI_20261108_v44_E6.html','U4_Box_Preview_20261108_v44_E6.html'];
const [u2,u3,u4]=names.map(n=>fs.readFileSync(path.join(dir,n),'utf8'));
test('v44 footer uses cutlery on all three tabs and retains version guard',()=>{
 for(const [i,s] of [u2,u3,u4].entries()){
  assert.match(s,/<ellipse cx="17\.4" cy="7\.4" rx="3\.3" ry="5\.1"\/>/,'spoon icon');
  assert.match(s,/<path d="M3 3v7a4 4 0 0 0 8 0V3M7 3v19/,'fork icon');
  assert.doesNotMatch(s,/<path d="M12\.2 8\.3c-2\.7-3\.5/,'old apple');
  assert.match(s,/#e6-footer-plan\[data-reproposal="true"\]::after/);
  for(const n of names)assert.ok(s.includes(n),'mixed v44 navigation '+i);
  assert.doesNotMatch(s,/href="U[234]_[^"]*_v4[0-3]_E6\.html"/);
  assert.ok(s.slice(s.indexOf('<title>'),s.indexOf('</title>')).includes('v44'));
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
});
test('v44 only exposes two proposal labels while preserving draft resume',()=>{
 assert.match(u3,/const labels=\{PROPOSE:'作戦を提案',REPROPOSE:'作戦を再提案'/);
 assert.match(u3,/RESUME_DRAFT:adopted\?'作戦を再提案':'作戦を提案'/);
 assert.match(u3,/card\.hidden=!\['PROPOSE','REPROPOSE','RESUME_DRAFT'\]\.includes\(action\)/);
 assert.match(u3,/action==='RESUME_DRAFT'[\s\S]*?renderReview\(\);\$\('#review-dialog'\)\.showModal\(\)/);
 assert.match(u3,/warning\.hidden=true;warning\.textContent='';/);
 assert.doesNotMatch(u3,/変更した内容は、確認・採用後に反映されます。/);
});
test('v44 ordinary partial save is not an error but proposal still requires confirmed conditions',()=>{
 assert.match(u3,/入力済みのイベント条件を保存しました/);
 assert.match(u3,/dataset\.validate='false';e6PaintConditionIssues\(\[\]\)/);
 assert.doesNotMatch(u3,/if\(unsatisfied\.length\)showToast\('未確定の項目を確認してください。',true\)/);
 assert.match(u3,/if\(!storeState\(\)\)\{showToast\('イベント条件を保存できませんでした。',true\);return;\}/);
 assert.match(u3,/e3Conditions\(\)\?\.status!=='CONFIRMED'/);
});
test('v44 field art matches all nine assets from priority and updates on field change',()=>{
 assert.match(u3,/id="e6-field-art"/);
 assert.match(u3,/function e6UpdateFieldArt\(\)/);
 assert.match(u3,/meka-create\.github\.io\/pokesleep-priority\/assets\//);
 const nine=['field-greengrass.png','field-cyan.png','field-taupe.png','field-snowdrop.png','field-lapis.png','field-gold.png','field-amber-landscape.jpg','field-greengrass-ex.jpg','field-cyan-ex.jpg'];
 for(const image of nine)assert.ok(u3.includes(image),'missing '+image);
 assert.match(u3,/e6UpdateFieldArt\(\);render\(\)/);
 assert.match(u3,/frame\.hidden=!file/);
});
test('v44 mobile Chromium checks partial save, actions and art',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v44.py')],{cwd:root,stdio:'pipe',timeout:170000});
});

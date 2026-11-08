'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'previews');
const files=['U2_Prep_Local_Ingredients_20261108_v45_E6.html',
 'U3_Strategy_UI_20261108_v45_E6.html','U4_Box_Preview_20261108_v45_E6.html'];
const [u2,u3,u4]=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8'));
test('v45 three-screen footer matches illustrated fork and filled spoon; all navigation stays v45',()=>{
 for(const [i,s] of [u2,u3,u4].entries()){
  assert.match(s,/M3\.3 2\.8v5\.7c0 1\.8/,'fork');
  assert.match(s,/M17 2c-2\.25 0-3\.55 2\.3/,'filled spoon');
  assert.match(s,/fill="currentColor" stroke="none"/,'filled design');
  assert.doesNotMatch(s,/M3 3v7a4 4 0 0 0 8 0V3/,'old icon must not return');
  assert.match(s,/#e6-footer-plan\[data-reproposal="true"\]::after/,'reproposal badge');
  for(const f of files)assert.ok(s.includes(f),'wrong navigation '+i+' '+f);
  assert.doesNotMatch(s,/href="U[234]_[^"]*_v4[0-4]_E6\.html"/);
  const title=s.slice(s.indexOf('<title>'),s.indexOf('</title>'));
  assert.ok(title.includes('v45'),title);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
});
test('v45 event bonus is a single rounded list directly under the event selector',()=>{
 const iSource=u3.indexOf('id="event-source-select"');
 const iBonus=u3.indexOf('id="e6-bonus-panel"');
 const iDate=u3.indexOf('id="event-start"');
 const iField=u3.indexOf('id="event-field"');
 const iArt=u3.indexOf('id="e6-field-art"');
 assert.ok(iSource<iBonus&&iBonus<iDate&&iDate<iField&&iField<iArt);
 assert.equal((u3.match(/id="e6-bonus-panel"/g)||[]).length,1);
 assert.doesNotMatch(u3,/id="e6-event-heading"/);
 assert.match(u3,/.e6-bonus-panel\{background:#263c51;border:1px solid #55718a;border-radius:12px/);
 assert.match(u3,/list-style:disc/);
 assert.match(u3,/panel\.hidden=list\.children\.length===0/);
 assert.match(u3,/const li=document\.createElement\('li'\);li\.textContent=item/);
});
test('v45 field artwork has no overlay text and resets on event switch',()=>{
 assert.match(u3,/<div id="e6-field-art"[^>]*aria-hidden="true"><\/div>/);
 assert.doesNotMatch(u3,/e6-field-art-name|e6-field-art span/);
 assert.match(u3,/frame\.hidden=!file/);
 assert.match(u3,/updateEventConditionSummary\(\);\s*e6UpdateFieldArt\(\);\s*render\(\);/);
 assert.match(u3,/pokesleep-priority\/assets/);
 assert.match(u3,/入力済みのイベント条件を保存しました/);
 assert.match(u3,/const labels=\{PROPOSE:'作戦を提案',REPROPOSE:'作戦を再提案'/);
});
test('v45 Android-sized Chromium: bonus, field art and navigation',{timeout:180000},()=>{
 execFileSync('python3',[path.join(root,'tests','preview_browser_e6_v45.py')],{cwd:root,stdio:'pipe',timeout:170000});
});

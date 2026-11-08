'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const previews=path.join(root,'previews');
const names=['U2_Prep_Local_Ingredients_20261108_v43_E6.html',
 'U3_Strategy_UI_20261108_v43_E6.html','U4_Box_Preview_20261108_v43_E6.html'];
const [u2,u3,u4]=names.map(n=>fs.readFileSync(path.join(previews,n),'utf8'));
test('v43 fixed order and compact navigation is identical across 3 tabs',()=>{
 assert.match(u3,/const layout='unified'/);
 assert.match(u3,/const nodes=\[primary,week,sleep,conditions,actions,intro\]/);
 for(const [i,s] of [u2,u3,u4].entries()){
  assert.equal((s.match(/<nav id="e6-footer"/g)||[]).length,1);
  assert.match(s,/#e6-footer a\{[^}]*font-size:11px;font-weight:750/);
  assert.match(s,/#e6-footer \.e6-ico\{height:24px;width:24px/);
  assert.match(s,/#e6-footer-plan\[data-reproposal="true"\]::after/);
  assert.match(s,/<path d="M12\.2 8\.3c-2\.7-3\.5/,'apple icon');
  assert.match(s,/<path d="M12 2\.8 3\.5 7\.4/,'cube icon');
  assert.match(s,/aria-label="メインナビゲーション"/);
  for(const n of names)assert.ok(s.includes(n),'missing v43 footer link '+i+' / '+n);
  assert.doesNotMatch(s,/20261108_v4[012]_E6\.html/,'ancestor v40/v41/v42 link');
  const title=s.slice(s.indexOf('<title>'),s.indexOf('</title>'));
  assert.ok(title.includes('v43'),title);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
});
test('v43 validation never guesses invalid event start and highlights visible custom triggers',()=>{
 assert.doesNotMatch(u3,/\$\('#event-details'\)\.open=true;\s*\$\('#event-start'\)\.focus\(\)/);
 assert.match(u3,/const errors=e6DraftProblems\(\)/);
 assert.match(u3,/function e6PaintConditionIssues\(ids\)/);
 assert.match(u3,/const control=errors\[0\]==='event-save'\?\$\('#event-save'\):e6VisibleControl\(errors\[0\]\)/);
 assert.match(u3,/if\(!\$\('#event-field'\)\.value\)errors\.push\('event-field'\)/);
 assert.match(u3,/used\.has\(v\)/);
 assert.match(u3,/if\(needsEX\(\)[\s\S]*?errors\.push\('e6-ex-effect'\)/);
 assert.match(u3,/node\.setAttribute\('aria-invalid','true'\)/);
});
test('v43 badge derives from authoritative action, event locked stock and validated week',()=>{
 assert.match(u3,/footerPlan\.dataset\.reproposal=String\(action==='REPROPOSE'\)/);
 assert.match(u3,/version:1,weekStart:eventInfo\.start,eventId:e3Selected\.id/);
 for(const s of [u2,u3,u4]){
  assert.match(s,/function watchPacket\(\)/);
  assert.match(s,/function watchSelection\(\)/);
  assert.match(s,/w\.weekStart===selected\.week/);
  assert.match(s,/w\.eventId===selected\.eventId/);
  assert.match(s,/w\.conditionsReady===true&&w\.draftReady!==true&&eventStillActive/);
  assert.match(s,/pokesleepPlanWatch/);
  assert.match(s,/pokesleepStock/);
  assert.match(s,/refreshReproposalDot\(\)/);
 }
});
test('v43 accepts real browser phase, precise fields and cross-tab badge',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],
   {cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[path.resolve(__dirname,'preview_browser_e6_v43.py')],
   {cwd:root,stdio:'pipe',timeout:145000});
});

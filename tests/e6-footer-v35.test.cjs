'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=resolve(__dirname,'..'),prefix='previews/';
const files=['U2_Prep_Local_Ingredients_20261107_v35_E6.html',
             'U3_Strategy_UI_20261107_v35_E6.html',
             'U4_Box_Preview_20261107_v35_E6.html'];
test('E6 v35: 3 footer tabs, active state, local paths, JS syntax, no retired preview navigation',()=>{
 for(const [index,file] of files.entries()){
  const html=readFileSync(resolve(root,prefix,file),'utf8');
  assert.match(html,/<nav id="e6-footer"/);
  assert.equal((html.match(/<nav id="e6-footer"/g)||[]).length,1);
  const footer=html.match(/<nav id="e6-footer"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(footer,file+' missing footer markup');
  assert.equal((footer.match(/aria-current="page"/g)||[]).length,1);
  for(const name of files)assert.ok(html.includes(name),file+' cannot navigate to '+name);
  assert.doesNotMatch(html,/20261107_v34_E6\.html/);
  const scripts=[...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)];
  scripts.forEach(m=>new vm.Script(m[1]));
 }
 const plan=readFileSync(resolve(root,prefix+files[1]),'utf8');
 assert.match(plan,/card\.hidden=beforePhase\|\|/);
 assert.match(plan,/else if\(stage==='preparation'\)conditions\.open=true;/);
 assert.match(plan,/const showIntro=stage==='ended'&&!activePlan;/);
 assert.match(plan,/const activePlan=hasApplied&&appliedEventStart===eventInfo\.start&&phase!=='before';/);
 const prep=readFileSync(resolve(root,prefix+files[0]),'utf8');
 assert.match(prep,/\.u2-transfer,#phase-intro-u2,#e3-update-stock\{display:none!important\}/);
});
test('E6 v35: footer UX browser contract',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e6_v35_footer.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

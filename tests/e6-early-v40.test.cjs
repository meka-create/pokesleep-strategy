'use strict';
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.resolve(root,'previews');
const f=['U2_Prep_Local_Ingredients_20261107_v40_E6.html','U3_Strategy_UI_20261107_v40_E6.html','U4_Box_Preview_20261107_v40_E6.html'];
test('E6 v40: full meal/all option, conditional weekly berry & EX, before-phase proposal without date unlock',{timeout:20000},()=>{
 for(const name of f){
  const s=fs.readFileSync(path.join(dir,name),'utf8');
  for(const dest of f)assert.ok(s.includes(dest),name+' missing '+dest);
  assert.doesNotMatch(s,/_v39_E6\.html/);
  [...s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].forEach(m=>new vm.Script(m[1]));
 }
 const s=fs.readFileSync(path.join(dir,f[1]),'utf8');
 assert.match(s,/<option value="all">すべて<\/option>/);
 assert.match(s,/const BERRY_TYPES=/);
 assert.match(s,/function canPlanNow\(\)/);
 assert.match(s,/function conditionBlocksForPlanning\(\)/);
 assert.match(s,/const earlyReady=state\.phase==='BEFORE'&&canPlanNow\(\)/);
 assert.match(s,/function planningWindow\(\)\{return eventPhase\(\)!=='ended';\}/);
 assert.match(s,/eventInfo\.berrySetup/);
 assert.match(s,/id="e6-ex-effect"/);
 assert.match(s,/if\(source\.foodAll\)/);
});
test('E6 v40: real browser early-planning & all-food scenario',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[path.resolve(__dirname,'preview_browser_e6_v40_early.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

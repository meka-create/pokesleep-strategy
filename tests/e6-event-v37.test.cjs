'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {execFileSync}=require('node:child_process');
const {Script}=require('node:vm');
const assert=require('node:assert/strict');
const root=resolve(__dirname,'..'),previews=resolve(root,'previews');
const paths=[
 'U2_Prep_Local_Ingredients_20261107_v37_E6.html',
 'U3_Strategy_UI_20261107_v37_E6.html',
 'U4_Box_Preview_20261107_v37_E6.html'];
test('E6 v37: no stale links, no dead demo fetch UI, camp default ON, prep non-collapsible and readable bonus',()=>{
 for(const name of paths){
  const html=readFileSync(resolve(previews,name),'utf8');
  for(const expected of paths)assert.ok(html.includes(expected),name+' misses '+expected);
  assert.doesNotMatch(html,/20261107_v36_E6\.html/);
  const scripts=[...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)];
  scripts.forEach(m=>new Script(m[1]));
  assert.match(html,/<nav id="e6-footer"/);
  assert.doesNotMatch(html,/data-e6-page/);
 }
 const plan=readFileSync(resolve(previews,paths[1]),'utf8');
 for(const retired of ['event-source-fetch','event-source-apply','event-source-select','pendingEventSource','manualSourceRequested','EVENT_FIXTURES'])
  assert.ok(!plan.includes(retired),'retired '+retired+' should not survive');
 assert.match(plan,/camp:true/);
 assert.match(plan,/id="event-camp" role="switch" aria-checked="true"/);
 assert.match(plan,/id="e6-bonus-value"/);
 assert.match(plan,/id="e6-stock-message"/);
 assert.match(plan,/main\[data-phase-stage="preparation"\] #event-details>summary\{display:none!important\}/);
 assert.match(plan,/function updateEventConditionSummary\(\)/);
});
test('E6 v37: Chrome prep conditions and legacy data regression',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{cwd:root,stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e6_v37_event_conditions.py')],{cwd:root,stdio:'pipe',timeout:120000});
});

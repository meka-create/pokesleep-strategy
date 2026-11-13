'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const u3=fs.readFileSync(path.join(base,'U3_Strategy_UI_20261109_v50_E7.html'),'utf8');
test('E7 v65 saved-event calendar is below the event conditions with a stable 3-tab order',()=>{
 const event=u3.indexOf('id="event-details"'),cal=u3.indexOf('id="e7-event-calendar"');
 assert(event>0&&cal>event&&cal<u3.indexOf('class="card sleep-settings"'));
 assert.match(u3,/const nodes=\[primary,week,sleep,conditions,calendar,actions,intro\]/);
 for(const id of ['e7-cal-month','e7-cal-prev','e7-cal-next','e7-cal-today','e7-cal-weeks'])
  assert.match(u3,new RegExp('id="'+id+'"'));
 assert.match(u3,/#e7-cal-board\{/);
 assert.ok(u3.includes('min-height:36px;max-height:36px'));
 assert.ok(u3.includes('grid-template-rows:39px repeat(var(--event-rows),40px)'));
});
test('E7 v65 calendars index original confirmed ledgers + same-event plans; no secondary store',()=>{
 assert.match(u3,/const E7_CAL_KEY=\/\^pokesleep-strategy-u3-e3-v1/);
 assert.match(u3,/E1\.validateConditionLedger\(JSON\.parse\(raw\)\)/);
 assert.match(u3,/validStoredState\(plan,selection\.weekStart,id\)/);
 assert.match(u3,/!ledger\.confirmed/);
 assert.match(u3,/function e7OpenSavedEvent\(selection\)/);
 assert.match(u3,/if\(dirty&&\!\(await PokeUI\.confirm\(/);
 assert.match(u3,/if\(e3Selected&&!storeState\(\)\)/);
 assert.match(u3,/window\.__pokesleepE7ResetRevoked=true/);
 assert.match(u3,/localStorage\.setItem\(E3_SELECTED_KEY,JSON\.stringify\(selection\)\)/);
 assert.doesNotMatch(u3,/pokesleep-strategy-e7-v65:calendar-store/);
});
test('E7 v65 JS compiles and versioned offline cache tracks the new HTML',()=>{
 assert.match(fs.readFileSync(path.join(base,'index.html'),'utf8'),/<title>ポケスリ作戦室 E7 v78<\/title>/);
 const scripts=[...u3.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)];
 for(const match of scripts)assert.doesNotThrow(()=>new vm.Script(match[1]));
 const sw=fs.readFileSync(path.join(base,'e7-sw-v50.js'),'utf8');
 assert.match(sw,/pokesleep-strategy-e7-v80-square-prep-detail-20261113/);
 assert.match(sw,/U3_Strategy_UI_20261109_v50_E7\.html/);
});
test('E7 v65 Chromium: month crossing, safe recall, saved plan, dirty cancellation, mobile fit',
 {timeout:180000},()=>{
 require('node:child_process').execFileSync('python3',
 [path.resolve(__dirname,'preview_browser_e7_v65.py')],
 {cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:175000});
});

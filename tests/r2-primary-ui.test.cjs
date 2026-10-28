const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const template=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');

test('R2: three main destinations plus a separate compact settings control',()=>{
 const tabs=[...template.matchAll(/<button\b[^>]*class="[^"]*\btab\b[^"]*"[^>]*data-tab="([^"]+)"/g)]
  .map(m=>m[1]);
 assert.deepEqual(tabs,['strategy','box','prep','settings']);
 assert.match(template,/data-tab="settings"[^>]*aria-label="設定・バックアップ"/);
 assert.doesNotMatch(template,/<button\b[^>]*data-tab="(?:event|simulate)"/);
 assert.match(app,/selected==='strategy'\?!\['panel-event','panel-simulate'\]/);
});

test('R2: the weekly proposal is visible first and long legacy tools are hidden or collapsed',()=>{
 assert.match(template,/<details\b[^>]*id="weekPlanner" open>/);
 assert.match(template,/<details\b[^>]*id="eventSettings">/);
 assert.match(template,/<div\b[^>]*class="card sim-setup step3-candidates" hidden>/);
 assert.match(template,/<details\b[^>]*class="card legacy-setup">/);
 assert.match(template,/<details\b[^>]*class="card advanced-settings">/);
 assert.match(template,/<details\b[^>]*class="card prep-forecast-details">/);
 assert.ok(template.indexOf('id="weekSearch"')<template.indexOf('id="weekOverview"'));
 assert.ok(template.indexOf('id="weekProposal"')<template.indexOf('id="weekOverview"'));
 assert.equal((template.match(/<details\b[^>]*hidden>/g)||[]).length>=3,true);
 assert.doesNotMatch(template,/STEP 4 開発中|STEP 3 機能受入済み/);
});

test('R2: all stateful controls remain in the DOM once for legacy restoration and engine safety',()=>{
 for(const id of ['eventMap','eventBerries','eventEffects','eventSummary','food2','camp2',
  'csvFile','backupFile','downloadBackup','weekAutoSleep','weekSearch','weekApplyProposal',
  'weekFillDays','weekFillSleep','weekSaveSlot','weekFiveEditors','weekOverview',
  'simRosters','simTap','simIngredientFields','simMagnetFields','runSim','simResult',
  'obsMonday','downloadObservation','shareObservationFile','prepCalculate']){
  const count=[...template.matchAll(new RegExp('id="'+id+'"','g'))].length;
  assert.equal(count,1,id+' must remain wired exactly once');
 }
 assert.match(template,/<input id="weekAutoSleep" type="checkbox"><\/label>/);
});

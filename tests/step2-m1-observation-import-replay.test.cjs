'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const sim=ctx.globalThis.PokeSimulator,obs=ctx.globalThis.PokeObservation;
const {compareSingleWeek}=require('../scripts/step2-m1-observation-compare.cjs');
const ids=['a','b','c','d','e'];
const pokemon=id=>({id,pokemon:'ライチュウ',nickname:id,level:1,skillLevel:1,
 ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],
 nature:'まじめ',sleepHours:0,shiny:false});
const input=()=>({box:ids.map(pokemon),teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
 options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:150,potSize:57,
 sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
 recipeId:'',initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'none'}});
const make=()=>{
 const x=input(),prediction=sim.simulate(x);
 const cap=obs.captureSimulation(x,prediction,'0.2.35','2026-10-18T13:00:00.000Z');
 return obs.makeReport(cap,{mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
 confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,false]))});
};
test('imported observation replay agrees with existing CLI while remaining uncalibrated',()=>{
 const report=make();
 const existing=compareSingleWeek(report);
 const browser=obs.reviewImportedReport(report,sim.simulate);
 assert.equal(browser.week.mondayDate,'2026-10-19');
 assert.equal(browser.week.field,'ゴールド旧発電所');
 assert.equal(browser.currentModel.total,existing.model.total);
 assert.equal(browser.currentModel.berryAndStrengthSkill,existing.model.berryAndStrengthSkill);
 assert.equal(browser.currentModel.cooking,existing.model.cooking);
 assert.equal(browser.signedDeltaObservedMinusCurrent.total,existing.signedDeltaObservedMinusModel.total);
 assert.equal(browser.signedDeltaObservedMinusCurrent.berryAndStrengthSkill,
  existing.signedDeltaObservedMinusModel.berryAndStrengthSkill);
 assert.equal(browser.signedDeltaObservedMinusCurrent.cooking,
  existing.signedDeltaObservedMinusModel.cooking);
 assert.equal(browser.captureComparison.matchesCurrentModel,true);
 assert.equal(browser.weeklySummaryBucketsReconcile,true);
 assert.equal(browser.unconfirmedConditions.length,5);
 assert.equal(browser.status,existing.status);
 assert.equal(browser.accuracyGate,'HOLD');
 assert.equal(browser.rankOrAccuracyValidated,false);
 assert.equal(browser.screenshotReviewed,false);
 assert.equal(browser.sourceIsUserSupplied,true);
});
test('JSON replay never overwrites current box or observation input and catches drift',()=>{
 const report=make(),serialized=JSON.stringify(report);
 const changed=JSON.parse(serialized);
 changed.capture.modelAtCapture.total+=250;
 changed.capture.modelAtCapture.berries+=250;
 const v=obs.reviewImportedReport(changed,sim.simulate);
 const cli=compareSingleWeek(changed);
 assert.equal(v.captureComparison.matchesCurrentModel,false);
 assert.equal(v.status,'CONFOUNDED_OBSERVATION');
 assert.equal(cli.status,'CONFOUNDED_OBSERVATION');
 assert.ok(v.confounders.some(x=>x.includes('試算値と最新の計算器')));
 assert.equal(JSON.stringify(report),serialized);
});
test('replay rejects malformed Monday, unsupported source, forged verified flag and non-numeric energy',()=>{
 const report=make();
 const altered=(edit)=>{const c=JSON.parse(JSON.stringify(report));edit(c);return c;};
 assert.throws(()=>obs.reviewImportedReport(altered(r=>r.week.mondayDate='2026-10-18'),sim.simulate),/月曜日/);
 assert.throws(()=>obs.reviewImportedReport(altered(r=>r.week.field='シアンの砂浜'),sim.simulate),/フィールド/);
 assert.throws(()=>obs.reviewImportedReport(altered(r=>r.provenance.source='inferred'),sim.simulate),/出典/);
 assert.throws(()=>obs.reviewImportedReport(altered(r=>r.provenance.noUnmodeledEvents='false'),sim.simulate),/真偽値/);
 assert.throws(()=>obs.reviewImportedReport(altered(r=>r.observed.total='100'),sim.simulate),/整数/);
 assert.throws(()=>obs.reviewImportedReport(altered(r=>delete r.capture),sim.simulate),/v0\.2\.35/);
 assert.throws(()=>obs.reviewImportedReport(altered(r=>r.capture.modelAtCapture.total=-1),sim.simulate),/不正/);
});
test('confounded summary values are displayed without promoting accuracy status',()=>{
 const r=make();
 r.observed.total+=3;
 const view=obs.reviewImportedReport(r,sim.simulate);
 assert.equal(view.observed.unattributed,3);
 assert.equal(view.weeklySummaryBucketsReconcile,false);
 assert.equal(view.status,'CONFOUNDED_OBSERVATION');
 assert.equal(view.accuracyGate,'HOLD');
 assert.equal(view.rankOrAccuracyValidated,false);
});


test('replay and CLI reject duplicate IDs, impossible teams and out-of-range saved options',()=>{
 const edits=[
  r=>{r.input.box[1].id=r.input.box[0].id;},
  r=>{r.input.teams.morning[1]=r.input.teams.morning[0];},
  r=>{r.input.teams.noon.push('a');},
  r=>{r.input.options.tapMinutes=0;},
  r=>{r.input.options.fieldBonus=250;},
  r=>{r.input.options.initialIngredients.apple=-3;},
  r=>{r.input.options.initialIngredients.apple=0.5;},
  r=>{r.input.box[0].level=100000;},
  r=>{r.input.options.map='a'.repeat(81);r.week.field=r.input.options.map;}
 ];
 for(const edit of edits){
  const report=make();edit(report);
  assert.throws(()=>obs.reviewImportedReport(report,sim.simulate),/試算入力が不正/);
  assert.throws(()=>compareSingleWeek(report),/試算入力が不正/);
 }
});
test('replay and CLI reject forged evidence metadata',()=>{
 const edits=[
  r=>{r.capture.screenshotReviewedByApp=true;},
  r=>{r.capture.recordingMethod='automatically_verified_game_screen';},
  r=>{r.capture.capturedAt='not-a-date';},
  r=>{r.capture.appVersion='unknown';}
 ];
 for(const edit of edits){
  const report=make();edit(report);
  assert.throws(()=>obs.reviewImportedReport(report,sim.simulate),/メタデータ/);
  assert.throws(()=>compareSingleWeek(report),/メタデータ/);
 }
});

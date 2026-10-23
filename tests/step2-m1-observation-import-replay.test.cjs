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


test('multiple saved observation reports flag duplicate Mondays without false calibration',()=>{
 const a=make(),b=make();
 const result=obs.reviewImportedReports([a,b],sim.simulate);
 assert.equal(result.count,2);
 assert.equal(result.sameSavedInputs,true);
 assert.deepEqual(Array.from(result.duplicateMondays),['2026-10-19']);
 assert.equal(result.conflictingMondays.length,0);
 assert.equal(result.accuracyGate,'HOLD');
 assert.equal(result.rankOrAccuracyValidated,false);
 assert.equal(result.status,'UNVERIFIED_MULTI_WEEK_RECORDS');
 b.observed.total=101;
 const conflicting=obs.reviewImportedReports([a,b],sim.simulate);
 assert.deepEqual(Array.from(conflicting.conflictingMondays),['2026-10-19']);
});
test('different weeks and changed saved options do not form one comparable condition',()=>{
 const a=make(),b=make();
 b.week.mondayDate='2026-10-26';
 b.input.options.fieldBonus=25;
 const result=obs.reviewImportedReports([a,b],sim.simulate);
 assert.equal(result.duplicateMondays.length,0);
 assert.equal(result.sameSavedInputs,false);
 assert.equal(result.items[1].captureComparison.matchesCurrentModel,false);
 assert.equal(result.items[1].accuracyGate,'HOLD');
});
test('invalid batch input rejects whole comparison instead of returning partial evidence',()=>{
 const a=make(),b=make();
 b.input.options.tapMinutes=0;
 assert.throws(()=>obs.reviewImportedReports([a,b],sim.simulate),/試算入力が不正/);
 assert.throws(()=>obs.reviewImportedReports([],sim.simulate),/1〜4/);
 assert.throws(()=>obs.reviewImportedReports(Array.from({length:5},()=>make()),sim.simulate),/1〜4/);
});


test('M1 multiweek comparison ignores arbitrary JSON object-key order but preserves array meaning',()=>{
 const a=make(),b=make();
 b.week.mondayDate='2026-10-26';
 const reorder=value=>Array.isArray(value)?value.map(reorder):
  value&&typeof value==='object'?
   Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reorder(v)])):value;
 b.input=reorder(b.input);
 assert.notEqual(JSON.stringify(a.input),JSON.stringify(b.input),
  'test fixture must actually reorder serialized input keys');
 const snapshot=JSON.stringify(b);
 const batch=obs.reviewImportedReports([a,b],sim.simulate);
 assert.equal(batch.sameSavedInputs,true);
 assert.deepEqual(Array.from(batch.duplicateMondays),[]);
 assert.deepEqual(Array.from(batch.conflictingInputsMondays),[]);
 assert.equal(JSON.stringify(b),snapshot,'review may not rewrite user observation JSON');
 assert.equal(batch.accuracyGate,'HOLD');
});
test('M1 same game-week observations with identical totals but different recorded lineup are flagged',()=>{
 const a=make(),b=make();
 b.input.teams.morning=[...b.input.teams.morning].reverse();
 const result=obs.reviewImportedReports([a,b],sim.simulate);
 assert.deepEqual(Array.from(result.duplicateMondays),['2026-10-19']);
 assert.deepEqual(Array.from(result.conflictingMondays),[]);
 assert.deepEqual(Array.from(result.conflictingInputsMondays),['2026-10-19']);
 assert.equal(result.sameSavedInputs,false);
 assert.equal(result.rankOrAccuracyValidated,false);
 assert.equal(result.accuracyGate,'HOLD');
});
test('M1 same-week duplicate with reordered properties and different capture timestamp is not a condition contradiction',()=>{
 const a=make(),b=make();
 b.capture.capturedAt='2026-10-19T10:00:00.000Z';
 b.provenance.noUntrackedItems=true;
 const reversed=Object.fromEntries(Object.entries(b.input).reverse());
 b.input=reversed;
 const result=obs.reviewImportedReports([a,b],sim.simulate);
 assert.deepEqual(Array.from(result.duplicateMondays),['2026-10-19']);
 assert.deepEqual(Array.from(result.conflictingMondays),[]);
 assert.deepEqual(Array.from(result.conflictingInputsMondays),[]);
 assert.equal(result.sameSavedInputs,true);
 assert.equal(result.accuracyGate,'HOLD');
});
test('M1 three records detect same-week condition mismatch without spurious weekly totals mismatch',()=>{
 const a=make(),b=make(),c=make();
 c.input.options.tapMinutes=180;
 const result=obs.reviewImportedReports([a,b,c],sim.simulate);
 assert.deepEqual(Array.from(result.duplicateMondays),['2026-10-19']);
 assert.deepEqual(Array.from(result.conflictingMondays),[]);
 assert.deepEqual(Array.from(result.conflictingInputsMondays),['2026-10-19']);
 assert.equal(result.status,'UNVERIFIED_MULTI_WEEK_RECORDS');
});

test('M1 actual-game comparisons fail closed for known unmodeled scope even when all checkboxes are true',()=>{
 const cases=[
  {name:'EX field',change:r=>{r.input.options.map='シアンの砂浜EX';r.week.field='シアンの砂浜EX';},needle:'EXフィールド'},
  {name:'random food category',change:r=>{r.input.options.foodMode='random';},needle:'ランダム料理カテゴリ'},
  {name:'event memo not calculated',change:r=>{r.input.options.eventEffects='イベント補正あり';},needle:'イベント補正メモ'},
  {name:'unknown selected species',change:r=>{r.input.box[0].pokemon='未実装の種族';},needle:'マスター未登録'},
  {name:'two simultaneous healers',change:r=>{r.input.box[0].pokemon='プクリン';r.input.box[1].pokemon='サーナイト';},needle:'2匹以上同時編成'}
 ];
 for(const {name,change,needle} of cases){
  const report=make();
  for(const flag of obs.flags)report.provenance[flag]=true;
  change(report);
  const ui=obs.reviewImportedReport(report,sim.simulate),cli=compareSingleWeek(report);
  const local=obs.preview(report);
  assert.equal(ui.status,'CONFOUNDED_OBSERVATION',name);
  assert.equal(cli.status,ui.status,name);
  assert.equal(local.status,'CONFOUNDED_OBSERVATION',name);
  assert.ok(ui.modelLimitations.some(x=>x.includes(needle)),name+' browser limitation');
  assert.ok(cli.modelLimitations.some(x=>x.includes(needle)),name+' CLI limitation');
  assert.ok(local.modelLimitations.some(x=>x.includes(needle)),name+' preview limitation');
  assert.equal(ui.accuracyGate,'HOLD');
  assert.equal(cli.rankOrAccuracyValidated,false);
 }
});
test('normal five-berry controlled input keeps explicit scope triage empty',()=>{
 const report=make();
 report.observed.cooking=0;report.observed.total=report.observed.berryAndStrengthSkill;
 for(const flag of obs.flags)report.provenance[flag]=true;
 assert.deepEqual(Array.from(obs.knownModelLimitations(report.input)),[]);
 assert.equal(obs.preview(report).status,'UNCALIBRATED_OBSERVATION');
 assert.equal(obs.reviewImportedReport(report,sim.simulate).accuracyGate,'HOLD');
});


test('M1 active unlocked ingredient mismatch is an unmodeled-input condition, not a game deviation',()=>{
 const r=make();
 for(const flag of obs.flags)r.provenance[flag]=true;
 r.input.box[0].ingredients[0]='ゲームに存在しない食材';
 const prediction=sim.simulate(r.input);
 assert.ok(prediction.warnings.some(x=>x.includes('食材設定を種族マスターと照合できない')));
 r.capture.modelAtCapture=Object.fromEntries(['total','berries','skills','cooking'].map(k=>[k,prediction[k]]));
 const browser=obs.reviewImportedReport(r,sim.simulate),cli=compareSingleWeek(r),preview=obs.preview(r);
 assert.equal(browser.captureComparison.matchesCurrentModel,true,'model drift must not be needed to reveal missing ingredients');
 assert.equal(browser.unconfirmedConditions.length,0);
 assert.equal(browser.confounders.length,0,'warning is a model limitation, distinct from self-reported confirmation flags');
 for(const result of [browser,cli,preview]){
  assert.equal(result.status,'CONFOUNDED_OBSERVATION');
  assert.ok(result.modelLimitations.some(x=>x.includes('解放済み食材')&&x.includes('1枠')));
  assert.equal(result.accuracyGate,'HOLD');
  assert.equal(result.rankOrAccuracyValidated,false);
 }
});
test('M1 ingredient check ignores off-roster and still-locked slots, but catches unlocked slot 2',()=>{
 const r=make();
 r.observed.cooking=0;r.observed.total=r.observed.berryAndStrengthSkill;
 for(const flag of obs.flags)r.provenance[flag]=true;
 r.input.box[0].ingredients[1]='不明な食材'; // level 1: second slot locked
 r.input.box.push({...pokemon('off'),ingredients:['不明な食材','','']});
 assert.equal(obs.knownModelLimitations(r.input).some(x=>x.includes('解放済み食材')),false);
 assert.equal(obs.preview(r).status,'UNCALIBRATED_OBSERVATION');
 r.input.box[0].level=30; // second slot is now available
 assert.ok(obs.knownModelLimitations(r.input).some(x=>x.includes('解放済み食材')));
 assert.equal(obs.preview(r).status,'CONFOUNDED_OBSERVATION');
});
test('M1 model-limitations and actual simulator treat the Berry Juice E4 pair the same',()=>{
 const r=make();
 for(const flag of obs.flags)r.provenance[flag]=true;
 r.input.box[0].pokemon='プクリン';
 r.input.box[1].pokemon='ツボツボ';
 // Construct canonical unlocked ingredients from each species instead of
 // interpreting ingredient mismatch as an E4 comparison issue.
 for(const p of r.input.box.slice(0,2)){
  const sp=ctx.globalThis.PokeMaster.species.find(x=>x.name===p.pokemon);
  const row=(sp.mythIng||sp.ings).find(x=>x&&x.c1>0);
  p.ingredients[0]=ctx.globalThis.PokeMaster.ingredients[row.name];
 }
 const predicted=sim.simulate(r.input);
 assert.ok(predicted.warnings.some(x=>x.includes('優劣を確定しないでください')));
 const limitations=obs.knownModelLimitations(r.input,predicted);
 assert.ok(limitations.some(x=>x.includes('R02型')));
 assert.equal(limitations.some(x=>x.includes('解放済み食材')),false);
 assert.equal(obs.preview(r).status,'CONFOUNDED_OBSERVATION');
});


test('M1 compares four active partial-skill strengths as confounded, in browser, CLI and save preview',()=>{
 const cases=[
  ['Berry Zone (Psystrike)','マゴのみゾーン'],
  ['Charge Energy S (Moonlight)','追加チーム回復'],
  ['Energizing Cheer S (Nuzzle)','スキル発動可能ボーナス'],
  ['Ingredient Draw S (Hyper Cutter)','条件付き追加食材']
 ];
 const master=ctx.globalThis.PokeMaster;
 for(const [skill,reason] of cases){
  const sp=master.species.find(x=>x.skill===skill);
  assert.ok(sp,'master species must exist: '+skill);
  assert.equal(sim.unmodeledStrengthSkillEffect(skill)?.includes(reason),true);
  const r=make();for(const flag of obs.flags)r.provenance[flag]=true;
  r.input.box[0].pokemon=sp.name;
  const slot=(sp.mythIng||sp.ings).find(x=>x&&x.c1>0);
  r.input.box[0].ingredients[0]=master.ingredients[slot.name];
  const actualModel=sim.simulate(r.input);
  r.capture.modelAtCapture=Object.fromEntries(
   ['total','berries','skills','cooking'].map(k=>[k,actualModel[k]]));
  const imported=obs.reviewImportedReport(r,sim.simulate),cli=compareSingleWeek(r),preview=obs.preview(r);
  assert.equal(imported.captureComparison.matchesCurrentModel,true,skill);
  assert.equal(imported.unconfirmedConditions.length,0,skill);
  assert.equal(imported.confounders.length,0,skill);
  for(const review of [imported,cli,preview]){
   assert.equal(review.status,'CONFOUNDED_OBSERVATION',skill);
   assert.ok(review.modelLimitations.some(x=>x.includes(sp.name)&&x.includes(reason)),skill);
   assert.equal(review.accuracyGate,'HOLD',skill);
   assert.equal(review.rankOrAccuracyValidated,false,skill);
  }
 }
});
test('M1 does not count excluded dream shard-only skills or inactive partial effects as strength omissions',()=>{
 const master=ctx.globalThis.PokeMaster;
 assert.equal(sim.unmodeledStrengthSkillEffect('Dream Shard Magnet S'),null);
 assert.equal(sim.unmodeledStrengthSkillEffect('Energy for Everyone S (Berry Juice)'),null);
 const r=make();r.observed.cooking=0;r.observed.total=r.observed.berryAndStrengthSkill;
 for(const flag of obs.flags)r.provenance[flag]=true;
 const partial=master.species.find(x=>x.skill==='Berry Zone (Psystrike)');
 assert.ok(partial);
 r.input.box.push({...pokemon('outside'),pokemon:partial.name});
 assert.equal(obs.knownModelLimitations(r.input).some(x=>x.includes('未計上の追加効果')),false);
 assert.equal(obs.preview(r).status,'UNCALIBRATED_OBSERVATION');
});


test('M1 original save preview, browser replay, and CLI all flag uncertain recipe-source meals',()=>{
 const x=input();
 x.options.recipeId='apple_curry';
 x.options.initialIngredients={};
 const pred=sim.simulate(x);
 assert.ok(pred.estimatedMeals>0,'the test must actually produce a modeled uncertain dish');
 const cap=obs.captureSimulation(x,pred,'0.2.49','2026-10-18T13:00:00.000Z');
 const form={mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
  confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))};
 const report=obs.makeReport(cap,form);
 assert.ok(report.capture.modelDiagnosticsAtCapture.estimatedMeals>0);
 const entries=[obs.preview(report),obs.reviewImportedReport(report,sim.simulate),compareSingleWeek(report)];
 for(const v of entries){
  assert.equal(v.status,'CONFOUNDED_OBSERVATION');
  assert.equal(v.accuracyGate,'HOLD');
  assert.ok(v.modelLimitations.some(line=>line.includes('不確実な食材生産')&&line.includes(pred.estimatedMeals+'食')));
 }
});
test('M1 original save preview, browser replay, CLI share E4 cap/timer diagnostics from actual week',()=>{
 const x=input();
 const species=ctx.globalThis.PokeMaster.species.find(sp=>sp.name==='プクリン');
 const first=(species.mythIng||species.ings).find(row=>row&&row.c1>0);
 const ingredient=ctx.globalThis.PokeMaster.ingredients[first.name];
 x.box.forEach(p=>{p.pokemon='プクリン';p.ingredients=[ingredient,'',''];p.skillLevel=6;});
 x.options.initialEnergy=145;
 const pred=sim.simulate(x);
 assert.ok(pred.healingCapNonlinearEvents>0||pred.healingTimerCorrelationEvents>0,
  'test should exercise nonlinear E4 production diagnostics');
 const cap=obs.captureSimulation(x,pred,'0.2.49','2026-10-18T13:00:00.000Z');
 const r=obs.makeReport(cap,{mondayDate:'2026-10-19',total:'100',
  berryAndStrengthSkill:'60',cooking:'40',confirmedSummary:true,
  ...Object.fromEntries(obs.flags.map(k=>[k,true]))});
 for(const view of [obs.preview(r),obs.reviewImportedReport(r,sim.simulate),compareSingleWeek(r)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(x=>x.includes('げんき回復')||x.includes('げんきオールS系')));
  assert.equal(view.accuracyGate,'HOLD');
 }
});
test('M1 legacy and changed diagnostics fail closed even when recorded energy totals are identical',()=>{
 const original=make();
 for(const key of obs.flags)original.provenance[key]=true;
 const saved=JSON.parse(JSON.stringify(original));
 delete saved.capture.modelDiagnosticsAtCapture;
 for(const view of [obs.preview(saved),obs.reviewImportedReport(saved,sim.simulate),compareSingleWeek(saved)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(x=>x.includes('診断情報が保存されていません')));
 }
 const drift=JSON.parse(JSON.stringify(original));
 drift.capture.modelDiagnosticsAtCapture.healingTimerCorrelationEvents+=1;
 const browser=obs.reviewImportedReport(drift,sim.simulate),cli=compareSingleWeek(drift);
 assert.equal(browser.captureComparison.matchesCurrentModel,true);
 for(const view of [browser,cli]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(x=>x.includes('診断カウンターが変わっています')));
  assert.equal(view.rankOrAccuracyValidated,false);
 }
});


test('M1 Heal Pulse expected two-target model remains observationally confounded, consistently in preview/browser/CLI',()=>{
 const master=ctx.globalThis.PokeMaster,sp=master.species.find(x=>x.skill==='Energizing Cheer S (Heal Pulse)');
 assert.ok(sp);
 const r=make();
 for(const flag of obs.flags)r.provenance[flag]=true;
 r.input.box[0].pokemon=sp.name;
 const first=(sp.mythIng||sp.ings).find(x=>x.c1>0);
 assert.ok(first);
 r.input.box[0].ingredients[0]=master.ingredients[first.name];
 const predicted=sim.simulate(r.input);
 r.capture.modelAtCapture=Object.fromEntries(['total','berries','cooking','skills'].map(k=>[k,predicted[k]]));
 r.capture.modelDiagnosticsAtCapture=obs.modelDiagnostics(predicted);
 const browser=obs.reviewImportedReport(r,sim.simulate),cli=compareSingleWeek(r),preview=obs.preview(r);
 assert.equal(browser.captureComparison.matchesCurrentModel,true);
 assert.equal(browser.confounders.length,0);
 for(const view of [browser,cli,preview]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.equal(view.accuracyGate,'HOLD');
  assert.equal(view.rankOrAccuracyValidated,false);
  assert.ok(view.modelLimitations.some(x=>x.includes('いやしのはどう')&&x.includes('対象2匹')));
 }
 const outside=make();
 outside.input.box.push({...pokemon('off'),pokemon:sp.name,
  ingredients:[master.ingredients[first.name],'','']});
 assert.equal(obs.knownModelLimitations(outside.input).some(x=>x.includes('いやしのはどう')),false,
  'off-roster Heal Pulse cannot confound the observation');
});


test('M1 concurrent Cresselia Lunar Blessing and regular E4 is classed as unverified rank risk by all intake paths',()=>{
 const master=ctx.globalThis.PokeMaster,r=make();
 for(const flag of obs.flags)r.provenance[flag]=true;
 const choices=[
  master.species.find(x=>x.skill==='Energy for Everyone S (Lunar Blessing)'),
  master.species.find(x=>x.name==='プクリン')
 ];
 for(let i=0;i<2;i++){
  const sp=choices[i];assert.ok(sp);
  const row=(sp.mythIng||sp.ings).find(x=>x&&x.c1>0);
  assert.ok(row);
  r.input.box[i].pokemon=sp.name;
  r.input.box[i].ingredients[0]=master.ingredients[row.name];
 }
 const prediction=sim.simulate(r.input);
 r.capture.modelAtCapture=Object.fromEntries(['total','berries','skills','cooking'].map(k=>[k,prediction[k]]));
 r.capture.modelDiagnosticsAtCapture=obs.modelDiagnostics(prediction);
 assert.ok(prediction.warnings.some(x=>x.includes('優劣を確定しないでください')));
 for(const view of [obs.preview(r),obs.reviewImportedReport(r,sim.simulate),compareSingleWeek(r)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(x=>x.includes('R02型')));
  assert.equal(view.accuracyGate,'HOLD');
  assert.equal(view.rankOrAccuracyValidated,false);
 }
 const sleepOnly=JSON.parse(JSON.stringify(r));
 // Both healers are only together while sleeping; the daytime rosters each have at most one.
 sleepOnly.input.box.push({...pokemon('g'),ingredients:['とくせんリンゴ','','']});
 sleepOnly.input.teams.morning=['a','c','d','e','g'];
 sleepOnly.input.teams.noon=['a','c','d','e','g'];
 sleepOnly.input.teams.evening=['a','c','d','e','g'];
 assert.equal(obs.knownModelLimitations(sleepOnly.input).some(x=>x.includes('R02型')),false);
});

test('M1 optional filler uncertainty from an actual simulated week is held in preview, browser replay, CLI',()=>{
 const x=input();
 x.box.forEach(p=>{p.level=30;p.ingredients=['とくせんリンゴ','あったかジンジャー',''];});
 x.options.recipeId='apple_curry';x.options.extraMode='fill';x.options.potSize=8;
 x.options.initialIngredients={apple:147,ginger:10};
 const prediction=sim.simulate(x);
 assert.equal(prediction.estimatedMeals,0,'all required apples should come from certain input stock');
 assert.ok(prediction.expectedSourceMeals>0,'some extra ingredients must rely on expected production');
 const r=obs.makeReport(obs.captureSimulation(x,prediction,'0.2.52','2026-10-18T13:00:00.000Z'),
  {mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',
   cooking:'40',confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))});
 assert.equal(r.capture.modelDiagnosticsAtCapture.expectedSourceMeals,prediction.expectedSourceMeals);
 for(const view of [obs.preview(r),obs.reviewImportedReport(r,sim.simulate),compareSingleWeek(r)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(s=>s.includes('追加食材')&&s.includes('不確実な食材')));
  assert.equal(view.accuracyGate,'HOLD');
 }
});

test('M1 missing discovered-ingredient pool holds only rostered magnet-type skills in preview/browser/CLI',()=>{
 const master=ctx.globalThis.PokeMaster;
 const sp=master.species.find(x=>x.skill==='Ingredient Magnet S');
 assert.ok(sp,'need a standard food magnet species in master');
 const first=(sp.mythIng||sp.ings).find(row=>row&&row.c1>0);
 assert.ok(first);
 const item=master.ingredients[first.name];
 const r=make();
 for(const k of obs.flags)r.provenance[k]=true;
 r.input.box[0].pokemon=sp.name;
 r.input.box[0].ingredients[0]=item;
 // An empty discovered-item pool makes the simulator omit these food rewards.
 r.input.options.magnetIngredients=[];
 const prediction=sim.simulate(r.input);
 assert.ok(prediction.unassignedMagnet>0,'actual weekly model must omit unassigned food');
 r.capture.modelAtCapture=Object.fromEntries(['total','berries','skills','cooking'].map(k=>[k,prediction[k]]));
 r.capture.modelDiagnosticsAtCapture=obs.modelDiagnostics(prediction);
 for(const view of [obs.preview(r),obs.reviewImportedReport(r,sim.simulate),compareSingleWeek(r)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(x=>x.includes('抽選食材')&&x.includes('未設定')));
  assert.equal(view.accuracyGate,'HOLD');
  assert.equal(view.rankOrAccuracyValidated,false);
 }
 const withPool=JSON.parse(JSON.stringify(r));
 withPool.input.options.magnetIngredients=['apple'];
 assert.equal(sim.simulate(withPool.input).unassignedMagnet,0);
 assert.equal(obs.knownModelLimitations(withPool.input).some(x=>x.includes('抽選食材の候補')),false);
 const inactive=make();
 inactive.input.box.push({...pokemon('off'),pokemon:sp.name,ingredients:[item,'','']});
 assert.equal(obs.knownModelLimitations(inactive.input).some(x=>x.includes('抽選食材の候補')),false);
 const noSkill=make();
 assert.equal(obs.knownModelLimitations(noSkill.input).some(x=>x.includes('抽選食材の候補')),false);
});

test('M1 cooked weeks with Extra Tasty expectation OFF are confounded in capture, browser replay and CLI',()=>{
 const x=input();x.options.recipeId='apple_curry';x.options.initialIngredients={apple:147};x.options.bagCapacity=500;
 const prediction=sim.simulate(x);
 assert.equal(prediction.meals.length,21);
 assert.ok(prediction.cooking>0);
 assert.equal(prediction.estimatedMeals,0);
 assert.equal(prediction.potDependentMeals,0);
 const cap=obs.captureSimulation(x,prediction,'0.2.63','2026-10-22T03:00:00.000Z');
 const record=obs.makeReport(cap,{mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
  confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))});
 for(const outcome of [obs.preview(record),obs.reviewImportedReport(record,sim.simulate),compareSingleWeek(record)]){
  assert.equal(outcome.status,'CONFOUNDED_OBSERVATION');
  assert.equal(outcome.accuracyGate,'HOLD');
  assert.equal(outcome.rankOrAccuracyValidated,false);
  assert.ok(outcome.modelLimitations.some(reason=>reason.includes('大成功期待値OFF')));
 }
 const expected={...x,options:{...x.options,successMode:'expected'}};
 const normal=sim.simulate(expected);
 assert.ok(normal.cooking>prediction.cooking);
 assert.equal(obs.knownModelLimitations(expected,normal).some(reason=>reason.includes('大成功期待値OFF')),false);
 const empty=input(),emptyResult=sim.simulate(empty);
 assert.equal(emptyResult.cooking,0);
 assert.equal(obs.knownModelLimitations(empty,emptyResult).some(reason=>reason.includes('大成功期待値OFF')),false);
});

// A per-meal recipe chosen by the weekly model is not evidence of which meals
// the user cooked in game, even when the starting ingredients are sufficient.
test('M1 automatic best/fallback recipe cooking stays HOLD in capture, replay and CLI',()=>{
 const base=input();
 base.options.recipeId='apple_curry';
 base.options.initialIngredients={apple:147};
 base.options.bagCapacity=500;
 base.options.successMode='expected';
 for(const mode of ['best','fallback']){
  const x=JSON.parse(JSON.stringify(base));x.options.recipeMode=mode;
  const prediction=sim.simulate(x);
  assert.ok(prediction.cooking>0);
  assert.equal(prediction.estimatedMeals,0);
  assert.equal(prediction.potDependentMeals,0);
  const record=obs.makeReport(obs.captureSimulation(x,prediction,'0.2.64','2026-10-22T05:00:00.000Z'),{
   mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
   confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))});
  for(const outcome of [obs.preview(record),obs.reviewImportedReport(record,sim.simulate),compareSingleWeek(record)]){
   assert.equal(outcome.status,'CONFOUNDED_OBSERVATION',mode);
   assert.equal(outcome.accuracyGate,'HOLD');
   assert.equal(outcome.rankOrAccuracyValidated,false);
   assert.ok(outcome.modelLimitations.some(x=>x.includes('自動選択近似')&&x.includes('全レシピ')),mode);
  }
 }
 const fixed={...base,options:{...base.options,recipeMode:'fixed'}};
 const fixedPrediction=sim.simulate(fixed);
 assert.ok(fixedPrediction.cooking>0);
 assert.equal(obs.knownModelLimitations(fixed,fixedPrediction).some(x=>x.includes('自動選択近似')),false);
 for(const mode of ['best','fallback']){
  const x={...base,options:{...base.options,recipeMode:mode,foodMode:'random'}};
  const prediction=sim.simulate(x);
  assert.equal(prediction.cooking,0);
  assert.equal(obs.knownModelLimitations(x,prediction).some(x=>x.includes('自動選択近似')),false);
 }
});


test('M1 duplicate records ignore box ordering but detect real individual or team differences',()=>{
 const a=make(),b=make();
 b.input.box.reverse();
 const snapshot=JSON.stringify(b);
 const group=obs.reviewImportedReports([a,b],sim.simulate);
 assert.equal(group.sameSavedInputs,true);
 assert.deepEqual(Array.from(group.duplicateMondays),['2026-10-19']);
 assert.deepEqual(Array.from(group.conflictingInputsMondays),[]);
 assert.equal(group.accuracyGate,'HOLD');
 assert.equal(JSON.stringify(b),snapshot);
 const different=JSON.parse(JSON.stringify(b));
 different.input.box.find(p=>p.id==='a').level+=1;
 const changed=obs.reviewImportedReports([a,different],sim.simulate);
 assert.equal(changed.sameSavedInputs,false);
 assert.deepEqual(Array.from(changed.conflictingInputsMondays),['2026-10-19']);
 const teamChange=JSON.parse(JSON.stringify(b));
 teamChange.input.teams.morning.reverse();
 const lineup=obs.reviewImportedReports([a,teamChange],sim.simulate);
 assert.equal(lineup.sameSavedInputs,false);
 assert.deepEqual(Array.from(lineup.conflictingInputsMondays),['2026-10-19']);
});


test('M1 positive observed cooking with zero modeled cooking is confounded in capture, replay and CLI',()=>{
 const x=input(),pred=sim.simulate(x);
 assert.equal(pred.cooking,0);
 assert.equal(x.options.recipeId,'');
 const cap=obs.captureSimulation(x,pred,'0.2.66','2026-10-18T10:00:00.000Z');
 const game=obs.makeReport(cap,{mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
  confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))});
 for(const out of [obs.preview(game),obs.reviewImportedReport(game,sim.simulate),compareSingleWeek(game)]){
  assert.equal(out.status,'CONFOUNDED_OBSERVATION');
  assert.equal(out.accuracyGate,'HOLD');
  assert.equal(out.rankOrAccuracyValidated,false);
  assert.ok(out.modelLimitations.some(m=>m.includes('料理エナジーを0')&&m.includes('料理比較')));
 }
 const noCooking=JSON.parse(JSON.stringify(game));
 noCooking.observed.cooking=0;noCooking.observed.total=noCooking.observed.berryAndStrengthSkill;
 for(const out of [obs.preview(noCooking),obs.reviewImportedReport(noCooking,sim.simulate),compareSingleWeek(noCooking)]){
  assert.equal(out.status,'UNCALIBRATED_OBSERVATION');
  assert.equal(out.modelLimitations.some(m=>m.includes('料理エナジーを0')),false);
  assert.equal(out.accuracyGate,'HOLD');
 }
 const mismatch=JSON.parse(JSON.stringify(game));
 mismatch.input.options.recipeId='apple_curry';
 mismatch.input.options.foodMode='salad';
 assert.equal(sim.simulate(mismatch.input).cooking,0);
 const compared=obs.reviewImportedReport(mismatch,sim.simulate);
 assert.ok(compared.modelLimitations.some(m=>m.includes('料理エナジーを0')));
 assert.equal(compared.status,'CONFOUNDED_OBSERVATION');
 const cooked={...x,options:{...x.options,recipeId:'apple_curry',foodMode:'curry',
  initialIngredients:{apple:147},bagCapacity:500,successMode:'expected'}};
 const modeled=sim.simulate(cooked);
 assert.ok(modeled.cooking>0);
 assert.equal(obs.knownModelLimitations(cooked,modeled,40).some(m=>m.includes('料理エナジーを0')),false);
});

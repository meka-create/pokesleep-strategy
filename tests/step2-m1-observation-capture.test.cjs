'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

const {compareSingleWeek}=require('../scripts/step2-m1-observation-compare.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const PokeSimulator=ctx.globalThis.PokeSimulator;
const obs=ctx.globalThis.PokeObservation;
const monday='2026-10-19',time='2026-10-18T13:00:00.000Z';
const flags=()=>Object.fromEntries(obs.flags.map(k=>[k,false]));
const input=()=>{
 const ids=['a','b','c','d','e'];
 const p=id=>({id,pokemon:'ライチュウ',nickname:id,level:1,skillLevel:1,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],nature:'まじめ',
  sleepHours:0,shiny:false});
 return {box:ids.map(p),teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:150,potSize:57,
   sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
   recipeId:'',initialIngredients:{},bagCapacity:0,camp:false,
   extraMode:'none',successMode:'none'}};
};
const form=()=>({mondayDate:monday,total:'100',berryAndStrengthSkill:'60',
 cooking:'40',screenshotReference:'IMG_20261019.png',confirmedSummary:true,...flags()});
test('weekly observation report captures exact run input once and preserves privacy scope',()=>{
 const source=input(),simOutput={total:175,berries:100,cooking:50,skills:25};
 const snap=obs.captureSimulation(source,simOutput,'0.2.35',time);
 source.box[0].nickname='changed later';source.options.fieldBonus=90;
 const report=obs.makeReport(snap,form());
 assert.equal(report.schema,'step2-m1-weekly-observation-v1');
 assert.equal(report.week.mondayDate,monday);
 assert.equal(report.week.field,'ゴールド旧発電所');
 assert.equal(report.provenance.source,'in_game_weekly_summary');
 assert.equal(report.provenance.screenshotReference,'IMG_20261019.png');
 assert.equal(report.provenance.noUnmodeledEvents,false);
 assert.equal(report.input.box[0].nickname,'a');
 assert.equal(report.input.options.fieldBonus,0);
 assert.equal(report.capture.modelAtCapture.total,175);
 assert.equal(report.capture.appVersion,'0.2.35');
 assert.equal(report.capture.recordingMethod,'manual_game_summary_input');
 assert.equal(report.capture.screenshotReviewedByApp,false);
 assert.equal(report.observed.total,100);
 assert.equal(report.observed.berryAndStrengthSkill,60);
 assert.equal(report.observed.cooking,40);
 const compare=obs.preview(report);
 assert.deepEqual(JSON.parse(JSON.stringify(compare.signedDeltaObservedMinusModel)),
  {total:-75,berryAndStrengthSkill:-65,cooking:-10});
 assert.equal(compare.weeklySummaryBucketsReconcile,true);
 assert.equal(compare.status,'CONFOUNDED_OBSERVATION');
 assert.equal(compare.accuracyGate,'HOLD');
 assert.equal(compare.rankOrAccuracyValidated,false);
});
test('weekly summary gate rejects all invalid, missing, fabricated and non-Monday fields',()=>{
 const snap=obs.captureSimulation(input(),{total:175,berries:100,skills:25,cooking:50},'0.2.35',time);
 assert.equal(obs.validMonday(monday),true);
 assert.equal(obs.validMonday('2026-10-18'),false);
 assert.equal(obs.validMonday('2026-02-30'),false);
 assert.throws(()=>obs.makeReport(snap,{...form(),confirmedSummary:false}),/実際に確認/);
 assert.throws(()=>obs.makeReport(snap,{...form(),mondayDate:'2026-10-18'}),/月曜日/);
 assert.throws(()=>obs.makeReport(snap,{...form(),total:''}),/整数/);
 assert.throws(()=>obs.makeReport(snap,{...form(),total:'1.5'}),/整数/);
 assert.throws(()=>obs.makeReport(snap,{...form(),total:'1e3'}),/整数/);
 assert.throws(()=>obs.makeReport(snap,{...form(),total:'-1'}),/整数/);
 assert.throws(()=>obs.makeReport(snap,{...form(),cooking:'9007199254740992'}),/整数/);
 assert.throws(()=>obs.makeReport(snap,{...form(),noUnmodeledEvents:'false'}),/不正/);
 assert.throws(()=>obs.makeReport(snap,{...form(),screenshotReference:'x'.repeat(301)}),/300文字/);
 assert.throws(()=>obs.makeReport(null,form()),/先に/);
 assert.throws(()=>obs.captureSimulation(input(),{total:177,berries:100,cooking:50,skills:25},'0.2.35',time),/内訳/);
});
test('local UI preview flags contradictory totals and keeps evidence explicitly uncalibrated',()=>{
 const snap=obs.captureSimulation(input(),{total:175,berries:100,skills:25,cooking:50},'0.2.35',time);
 const report=obs.makeReport(snap,{...form(),total:'101'});
 const compare=obs.preview(report);
 assert.equal(compare.observedUnattributed,1);
 assert.equal(compare.weeklySummaryBucketsReconcile,false);
 assert.equal(compare.status,'CONFOUNDED_OBSERVATION');
 const yes=Object.fromEntries(obs.flags.map(k=>[k,true]));
 const all=obs.makeReport(snap,{...form(),...yes});
 const uncalibrated=obs.preview(all);
 assert.equal(uncalibrated.status,'UNCALIBRATED_OBSERVATION');
 assert.equal(uncalibrated.rankOrAccuracyValidated,false);
 assert.equal(uncalibrated.accuracyGate,'HOLD');
});
test('recorded real-week JSON is directly accepted by existing CLI without false accuracy promotion',()=>{
 const runInput=input(),model=PokeSimulator.simulate(runInput);
 const snap=obs.captureSimulation(runInput,model,'0.2.35',time);
 const report=obs.makeReport(snap,form());
 const analyzed=compareSingleWeek(report);
 assert.equal(analyzed.schema,obs.schema);
 assert.equal(analyzed.captureComparison.matchesCurrentModel,true);
 assert.equal(analyzed.status,'CONFOUNDED_OBSERVATION');
 assert.equal(analyzed.rankOrAccuracyValidated,false);
 assert.equal(analyzed.accuracyGate,'HOLD');
 assert.equal(analyzed.provenance.screenshotReviewed,false);
 assert.equal(analyzed.model.total,model.total);
 // A new engine or different master must not be compared as if it were the
 // originally captured model. Confound rather than silently replacing it.
 const changed=JSON.parse(JSON.stringify(report));
 changed.capture.modelAtCapture.total+=500;
 const drift=compareSingleWeek(changed);
 assert.equal(drift.captureComparison.matchesCurrentModel,false);
 assert.equal(drift.status,'CONFOUNDED_OBSERVATION');
 assert.ok(drift.confounders.some(s=>s.includes('試算値と現在の計算器')));
 const malformed=JSON.parse(JSON.stringify(report));
 malformed.capture.modelAtCapture.total='not-a-number';
 assert.throws(()=>compareSingleWeek(malformed),/スナップショット/);
});

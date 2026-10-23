'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const obs=ctx.globalThis.PokeObservation;
const monday='2026-10-26';
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
const forecast=(at='2026-10-25T18:59:59.999Z')=>
 obs.captureSimulation(input(),{total:175,berries:100,cooking:50,skills:25},
  '0.2.72',at);
const flags=()=>Object.fromEntries(obs.flags.map(k=>[k,true]));
const form=()=>({mondayDate:monday,total:'175',berryAndStrengthSkill:'125',
 cooking:'50',confirmedSummary:true,screenshotReference:'',...flags()});
test('Monday 04 JST is the absolute forecast cutoff, not midnight UTC',()=>{
 assert.equal(obs.forecastTiming('2026-10-25T18:59:59.999Z',monday).phase,'PRE_WEEK');
 assert.equal(obs.forecastTiming('2026-10-25T19:00:00.000Z',monday).phase,'DURING_WEEK');
 assert.equal(obs.forecastTiming('2026-11-01T18:59:59.999Z',monday).phase,'DURING_WEEK');
 assert.equal(obs.forecastTiming('2026-11-01T19:00:00.000Z',monday).phase,'AFTER_WEEK');
 assert.equal(obs.forecastTiming('2026-10-25T18:59:59.999Z',monday).independentlyVerified,false);
 assert.throws(()=>obs.forecastTiming('invalid',monday),/日時/);
});
test('pre-week plan exports a deep frozen-input copy and restores without altering the box',()=>{
 const source=input(),snap=forecast();
 const plan=obs.makePlan(snap,monday);
 assert.equal(plan.schema,'step2-m1-weekly-plan-v1');
 assert.equal(plan.capture.recordingMethod,'manual_game_summary_input');
 assert.equal(plan.capture.screenshotReviewedByApp,false);
 source.box[0].nickname='later';
 snap.input.box[0].nickname='changed after download';
 assert.equal(plan.input.box[0].nickname,'a');
 const restored=obs.snapshotFromPlan(JSON.parse(JSON.stringify(plan)));
 assert.equal(restored.input.box[0].nickname,'a');
 assert.equal(restored.plannedWeekMonday,monday);
 assert.equal(restored.capturedAt,plan.capture.capturedAt);
 const observation=obs.makeReport(restored,form());
 assert.equal(observation.schema,obs.schema);
 assert.equal(observation.capture.capturedAt,plan.capture.capturedAt);
 assert.equal(obs.preview(observation).forecastTiming.phase,'PRE_WEEK');
 assert.equal(obs.preview(observation).accuracyGate,'HOLD');
 assert.equal(obs.preview(observation).rankOrAccuracyValidated,false);
 assert.throws(()=>obs.makeReport(restored,{...form(),mondayDate:'2026-11-02'}),/一致していません/);
});
test('mid-week and retrospective predictions cannot be passed off as pre-week plans',()=>{
 for(const [when,phase] of [['2026-10-25T19:00:00.000Z','DURING_WEEK'],
  ['2026-11-01T19:00:00.000Z','AFTER_WEEK']]){
  const snap=forecast(when);
  assert.throws(()=>obs.makePlan(snap,monday),/04:00/);
  const report=obs.makeReport(snap,form());
  const preview=obs.preview(report);
  assert.equal(preview.forecastTiming.phase,phase);
  assert.equal(preview.status,'CONFOUNDED_OBSERVATION');
  assert.ok(preview.modelLimitations.some(v=>v.includes(phase==='DURING_WEEK'?'週途中':'事後再現')));
  assert.equal(preview.accuracyGate,'HOLD');
  const imported=obs.reviewImportedReport(report,()=>({total:175,berries:100,skills:25,cooking:50}));
  assert.equal(imported.forecastTiming.phase,phase);
  assert.equal(imported.status,'CONFOUNDED_OBSERVATION');
  assert.ok(imported.modelLimitations.some(v=>v.includes(phase==='DURING_WEEK'?'週途中':'事後再現')));
 }
});
test('tampered plan field, week, roster or post-start timestamp fails closed',()=>{
 const plan=JSON.parse(JSON.stringify(obs.makePlan(forecast(),monday)));
 for(const edit of [
  r=>{r.week.mondayDate='2026-10-27';},
  r=>{r.week.field='シアンの砂浜';},
  r=>{r.input.teams.sleep[1]='a';},
  r=>{r.capture.capturedAt='2026-10-25T19:00:00.000Z';},
  r=>{r.capture.modelAtCapture.total=999;}
 ]){
  const changed=JSON.parse(JSON.stringify(plan));edit(changed);
  assert.throws(()=>obs.snapshotFromPlan(changed));
 }
});

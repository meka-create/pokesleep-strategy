'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const {PokeObservation:obs,PokeSimulator:sim}=ctx.globalThis;
const monday='2026-10-26'; // week ends Nov 2, 04:00 JST = Nov 1, 19:00 UTC
function input(){
 const ids=['a','b','c','d','e'];
 const box=ids.map(id=>({id,pokemon:'ライチュウ',nickname:id,level:1,skillLevel:1,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],
  nature:'まじめ',sleepHours:0,shiny:false}));
 return {box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:150,potSize:57,
   sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'',
   initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'none'}};
}
const verify=()=>Object.fromEntries(obs.flags.map(k=>[k,true]));
const form=()=>({mondayDate:monday,total:'100',berryAndStrengthSkill:'80',
 cooking:'20',confirmedSummary:true,...verify()});
const snapshot=(at='2026-10-25T18:59:59.999Z')=>
 obs.captureSimulation(input(),{total:175,berries:100,cooking:50,skills:25},'0.2.73',at);
test('a full game-week summary is unavailable before next Monday 04:00 JST',()=>{
 const before='2026-11-01T18:59:59.999Z',end='2026-11-01T19:00:00.000Z';
 assert.throws(()=>obs.makeReport(snapshot(),form(),before),/未終了の週/);
 assert.throws(()=>obs.makeReport(snapshot(),form(),'2026-10-26T04:00:00.000Z'),/未終了の週/);
 const exact=obs.makeReport(snapshot(),form(),end);
 assert.equal(exact.provenance.summaryRecordedAt,end);
 assert.equal(obs.preview(exact).summaryRecordingTime.weekCompletedByRecordedClock,true);
 assert.equal(obs.preview(exact).summaryRecordingTime.independentlyVerified,false);
 assert.equal(obs.preview(exact).accuracyGate,'HOLD');
 assert.equal(obs.preview(exact).rankOrAccuracyValidated,false);
 assert.throws(()=>obs.makeReport(snapshot(),form(),'2026-11-01T19:00:00+00:00'),/ISO/);
});
test('recorded summary cannot precede its saved simulation',()=>{
 const postWeekSnapshot=snapshot('2026-11-02T05:00:00.000Z');
 assert.throws(()=>obs.makeReport(postWeekSnapshot,form(),'2026-11-02T04:59:59.000Z'),/試算の保存時刻/);
 const report=obs.makeReport(postWeekSnapshot,form(),'2026-11-02T05:00:00.000Z');
 assert.equal(obs.preview(report).forecastTiming.phase,'AFTER_WEEK');
 assert.equal(obs.preview(report).status,'CONFOUNDED_OBSERVATION');
});
test('tampered recorded timestamps fail closed in preview, replay and CLI; absent legacy timestamp stays readable',()=>{
 const runInput=input(),pred=sim.simulate(runInput);
 const cap=obs.captureSimulation(runInput,pred,'0.2.73','2026-10-25T18:59:59.999Z');
 const clean=obs.makeReport(cap,form(),'2026-11-01T19:00:00.000Z');
 const review=obs.reviewImportedReport(clean,sim.simulate);
 assert.equal(review.summaryRecordingTime.recordedAt,clean.provenance.summaryRecordedAt);
 assert.equal(review.accuracyGate,'HOLD');
 assert.equal(review.screenshotReviewed,false);
 const {compareSingleWeek}=require('../scripts/step2-m1-observation-compare.cjs');
 assert.equal(compareSingleWeek(clean).summaryRecordingTime.weekCompletedByRecordedClock,true);
 for(const altered of ['2026-11-01T18:59:59.999Z','no date',null,'2026-10-20T13:00:00.000Z']){
  const wrong=JSON.parse(JSON.stringify(clean));
  wrong.provenance.summaryRecordedAt=altered;
  assert.throws(()=>obs.preview(wrong));
  assert.throws(()=>obs.reviewImportedReport(wrong,sim.simulate));
  assert.throws(()=>compareSingleWeek(wrong));
 }
 const legacy=JSON.parse(JSON.stringify(clean));
 delete legacy.provenance.summaryRecordedAt;
 assert.equal(obs.preview(legacy).summaryRecordingTime,null);
 assert.equal(obs.reviewImportedReport(legacy,sim.simulate).summaryRecordingTime,null);
 assert.equal(compareSingleWeek(legacy).accuracyGate,'HOLD');
});

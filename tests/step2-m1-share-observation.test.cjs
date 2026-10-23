'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator,obs=context.globalThis.PokeObservation;
const {compareSingleWeek}=require('../scripts/step2-m1-observation-compare.cjs');
function rawInput(){
 const ids=['user@example.com/private-3','/private/photo-1','family-name','old-4','old-5','old-6'];
 const make=(id,i)=>({id,pokemon:i<5?'ライチュウ':'プクリン',
  nickname:'SECRET-NICK-'+i,level:30,skillLevel:3,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],
  nature:'まじめ',sleepHours:0,shiny:false,mainSkill:'SECRET-MAIN-SKILL-'+i,
  freeText:'SECRET-FREE-TEXT-'+i});
 const active=ids.slice(0,5);
 return {box:ids.map(make),teams:{morning:active,noon:active,evening:active,sleep:active},
  options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
   sleepScore:88,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'',
   initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'expected',
   magnetIngredients:['apple'],eventEffects:'SECRET-HOME-ADDRESS-123',
   personalContact:'SECRET-CONTACT-456'}};
}
const flags=()=>Object.fromEntries(obs.flags.map(k=>[k,true]));
function fixture(){
 const input=rawInput(),pred=sim.simulate(input);
 const cap=obs.captureSimulation(input,pred,'0.2.74','2026-10-18T10:00:00.000Z');
 const form={mondayDate:'2026-10-19',total:'1000',berryAndStrengthSkill:'600',
  cooking:'400',confirmedSummary:true,...flags(),
  screenshotReference:'SECRET-SCREENSHOT-999'};
 const report=obs.makeReport(cap,form,'2026-10-26T00:00:00.000Z');
 report.provenance.privateNote='SECRET-PROVENANCE-777';
 report.privateExtension='SECRET-ROOT-888';
 return report;
}
test('limited disclosure drops nicknames, original internal IDs, paths and arbitrary text but retains replay semantics',()=>{
 const raw=fixture(),snapshot=JSON.stringify(raw);
 const before=obs.reviewImportedReport(raw,sim.simulate);
 const shared=obs.shareObservation(raw,sim.simulate);
 assert.equal(JSON.stringify(raw),snapshot,'must not mutate the raw evidence');
 assert.equal(shared.schema,obs.schema);
 assert.equal(shared.input.box.length,6);
 assert.equal(shared.provenance.source,'in_game_weekly_summary');
 assert.equal(shared.provenance.summaryRecordedAt,raw.provenance.summaryRecordedAt);
 assert.equal(shared.capture.capturedAt,raw.capture.capturedAt);
 assert.equal(shared.capture.recordingMethod,'manual_game_summary_input');
 assert.equal(shared.capture.screenshotReviewedByApp,false);
 const text=JSON.stringify(shared);
 for(const secret of ['SECRET-NICK','user@example.com','/private/photo-1',
  'SECRET-SCREENSHOT','SECRET-FREE-TEXT','SECRET-HOME-ADDRESS',
  'SECRET-CONTACT','SECRET-MAIN-SKILL','SECRET-PROVENANCE','SECRET-ROOT'])
  assert.equal(text.includes(secret),false,secret);
 assert.equal('nickname' in shared.input.box[0],false);
 assert.equal('screenshotReference' in shared.provenance,false);
 assert.match(shared.input.options.eventEffects,/内容非公開/);
 const after=obs.reviewImportedReport(shared,sim.simulate);
 for(const key of ['total','berries','skills','cooking'])
  assert.ok(Math.abs(before.currentModel[key]-after.currentModel[key])<1e-5);
 assert.equal(before.status,after.status);
 assert.equal(after.accuracyGate,'HOLD');
 assert.equal(after.rankOrAccuracyValidated,false);
 assert.equal(after.screenshotReviewed,false);
 assert.equal(compareSingleWeek(shared).accuracyGate,'HOLD');
 for(const period of ['morning','noon','evening','sleep']){
  assert.equal(new Set(shared.input.teams[period]).size,5);
  assert.ok(shared.input.teams[period].every(id=>shared.input.box.some(p=>p.id===id)));
 }
});
test('same roster IDs generate stable aliases independent of box-row order',()=>{
 const a=fixture(),b=JSON.parse(JSON.stringify(a));
 b.input.box.reverse();
 const outA=obs.shareObservation(a,sim.simulate),outB=obs.shareObservation(b,sim.simulate);
 const pairs=x=>new Map(x.input.box.map(p=>[p.pokemon+':'+p.level+':'+p.id,p.id]));
 assert.equal(JSON.stringify(outA.input.teams),JSON.stringify(outB.input.teams));
 assert.equal(outA.input.box[0].id!==outB.input.box[0].id,true);
 assert.equal(outA.input.box.length,outB.input.box.length);
 assert.ok([...pairs(outA).values()].every(x=>/^P\d{5}$/.test(x)));
});
test('malformed/contradictory evidence never produces a shareable report',()=>{
 const a=fixture();const wrong=JSON.parse(JSON.stringify(a));
 wrong.provenance.summaryRecordedAt='2026-10-20T00:00:00.000Z';
 assert.throws(()=>obs.shareObservation(wrong,sim.simulate),/未終了/);
 assert.throws(()=>obs.shareObservation(a,null),/週間計算器/);
 const invalid=JSON.parse(JSON.stringify(a));
 invalid.input.teams.morning[0]='UNKNOWN-PRIVATE';
 assert.throws(()=>obs.shareObservation(invalid,sim.simulate),/不正/);
 const duplicate=JSON.parse(JSON.stringify(a));
 duplicate.input.box[1].id=duplicate.input.box[0].id;
 assert.throws(()=>obs.shareObservation(duplicate,sim.simulate),/重複/);
});
test('the optional UI action is explicitly opt-in and keeps existing observation buttons',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 assert.match(html,/id="shareObservationFile"/);
 assert.match(html,/id="shareObservationError"/);
 assert.match(html,/匿名性の保証ではありません/);
 assert.match(html,/id="downloadObservation"/);
 assert.match(app,/PokeObservation.shareObservation\(report,PokeSimulator.simulate\)/);
 assert.match(app,/pokesleep_weekly_observation_share_/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master','recipes','simulator','observation'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),ctx);
const {PokeMaster:master,PokeSimulator:sim,PokeObservation:obs}=ctx.globalThis;
const {compareSingleWeek}=require('../scripts/step2-m1-observation-compare.cjs');
function input(){
 const box=Array.from({length:5},(_,i)=>{
  const sp=master.species.find(s=>s.name===(i?'ライチュウ':'ジバコイル'));
  return {id:'p'+i,pokemon:sp.name,level:50,skillLevel:6,
   ingredients:[1,2,3].map(j=>master.ingredients[sp.ings.find(s=>s&&s['c'+j]>0)?.name]||''),
   subskills:['','','','',''],nature:'まじめ',sleepHours:0};
 });
 const ids=box.map(p=>p.id);
 return {box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},options:{
  map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:7,sleepScore:88,
  initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'curry_03',
  initialIngredients:{tomato:210,herb:105},bagCapacity:500,camp:false,
  extraMode:'none',successMode:'none'}};
}
function report(x,r){
 return obs.makeReport(obs.captureSimulation(x,r,'0.2.60','2026-10-18T05:00:00.000Z'),{
  mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
  confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))});
}
test('certain ingredients do not certify meals requiring expected pot expansion; all intake paths hold',()=>{
 const x=input(),r=sim.simulate(x);
 // Literal recipe requirement 10 tomato + 5 herb exceeds base 7 (Sunday 14).
 // These are model outputs, NOT a measured game week or skill probability.
 assert.equal(r.meals.length,20);assert.equal(r.initialCoveredMeals,20);
 assert.equal(r.estimatedMeals,0);assert.equal(r.expectedSourceMeals,0);
 assert.equal(r.cooking,185960);assert.equal(r.potDependentMeals,20);
 assert.ok(r.meals.every(m=>m.potDependent&&m.recipeDependsOnPotSkill));
 assert.ok(r.warnings.some(s=>s.includes('鍋拡張')));
 const saved=report(x,r);
 assert.equal(saved.capture.modelDiagnosticsAtCapture.potDependentMeals,20);
 for(const view of [obs.preview(saved),obs.reviewImportedReport(saved,sim.simulate),compareSingleWeek(saved)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(s=>s.includes('鍋拡張')));
  assert.equal(view.accuracyGate,'HOLD');assert.equal(view.rankOrAccuracyValidated,false);
 }
});
test('pot evidence handles Sunday and camp capacity, optional fillers, and best-recipe selection',()=>{
 const x=input();x.options.potSize=10;x.options.camp=true;
 const safe=sim.simulate(x);assert.equal(safe.potDependentMeals,0);
 assert.equal(safe.meals.length,21);
 assert.ok(safe.meals.every(m=>m.basePotCapacity===(m.day===7?30:15)));
 x.options.camp=false;x.options.potSize=8;
 const sunday=sim.simulate(x);
 assert.ok(sunday.meals.filter(m=>m.day===7).every(m=>!m.potDependent));
 assert.ok(sunday.meals.filter(m=>m.day<7).every(m=>m.potDependent));
 x.options.potSize=7;x.options.recipeId='apple_curry';x.options.extraMode='fill';
 x.options.initialIngredients={apple:147,tail:3000};x.options.bagCapacity=10000;
 const fill=sim.simulate(x);
 assert.ok(fill.potDependentMeals>0);
 assert.ok(fill.meals.some(m=>m.potDependent&&!m.recipeDependsOnPotSkill));
 for(const m of fill.meals)assert.equal(m.potDependent,m.count>(m.day===7?14:7));
 const best=input();best.options.recipeMode='best';best.options.initialIngredients.apple=147;
 const result=sim.simulate(best);
 assert.ok(result.meals.some(m=>m.recipeId==='curry_03'&&m.recipeDependsOnPotSkill));
});
test('no cooking and a sufficient base pot do not claim pot-dependent meals',()=>{
 const x=input();x.options.recipeId='';assert.equal(sim.simulate(x).potDependentMeals,0);
 x.options.recipeId='curry_03';x.options.potSize=15;
 const r=sim.simulate(x);assert.equal(r.potDependentMeals,0);
 const off=obs.preview(report(x,r));
 assert.equal(off.status,'CONFOUNDED_OBSERVATION');
 assert.ok(off.modelLimitations.some(s=>s.includes('大成功期待値OFF')));
 x.options.successMode='expected';
 const on=sim.simulate(x);assert.equal(on.potDependentMeals,0);
 assert.equal(obs.preview(report(x,on)).status,'UNCALIBRATED_OBSERVATION');
});
test('legacy pot diagnostics stay readable but held; invalid and changed counters are detected',()=>{
 const x=input(),r=sim.simulate(x),saved=report(x,r);
 const old=JSON.parse(JSON.stringify(saved));delete old.capture.modelDiagnosticsAtCapture.potDependentMeals;
 for(const view of [obs.preview(old),obs.reviewImportedReport(old,sim.simulate),compareSingleWeek(old)]){
  assert.equal(view.status,'CONFOUNDED_OBSERVATION');
  assert.ok(view.modelLimitations.some(s=>s.includes('鍋拡張')&&s.includes('保存されていません')));
 }
 const drift=JSON.parse(JSON.stringify(saved));drift.capture.modelDiagnosticsAtCapture.potDependentMeals=0;
 assert.ok(obs.reviewImportedReport(drift,sim.simulate).modelLimitations.some(s=>s.includes('カウンターが変わっています')));
 for(const value of [-1,0.5,'20',null]){
  const bad=JSON.parse(JSON.stringify(saved));bad.capture.modelDiagnosticsAtCapture.potDependentMeals=value;
  assert.throws(()=>obs.preview(bad),/メタデータ/);
  assert.throws(()=>obs.captureSimulation(x,{...r,potDependentMeals:value},'0.2.60','2026-10-21T05:00:00.000Z'),/診断カウンター/);
 }
});

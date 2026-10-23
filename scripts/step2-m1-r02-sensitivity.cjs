'use strict';
/* STEP2 M1 R02: same-input comparative sensitivity only.
 * DO NOT interpret parameter sweeps as independently verified Pokémon Sleep
 * healing rates, empirical confidence intervals, or accurate rankings.
 * Frozen v0.2.30 baseline is never rewritten.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context,{filename:file});
const master=context.globalThis.PokeMaster,sim=context.globalThis.PokeSimulator;
const baseline=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
const savedPair=baseline.rankingComparisons.find(x=>x.id==='R02');
assert.ok(savedPair&&savedPair.configurationA==='oneHealer'&&savedPair.configurationB==='twoHealer');
const members=[
 ['r0','ライチュウ'],['r1','ライチュウ'],['r2','ライチュウ'],
 ['r3','ライチュウ'],['r4','ライチュウ'],['w0','プクリン'],
 ['w1','サーナイト'],['g0','フシギバナ'],['f0','リザードン'],
 ['t0','バクフーン']
];
const sleep=['r0','r1','r2','r3','r4'];
const configurations={
 oneHealer:['r0','r1','r2','r3','w0'],
 twoHealer:['r0','r1','r2','w0','w1']
};
const rates=[0,.25,.5,.75,1,1.25,1.5,2];
const scenarios=[
 {id:'original-140',initialApples:140,forceBerryDrops:false,
  description:'Original M1 140 initial apples; one meal food-source dependent'},
 {id:'guaranteed-147',initialApples:147,forceBerryDrops:false,
  description:'All 21 apple curries paid from certain initial apples; normal food draw rates'},
 {id:'berry-only-147',initialApples:147,forceBerryDrops:true,
  description:'All 21 curries paid from initial apples; ingredient draw rate forced to zero'}
];
const speciesByName=new Map(master.species.map(sp=>[sp.name,sp]));
function monster(id,name){
 const sp=speciesByName.get(name);
 assert.ok(sp,'Unknown species '+name);
 const entries=sp.mythIng||sp.ings;
 const ingredients=[1,2,3].map(i=>{
  const row=entries.find(x=>x&&x['c'+i]>0);
  return row?master.ingredients[row.name]:'';
 });
 return {id,pokemon:name,nickname:id,level:50,skillLevel:6,
  ingredients,subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false};
}
function fixture(morning,initialApples){
 const box=members.map(([id,name])=>monster(id,name));
 return {box,teams:{morning:[...morning],noon:[...morning],
  evening:[...morning],sleep:[...sleep]},
 options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
  sleepScore:88,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
  recipeId:'apple_curry',initialIngredients:{apple:initialApples},
  bagCapacity:500,camp:false,extraMode:'none',successMode:'none',
  magnetIngredients:['apple']}};
}
function score(result){
 return {total:result.total,berries:result.berries,skills:result.skills,
  cooking:result.cooking,meals:result.meals.length,
  estimatedMeals:result.estimatedMeals,expectedSourceMeals:result.expectedSourceMeals,
  skillTriggers:result.skillTriggers,directStrengthRoundingCorrection:result.directStrengthRoundingCorrection,
  historicalTotal:result.total-result.directStrengthRoundingCorrection,
  historicalSkills:result.skills-result.directStrengthRoundingCorrection};
}
function leader(delta){
 if(Math.abs(delta)<1e-8)return 'TIE';
 return delta>0?'B':'A';
}
function safeRound(n){return Math.round(n*1e6)/1e6;}
function compareTwo(scenario,rateFactor){
 const snapshot=[...speciesByName.values()].filter(sp=>
  members.some(m=>m[1]===sp.name)).map(sp=>({
    sp,ingRate:sp.ingRate,skillRate:sp.skillRate
  }));
 try{
  for(const x of snapshot){
   if(scenario.forceBerryDrops)x.sp.ingRate=0;
   if(x.sp.name==='プクリン'||x.sp.name==='サーナイト')
    x.sp.skillRate=x.skillRate*rateFactor;
  }
  const a=score(sim.simulate(fixture(configurations.oneHealer,scenario.initialApples)));
  const b=score(sim.simulate(fixture(configurations.twoHealer,scenario.initialApples)));
  if(a.meals!==21||b.meals!==21)
   throw Error('Cannot compare R02: recipe opportunity differs unexpectedly');
  if(scenario.initialApples===147){
   if(a.estimatedMeals!==0||b.estimatedMeals!==0||
     a.expectedSourceMeals!==0||b.expectedSourceMeals!==0)
    throw Error('All recipe mandatory ingredients must be certain');
  }
  const delta=safeRound(b.total-a.total);
  return {rateFactor,historicalDeltaBminusA:safeRound(b.historicalTotal-a.historicalTotal),scoreA:Object.fromEntries(Object.entries(a).map(([k,v])=>[k,safeRound(v)])),
   scoreB:Object.fromEntries(Object.entries(b).map(([k,v])=>[k,safeRound(v)])),
   deltaBminusA:delta,modelLeader:leader(delta),
   referenceRankValidated:false,gameAccuracyValidated:false};
 }finally{
  for(const {sp,ingRate,skillRate} of snapshot)
   Object.assign(sp,{ingRate,skillRate});
 }
}
function sensitivityReport(){
 const scenariosOut=scenarios.map(s=>{
  const values=rates.map(factor=>compareTwo(s,factor));
  const leaders=new Set(values.map(x=>x.modelLeader));
  return {id:s.id,description:s.description,initialApples:s.initialApples,
   forceBerryDrops:s.forceBerryDrops,rates:values,
   includesModelRankReversal:leaders.size>1,
   modelLeaders:[...leaders].sort(),testedFactors:rates,
   externalRankingValidated:false};
 });
 const original=scenariosOut.find(x=>x.id==='original-140');
 const atNatural=original.rates.find(x=>x.rateFactor===1);
 // Preserving the 2026-10-17 pair identity does NOT imply its old numeric
 // delta is still reconstructible by removing direct-strength rounding alone.
 // The full-pocket skill queue changed legitimate current model outputs.
 assert.equal(savedPair.id,'R02');
 assert.equal(atNatural.rateFactor,1);
 return {schema:'step2-m1-r02-sensitivity-v1',sourceBaseline:'v0.2.30 M1 R02',
  baselineFrozen:true,scope:'INTERNAL_PARAMETER_SENSITIVITY_ONLY',
  actualGameWeeksObserved:0,realGameRankingValidated:false,
  rateFactorsAreMeasured:false,probabilityOfRankInversionKnown:false,
  step2:'HOLD',m1:'PARTIAL',step3:'NOT_STARTED',
  pairing:{A:'r0/r1/r2/r3/Wigglytuff',B:'r0/r1/r2/Wigglytuff/Gardevoir',
   fixedSleepTeam:sleep,note:'Identical initial box, schedule and cook settings per pair'},
  caveat:'A rank change under skill-rate perturbation is an M1 priority signal, never an empirical rate bound.',
  scenarios:scenariosOut};
}
if(require.main===module)
 console.log('M1_R02_SENSITIVITY_JSON='+JSON.stringify(sensitivityReport()));
module.exports={sensitivityReport};

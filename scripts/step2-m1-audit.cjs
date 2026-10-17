'use strict';
// M1: independently graded, reproducible benchmark matrix.
// B = separate formula / minute integrator under explicit controlled inputs.
// C = model-generated trace / invariants only, NOT a gameplay oracle.
// A = repeatable real-game observational data (none supplied yet).
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','ingredient-distribution.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const sim=ctx.globalThis.PokeSimulator,master=ctx.globalThis.PokeMaster,prob=ctx.globalThis.PokeIngredientDistribution;
const species=name=>{
 const sp=master.species.find(s=>s.name===name);
 if(!sp)throw Error('M1 fixture requires known species: '+name);
 return sp;
};
function monster(id,name,level=50){
 const sp=species(name),slots=sp.mythIng||sp.ings;
 const ingredients=[1,2,3].map(j=>{
  const choice=slots.find(s=>s&&s['c'+j]>0);
  return choice?master.ingredients[choice.name]:'';
 });
 return {id,pokemon:name,nickname:id,level,skillLevel:6,
  ingredients,subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false};
}
const sleep=['r0','r1','r2','r3','r4'];
function simpleInput(){
 const box=sleep.map(id=>monster(id,'ライチュウ',1));
 return {box,teams:{morning:sleep.slice(),noon:sleep.slice(),evening:sleep.slice(),sleep:sleep.slice()},
  options:{map:'ワカクサ本島',fieldBonus:0,tapMinutes:150,potSize:57,
    sleepScore:0,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'',
    initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'none'}};
}
function mixedInput(){
 const box=[...sleep.map(id=>monster(id,'ライチュウ',50)),
  monster('w0','プクリン'),monster('w1','サーナイト'),
  monster('g0','フシギバナ'),monster('f0','リザードン'),
  monster('t0','バクフーン')];
 return {box,teams:{morning:sleep.slice(),noon:sleep.slice(),evening:sleep.slice(),sleep:sleep.slice()},
  options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
    sleepScore:88,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'apple_curry',
    initialIngredients:{apple:140},bagCapacity:500,camp:false,extraMode:'none',successMode:'none',
    magnetIngredients:['apple']}};
}
function withRaichuControlled(fn){
 const sp=species('ライチュウ');
 const props=['frequency','ingRate','skillRate','carryLimit'];
 const saved=Object.fromEntries(props.map(k=>[k,sp[k]]));
 Object.assign(sp,{frequency:2200,ingRate:0,skillRate:0,carryLimit:10000000});
 try{return fn();}finally{Object.assign(sp,saved);}
}
function oracleBerry(type,lv,bonus,fav){
 const values={normal:28,fire:27,water:31,electric:25,grass:30,ice:32,fighting:27,poison:32,
 ground:29,flying:24,psychic:26,bug:24,rock:30,ghost:26,dragon:35,dark:31,steel:33,fairy:26};
 const x=values[type],raw=Math.max(x+lv-1,Math.round((1.025**(lv-1))*x));
 return Math.ceil(Math.ceil(raw*(1+bonus/100))*(fav?2:1));
}
function speed(e){return e>80?.45:e>60?.52:e>40?.58:e>1?.66:1;}
function oracleSevenDays(start,score){
 let energy=start,decay=0,phase=0,helps=0;
 const work=n=>{
  for(let minute=0;minute<n;minute++){
   phase+=60/(2200*speed(energy));
   const completed=Math.floor(phase+1e-11);
   helps+=completed;phase-=completed;
   decay++;if(decay===10){energy=Math.max(0,energy-1);decay=0;}
  }
 };
 for(let day=0;day<7;day++){
  work(990);
  if(day<6){
   work(450);
   const wake=Math.max(energy,Math.ceil(Math.min(100,energy+Math.round(score))));
   if(wake>energy)decay=0;
   energy=wake;
  }
 }
 return {helps,energy};
}
function check(known,got){assert.ok(Number.isFinite(got)&&Number.isFinite(known));assert.ok(Math.abs(got-known)<1e-7,`Independent mismatch: expected ${known}, got ${got}`);}
const round=n=>Math.round(n*1e6)/1e6;
function reportRow(id,group,label,grade,measure,reference,notes){
 assert.ok(['B','C'].includes(grade));
 const verified=grade==='B'&&reference!==null;
 if(verified)check(reference,measure);
 return {id,group,label,evidenceGrade:grade,referenceSource:verified?'independent-controlled-formula-or-one-minute-oracle':null,
  reference:verified?round(reference):null,simulated:round(measure),
  absoluteDifference:verified?round(measure-reference):null,
  disposition:verified?'MATCH_CONTROLLED':'UNVERIFIED_EXTERNAL',
  triage:verified?'NO_DISCREPANCY_IN_CONTROLLED_CASE':'PENDING_EVIDENCE',notes};
}
function totals(input){
 const result=sim.simulate(input);
 const sum=result.days.reduce((a,d)=>a+d.berries+d.cooking+d.skills,0);
 check(result.total,sum);
 check(result.total,result.berries+result.cooking+result.skills);
 if(result.meals.length)check(result.cooking,result.meals.reduce((a,m)=>a+m.energy,0));
 if(!Number.isFinite(result.total)||result.total<0)throw Error('Nonfinite mixed weekly result');
 return result;
}
function buildReport(){
 const cases=[];
 // 6 B-class deterministic references: NEVER call simulator to derive the oracle.
 cases.push(reportRow('D01','deterministic','Berry.ts electric lv50, 25% field, favorite', 'B',
   sim.berryUnit('electric',50,['electric'],25),oracleBerry('electric',50,25,true),
   'B: separate upstream Berry.ts formula'));
 const dishStrength=sim.RECIPES.find(r=>r.id==='apple_curry').strength70;
 cases.push(reportRow('D02','deterministic','Cooking floor, strength70 apple curry, 25% bonus','B',
  sim.calculateMealEnergy(dishStrength,0,25,0,0).expected,
  Math.floor(dishStrength*1.25+1e-9),'B: independent normal dish rounding'));
 cases.push(reportRow('D03','deterministic','Sleep wake energy: current19.7 score53, 0.88 recovery + one bonus','B',
  sim.recoverFromSleep(19.7,53,.88,1,false),
  Math.ceil(Math.min(100,19.7+Math.round(53)*.88*(1+.14))),
  'B: separate wake-recovery arithmetic'));
 cases.push(withRaichuControlled(()=>{
  const x=simpleInput(),r=totals(x),h=oracleSevenDays(100,0);
  return reportRow('D04','deterministic','7-day berry-only, no sleep recovery, no cooking or skill','B',
   r.total,h.helps*5*2*oracleBerry('electric',1,0,false),
   'B: separate one-minute chronological oracle, 5 Raichu, all ingredient/skill rates zero');
 }));
 cases.push(withRaichuControlled(()=>{
  const x=simpleInput();Object.assign(x.options,{map:'ゴールド旧発電所',fieldBonus:50,initialEnergy:15,sleepScore:80});
  const r=totals(x),h=oracleSevenDays(15,80);
  return reportRow('D05','deterministic','7-day berry-only, six wake recovery events and favorite field','B',
   r.total,h.helps*5*2*oracleBerry('electric',1,50,true),
   'B: separate one-minute chronological oracle and wake events');
 }));
 cases.push(withRaichuControlled(()=>{
  const x=simpleInput();Object.assign(x.options,{recipeId:'apple_curry',initialIngredients:{apple:147}});
  const r=totals(x),expected=21*Math.floor(dishStrength+1e-9);
  assert.equal(r.meals.length,21);
  assert.equal(r.consumedIngredients.apple,147);
  return reportRow('D06','deterministic','21 fixed dishes consumed from certain 147 apples, no food production','B',
   r.cooking,expected,'B: independent integer recipe stock and energy arithmetic');
 }));
 // Four controlled probability observations: B for independent branch math;
 // C for model-only gameplay mapping without measured random-event rates.
 {
 const state=sim.advanceSkillProcState(sim.emptySkillProcState(78,2),2,.25);
 const expected=.375+2*.0625;
 cases.push(reportRow('P01','probability','2 eligible helps, independent 25% skill chance, 2-stock cap','B',
   sim.expectedSkillStock(sim.skillProcMarginal(state)),expected,
   'B: binomial P(stock1)=.375, P(stock2)=.0625; controlled rate, not measured skill rate'));
 }
 {
 const outcome=sim.integerPocketTransitions(new Map([[0,1]]),1,3,2,.5,[{key:'apple',count:3}]);
 cases.push(reportRow('P02','probability','1 help at 50% berry2 / 50% food3, cap3','B',
   outcome.used,2*.5+3*.5,'B: two equally weighted integer branches'));
 }
 {
 const d=prob.addCompoundIngredientOutcomes(prob.certainIngredientBag({}),[
  {probability:.4,items:[{ingredient:'apple',count:3},{ingredient:'milk',count:2}]},
  {probability:.6,items:[]}],20).distribution;
 const dish=prob.evaluateRecipeOutcomes(d,{apple:3,milk:2},20);
 cases.push(reportRow('P03','probability','correlated apple3+milk2 set drop, dish needs both','B',
  dish.successProbability,.4,'B: 40% one compound branch vs 60% empty; not upstream draw rate'));
 }
 {
 const x=mixedInput();x.box=x.box.slice(0,5).map((p,i)=>monster('r'+i,'フシギダネ'));
 x.options.initialIngredients={apple:1};x.options.bagCapacity=1;x.options.recipeId='';
 const r=totals(x);
 assert.equal(r.skillTriggers,0);
 cases.push(reportRow('P04','probability','full shared bag blocks ingredient-magnet activations','C',
  r.skillTriggers,null,'C: internal weekly conservation; actual full-bag skill chronology unmeasured'));
 }
 // Mixed cases have NO independently validated weekly oracle. Never mark PASS.
 {
 const x=mixedInput();x.options.recipeId='';
 cases.push(reportRow('M01','mixed','5 Raichu, berry/skill mixed full seven-day run','C',
  totals(x).total,null,'C: simulation-only, no independent mixed-week reference'));
 }
 {
 const x=mixedInput();const food=['r0','r1','r2','g0','f0'];
 x.teams.morning=food.slice();x.teams.noon=food.slice();x.teams.evening=food.slice();
 cases.push(reportRow('M02','mixed','ingredient-focused daytime with curry production','C',
  totals(x).total,null,'C: recipes use expected food quantities, 21-meal success not validated'));
 }
 {
 const x=mixedInput(),healer=['r0','r1','r2','r3','w0'];
 x.teams.morning=healer.slice();x.teams.noon=healer.slice();x.teams.evening=healer.slice();
 cases.push(reportRow('M03','mixed','healer/Raichu mixed team with night-only sleep squad','C',
  totals(x).total,null,'C: healer activation timing and inter-Pokemon Energy correlations unmeasured'));
 }
 {
 const x=mixedInput();
 x.options.initialIngredients={apple:7};x.options.bagCapacity=7;x.options.recipeId='';
 x.teams.morning=['r0','r1','r2','g0','f0'];
 x.teams.noon=['r0','r1','r2','r3','w0'];
 x.teams.evening=['r0','r1','r2','r3','t0'];
 cases.push(reportRow('M04','mixed','full bag with breakfast/noon/evening substitution and fixed sleep','C',
  totals(x).total,null,'C: mixed full-bag carry and team-swap correlations not externally validated'));
 }
 assert.equal(cases.length,14);
 const configurations={
  allBerry:{morning:sleep,noon:sleep,evening:sleep},
  oneHealer:{morning:['r0','r1','r2','r3','w0'],noon:['r0','r1','r2','r3','w0'],evening:['r0','r1','r2','r3','w0']},
  twoHealer:{morning:['r0','r1','r2','w0','w1'],noon:['r0','r1','r2','w0','w1'],evening:['r0','r1','r2','w0','w1']},
  food:{morning:['r0','r1','r2','g0','f0'],noon:['r0','r1','r2','g0','f0'],evening:['r0','r1','r2','g0','f0']},
  mixed:{morning:['r0','r1','g0','w0','f0'],noon:['r0','r1','g0','w0','f0'],evening:['r0','r1','g0','w0','f0']},
  switching:{morning:['r0','r1','r2','r3','w0'],noon:['r0','r1','r2','g0','f0'],evening:['r0','r1','r2','r3','t0']}
 };
 const pairPlan=[
  ['R01','allBerry','oneHealer','berry-heavy vs single healer'],
  ['R02','oneHealer','twoHealer','one healer vs two healers'],
  ['R03','allBerry','food','berry-heavy vs food production'],
  ['R04','food','mixed','food-focused vs food/healer mixed'],
  ['R05','oneHealer','switching','static healer vs three-period rotation']
 ];
 const outputs={};
 for(const name of [...new Set(pairPlan.flatMap(x=>x.slice(1,3)))]){
  const x=mixedInput();
  for(const period of ['morning','noon','evening'])x.teams[period]=configurations[name][period].slice();
  const z=totals(x);
  outputs[name]={total:round(z.total),berries:round(z.berries),cooking:round(z.cooking),
   skills:round(z.skills),meals:z.meals.length,uncertainMeals:z.expectedSourceMeals};
 }
 const comparisons=pairPlan.map(([id,a,b,label])=>{
  const delta=outputs[b].total-outputs[a].total;
  return {id,label,configurationA:a,configurationB:b,scoreA:outputs[a],scoreB:outputs[b],
   modelDeltaBminusA:round(delta),modelLeader:Math.abs(delta)<1e-7?'TIE':delta>0?'B':'A',
   evidenceGrade:'C',externalRankingValidated:false,conclusion:'UNVERIFIED_RANKING',
   notes:'Same sleep team (r0..r4), same box/config/map/food; differs only in daylight members. No measured or independent mixed-team oracle.'};
 });
 assert.equal(comparisons.length,5);
 return {schema:'step2-m1-benchmark-v1',baselineVersion:'0.2.30',masterAsOf:master.asOf||'2026-10-16',
   evidenceMeaning:{A:'independent repeated game observations; none yet',
    B:'separate controlled formula/chronological/branch oracle',
    C:'internal invariants or simulator output only; NOT accuracy validation'},
   counts:{matrix:cases.length,deterministic:6,probability:4,mixed:4,rankingPairs:5,
    referenceCompared:cases.filter(x=>x.disposition==='MATCH_CONTROLLED').length,
    unverifiedCases:cases.filter(x=>x.disposition==='UNVERIFIED_EXTERNAL').length,
    externallyVerifiedRankingPairs:0},
   matrix:cases,rankingComparisons:comparisons,
   gate:{step2:'HOLD',m1:'PARTIAL',step3:'NOT_STARTED',
    blockers:['four mixed weeks have no external independent reference',
     'five ranking pairs lack independent ordering validation',
     'one random-skill case has only model conservation evidence',
     'no Android Chrome device test or actual-game multiweek measurements']},
   limitations:['Model C comparisons are descriptive rankings, not validated optimal teams',
    'Mock mutation of Raichu rates for controlled oracles is not real-game scenario',
    'Probability branch inputs are synthetic and not sourced from actual game draws',
    'Monte Carlo variance and official mixed-skill correlation remain unmeasured']};
}
if(require.main===module)console.log('M1_REPORT_JSON='+JSON.stringify(buildReport()));
module.exports={buildReport};

'use strict';
/* R01-R05 fixed-input model sensitivity under artificial Wigglytuff/Gardevoir
 * skill-rate scaling. Grade C MODEL-ONLY, never empirical game ranking proof.
 * No changes to frozen M1 baseline or source simulator.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),sandbox,{filename:file});
const master=sandbox.globalThis.PokeMaster,engine=sandbox.globalThis.PokeSimulator;
const frozen=require('../docs/STEP2_M1_BASELINE_V0230_20261017.json');
const dex=new Map(master.species.map(x=>[x.name,x]));
const roster=[['r0','ライチュウ'],['r1','ライチュウ'],['r2','ライチュウ'],
 ['r3','ライチュウ'],['r4','ライチュウ'],['w0','プクリン'],
 ['w1','サーナイト'],['g0','フシギバナ'],['f0','リザードン'],
 ['t0','バクフーン']];
const sleep=['r0','r1','r2','r3','r4'];
const configs={
 allBerry:['r0','r1','r2','r3','r4'],
 oneHealer:['r0','r1','r2','r3','w0'],
 twoHealer:['r0','r1','r2','w0','w1'],
 food:['r0','r1','r2','g0','f0'],
 mixed:['r0','r1','g0','w0','f0'],
 switching:null
};
const rotation={morning:['r0','r1','r2','r3','w0'],
 noon:['r0','r1','r2','g0','f0'],evening:['r0','r1','r2','r3','t0']};
const rates=[.75,1],foodModes=[{id:'original-140',apples:140},{id:'guaranteed-147',apples:147}];
const round=n=>Math.round(n*1e6)/1e6;
function fixture(name,apples){
 const box=roster.map(([id,pokemon])=>{
  const sp=dex.get(pokemon);assert.ok(sp);
  const choices=sp.mythIng||sp.ings;
  const ingredients=[1,2,3].map(i=>{
   const x=choices.find(s=>s&&s['c'+i]>0);
   return x?master.ingredients[x.name]:'';
  });
  return {id,pokemon,nickname:id,level:50,skillLevel:6,ingredients,
   subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false};
 });
 const group=configs[name];
 assert.ok(group||name==='switching','Unknown configuration '+name);
 const teams=name==='switching'?rotation:
  {morning:group,noon:group,evening:group};
 return {box,teams:{...Object.fromEntries(
  Object.entries(teams).map(([k,ids])=>[k,[...ids]])),sleep:[...sleep]},
  options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
   sleepScore:88,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
   recipeId:'apple_curry',initialIngredients:{apple:apples},
   bagCapacity:500,camp:false,extraMode:'none',successMode:'none',
   magnetIngredients:['apple']}};
}
function modelScore(name,apples){
 const out=engine.simulate(fixture(name,apples));
 assert.equal(out.meals.length,21);
 if(apples===147)assert.equal(out.estimatedMeals,0);
 return {total:round(out.total),berries:round(out.berries),
  cooking:round(out.cooking),skills:round(out.skills),
  estimatedMeals:out.estimatedMeals,meals:out.meals.length,
  directStrengthRoundingCorrection:round(out.directStrengthRoundingCorrection),
  historicalTotal:round(out.total-out.directStrengthRoundingCorrection),
  historicalSkills:round(out.skills-out.directStrengthRoundingCorrection)};
}
function winner(n){return Math.abs(n)<1e-8?'TIE':n>0?'B':'A';}
function runScenario(mode,rateFactor){
 const selected=['プクリン','サーナイト'].map(x=>dex.get(x));
 const originals=selected.map(x=>x.skillRate);
 try{
  for(let i=0;i<selected.length;i++)selected[i].skillRate=originals[i]*rateFactor;
  const outputs=Object.fromEntries(Object.keys(configs).map(name=>[name,modelScore(name,mode.apples)]));
  const pairs=frozen.rankingComparisons.map(row=>{
   const a=outputs[row.configurationA],b=outputs[row.configurationB];
   assert.ok(a&&b);
   const delta=round(b.total-a.total);
   if(mode.id==='original-140'&&rateFactor===1){
    assert.equal(round(b.historicalTotal-a.historicalTotal),
     row.modelDeltaBminusA,row.id+' frozen 2026-10-17 delta + isolated rounding difference');
    assert.equal(a.historicalTotal,row.scoreA.total,row.id+' frozen score A');
    assert.equal(b.historicalTotal,row.scoreB.total,row.id+' frozen score B');
   }
   return {id:row.id,configA:row.configurationA,configB:row.configurationB,
    deltaBminusA:delta,modelLeader:winner(delta),
    originalRankingExternallyVerified:false};
  });
  return {rateFactor,outputs,pairs};
 }finally{
  for(let i=0;i<selected.length;i++)selected[i].skillRate=originals[i];
 }
}
function reportFivePairs(){
 const cases=foodModes.map(mode=>{
  const models=rates.map(factor=>runScenario(mode,factor));
  const base=models.find(x=>x.rateFactor===.75),natural=models.find(x=>x.rateFactor===1);
  const comparisons=frozen.rankingComparisons.map(x=>{
   const a=base.pairs.find(y=>y.id===x.id),b=natural.pairs.find(y=>y.id===x.id);
   const flipped=a.modelLeader!==b.modelLeader;
   return {id:x.id,at075:a.deltaBminusA,at1:b.deltaBminusA,
    leaderAt075:a.modelLeader,leaderAt1:b.modelLeader,
    modelLeaderChanges:flipped,
    triage:flipped?'P1_PRIORITY_VERIFY_SKILL_EVENTS':'UNVERIFIED_GAME_RANK',
    externallyValidated:false};
  });
  return {id:mode.id,apples:mode.apples,factors:models,
   comparisons,changedModelLeaders:comparisons.filter(x=>x.modelLeaderChanges).map(x=>x.id)};
 });
 return {schema:'step2-m1-five-ranking-healer-sensitivity-v1',
  source:'frozen v0.2.30 R01-R05',
  evidenceGrade:'C_INTERNAL_MODEL_SENSITIVITY',
  actualGameRanksValidated:0,measuredSkillRateUncertainty:false,
  probabilitiesOfRankingErrorsEstimated:false,
  step2:'HOLD',m1:'PARTIAL',step3:'NOT_STARTED',
  caveat:'No flip at these two artificial factors is NOT proof of ranking robustness or game accuracy.',
  cases};
}
if(require.main===module)console.log('M1_FIVE_RANKINGS_JSON='+JSON.stringify(reportFivePairs()));
module.exports={reportFivePairs,fixture};

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(legacy=false,trace=false){
 const ctx=vm.createContext({module:{exports:{}},globalThis:{},trace:[]});
 for(const name of ['master','recipes','simulator','observation']){
  let source=fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8');
  if(name==='simulator'&&legacy){
   // Reproduce v0.2.61 mean-bonus closure only; not an independent oracle.
   source=source.replace('tastyChanceState=addTastyChanceBonus(tastyChanceState,increment);',
    'tastyChanceState=new Map([[Math.min(.7,Array.from(tastyChanceState,([b,p])=>b*p).reduce((a,b)=>a+b,0)+increment),1]]);');
   source=source.replace('if(tastyMeal)tastyChanceState=tastyMeal.distribution;',
    'if(tastyMeal)tastyChanceState=new Map([[Array.from(tastyChanceState,([b,p])=>b*p).reduce((a,b)=>a+b,0)*(1-greatChance),1]]);');
  }
  if(name==='simulator'&&trace){
   // Observe inputs at the production integration boundary, never substitute
   // test probabilities or callbacks into the shipping simulator.
   source=source.replace('const grantTastyChance=increment=>{',
    'const grantTastyChance=increment=>{ trace.push({grant:increment});');
   source=source.replace('const value=mealEnergy.expected;',
    'const value=mealEnergy.expected;trace.push({base:day===6?.3:.1,normal:mealEnergy.normal,extra:mealEnergy.extraTasty,probability:greatChance});');
  }
  vm.runInContext(source,ctx);
 }
 return {sim:ctx.globalThis.PokeSimulator,master:ctx.globalThis.PokeMaster,obs:ctx.globalThis.PokeObservation,trace:ctx.trace};
}
const {sim}=load();
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,`${message||''}: ${a} != ${b}`);
function input(pokemon='デデンネ'){
 const ids=['a','b','c','d','e'];
 return {box:ids.map((id,i)=>({id,pokemon:i===0?pokemon:'ライチュウ',nickname:id,level:1,skillLevel:6,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false})),
  teams:{morning:ids,noon:ids,evening:ids,sleep:ids},options:{map:'ゴールド旧発電所',fieldBonus:0,
  tapMinutes:150,potSize:57,sleepScore:100,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
  recipeId:'apple_curry',initialIngredients:{apple:147},bagCapacity:500,camp:false,
  extraMode:'none',successMode:'expected',magnetIngredients:['apple']}};
}
// Independent explicit success/failure histories. No production helper is
// used. Suitable for short sequences; each meal doubles the histories.
function enumerate(increments,bases){
 let worlds=[{p:1,bonus:0}];const probabilities=[];
 for(let i=0;i<bases.length;i++){
  let chance=0;const next=[];
  for(const w of worlds){
   const bonus=Math.min(.7,w.bonus+increments[i]),p=Math.min(1,bases[i]+bonus);
   chance+=w.p*p;
   next.push({p:w.p*p,bonus:0},{p:w.p*(1-p),bonus});
  }
  probabilities.push(chance);worlds=next;
 }
 return {probabilities,remaining:worlds.reduce((n,w)=>n+w.p*w.bonus,0)};
}
test('cooking reset histories remove the third-meal mean-bonus overestimate',()=>{
 let state=sim.addTastyChanceBonus(new Map([[0,1]]),.7),old=.7;
 const actual=[],legacy=[];
 for(let i=0;i<3;i++){
  const r=sim.resolveTastyChanceMeal(state,.1);actual.push(r.successProbability);state=r.distribution;
  legacy.push(.1+old);old*=1-(.1+old);
 }
 [.8,.24,.128].forEach((p,i)=>near(actual[i],p));
 near(legacy[2],.2064);near(legacy[2]-actual[2],.0784);
 const ref=enumerate([.7,0,0],[.1,.1,.1]);
 actual.forEach((p,i)=>near(p,ref.probabilities[i]));
 near(Array.from(state,([b,p])=>b*p).reduce((a,b)=>a+b,0),ref.remaining);
});
test('caps and Sunday resets match independent histories with branch mass preserved',()=>{
 for(const increments of [[.1,.3,.6,0,.07,.2],[.7,0,0,0,0,0],[0,0,0,0,0,0]]){
  const bases=[.1,.1,.1,.3,.3,.3],ref=enumerate(increments,bases);let state=new Map([[0,1]]);
  increments.forEach((x,i)=>{
   state=sim.addTastyChanceBonus(state,x);
   const r=sim.resolveTastyChanceMeal(state,bases[i]);state=r.distribution;
   near(r.successProbability,ref.probabilities[i]);
   near(Array.from(state.values()).reduce((a,b)=>a+b,0),1);
   assert.ok(state.size<=i+2);
  });
  near(Array.from(state,([b,p])=>b*p).reduce((a,b)=>a+b,0),ref.remaining);
 }
 const sunday=sim.resolveTastyChanceMeal(new Map([[.7,1]]),.3);
 const sundayEntries=Array.from(sunday.distribution,([b,p])=>[b,p]);
 assert.equal(sundayEntries.length,1);
 assert.equal(sundayEntries[0][0],0);
 assert.equal(sundayEntries[0][1],1);
 for(const bad of [new Map(),new Map([[.8,1]]),new Map([[0,.5]])])
  assert.throws(()=>sim.addTastyChanceBonus(bad,.1));
});
// Independent last-success-history ledger: no Map merging and no production
// probability helpers. Shares only the observed expected skill increments.
function replayTrace(events){
 let paths=[{p:1,bonus:0}],energy=0;const chances=[];
 for(const event of events){
  if('grant' in event){for(const w of paths)w.bonus=Math.min(.7,w.bonus+event.grant);continue;}
  let successes=0;
  for(const w of paths){
   const chance=Math.min(1,event.base+w.bonus),win=w.p*chance;
   successes+=win;w.p-=win;
  }
  paths.push({p:successes,bonus:0});chances.push(successes);
  energy+=(1-successes)*event.normal+successes*event.extra;
 }
 return {energy,chances,bonus:paths.reduce((n,w)=>n+w.p*w.bonus,0)};
}
test('weekly Tasty Chance and Bulk Up cooking follow independent reset-history accounting',()=>{
 for(const skill of ['Tasty Chance S','Cooking Assist S (Bulk Up)']){
  const ctx=load(false,true),species=ctx.master.species.find(s=>s.skill===skill);
  const x=input(species.name);
  x.box[0].ingredients[0]=ctx.master.ingredients[species.ings.find(s=>s.c1>0).name];
  const r=ctx.sim.simulate(x),ref=replayTrace(ctx.trace),old=load(true).sim.simulate(x);
  assert.equal(r.meals.length,21);assert.equal(ref.chances.length,21);
  assert.ok(ctx.trace.some(e=>e.grant>0));
  r.meals.forEach((m,i)=>near(m.successProbability,ref.chances[i]));
  near(r.cooking,ref.energy);near(r.successBonus,ref.bonus);
  assert.ok(old.cooking>r.cooking,'old mean closure overcounts this weekly fixture');
  for(const key of ['berries','skills','skillTriggers','inventory','ingredients','nightEnergy'])
   assert.deepEqual(JSON.parse(JSON.stringify(r[key])),JSON.parse(JSON.stringify(old[key])),key);
 }
});
test('no chance skills, disabled mode and failed meals retain existing behavior',()=>{
 const ctx=load(),old=load(true);
 for(const mode of ['expected','none']){
  const x=input(mode==='none'?'デデンネ':'ライチュウ');x.options.successMode=mode;
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.sim.simulate(x))),JSON.parse(JSON.stringify(old.sim.simulate(x)))) ;
 }
 const traced=load(false,true),x=input();x.options.recipeId='';
 const r=traced.sim.simulate(x);assert.equal(r.meals.length,0);
 assert.ok(traced.trace.every(e=>'grant' in e));near(r.successBonus,.7);
});
test('remaining skill-rate uncertainty stays HOLD in preview, browser replay and CLI',()=>{
 const {sim,obs,master}=load();
 for(const skill of ['Tasty Chance S','Cooking Assist S (Bulk Up)']){
  const sp=master.species.find(s=>s.skill===skill),x=input(sp.name);
  x.box[0].ingredients[0]=master.ingredients[sp.ings.find(s=>s.c1>0).name];
  const cap=obs.captureSimulation(x,sim.simulate(x),'0.2.62','2026-10-21T16:00:00.000Z');
  const report=obs.makeReport(cap,{mondayDate:'2026-10-19',total:'100',berryAndStrengthSkill:'60',cooking:'40',
   confirmedSummary:true,...Object.fromEntries(obs.flags.map(k=>[k,true]))});
  for(const reviewed of [obs.preview(report),obs.reviewImportedReport(report,sim.simulate),
    require('../scripts/step2-m1-observation-compare.cjs').compareSingleWeek(report)]){
   assert.equal(reviewed.status,'CONFOUNDED_OBSERVATION');
   assert.ok(JSON.stringify(reviewed).includes('上限時の待機ストック'));
  }
  x.options.successMode='none';
  assert.equal(obs.knownModelLimitations(x).some(s=>s.includes('料理チャンス系')),false);
  x.options.successMode='expected';
  x.box.push({...x.box[0],id:'inactive'});x.box[0].pokemon='ライチュウ';
  assert.equal(obs.knownModelLimitations(x).some(s=>s.includes('料理チャンス系')),false);
 }
});
module.exports={load,input,replayTrace};

'use strict';
/* M1 B-grade CONTROLLED ranking oracle.
 * Compare five representative pair SHAPES after turning all ingredient
 * draws and all main skill activations OFF. This verifies only the
 * deterministic berry/time/roster projection of the rankings, not the
 * real-game R01-R05 full stochastic results.
 *
 * Independent clock: one minute at a time. Never imports the simulator's
 * berry formula, energy-speed function, help counter, team switch helper,
 * or recovery routine. Shares the same source master species constants.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx,{filename:file});
const master=ctx.globalThis.PokeMaster,sim=ctx.globalThis.PokeSimulator;
const members=[
 ['r0','ライチュウ'],['r1','ライチュウ'],['r2','ライチュウ'],
 ['r3','ライチュウ'],['r4','ライチュウ'],['w0','プクリン'],
 ['w1','サーナイト'],['g0','フシギバナ'],['f0','リザードン'],
 ['t0','バクフーン']
];
const sleep=['r0','r1','r2','r3','r4'];
const namedTeams={
 allBerry:['r0','r1','r2','r3','r4'],
 oneHealer:['r0','r1','r2','r3','w0'],
 twoHealer:['r0','r1','r2','w0','w1'],
 food:['r0','r1','r2','g0','f0'],
 mixed:['r0','r1','g0','w0','f0']
};
const lineups={
 allBerry:{morning:namedTeams.allBerry,noon:namedTeams.allBerry,evening:namedTeams.allBerry},
 oneHealer:{morning:namedTeams.oneHealer,noon:namedTeams.oneHealer,evening:namedTeams.oneHealer},
 twoHealer:{morning:namedTeams.twoHealer,noon:namedTeams.twoHealer,evening:namedTeams.twoHealer},
 food:{morning:namedTeams.food,noon:namedTeams.food,evening:namedTeams.food},
 mixed:{morning:namedTeams.mixed,noon:namedTeams.mixed,evening:namedTeams.mixed},
 switching:{
  morning:namedTeams.oneHealer,noon:namedTeams.food,
  evening:['r0','r1','r2','r3','t0']
 }
};
const pairPlan=[
 ['R01','allBerry','oneHealer'],['R02','oneHealer','twoHealer'],
 ['R03','allBerry','food'],['R04','food','mixed'],
 ['R05','oneHealer','switching']
];
const baseBerry={
 normal:28,fire:27,water:31,electric:25,grass:30,ice:32,
 fighting:27,poison:32,ground:29,flying:24,psychic:26,
 bug:24,rock:30,ghost:26,dragon:35,dark:31,steel:33,fairy:26
};
const species=new Map();
function getSpecies(name){
 const sp=master.species.find(p=>p.name===name);
 if(!sp)throw Error('Missing controlled species: '+name);
 return sp;
}
function fixture(roster){
 const box=members.map(([id,name])=>{
  const sp=getSpecies(name),slot=(sp.mythIng||sp.ings).find(x=>x&&x.c1>0);
  if(!slot)throw Error('No first ingredient for '+name);
  species.set(id,{frequency:sp.frequency,specialty:sp.specialty,type:sp.type});
  return {id,pokemon:name,nickname:id,level:50,skillLevel:6,
   ingredients:[master.ingredients[slot.name],'',''],
   subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false};
 });
 return {box,teams:{morning:[...roster.morning],noon:[...roster.noon],
   evening:[...roster.evening],sleep:[...sleep]},
  options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
   sleepScore:80,initialEnergy:30,foodMode:'curry',recipeMode:'fixed',
   recipeId:'',initialIngredients:{},bagCapacity:0,camp:false,
   extraMode:'none',successMode:'none'}};
}
function berryValue(type){
 const raw=Math.max(baseBerry[type]+49,Math.round(baseBerry[type]*Math.pow(1.025,49)));
 return Math.ceil(Math.ceil(raw*1.25-1e-9)*
  (['electric','ghost','steel'].includes(type)?2:1)-1e-9);
}
function speedMultiplier(energy){
 if(energy>80)return .45;
 if(energy>60)return .52;
 if(energy>40)return .58;
 if(energy>1)return .66;
 return 1;
}
function independentMinuteWeek(input){
 const activeIds=new Set(input.box.map(p=>p.id));
 const energy=new Map(input.box.map(p=>[p.id,30]));
 const phases=new Map(),decay=new Map(),count=new Map(input.box.map(p=>[p.id,0]));
 let current=[];
 function select(next){
  const set=new Set(next);
  if(next.length!==5||set.size!==5||[...set].some(x=>!activeIds.has(x)))
   throw Error('Invalid controlled roster');
  for(const id of current)if(!set.has(id)){
   phases.delete(id);
   decay.delete(id);
  }
  current=[...next];
 }
 function minute(){
  for(const id of current){
   const sp=species.get(id),baseHelp=sp.frequency*0.902;
   const progress=(phases.get(id)||0)+60/(baseHelp*speedMultiplier(energy.get(id)));
   const completed=Math.floor(progress+1e-11);
   phases.set(id,Math.max(0,progress-completed));
   count.set(id,count.get(id)+completed);
   const elapsed=(decay.get(id)||0)+1;
   if(elapsed===10){
    energy.set(id,Math.max(0,energy.get(id)-1));
    decay.set(id,0);
   }else decay.set(id,elapsed);
  }
 }
 const names=['morning','noon','evening'];
 for(let d=0;d<7;d++){
  let currentPeriod='';
  for(let m=0;m<990;m++){
   const name=names[m<270?0:m<630?1:2];
   if(name!==currentPeriod){select(input.teams[name]);currentPeriod=name;}
   minute();
  }
  select(input.teams.sleep);
  // Sunday 00:00 -> Monday 04:00 is uncollected and must not be
  // credited to the preceding week's earned Strength.
  if(d<6){
   for(let m=0;m<450;m++)minute();
   for(const id of sleep){
    const was=energy.get(id),next=Math.max(was,Math.ceil(Math.min(100,was+80)));
    if(next>was)decay.set(id,0);
    energy.set(id,next);
   }
  }
 }
 const byId={};let total=0;
 for(const [id,name] of members){
  const sp=species.get(id),berryPerHelp=
   sp.specialty==='Berries'||sp.specialty==='All'?2:1;
  const unit=berryValue(sp.type),helps=count.get(id);
  byId[id]={name,completedHelps:helps,unitBerryEnergy:unit,
   berryPerHelp,energy:helps*berryPerHelp*unit};
  total+=byId[id].energy;
 }
 return {total,byId};
}
function controlledRankings(){
 const modified=[...new Set(members.map(x=>x[1]))].map(getSpecies);
 const originals=modified.map(sp=>({sp,ingRate:sp.ingRate,skillRate:sp.skillRate,
  carryLimit:sp.carryLimit}));
 try{
  for(const sp of modified)Object.assign(sp,{ingRate:0,skillRate:0,carryLimit:1000000});
  const results={};
  for(const [key,roster] of Object.entries(lineups)){
   const input=fixture(roster),reference=independentMinuteWeek(input),actual=sim.simulate(input);
   assert.equal(actual.berries,reference.total,key+' independent berry mismatch');
   assert.equal(actual.total,reference.total,key+' independent total mismatch');
   assert.equal(actual.cooking,0,key+' phantom cooking');
   assert.equal(actual.skills,0,key+' phantom skills');
   assert.equal(actual.sneaky,0,key+' unexpected carry overflow');
   results[key]={reference:reference.total,simulated:actual.total,difference:actual.total-reference.total,
    byId:reference.byId};
  }
  const pairs=pairPlan.map(([id,a,b])=>{
   const expected=results[b].reference-results[a].reference;
   const model=results[b].simulated-results[a].simulated;
   const winner=x=>x===0?'TIE':x>0?'B':'A';
   assert.equal(model,expected,id+' controlled rank delta mismatch');
   return {id,configurationA:a,configurationB:b,
    referenceDeltaBminusA:expected,modelDeltaBminusA:model,
    referenceLeader:winner(expected),modelLeader:winner(model),
    controlledOrderingAgrees:winner(expected)===winner(model),
    originalStochasticRankingValidated:false};
  });
  return {schema:'step2-m1-controlled-ranking-v1',
   grade:'B_CONTROLLED_BERRY_ONLY',step2:'HOLD',m1:'PARTIAL',step3:'NOT_STARTED',
   actualGameWeeklyValidated:false,originalStochasticRankingPairsValidated:false,
   controls:'Level50 neutral; food and main-skill draw rates artificially 0, huge carry; fixed sleeping Raichu x5; energy30; sleep score80; no meals; Gold Power Plant FB25%',
   independentReference:'one-minute clock and berry arithmetic; no simulator helper functions',
   results,pairs};
 }finally{
  for(const old of originals)Object.assign(old.sp,{ingRate:old.ingRate,
   skillRate:old.skillRate,carryLimit:old.carryLimit});
 }
}
if(require.main===module)console.log('M1_CONTROLLED_RANKING_JSON='+JSON.stringify(controlledRankings()));
module.exports={controlledRankings};

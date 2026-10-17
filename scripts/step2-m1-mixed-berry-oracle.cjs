'use strict';
/* Independent ONE-MINUTE mixed-species berry oracle for controlled,
 * food-free/skill-free Pokémon Sleep weeks. This is not a reference for
 * stochastic real-game mixed parties.
 * Production's 15-minute integrators, energy helpers, Berry formulas,
 * team-switch helpers and collection routines are NOT reused here.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const filename of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',filename),'utf8'),ctx,{filename});
const master=ctx.globalThis.PokeMaster,engine=ctx.globalThis.PokeSimulator;
const kinds=['ライチュウ','フシギバナ','リザードン','プクリン','バクフーン','トドゼルガ','エーフィ'];
const ids=kinds.map((_,i)=>'p'+i),sleep=ids.slice(0,5);
const BERRY={normal:28,fire:27,water:31,electric:25,grass:30,ice:32,fighting:27,poison:32,
 ground:29,flying:24,psychic:26,bug:24,rock:30,ghost:26,dragon:35,dark:31,steel:33,fairy:26};
const frequencies=new Map();
function setupBox(){
 return kinds.map((name,i)=>{
  const sp=master.species.find(s=>s.name===name);
  if(!sp||!Array.isArray(sp.ings))throw Error('M1 mixed berry oracle master fixture missing '+name);
  frequencies.set('p'+i,{frequency:sp.frequency,type:sp.type,specialty:sp.specialty});
  const first=sp.ings.find(x=>x.c1>0);
  if(!first)throw Error('No first ingredient '+name);
  return {id:'p'+i,pokemon:name,nickname:name,level:1,skillLevel:1,
   ingredients:[master.ingredients[first.name],'',''],subskills:['','','','',''],
   nature:'まじめ',sleepHours:0,shiny:false};
 });
}
function berryOracle(type,level,bonus,favorite){
 const base=BERRY[type];
 if(base===undefined)throw Error('Unknown berry type '+type);
 const raw=Math.max(base+level-1,Math.round(base*Math.pow(1.025,level-1)));
 return Math.ceil(Math.ceil(raw*(1+bonus/100))*(favorite?2:1));
}
function acceleration(e){return e>80?.45:e>60?.52:e>40?.58:e>1?.66:1;}
function fixture(rotates,score,start){
 const box=setupBox();
 const morning=sleep.slice(),noon=rotates?[ids[0],ids[1],ids[2],ids[5],ids[6]]:sleep.slice(),
  evening=rotates?[ids[0],ids[1],ids[2],ids[3],ids[6]]:sleep.slice();
 return {box,teams:{morning,noon,evening,sleep:sleep.slice()},
  options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
   sleepScore:score,initialEnergy:start,foodMode:'curry',recipeMode:'fixed',
   recipeId:'',initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'none'}};
}
function minuteOracle(input){
 const energy=new Map(ids.map(id=>[id,input.options.initialEnergy]));
 const phase=new Map(),timers=new Map(),credited=new Map(ids.map(id=>[id,0]));
 let current=[];
 const transition=next=>{
  const retained=new Set(next);
  for(const id of current)if(!retained.has(id)){phase.delete(id);timers.delete(id);}
  current=next;
 };
 const oneMinute=()=>{
  for(const id of current){
   const sp=frequencies.get(id),freq=sp.frequency; // level1/nature neutral/no subskill
   const work=60/(freq*acceleration(energy.get(id)));
   const sum=(phase.get(id)||0)+work;
   const helps=Math.floor(sum+1e-11);
   phase.set(id,Math.max(0,sum-helps));
   credited.set(id,credited.get(id)+helps);
   const next=(timers.get(id)||0)+1;
   if(next===10){energy.set(id,Math.max(0,energy.get(id)-1));timers.set(id,0);}
   else timers.set(id,next);
  }
 };
 for(let d=0;d<7;d++){
  for(let minute=0;minute<990;minute++){
   const group=minute<270?input.teams.morning:minute<630?input.teams.noon:input.teams.evening;
   if(current!==group)transition(group);
   oneMinute();
  }
  transition(input.teams.sleep);
  if(d<6){
   for(let t=0;t<450;t++)oneMinute();
   for(const id of input.teams.sleep){
    const old=energy.get(id),after=Math.max(old,Math.ceil(Math.min(100,old+Math.round(input.options.sleepScore))));
    if(after>old)timers.set(id,0);
    energy.set(id,after);
   }
  }
  // Last Sunday 00:00 -> Monday 04:00 has no user interaction;
  // all items produced then remain uncollected and earn zero old-week berries.
 }
 let total=0;
 const bySpecies={};
 for(const id of ids){
  const sp=frequencies.get(id),berryCount=sp.specialty==='Berries'||sp.specialty==='All'?2:1;
  const favorite=['electric','ghost','steel'].includes(sp.type);
  const strength=berryOracle(sp.type,1,input.options.fieldBonus,favorite);
  const contribution=credited.get(id)*berryCount*strength;
  total+=contribution;
  bySpecies[id]={name:input.box.find(x=>x.id===id).pokemon,completedHelps:credited.get(id),
   berryPerHelp:berryCount,unitStrength:strength,energy:contribution};
 }
 return {total,bySpecies,unrecoveredBoxIds:ids.filter(id=>!input.teams.sleep.includes(id))};
}
function compareControlled(rotates,score,start){
 const pokemon=kinds.map(name=>master.species.find(sp=>sp.name===name));
 const old=pokemon.map(sp=>({ingRate:sp.ingRate,skillRate:sp.skillRate,carryLimit:sp.carryLimit}));
 try{
  pokemon.forEach(sp=>Object.assign(sp,{ingRate:0,skillRate:0,carryLimit:1000000}));
  const input=fixture(rotates,score,start);
  const reference=minuteOracle(input),actual=engine.simulate(input);
  assert.equal(actual.berries,reference.total,'Mixed berry oracle failed: '+JSON.stringify({rotates,score,start}));
  assert.equal(actual.total,reference.total);
  assert.equal(actual.cooking,0);assert.equal(actual.skills,0);assert.equal(actual.sneaky,0);
  assert.equal(actual.meals.length,0);
  return {rotates,score,start,expected:reference.total,observed:actual.total,
   absoluteDifference:actual.total-reference.total,
   bySpecies:reference.bySpecies,
   qualification:'B: controlled 7-species, 1-minute independent berry/energy/phase calculation with stochastic ingredients and skills switched off; NOT validated real gameplay'};
 }finally{pokemon.forEach((sp,i)=>Object.assign(sp,old[i]));}
}
function buildControlledReport(){
 const fixed=compareControlled(false,0,100);
 const rotated=compareControlled(true,80,30);
 return {schema:'step2-m1-controlled-mixed-berry-v1',step2:'HOLD',
  source:'independent one-minute formula with shared master frequency',
  grade:'B_CONTROLLED_ONLY',
  actualGameWeeklyValidated:false,fullStochasticTeamComparisonValidated:false,
  cases:[{id:'MB01',...fixed},{id:'MB02',...rotated}]};
}
if(require.main===module)console.log('M1_CONTROLLED_JSON='+JSON.stringify(buildControlledReport()));
module.exports={buildControlledReport};

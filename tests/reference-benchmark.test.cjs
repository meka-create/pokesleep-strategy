'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js']){
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../src',file),'utf8'),ctx,{filename:file});
}
const engine=ctx.globalThis.PokeSimulator,master=ctx.globalThis.PokeMaster;
const REF_BERRY_BASE={
 normal:28,fire:27,water:31,electric:25,grass:30,ice:32,fighting:27,
 poison:32,ground:29,flying:24,psychic:26,bug:24,rock:30,ghost:26,
 dragon:35,dark:31,steel:33,fairy:26
};
// Independent formula copied from nitoyon/pokesleep-tool src/util/Berry.ts.
// This benchmark must NOT use the simulator's own rounding or berry lookup.
function oracleBerry(type,level,areaBonus,favorite){
 if(level===0)return 0;
 const v=REF_BERRY_BASE[type];
 const basic=Math.max(v+level-1,Math.round((1.025**(level-1))*v));
 return Math.ceil(Math.ceil(basic*(1+areaBonus/100))*(favorite?2:1));
}
function oracleSpeed(energy){
 if(energy>80)return .45;
 if(energy>60)return .52;
 if(energy>40)return .58;
 if(energy>1)return .66;
 return 1;
}
// Independent one-MINUTE discrete integrator (vs production's 15-minute
// tick). Awake 7*16.5h plus SIX already-collected 7.5h sleeps = 160.5h.
// Sunday 00:00-04:00 is deliberately omitted: no interaction before reset.
function oracleWeeklyCompletedHelps(){
 let energy=100,phase=0,completed=0;
 const minutes=7*990+6*450;
 for(let m=0;m<minutes;m++){
  if(m>0&&m%10===0)energy=Math.max(0,energy-1);
  phase+=60/(2200*oracleSpeed(energy));
  const n=Math.floor(phase+1e-12);
  phase-=n;completed+=n;
 }
 return {minutes,completed,phase,energy};
}
function isolatedNoSkillScenario(){
 const ids=Array.from({length:5},(_,i)=>String(i));
 return {
  box:ids.map(id=>({
   id,pokemon:'ライチュウ',nickname:id,level:1,skillLevel:1,
   ingredients:['とくせんリンゴ','あったかジンジャー','とくせんエッグ'],
   subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false
  })),
  teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ワカクサ本島',fieldBonus:0,tapMinutes:150,potSize:57,
   sleepScore:0,initialEnergy:100,foodMode:'curry',recipeId:'',
   initialIngredients:{},bagCapacity:0,camp:false}
 };
}
test('independent pokesleep-tool Berry.ts oracle on types, levels, areas and favorite multipliers',()=>{
 let compared=0;
 for(const type of Object.keys(REF_BERRY_BASE)){
  for(const level of [1,2,10,25,50,60,75,100]){
   for(const bonus of [0,25,50,75,100]){
    for(const favorite of [false,true]){
     assert.equal(engine.berryUnit(type,level,favorite?[type]:[],bonus),
      oracleBerry(type,level,bonus,favorite),
      'berry mismatch type='+type+' lv='+level+' area='+bonus+' favorite='+favorite);
     compared++;
    }
   }
  }
 }
 assert.equal(compared,1440);
});
test('independent pokesleep-tool Energy.ts oracle cooking boundary values, including fractional Energy',()=>{
 const oracle=e=>e>80?1:e>70?2:e>60?3:e>50?4:e>40?5:e>30?6:e>20?7:e>10?8:9;
 let compared=0;
 for(const value of [0,1,10,10.00001,10.5,11,20,20.5,30,30.5,40,40.5,
   50,50.5,60,60.5,70,70.5,80,80.5,81,100,149.5]){
  assert.equal(engine.mealRecovery(value),oracle(value),'cook energy '+value);
  compared++;
 }
 assert.equal(compared,23);
});
test('independent wake Energy.ts reference: round score first, apply modifiers, then ceil restored Energy',()=>{
 const reference=(current,score,nature,count,personal)=>{
  const cap=personal?105:100;
  const recovered=Math.ceil(Math.min(cap,current+Math.round(score)*nature*(1+.14*count)));
  return Math.max(current,recovered);
 };
 for(const score of [1,37,53,74,100])
  for(const nature of [.88,1,1.2])
   for(const count of [0,1,2]){
    const current=19.7;
    assert.equal(engine.recoverFromSleep(current,score,nature,count,false),
      reference(current,score,nature,count,false));
   }
 // User invariant: never reduce already-high Energy at wake.
 assert.equal(engine.recoverFromSleep(115,100,1,0,false),115);
 assert.equal(engine.recoverFromSleep(19.7,0,1,0,false),19.7);
});
test('independent 1-minute energy clock gives exactly the same collected 7-day berry total as 15-minute simulator',()=>{
 const species=master.species.find(x=>x.name==='ライチュウ');
 const original={frequency:species.frequency,ingRate:species.ingRate,skillRate:species.skillRate,carryLimit:species.carryLimit};
 try{
  species.frequency=2200;species.ingRate=0;species.skillRate=0;species.carryLimit=10000000;
  const expected=oracleWeeklyCompletedHelps();
  assert.equal(expected.minutes,9630);
  assert.equal(expected.completed,283);
  assert.equal(expected.energy,0);
  const actual=engine.simulate(isolatedNoSkillScenario());
  const referenceEnergy=expected.completed*5*2*oracleBerry('electric',1,0,false);
  assert.equal(referenceEnergy,70750);
  assert.equal(actual.berries,referenceEnergy);
  assert.equal(actual.total,referenceEnergy);
  assert.equal(actual.sneaky,0);
  assert.equal(actual.skills,0);
  assert.equal(actual.cooking,0);
  assert.equal(actual.skillTriggers,0);
  assert.equal(actual.days.length,7);
  // Sunday 00:00-04:00 still counts completed helps internally, but no
  // morning collection occurs: total >= collected helps.
  assert.ok(actual.skillHelpCompletions>=expected.completed*5);
 }finally{Object.assign(species,original)}
});

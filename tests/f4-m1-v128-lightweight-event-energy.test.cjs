'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const scope={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),scope,{filename:p,timeout:15000});
 return scope.module.exports;
}
const lite=load('f4/f4-m1-lite-energy-v128.js'),
 cooking=load('f4/f4-c-cooking-skills-v102.js'),
 values=load('f1/f1-c-skill-values-v1.js');
const recipes=load('e7-preview/e7-recipes-v122.js');
const WEEK='2026-08-10',manual=week=>({weekStart:week,eventId:'manual:'+week,fields:{source:null}});
function official(effects={},target={},week=WEEK){
 const id='pokesleep-tool:synthetic cooking week:'+week;
 return {weekStart:week,eventId:id,fields:{source:{
  id,start:week,upstreamRevision:'a'.repeat(40),
  verifiedEffects:effects,verifiedTarget:target,unknownEffects:false
 }}};
}
const neutral=lite.event(manual(WEEK));
const event=(effects,target)=>lite.event(official(effects,target));
const apple=recipes.find(r=>r.id==='apple_curry');
function cook(state,day,bonus=1){
 return lite.cook(state,apple,0,bonus,day,cooking);
}
test('M1: 81 recipes are pinned to Lv70; strength70 is not boosted twice',()=>{
 assert.equal(recipes.length,81);
 assert.equal(apple.baseStrength,748);
 assert.equal(apple.strength70,2678);
 assert.equal(lite.recipeEnergy(apple,0,1).base,2678);
 assert.equal(lite.recipeEnergy(apple,0,1.5).base,4017);
 assert.equal(lite.recipeEnergy(apple,60,1.5).base,6427);
 assert.equal(lite.recipeEnergy({...apple,strength70:undefined},0,1).status,'BLOCKED');
});
test('M1: event owner, event provenance and unknown bonuses fail closed',()=>{
 assert.equal(neutral.status,'EVENT_READY');
 assert.equal(neutral.dish,1);
 assert.equal(event({dish:1.5,skillTrigger:1.25}).dish,1.5);
 assert.equal(event({dish:1.5,skillTrigger:1.25}).skillTrigger,1.25);
 assert.equal(lite.event({...official({dish:1.5}),eventId:'pokesleep-tool:other:2026-08-10'}).status,'BLOCKED');
 const nope=event({dish:1.5,unknownExcitingBuff:20});
 assert.equal(nope.status,'BLOCKED');
 assert.equal(nope.reason,'M1_EVENT_EFFECT_UNMODELED');
 assert.equal(event({potSize:2}).status,'EVENT_READY','M2 models verified pot capacity separately from skill procs');
 assert.equal(event({potSize:2}).potSize,2);
 assert.equal(event({dish:-1}).status,'BLOCKED');
});
test('M1: verified target scope applies skill proc, ingredient +1 and level independently',()=>{
 const raw=id=>({
  id,source:'F1_B_PINNED_66_SPECIES',skillCode:'Tasty Chance S',
  skillSpecialty:id==='p1'?'Skills':'Ingredients',pokemonType:'psychic',
  selectedMainSkillLevel:1,carryLimit:42,
  ratesByTeammateBonus:Array.from({length:5},()=>({
   status:'BASE_RATES_AVAILABLE',helpSeconds:3000,
   skillProbabilityPerEligibleHelp:.15,ingredientProbabilityPerHelp:.25,
   ingredientCountsPerHelp:{apple:.5,milk:.25},berryItemsPerHelp:1,
   berryCountPerBerryHelp:1,berryEnergyPerHelp:50
  }))
 });
 const source=event({skillTrigger:1.5,skillLevel:3,ingredient:1},{specialty:'Skills'});
 assert.equal(source.status,'EVENT_READY',source.reason);
 const got=lite.withEvent([raw('p1'),raw('p2')],source,values);
 assert.equal(got.status,'ROSTER_READY',got.reason);
 assert.equal(got.profiles[0].selectedMainSkillLevel,4);
 assert.equal(got.profiles[1].selectedMainSkillLevel,1);
 assert(Math.abs(got.profiles[0].ratesByTeammateBonus[0].skillProbabilityPerEligibleHelp-.225)<1e-8);
 assert.equal(got.profiles[1].ratesByTeammateBonus[0].skillProbabilityPerEligibleHelp,.15);
 assert.equal(got.profiles[0].ratesByTeammateBonus[0].ingredientCountsPerHelp.apple,2/3);
 assert.equal(got.profiles[1].ratesByTeammateBonus[0].ingredientCountsPerHelp.apple,.5);
});
test('M1: probabilistic tasty chance reuses v102 carry, success reset, weekday/Sunday',()=>{
 const start=cooking.initial({potExtra:0,tastyExtra:0});
 const after=lite.expectedTastyCast(start,1,1,1,values,cooking);
 assert.equal(after.status,'STATE_READY',after.reason);
 assert(Math.abs(after.tastyDistribution[4]-1)<1e-8);
 const monday=cook(after,0);
 assert.equal(monday.status,'COOKED');
 assert(Math.abs(monday.criticalProbability-.14)<1e-8);
 const tuesday=cook(monday.state,1);
 assert(Math.abs(tuesday.criticalProbability-.1344)<1e-8);
 const sunday=cook(after,6);
 assert(Math.abs(sunday.criticalProbability-.34)<1e-8);
 const half=lite.expectedTastyCast(start,1,.5,1,values,cooking);
 assert.equal(half.tastyDistribution[4],.5);
 assert.equal(half.tastyDistribution[0],.5);
 assert(Math.abs(cook(half,0).criticalProbability-.12)<1e-8);
 const two=lite.expectedTastyCast(start,1,1,2,values,cooking);
 assert(Math.abs(two.tastyDistribution[0]-.25)<1e-8);
 assert(Math.abs(two.tastyDistribution[4]-.5)<1e-8);
 assert(Math.abs(two.tastyDistribution[8]-.25)<1e-8);
});
test('M1: cooking bonus raises value of tasty chance and can reverse the winning team',()=>{
 const start=cooking.initial({potExtra:0,tastyExtra:0});
 const after=lite.expectedTastyCast(start,1,1,1,values,cooking);
 const increment=bonus=>cook(after,0,bonus).energyExpected-
  cook(start,0,bonus).energyExpected;
 const noEvent=increment(1),highEvent=increment(3);
 assert(noEvent>0);
 assert(highEvent>noEvent*2.9&&highEvent<noEvent*3.1);
 const berryAlternative=200; // illustrative extra berry energy from another team
 assert(noEvent<berryAlternative,'normal week favors the berry alternative');
 assert(highEvent>berryAlternative,'cooking-bonus week favors the tasty-chance user');
});
test('M1: event and chance adjustments do not modify original profiles or source',()=>{
 const raw={id:'p1',skillSpecialty:'Skills',pokemonType:'psychic',carryLimit:40,
  selectedMainSkillLevel:1,skillCode:'Tasty Chance S',
  ratesByTeammateBonus:[{ingredientProbabilityPerHelp:.1,
   ingredientCountsPerHelp:{apple:.2},skillProbabilityPerEligibleHelp:.4,
   berryItemsPerHelp:1,berryCountPerBerryHelp:1,berryEnergyPerHelp:50}]};
 const clone=JSON.stringify(raw);
 const ev=event({skillTrigger:1.5,ingredient:1},{specialty:'Skills'});
 const adjusted=lite.withEvent([raw],ev,values);
 assert.equal(adjusted.status,'ROSTER_READY',adjusted.reason);
 assert.equal(JSON.stringify(raw),clone);
 assert(Math.abs(adjusted.profiles[0].ratesByTeammateBonus[0].skillProbabilityPerEligibleHelp-.6)<1e-10);
});
test('M1: E7 injection, F4 and F5 scoring call verified shared module',()=>{
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 const f4=read('f4/f4-c-auto-v112.js');
 const f5=read('f5/f5-midweek-v119.js');
 const item=read('f4/f4-c-item-aware-rank-v101.js');
 assert.match(html,/f4-m1-lite-energy-v128\.js/);
 assert.match(html,/f4-c-cooking-skills-v102\.js/);
 assert.match(ui,/m1Lite:root\.PokeM1LiteEnergyV128/);
 assert.match(f4,/deps\.m1Lite\.withEvent/);
 assert.match(f5,/deps\.m1Lite\.withEvent/);
 assert.match(item,/M1_LIGHTWEIGHT_EVENT_V128/);
 assert.match(item,/expectedTastyCast/);
});

test('tasty support competes with replacement energy for the next cook only',()=>{
 const dishes=[{size:5,baseStrength:10000,requirements:{apple:5}},
  {size:90,baseStrength:30000,requirements:{milk:90}}];
 const windows=[{day:5,slot:'morning'},{day:5,slot:'noon'},
  {day:5,slot:'sleep'},{day:6,slot:'morning'}];
 const credit=lite.nextMealCredit(dishes,80,false,windows);
 const stock={apple:5,milk:90};
 assert.equal(credit[0](stock,20),2000);
 assert.equal(credit[0](stock,30),3000);
 assert.equal(credit[0](stock,40),3000);
 assert.equal(credit[0]({},30),0);
 assert.equal(credit[1](stock,20),6000);
 const mixture=Array(71).fill(0);mixture[0]=0.5;mixture[40]=0.5;
 assert.equal(credit[0](stock,{tastyDistribution:mixture}),1500);
 assert.equal(credit[3](stock,30),0);
});

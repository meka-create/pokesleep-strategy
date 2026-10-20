'use strict';
/* STEP 2 M1: independently integrated deterministic berry + food + cook week.
 * Force all Raichu helps to drop exactly 1 apple, all Bulbasaur helps to
 * drop a berry, all main skills off, and virtually unlimited carry space.
 * ONE-MINUTE reference never calls any simulator helper or its meal planner.
 * An artificial controlled B reference, NOT real-game mixed-week validation.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),sandbox,{filename:name});
const master=sandbox.globalThis.PokeMaster,engine=sandbox.globalThis.PokeSimulator;
const recipe=master===null?null:sandbox.globalThis.PokeRecipes.find(x=>x.id==='apple_curry');
assert.equal(recipe.requirements.apple,7);
const boxNames=[['r0','ライチュウ'],['r1','ライチュウ'],
 ['b0','フシギダネ'],['b1','フシギダネ'],['b2','フシギダネ'],
 ['b3','フシギダネ'],['b4','フシギダネ']];
const sleep=['r0','b0','b1','b2','b3'];
const morning=['r0','b0','b1','b2','b3'];
const rotating={
 morning:['r0','b0','b1','b2','b3'],
 noon:['r0','r1','b0','b1','b2'],
 evening:['r0','b0','b1','b2','b4']
};
const configs=[
 {id:'CM01',label:'fixed producer and fixed berry squad, initially enough for breakfast',
  initialApple:7,teams:{morning,noon:morning,evening:morning}},
 {id:'CM02',label:'morning/noon/evening substitutes, start with no meal inventory',
  initialApple:0,bagCapacity:0,teams:rotating},
 {id:'CM03',label:'always-sized global bag7, held food until a meal frees storage',
  initialApple:7,bagCapacity:7,teams:{morning,noon:morning,evening:morning}},
 // Artificial zero-food/zero-skill chance: no apples are produced during the
 // entire week. Only the INITIAL seven-apple difference changes last meal.
 {id:'CM04',label:'140 initial apples: Sunday evening 21st meal is skipped',
  initialApple:140,bagCapacity:500,sleepScore:0,noAppleProduction:true,
  teams:{morning,noon:morning,evening:morning}},
 {id:'CM05',label:'147 initial apples: Sunday evening 21st meal is cooked',
  initialApple:147,bagCapacity:500,sleepScore:0,noAppleProduction:true,
  teams:{morning,noon:morning,evening:morning}}
];
const types={normal:28,fire:27,water:31,electric:25,grass:30,ice:32,
 fighting:27,poison:32,ground:29,flying:24,psychic:26,
 bug:24,rock:30,ghost:26,dragon:35,dark:31,steel:33,fairy:26};
const speciesInfo={};
for(const [id,name] of boxNames){
 const sp=master.species.find(s=>s.name===name);
 if(!sp)throw Error('Missing controlled species '+name);
 speciesInfo[id]={type:sp.type,frequency:sp.frequency,specialty:sp.specialty,
  appleProducer:name==='ライチュウ'};
}
function fixture(c){
 return {box:boxNames.map(([id,name])=>{
  const sp=master.species.find(s=>s.name===name);
  const first=(sp.mythIng||sp.ings).find(x=>x?.c1>0);
  assert.ok(first,'first food slot must exist');
  return {id,pokemon:name,nickname:id,level:50,skillLevel:1,
   nature:'まじめ',sleepHours:0,shiny:false,
   ingredients:[master.ingredients[first.name],'',''],subskills:['','','','','']};
 }),teams:{morning:[...c.teams.morning],noon:[...c.teams.noon],
  evening:[...c.teams.evening],sleep:[...sleep]},
 options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
  sleepScore:c.sleepScore??80,initialEnergy:30,foodMode:'curry',
  recipeMode:'fixed',recipeId:'apple_curry',initialIngredients:{apple:c.initialApple},
  bagCapacity:c.bagCapacity||0,camp:false,extraMode:'none',successMode:'none'}};
}
function berryUnit(type){
 const base=types[type];
 if(!base)throw Error('Unknown berry type '+type);
 const raw=Math.max(base+49,Math.round(base*Math.pow(1.025,49)));
 const strengthened=Math.ceil(raw*1.25-1e-9);
 return strengthened*(type==='electric'||type==='ghost'||type==='steel'?2:1);
}
function frequencyFactor(e){
 if(e>80)return .45;
 if(e>60)return .52;
 if(e>40)return .58;
 if(e>1)return .66;
 return 1;
}
function mealRecovery(e){
 if(e>=150)return 0;
 if(e>80)return 1;
 if(e>70)return 2;
 if(e>60)return 3;
 if(e>50)return 4;
 if(e>40)return 5;
 if(e>30)return 6;
 if(e>20)return 7;
 if(e>10)return 8;
 return 9;
}
function oneMinuteOracle(c){
 const energy=new Map(boxNames.map(([id])=>[id,30]));
 const progress=new Map(),tenMinuteTimer=new Map();
 const pockets=new Map(boxNames.map(([id])=>[id,{apple:0,berries:0}]));
 let held=[],berryEnergy=0,cookingEnergy=0,producedApple=0,collectedApple=0,consumedApple=0;
 let inventory=c.initialApple;
 const meals=[];
 function select(next){
  const ids=new Set(next);
  if(next.length!==5||ids.size!==5||next.some(id=>!energy.has(id)))
   throw Error('Invalid five-person controlled lineup');
  for(const id of held)if(!ids.has(id)){
   progress.delete(id);
   tenMinuteTimer.delete(id);
   const bag=pockets.get(id);
   assert.equal(bag.apple,0,'swapped helper was not collected');
   assert.equal(bag.berries,0,'swapped helper was not collected');
  }
  held=[...next];
 }
 function collect(){
  for(const id of held){
   const bag=pockets.get(id);
   const free=c.bagCapacity?Math.max(0,c.bagCapacity-inventory):bag.apple;
   const accepted=Math.min(bag.apple,free);
   inventory+=accepted;
   collectedApple+=accepted;
   berryEnergy+=bag.berries*berryUnit(speciesInfo[id].type);
   bag.apple-=accepted;
   bag.berries=0;
  }
 }
 function cook(day,slot){
  if(inventory<7)return;
  inventory-=7;consumedApple+=7;
  const value=Math.floor(recipe.strength70*1.25+1e-9);
  cookingEnergy+=value;
  meals.push({day:day+1,slot,energy:value});
  for(const id of held){
   const old=energy.get(id),next=Math.min(150,old+mealRecovery(old));
   if(next>old)tenMinuteTimer.set(id,0);
   energy.set(id,next);
  }
 }
 function minute(){
  for(const id of held){
   const sp=speciesInfo[id],e=energy.get(id);
   const phase=(progress.get(id)||0)+60/(sp.frequency*0.902*frequencyFactor(e));
   const completed=Math.floor(phase+1e-10);
   progress.set(id,Math.max(0,phase-completed));
   const bag=pockets.get(id);
   if(sp.appleProducer&&!c.noAppleProduction){bag.apple+=completed;producedApple+=completed;}
   else bag.berries+=completed*(sp.specialty==='Berries'||sp.specialty==='All'?2:1);
   const time=(tenMinuteTimer.get(id)||0)+1;
   if(time===10){
    energy.set(id,Math.max(0,e-1));
    tenMinuteTimer.set(id,0);
   }else tenMinuteTimer.set(id,time);
  }
 }
 for(let day=0;day<7;day++){
  select(c.teams.morning);collect();cook(day,'朝');
  for(let m=0;m<990;m++){
   if(m===270||m===630){
    collect();
    select(m===270?c.teams.noon:c.teams.evening);
    collect();
    cook(day,m===270?'昼':'夜');
   }
   if(m>0&&m%150===0)collect();
   minute();
  }
  collect();select(sleep);
  if(day<6){
   for(let m=0;m<450;m++)minute();
   for(const id of sleep){
    const old=energy.get(id);
    const next=Math.max(old,Math.ceil(Math.min(100,old+(c.sleepScore??80))));
    if(next>old)tenMinuteTimer.set(id,0);
    energy.set(id,next);
   }
   collect();
  }else{
   for(let m=0;m<240;m++)minute();
   // Uncollected 00:00-04:00 Sunday night remains out of weekly total.
  }
 }
 assert.equal(inventory+consumedApple,c.initialApple+collectedApple,
  'apple inventory must conserve deterministic production minus uncollected pockets');
 return {total:berryEnergy+cookingEnergy,berries:berryEnergy,cooking:cookingEnergy,
  ingredientsProduced:collectedApple,uncollectedApple:producedApple-collectedApple,
  consumedApple,endingInventory:inventory,
  meals:meals.length,mealTrace:meals};
}
function controlledMealReport(){
 const mods=['ライチュウ','フシギダネ'].map(name=>{
  const sp=master.species.find(s=>s.name===name);
  return {sp,old:{ingRate:sp.ingRate,skillRate:sp.skillRate,carryLimit:sp.carryLimit}};
 });
 try{
  const cases=configs.map(c=>{
   for(const {sp} of mods)Object.assign(sp,{
    ingRate:sp.name==='ライチュウ'&&!c.noAppleProduction?100:0,
    skillRate:0,carryLimit:1000000
   });
   const input=fixture(c),reference=oneMinuteOracle(c),model=engine.simulate(input);
   const compared={
    berries:model.berries-reference.berries,
    cooking:model.cooking-reference.cooking,
    total:model.total-reference.total,
    meals:model.meals.length-reference.meals,
    ingredientsProduced:(model.ingredients.apple||0)-reference.ingredientsProduced,
    consumedApple:(model.consumedIngredients.apple||0)-reference.consumedApple,
    endingInventory:(model.inventory.apple||0)-reference.endingInventory
   };
   for(const [metric,diff] of Object.entries(compared))
    assert.ok(Math.abs(diff)<1e-7,
     c.id+': '+metric+' disagrees with independent minute reference: '+diff);
   assert.equal(model.skills,0,c.id+' phantom skill');
   assert.equal(model.sneaky,0,c.id+' phantom sneaky');
   if(c.bagCapacity){assert.ok(reference.endingInventory<=c.bagCapacity);
    assert.ok(model.inventory.apple<=c.bagCapacity);}
   assert.equal(reference.endingInventory+reference.consumedApple,
    c.initialApple+reference.ingredientsProduced,c.id+' conservation');
   assert.equal(model.meals.filter(m=>m.recipeId!=='apple_curry').length,0);
   assert.equal(JSON.stringify(model.meals.map(m=>[m.day,m.meal])),
    JSON.stringify(reference.mealTrace.map(m=>[m.day,m.slot])),c.id+' meal chronology');
   return {id:c.id,label:c.label,noAppleProduction:!!c.noAppleProduction,reference:{total:reference.total,berries:reference.berries,
     cooking:reference.cooking,meals:reference.meals,
     ingredientsProduced:reference.ingredientsProduced,consumedApple:reference.consumedApple,
     endingInventory:reference.endingInventory},
    model:{total:model.total,berries:model.berries,cooking:model.cooking,
     meals:model.meals.length,ingredientsProduced:model.ingredients.apple||0,
     consumedApple:model.consumedIngredients.apple||0,endingInventory:model.inventory.apple||0},
    differences:compared,mealTrace:reference.mealTrace};
  });
  const missing=cases.find(c=>c.id==='CM04'),present=cases.find(c=>c.id==='CM05');
  assert.equal(missing.reference.meals,20);
  assert.equal(present.reference.meals,21);
  assert.deepEqual(present.mealTrace.slice(0,20),missing.mealTrace,
   'Adding seven certain apples may change only the 21st meal chronology');
  assert.deepEqual(present.mealTrace[20],{day:7,slot:'夜',energy:3347});
  const compareKeys=['total','berries','cooking'];
  const diff=(a,b)=>Object.fromEntries(compareKeys.map(k=>[k,a[k]-b[k]]));
  const refDelta=diff(present.reference,missing.reference);
  const modelDelta=diff(present.model,missing.model);
  assert.deepEqual(modelDelta,refDelta,
   'The cooking + post-meal Energy/help/berry counterfactual must match a separate minute clock');
  assert.equal(refDelta.cooking,3347);
  const lastMealCounterfactual={
   schema:'step2-m1-last-meal-sunday-evening-v1',
   grade:'B_CONTROLLED_ZERO_INGREDIENT_ZERO_SKILL',
   scenario:'Identical seven days; initial apples 140 vs 147, zero stochastic food/skill, one additional Sunday evening apple curry',
   initialStockMissing:140,initialStockPresent:147,
   missingMeals:missing.reference.meals,presentMeals:present.reference.meals,
   independentDelta:{...refDelta},
   productionDelta:{...modelDelta},
   indirectBerryDelta:refDelta.berries,
   weeklyTotalDifferenceNotAssumedToEqualMealStrength:true,
   gameProbabilityOrRankingValidated:false
  };
  return {schema:'step2-m1-controlled-meal-week-v2',grade:'B_CONTROLLED_DETERMINISTIC_COOKING',
   lastMealCounterfactual,
   step2:'HOLD',m1:'PARTIAL',step3:'NOT_STARTED',realGameMixedAccuracyValidated:false,
   originalM02M04Validated:false,
   controls:'Level50, CM01-CM03 Raichu apple guaranteed per normal help; CM04-CM05 zero ingredient probability on both species; Bulbasaur berry-only, no skill triggers, huge Pokemon carry; CM01/CM02 unbounded food bag, CM03 bag cap7; CM04/CM05 bag cap500 and sleep score0; 25% FB Gold Power Plant; 7 apples per curry; fixed sleeping five',
   reference:'independent one-minute clock, per-help inventory and per-meal energy/energy recovery, separate from simulator helpers',
   cases};
 }finally{
  for(const {sp,old} of mods)Object.assign(sp,old);
 }
}
if(require.main===module)
 console.log('M1_CONTROLLED_MEAL_JSON='+JSON.stringify(controlledMealReport()));
module.exports={controlledMealReport};

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const sim=ctx.globalThis.PokeSimulator;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`expected ${b}, got ${a}`);
const mass=m=>Array.from(m.values()).reduce((a,b)=>a+b,0);

// Independent branch enumeration: occupied, retained food, and four-roll usage.
function brute(start,helps,cap,berry,ingRate,foodPerHelp=1){
 let paths=start;
 for(let h=0;h<helps;h++){
  const next=[];
  for(const p of paths){
   if(p.occupied===cap){
    next.push({...p,used:Math.min(4,p.used+1),
      rolls:p.rolls+(p.used<4?1:0)});
    continue;
   }
   const free=cap-p.occupied;
   next.push({...p,occupied:p.occupied+Math.min(berry,free),
      rolls:p.rolls+1,prob:p.prob*(1-ingRate)});
   next.push({...p,occupied:p.occupied+Math.min(foodPerHelp,free),
      food:p.food+Math.min(foodPerHelp,free),
      rolls:p.rolls+1,prob:p.prob*ingRate});
  }
  paths=next;
 }
 return paths.filter(p=>p.prob>0);
}
function expectRolls(paths){return paths.reduce((s,p)=>s+p.rolls*p.prob,0);}
function combine(paths,cap){
 const joint=new Map();
 for(const p of paths){
  const key=(p.occupied*(cap+1)+p.food)*5+p.used;
  joint.set(key,(joint.get(key)||0)+p.prob);
 }
 return joint;
}
function forCollection(paths,free){
 return paths.map(p=>{
  const received=Math.min(p.food,free),left=p.food-received;
  return {...p,occupied:left,food:left,used:left===p.cap?p.used:0,rolls:0};
 });
}
test('joint food+queue is identical to exhaustive enumeration before collection',()=>{
 const initial=new Map([[0,1]]);
 const slots=[{key:'apple',count:1}];
 for(const n of [0,1,2,3,4,7]){
  const actual=sim.integerFoodSkillQueueTransitions(initial,n,2,1,.5,slots);
  const brutePaths=brute([{occupied:0,food:0,used:0,rolls:0,prob:1}],n,2,1,.5);
  const expected=combine(brutePaths,2);
  near(actual.eligible,expectRolls(brutePaths));
  near(mass(actual.queueFoodJoint),1);
  near(mass(actual.foodJoint),1);
  near(mass(actual.fullSkillQueue),1);
  for(const [key,p] of expected)near(actual.queueFoodJoint.get(key)||0,p);
  for(const [key,p] of actual.queueFoodJoint)near(expected.get(key)||0,p);
  const foodLegacy=sim.integerFoodPocketTransitions(new Map([[0,1]]),n,2,1,.5,slots);
  near(actual.used,foodLegacy.used);
  near(actual.berries,foodLegacy.berries);
  near(actual.sneaky,foodLegacy.sneaky);
  near(actual.ingredients.apple||0,foodLegacy.ingredients.apple||0);
 }
});
test('zero-space partial collection retains the 4-roll queue only in food-only full branches',()=>{
 const init=[{occupied:0,food:0,used:0,rolls:0,prob:1}];
 const initial=sim.integerFoodSkillQueueTransitions(new Map([[0,1]]),3,2,1,.5,[{key:'apple',count:1}]);
 const before=brute(init,3,2,1,.5);
 const collected=sim.collectIntegerFoodSkillQueue(initial.queueFoodJoint,2,0);
 const after=forCollection(before.map(x=>({...x,cap:2})),0);
 near(collected.accepted,0);
 near(collected.remaining,1);
 near(collected.fullSkillQueue.get(2*5+1),.25);
 near(collected.fullSkillQueue.get(1*5),.5);
 near(collected.fullSkillQueue.get(0),.25);
 const expected=combine(after,2);
 for(const [key,p] of expected)near(collected.queueFoodJoint.get(key)||0,p);
 const second=sim.integerFoodSkillQueueTransitions(collected.queueFoodJoint,3,2,1,.5,[{key:'apple',count:1}]);
 const brutesecond=brute(after,3,2,1,.5);
 near(second.eligible,3);
 near(second.eligible,expectRolls(brutesecond));
 // The v0.2.68 separate-marginal fallback wrongly exhausted the still-full
 // 25% branch by setting used=4, losing 0.75 prospective eligible rolls.
 const coarse=sim.queuedFullPocketAfterCollection(initial.fullSkillQueue,
   initial.occupation,collected.occupation,1,0,2);
 const oldNext=sim.queuedFullPocketTransitions(coarse.joint,3,2,1,.5,[{key:'apple',count:1}]);
 near(oldNext.eligible,2.25);
 assert.ok(second.eligible>oldNext.eligible);
});
test('one available shared-bag slot leaves no full pocket and resets queue exactly',()=>{
 const before=sim.integerFoodSkillQueueTransitions(new Map([[0,1]]),3,2,1,.5,[{key:'apple',count:1}]);
 const collected=sim.collectIntegerFoodSkillQueue(before.queueFoodJoint,2,1);
 near(collected.accepted,.75); // E[min(food,1)] = 0*.25 + 1*.5 + 1*.25
 near(collected.remaining,.25);
 assert.ok([...collected.fullSkillQueue.keys()].every(key=>key%5===0));
 near(mass(collected.queueFoodJoint),1);
 const next=sim.integerFoodSkillQueueTransitions(collected.queueFoodJoint,4,2,1,.5,[{key:'apple',count:1}]);
 near(mass(next.queueFoodJoint),1);
 near(mass(next.eligibleDistribution),1);
});
test('no-food-with-room and still-full-food branches preserve conservation',()=>{
 const start=new Map([[(2*3+2)*5+3,1]]);
 const retained=sim.collectIntegerFoodSkillQueue(start,2,0);
 near(retained.fullSkillQueue.get(2*5+3),1);
 const one=sim.integerFoodSkillQueueTransitions(retained.queueFoodJoint,2,2,1,.4,[{key:'apple',count:1}]);
 near(one.eligible,1);
 const emptied=sim.collectIntegerFoodSkillQueue(start,2,2);
 near(emptied.accepted,2);
 near(emptied.fullSkillQueue.get(0),1);
 const restarted=sim.integerFoodSkillQueueTransitions(emptied.queueFoodJoint,5,2,1,.4,[{key:'apple',count:1}]);
 near(restarted.eligible,5);
});
test('reject invalid food/skill joint masses or geometry',()=>{
 for(const joint of [new Map([[0,.75]]),new Map([[5,1]]),
  new Map([[-1,1]]),new Map([[(3*3+1)*5,1]])]){
  assert.throws(()=>sim.integerFoodSkillQueueTransitions(joint,1,2,1,.5,[{key:'apple',count:1}]),/結合|質量/);
 }
});
test('full global food bag runs seven-day simulator without false queue-to-food conversions',()=>{
 const ids=['a','b','c','d','e'];
 const box=ids.map(id=>({id,pokemon:'フワライド',nickname:id,level:20,skillLevel:1,
  ingredients:['ワカクサコーン','',''],subskills:['','','','',''],
  nature:'まじめ',sleepHours:0,shiny:false}));
 const options={map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:180,potSize:57,
  sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
  recipeId:'',initialIngredients:{apple:1},bagCapacity:1,camp:false,
  extraMode:'none',successMode:'none'};
 const r=sim.simulate({box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},options});
 assert.ok(r.exactFoodCarryCollections>0);
 assert.ok(r.skillEligibleHelps>0&&r.skillTriggers>0);
 assert.ok(Number.isFinite(r.total));
 near(r.days.reduce((sum,d)=>sum+d.berries+d.cooking+d.skills,0),r.total);
});

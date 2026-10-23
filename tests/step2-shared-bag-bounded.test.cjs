'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator,master=context.globalThis.PokeMaster;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`expected ${b}; got ${a}`);
const mass=m=>Array.from(m.values()).reduce((x,y)=>x+y,0);
const queue=(food,capacity=1,used=0)=>(food*(capacity+1)+food)*5+used;
const each=(id,choices,capacity=1)=>({id,capacity,joint:new Map(choices.map(([food,p])=>[queue(food,capacity),p]))});
const food50=id=>each(id,[[0,.5],[1,.5]]);

test('two independent 50% food pockets competing for one shared slot recover only .75 expected items',()=>{
 const r=sim.collectSharedBagFoodQueues([food50('a'),food50('b')],1);
 near(r.results[0].accepted,.5);
 near(r.results[1].accepted,.25);
 near(r.accepted,.75);
 near(r.expectedFree,.25);
 near(r.freeDistribution.get(0),.75);
 near(r.freeDistribution.get(1),.25);
 // Wrong sequential marginal mean-free approximation gives 0.5+0.5.
 const first=sim.collectIntegerFoodSkillQueue(food50('a').joint,1,1);
 const fractionalApproxSecond=Math.min(.5,1-first.accepted);
 near(first.accepted+fractionalApproxSecond,1);
 near(r.results[0].remaining,0);
 near(r.results[1].remaining,.25);
 near(r.results[1].queueFoodJoint.get(queue(1)),.25);
 near(mass(r.results[1].queueFoodJoint),1);
});

test('full free capacity and zero capacity reduce to exact individual collection',()=>{
 for(const free of [0,1,2]){
  const input=[food50('first'),food50('second')];
  const result=sim.collectSharedBagFoodQueues(input,free);
  const expected=free===0?0:free===1?.75:1;
  near(result.accepted,expected);
  near(result.expectedFree,free-expected);
  for(const row of result.results){
   near(mass(row.queueFoodJoint),1);
   near(mass(row.foodJoint),1);
   near(mass(row.fullSkillQueue),1);
   near(mass(row.occupation),1);
  }
 }
});

test('a retained full food pocket preserves its remaining skill queue across a contested pickup',()=>{
 const fullWithQueue=each('first',[[1,1]],1);
 fullWithQueue.joint=new Map([[queue(1,1,2),1]]);
 const second=food50('second');
 const result=sim.collectSharedBagFoodQueues([fullWithQueue,second],0);
 near(result.accepted,0);
 near(result.results[0].fullSkillQueue.get(1*5+2),1);
 const next=sim.integerFoodSkillQueueTransitions(result.results[0].queueFoodJoint,3,1,1,0,[]);
 near(next.eligible,2);
});

test('five helpers share the same one-slot bag instead of receiving five fractional slots',()=>{
 const helpers=Array.from({length:5},(_,i)=>food50('p'+i));
 const res=sim.collectSharedBagFoodQueues(helpers,1);
 near(res.accepted,1-Math.pow(.5,5));
 near(res.expectedFree,Math.pow(.5,5));
 for(let i=0;i<5;i++){
  near(res.results[i].accepted,Math.pow(.5,i+1));
  near(mass(res.results[i].queueFoodJoint),1);
 }
});
test('reject duplicate IDs and corrupted probability mass',()=>{
 assert.throws(()=>sim.collectSharedBagFoodQueues([food50('a'),food50('a')],1),/共有バッグ/);
 assert.throws(()=>sim.collectSharedBagFoodQueues([each('a',[[1,.9]])],1),/質量/);
 assert.throws(()=>sim.collectSharedBagFoodQueues([food50('a')],-.5),/共有バッグ/);
});

test('bounded five-member shared-bag path is actually used inside the weekly simulator',()=>{
 const sp=master.species.find(x=>x.name==='ライチュウ');
 assert.ok(sp);
 const entries=sp.mythIng||sp.ings;
 const ingredients=[1,2,3].map(i=>{
  const slot=entries.find(x=>x&&x['c'+i]>0);
  return slot?master.ingredients[slot.name]:'';
 });
 const ids=['a','b','c','d','e'];
 const box=ids.map(id=>({id,pokemon:'ライチュウ',nickname:id,level:50,skillLevel:1,
  ingredients,subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false}));
 const input={box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:180,potSize:57,
   sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
   recipeId:'',initialIngredients:{apple:1},bagCapacity:1,camp:false,
   extraMode:'none',successMode:'none'}};
 const result=sim.simulate(input);
 assert.ok(result.exactSharedBagCollections>0,'conditional branch must run in a real 7-day simulation');
 assert.ok(result.exactFoodCarryCollections>=result.exactSharedBagCollections);
 assert.ok(result.warnings.some(x=>x.includes('整数空きを分岐計算')));
 near(result.total,result.berries+result.cooking+result.skills);
 assert.equal(result.days.length,7);
});

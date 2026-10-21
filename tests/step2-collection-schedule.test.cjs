'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(controlled=false,legacy=false){
 const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
 for(const name of ['master','recipes','simulator']){
  let source=fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8');
  if(legacy&&name==='simulator'){
   // Only restore the pre-fix clock for compatibility comparison. Not an oracle.
   assert.ok(source.includes('for(const step of daySchedule){\n    const t=step.minute/60;'),'legacy clock replacement anchor');
   source=source.replace('for(const step of daySchedule){\n    const t=step.minute/60;',
    'for(let t=7.5;t<24-1e-9;t+=.25){\n    const step={duration:15,tap:t>7.5&&Math.abs((t-7.5)*60/input.options.tapMinutes-Math.round((t-7.5)*60/input.options.tapMinutes))<1e-6};');
  }
  vm.runInContext(source,ctx);
 }
 if(controlled)Object.assign(ctx.globalThis.PokeMaster.species.find(s=>s.name==='ライチュウ'),{
  frequency:600,ingRate:100,skillRate:0,carryLimit:1,evolutionCount:0,skill:'Metronome'});
 return ctx.globalThis.PokeSimulator;
}
const engine=load(true);
function input(tapMinutes){
 const ids=['a','b','c','d','e'];
 return {box:ids.map(id=>({id,pokemon:'ライチュウ',level:1,skillLevel:1,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],nature:'まじめ',sleepHours:0})),
  teams:{morning:ids,noon:ids,evening:ids,sleep:ids},options:{map:'ワカクサ本島',
  fieldBonus:0,tapMinutes,potSize:57,sleepScore:0,initialEnergy:0,foodMode:'curry',
  recipeId:'',initialIngredients:{},camp:false}};
}
// Independent one-minute world: one apple per 10-minute help, pocket1,
// full-pocket help gives 2 berries. No skills, meals, or Energy changes.
// Start Monday07:30; stop next Monday04:00 WITHOUT collecting that last night.
function minuteReference(interval){
 let pocket=0,phase=0,food=0,berries=0,pending=0;
 for(let elapsed=0;elapsed<9870;elapsed++){
  const minute=(450+elapsed)%1440;
  if(minute===450||minute===720||minute===1080||minute===0||
    (minute>450&&minute<1440&&(minute-450)%interval===0)){
   food+=pocket;pocket=0;berries+=pending;pending=0;
  }
  if(++phase===10){phase=0;if(pocket===0)pocket=1;else pending+=50;}
 }
 return {food:food*5,berries:berries*5,pending:pending*5};
}
test('all accepted integer intervals have exact tap times and continuous awake coverage',()=>{
 for(let interval=120;interval<=180;interval++){
  const steps=engine.daytimeSchedule(interval);
  const taps=Array.from(steps.filter(s=>s.tap),s=>s.minute);
  const expected=[];for(let m=450+interval;m<1440;m+=interval)expected.push(m);
  assert.deepEqual(taps,expected);
  assert.equal(steps[0].minute,450);
  assert.equal(steps.reduce((n,s)=>n+s.duration,0),990);
  for(let i=0;i<steps.length;i++){
   assert.ok(steps[i].duration>0&&steps[i].duration<=15);
   assert.equal(steps[i].minute+steps[i].duration,steps[i+1]?.minute??1440);
  }
 }
 assert.deepEqual(Array.from(engine.daytimeSchedule(121).filter(s=>s.tap),s=>s.minute),
  [571,692,813,934,1055,1176,1297,1418]);
 for(const bad of [119,181,150.5,NaN,'150',null])assert.throws(()=>engine.daytimeSchedule(bad));
});
test('non-grid collection intervals match independent minute food/berry accounting and leave last night pending',()=>{
 for(const interval of [121,122,137,149,151,179]){
  const ref=minuteReference(interval),r=engine.simulate(input(interval));
  assert.equal(r.ingredients.apple,ref.food,'food interval '+interval);
  assert.equal(r.berries,ref.berries,'berries interval '+interval);
  assert.equal(r.pendingSneaky,ref.pending,'pending interval '+interval);
 }
 const ref=minuteReference(121);assert.equal(ref.food,415);assert.equal(ref.berries,220000);
 const old=load(true,true).simulate(input(121));
 assert.equal(old.ingredients.apple,135);assert.equal(old.berries,234000);
});
test('15-minute aligned intervals preserve full weekly results with real master and mixed meals',()=>{
 const actual=load(),legacy=load(false,true);
 const {mixedInput}=require('../scripts/step2-m1-audit.cjs');
 for(const interval of [120,135,150,165,180]){
  const x=mixedInput();x.options.tapMinutes=interval;
  assert.deepEqual(JSON.parse(JSON.stringify(actual.simulate(x))),JSON.parse(JSON.stringify(legacy.simulate(x))));
 }
});

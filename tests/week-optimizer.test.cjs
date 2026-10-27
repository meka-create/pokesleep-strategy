'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','week-optimizer.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator,opt=context.globalThis.PokeWeekOptimizer;
const plain=v=>JSON.parse(JSON.stringify(v));
const make=(i)=>({id:'p'+i,pokemon:'ライチュウ',nickname:'P'+i,
 level:i===5?100:20,skillLevel:2,ingredients:['とくせんリンゴ','',''],
 subskills:['','','','',''],mainSkill:'エナジーチャージS',nature:'まじめ',
 sleepHours:0,shiny:false});
function fixture(count=6){
 const box=Array.from({length:count},(_,i)=>make(i));
 const first=box.slice(0,5).map(p=>p.id);
 const teams={morning:[...first],noon:[...first],evening:[...first],sleep:[...first]};
 return {box,teams,options:{map:'シアンの砂浜'}};
}
function fakeEnergy(input){
 const ds=input.teamsByDay,ns=input.sleepTeamsByDay;
 let amount=1000;
 for(let d=0;d<7;d++)for(const period of ['morning','noon','evening']){
  if(ds[d][period].includes('p5'))amount+=(d+1)*7;
 }
 return {total:amount,berries:amount,cooking:0,skills:0,warnings:['参考計算']};
}
test('W2 step evaluates at most one full-week candidate and stops at finite budget',()=>{
 const data=fixture(),unchanged=JSON.stringify(data),seen=[];
 const session=opt.createSession({...data,maxEvaluations:8,simulate:input=>{
  seen.push(plain(input));return fakeEnergy(input);
 }});
 let result=session.step();
 assert.equal(seen.length,1);
 assert.equal(result.baseline.score.total,1000);
 assert.equal(result.evaluations,1);
 while(!result.done){
  const before=seen.length;
  result=session.step();
  assert.ok(seen.length-before<=1,'no more than one expensive weekly simulation per step');
 }
 assert.equal(result.evaluations,seen.length);
 assert.ok(result.evaluations<=8);
 assert.ok(result.attempts<=96);
 assert.equal(result.exhaustive,false);
 assert.equal(result.weekRankValidated,false);
 assert.equal(result.status,'REFERENCE_ONLY');
 assert.ok(result.best.score.total>=result.baseline.score.total);
 assert.ok(result.best.score.total>1000,'found a model-positive candidate without claiming a global optimum');
 assert.ok(result.best.teamsByDay.some((day,d)=>d>0&&day.morning.some(id=>id==='p5')||
  day.noon.some(id=>id==='p5')||day.evening.some(id=>id==='p5')));
 assert.ok(result.best.sleepTeamsByDay.every(team=>team.join(',')===data.teams.sleep.join(',')));
 assert.equal(JSON.stringify(data),unchanged,'never overwrite provided rosters');
});
test('W2 OFF respects seven individually chosen manual sleeping parties',()=>{
 const data=fixture();
 const manual=Array.from({length:7},()=>[...data.teams.sleep]);
 manual[4][4]='p5';
 const output=opt.optimize({...data,sleepTeamsByDay:manual,sleepAuto:false,
  maxEvaluations:10,simulate:fakeEnergy});
 assert.equal(output.sleepAuto,false);
 assert.equal(output.baseline.sleepTeamsByDay[4][4],'p5');
 assert.deepEqual(plain(output.best.sleepTeamsByDay),manual);
 assert.ok(output.best.score.total>=output.baseline.score.total);
});
test('W2 ON explores night-specific sleep proposals on same W1 weekly metric',()=>{
 const data=fixture(),seen=[];
 const scoring=input=>{
  seen.push(plain(input.sleepTeamsByDay));
  let total=1000;
  for(let d=0;d<7;d++)if(input.sleepTeamsByDay[d].includes('p5'))total+=100+(d*13);
  return {total,berries:total,skills:0,cooking:0};
 };
 const r=opt.optimize({...data,sleepAuto:true,maxEvaluations:12,simulate:scoring});
 assert.equal(r.sleepAuto,true);
 assert.ok(r.best.score.total>r.baseline.score.total,'opt-in sleeping changes can improve model score');
 assert.ok(r.best.sleepTeamsByDay.some(row=>row.includes('p5')));
 assert.ok(r.evaluations<=12);
 assert.ok(seen.some(week=>week.some(row=>row.includes('p5'))));
});
test('W2 zero alternatives returns only the fixed baseline without loops',()=>{
 const data=fixture(5),calls=[];
 const r=opt.optimize({...data,maxEvaluations:12,simulate:input=>{
  calls.push(input);return {total:1000,berries:1000,cooking:0,skills:0};
 }});
 assert.equal(r.evaluations,1);
 assert.equal(r.best.score.total,r.baseline.score.total);
 assert.equal(r.improvement,0);
 assert.equal(calls.length,1);
 assert.equal(r.done,true);
});
test('W2 deterministic reruns, tie-handling preserves baseline if no better swap count',()=>{
 const data=fixture(),fake=()=>({total:30,berries:30,cooking:0,skills:0});
 const run=()=>plain(opt.optimize({...data,maxEvaluations:7,simulate:fake}));
 const a=run(),b=run();
 assert.deepEqual(a,b);
 assert.equal(a.baseline.score.total,30);
 assert.equal(a.best.score.total,30);
 assert.ok(a.best.swaps.total<=a.baseline.swaps.total);
});
test('W2 reject corrupted input, invalid max, invalid model scores',()=>{
 const base=fixture();
 assert.throws(()=>opt.createSession({...base,maxEvaluations:0}),/1～32/);
 assert.throws(()=>opt.createSession({...base,maxEvaluations:33}),/1～32/);
 assert.throws(()=>opt.createSession({...base,sleepAuto:'on'}),/ON\/OFF/);
 assert.throws(()=>opt.createSession({...base,teamsByDay:[]}),/7日分/);
 assert.throws(()=>opt.createSession({...base,simulate:()=>({total:99,berries:98,cooking:0,skills:0})}).step(),/不一致/);
 const mixed=fixture();mixed.sleepTeamsByDay=Array.from({length:7},()=>[...mixed.teams.sleep]);
 mixed.sleepTeamsByDay[1][1]=mixed.sleepTeamsByDay[1][0];
 assert.throws(()=>opt.createSession(mixed),/5匹/);
});
test('W2 real calculator baseline equals W1 28-slot calculation',()=>{
 const data=fixture();
 data.options={map:'シアンの砂浜',fieldBonus:20,tapMinutes:150,
  potSize:57,sleepScore:88,initialEnergy:70,foodMode:'random',
  recipeId:'',initialIngredients:{}};
 const session=opt.createSession({...data,maxEvaluations:1});
 const output=session.step();
 const legacy=sim.simulate(data);
 assert.equal(output.baseline.score.total,legacy.total);
 assert.equal(output.baseline.score.berries,legacy.berries);
 assert.equal(output.evaluations,1);
 assert.equal(output.done,true);
});

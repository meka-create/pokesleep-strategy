'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','storage.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const sim=ctx.globalThis.PokeSimulator,storage=ctx.globalThis.PokeStorage;
const asPlain=x=>JSON.parse(JSON.stringify(x));
const one=(i)=>({id:'p'+i,pokemon:'ライチュウ',nickname:'個体'+i,
 level:i===5?15:50,skillLevel:6,
 ingredients:['とくせんリンゴ','あったかジンジャー','とくせんエッグ'],
 subskills:['きのみの数S','','','',''],mainSkill:'エナジーチャージS',
 nature:'さみしがり',sleepHours:1000,shiny:false});
function fixture(){
 const box=Array.from({length:6},(_,i)=>one(i)),ids=box.slice(0,5).map(p=>p.id);
 return {box,teams:{morning:[...ids],noon:[...ids],evening:[...ids],sleep:[...ids]},
  options:{map:'シアンの砂浜',fieldBonus:50,tapMinutes:150,potSize:57,
   sleepScore:80,initialEnergy:40,foodMode:'curry',recipeId:'apple_curry',
   initialIngredients:{apple:100},camp:false}};
}
const fullDay=input=>Object.fromEntries(['morning','noon','evening'].map(k=>[k,[...input.teams[k]]]));
const validNight=input=>[...input.teams.sleep];
test('W1 legacy static rosters and explicit identical 21+7 schedule are bit-for-bit equivalent',()=>{
 const old=fixture(),scheduled=fixture();
 scheduled.teamsByDay=Array.from({length:7},()=>fullDay(scheduled));
 scheduled.sleepTeamsByDay=Array.from({length:7},()=>validNight(scheduled));
 assert.deepEqual(asPlain(sim.simulate(scheduled)),asPlain(sim.simulate(old)));
});
test('W1 all 21 slots can vary, and Monday differs from Thursday without resetting state',()=>{
 const a=fixture(),b=fixture();
 b.teamsByDay=Array.from({length:7},()=>fullDay(b));
 b.teamsByDay[3].morning[0]='p5';
 const before=asPlain(b.teamsByDay);
 const x=sim.simulate(a),y=sim.simulate(b);
 assert.notEqual(y.total,x.total);
 assert.equal(y.days.length,7);
 assert.ok(Math.abs(y.days.reduce((n,d)=>n+d.berries+d.cooking+d.skills,0)-y.total)<1e-6);
 assert.deepEqual(asPlain(b.teamsByDay),before,'simulation never mutates the proposed plan');
 assert.ok(y.days[0].berries>0);
});
test('W1 changing only Tuesday night changes Wednesday active-member recovery',()=>{
 const original=fixture(),modified=fixture();
 modified.sleepTeamsByDay=Array.from({length:7},()=>validNight(modified));
 modified.sleepTeamsByDay[1][4]='p5';
 const baseline=sim.simulate(original),changed=sim.simulate(modified);
 assert.deepEqual(Object.keys(asPlain(changed.nightEnergy[1].beforeSleep)).sort(),
  ['p0','p1','p2','p3','p5']);
 assert.equal(Object.hasOwn(changed.nightEnergy[1].afterRecovery,'p4'),false);
 assert.notEqual(changed.days[2].berries,baseline.days[2].berries);
 assert.ok(changed.nightEnergy[6].hours===4,'Sunday night stops at next Monday 04:00');
});
test('W1 mixed day and night schedule validation rejects all incomplete/foreign/duplicate teams',()=>{
 const make=()=>fixture();
 let p=make();p.teamsByDay=[];assert.throws(()=>sim.simulate(p),/7日分/);
 p=make();p.sleepTeamsByDay=[...Array(6)].map(()=>validNight(p));
 assert.throws(()=>sim.simulate(p),/7回分/);
 p=make();p.teamsByDay=Array.from({length:7},()=>fullDay(p));
 p.teamsByDay[4].evening[2]=p.teamsByDay[4].evening[1];
 assert.throws(()=>sim.simulate(p),/5匹/);
 p=make();p.sleepTeamsByDay=Array.from({length:7},()=>validNight(p));
 p.sleepTeamsByDay[5][1]='unlisted';
 assert.throws(()=>sim.simulate(p),/5匹/);
 p=make();p.teamsByDay=Array.from({length:7},()=>fullDay(p));delete p.teamsByDay[0].noon;
 assert.throws(()=>sim.simulate(p),/5匹/);
});
test('W1 storage accepts optional manual nights, preserves defaults, rejects corrupt schedules',()=>{
 const s=storage.newState();s.box=fixture().box;
 s.sleepIds=fixture().teams.sleep;
 s.simulation.teams=fullDay(fixture());
 const legacy=JSON.parse(JSON.stringify(s));delete legacy.weeklyPlan;
 const restored=storage.validateState(legacy);
 assert.equal(restored.version,1);
 assert.equal(restored.weeklyPlan.sleepAuto,false);
 assert.equal(restored.weeklyPlan.manualSleepTeams.length,0);
 const resolved=storage.resolveWeeklyPlan(restored);
 assert.equal(resolved.teamsByDay.length,7);
 assert.ok(resolved.sleepTeamsByDay.every(ids=>ids.join(',')===s.sleepIds.join(',')));
 const nights=Array.from({length:7},()=>[...s.sleepIds]);nights[4][4]='p5';
 s.weeklyPlan.manualSleepTeams=nights;
 s.weeklyPlan.dayTeams=Array.from({length:7},()=>fullDay(fixture()));
 const roundtrip=storage.validateState(JSON.parse(JSON.stringify(s)));
 assert.equal(roundtrip.weeklyPlan.manualSleepTeams[4][4],'p5');
 assert.equal(storage.resolveWeeklyPlan(roundtrip).sleepTeamsByDay[4][4],'p5');
 s.weeklyPlan.sleepAuto=true;
 assert.throws(()=>storage.resolveWeeklyPlan(s),/提案が未作成/);
 s.weeklyPlan.sleepAuto=false;
 s.weeklyPlan.manualSleepTeams[0][2]='p0';
 assert.throws(()=>storage.validateState(s),/5匹/);
});

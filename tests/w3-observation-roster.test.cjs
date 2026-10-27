'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx,{filename:name});
const obs=ctx.globalThis.PokeObservation,copy=o=>JSON.parse(JSON.stringify(o));
const box=Array.from({length:6},(_,i)=>({id:'p'+i,pokemon:'ライチュウ',level:40,skillLevel:4,nature:'まじめ',
 ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],nickname:'P'+i,mainSkill:'',sleepHours:null,shiny:false}));
const initial=box.slice(0,5).map(x=>x.id);
function fixture(){
 const teams={morning:[...initial],noon:[...initial],evening:[...initial],sleep:[...initial]};
 return {box:copy(box),teams,teamsByDay:Array.from({length:7},()=>({
  morning:[...initial],noon:[...initial],evening:[...initial]})),
  sleepTeamsByDay:Array.from({length:7},()=>[...initial]),
  options:{map:'シアンの砂浜',fieldBonus:10,tapMinutes:150,potSize:57,
   bagCapacity:0,sleepScore:88,initialEnergy:100,recipeId:'',recipeMode:'fixed',
   extraMode:'none',successMode:'none',foodMode:'curry',camp:false,initialIngredients:{},magnetIngredients:[]}};
}
test('W3 observation JSON validates all 28 slots and accepts night-only variation',()=>{
 const source=fixture();
 source.sleepTeamsByDay[2][4]='p5';
 assert.equal(obs.validateReplayInput(source),source);
 const invalid=copy(source);
 invalid.teamsByDay[4].noon[0]='not-in-box';
 assert.throws(()=>obs.validateReplayInput(invalid),/不正/);
 const duplicate=copy(source);duplicate.sleepTeamsByDay[3][4]=duplicate.sleepTeamsByDay[3][0];
 assert.throws(()=>obs.validateReplayInput(duplicate),/不正/);
 const short=copy(source);short.teamsByDay.pop();
 assert.throws(()=>obs.validateReplayInput(short),/7日分/);
 const noNights=copy(source);delete noNights.sleepTeamsByDay;
 assert.equal(obs.validateReplayInput(noNights),noNights,'historical snapshots remain readable');
 const old=copy(source);delete old.sleepTeamsByDay;delete old.teamsByDay;
 assert.equal(obs.validateReplayInput(old),old);
});

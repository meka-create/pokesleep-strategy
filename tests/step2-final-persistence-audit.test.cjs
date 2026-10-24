'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// package.json uses type=module, while the legacy browser storage adapter
// intentionally attaches to globalThis. Load it exactly as browser script,
 // rather than require() an ESM .js file from a CommonJS test.
const storageContext=vm.createContext({globalThis:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/storage.js'),'utf8'),storageContext);
const storage=storageContext.globalThis.PokeStorage;
function fixture(){
 const state=storage.newState();
 const box=Array.from({length:5},(_,i)=>({
  id:'audit-'+i,nickname:'',pokemon:'ライチュウ',level:30,skillLevel:3,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],
  mainSkill:'',nature:'まじめ',sleepHours:null,shiny:false
 }));
 const ids=box.map(x=>x.id);
 state.box=box;state.sleepIds=[...ids];
 for(const key of ['morning','noon','evening'])state.simulation.teams[key]=[...ids];
 state.event.start='2026-10-19';state.event.map='シアンの砂浜';
 return state;
}
test('audit: roundtrip valid saved state and all 19 actual master ingredient keys',()=>{
 const context=vm.createContext({globalThis:{}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/master.js'),'utf8'),context);
 const keys=Object.keys(context.globalThis.PokeMaster.ingredients);
 assert.equal(keys.length,19);
 const state=fixture();
 for(const key of keys)state.simulation.initialIngredients[key]=0;
 state.simulation.magnetIngredients=[...keys];
 const restored=storage.validateState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.simulation.initialIngredients,state.simulation.initialIngredients);
 assert.deepEqual(restored.simulation.magnetIngredients,keys);
 assert.equal(restored.sleepIds.length,5);
});
test('audit: rejects invalid saved integer controls rather than failing only when user taps simulate',()=>{
 for(const [field,bad] of [['fieldBonus',12.5],['tapMinutes',150.5],['potSize',57.5],
  ['sleepScore',88.3],['initialEnergy',99.5],['bagCapacity',4.5],
  ['fieldBonus','20'],['tapMinutes',null]]){
  const state=fixture();state.simulation[field]=bad;
  assert.throws(()=>storage.validateState(state),/計算設定/,field);
 }
 const valid=fixture();valid.simulation.tapMinutes=121;
 assert.equal(storage.validateState(valid).simulation.tapMinutes,121,
  'integer 121-minute input remains supported for the simulator');
});
test('audit: rejects unknown ingredient keys and impossible event dates in backups',()=>{
 const state=fixture();state.simulation.initialIngredients['unknown_ingredient']=7;
 assert.throws(()=>storage.validateState(state),/初期食材数/);
 delete state.simulation.initialIngredients.unknown_ingredient;
 state.event.start='2026-02-30';
 assert.throws(()=>storage.validateState(state),/イベント開始日/);
 state.event.start='2028-02-29';
 assert.equal(storage.validateState(state).event.start,'2028-02-29');
});
test('audit: rejecting a bad backup must not silently normalize valid references',()=>{
 const state=fixture(),expected=JSON.stringify(state);
 const invalid=JSON.parse(expected);
 invalid.simulation.teams.morning[0]=invalid.simulation.teams.morning[1];
 assert.throws(()=>storage.validateState(invalid),/計算用パーティ/);
 assert.equal(JSON.stringify(state),expected);
});

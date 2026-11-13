'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={module:{exports:{}},globalThis:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../f1/f1-c-skill-values-v1.js'),'utf8'),context);
const skill=context.module.exports;
const snapshot=require('../f1/f1-b-target-source-v1.json');
test('F1-C skill baseline: all source-target 22 skill types are represented',()=>{
 const distinct=new Set(snapshot.targets.map(t=>t.sourceProfile.mainSkill));
 assert.equal(distinct.size,22);
 for(const s of distinct){
  const result=skill.skillValue(s,1,s==='Helper Boost'?{distinctSpeciesCount:3}:{});
  assert.notEqual(result.status,'UNSUPPORTED_SKILL',s);
  assert.equal(result.weeklyEnergy,null);
  assert(!result.status.includes('CALCULATED_WEEKLY'));
 }
});
test('F1-C skill baseline: pinned direct-strength levels and per-trigger rounding',()=>{
 const examples=[
  ['Charge Strength S',1,400],['Charge Strength S',7,3212],
  ['Charge Strength M',1,880],['Charge Strength M',7,6858],
  ['Charge Strength M (Bad Dreams)',7,18515]
 ];
 for(const [name,level,want] of examples){
  assert.equal(skill.skillValue(name,level).value,want);
  assert.equal(skill.skillValue(name,level,{fieldBonusPercent:50}).value,Math.ceil(want*1.5));
 }
 assert.equal(skill.skillValue('Charge Strength M (Bad Dreams)',1).status,
  'PARTIAL_SIDE_EFFECT_UNMODELED');
 assert.deepEqual([...skill.skillValue('Charge Strength M (Bad Dreams)',1).notes],
  ['PARTIAL_NIGHTMARE_TEAM_ENERGY_COST_UNMODELED']);
});
test('F1-C skill baseline: random charge exact 151-point rounded expectation',()=>{
 assert.equal(skill.randomStrength(1,0),
  Array.from({length:151},(_,i)=>Math.ceil(200+600*i/150)).reduce((a,b)=>a+b,0)/151);
 assert.equal(skill.skillValue('Charge Strength S (Random)',1).value,skill.randomStrength(1));
 const result=skill.skillValue('Charge Strength S (Random)',7,{fieldBonusPercent:80});
 assert(result.value>skill.skillValue('Charge Strength S (Random)',7).value);
 assert.equal(result.status,'BASE_VALUE_ONLY');
 assert.equal(result.weeklyEnergy,null);
});
test('F1-C skill baseline: support levels and team parameters for all 22 skills',()=>{
 for(const t of Object.keys(skill.TABLES)){
  const cap=skill.maxLevel(t),max=skill.skillValue(t,cap);
  assert(max.value>0,t);
  assert.equal(skill.skillValue(t,cap+1).status,'INVALID_LEVEL',t);
 }
 for(let n=1;n<=5;n++){
  const x=skill.skillValue('Helper Boost',6,{distinctSpeciesCount:n});
  assert.equal(x.value,skill.HELP_BOOST[n][5]);
 }
 assert.equal(skill.skillValue('Helper Boost',6).status,'CONTEXT_REQUIRED');
 assert.equal(skill.skillValue('Versatile',8).status,'CONTEXT_REQUIRED');
 assert.equal(skill.skillValue('Skill Copy (Transform)',7).status,'CONTEXT_REQUIRED');
 assert.equal(skill.skillValue('Metronome',7).status,'CONTEXT_REQUIRED');
 assert.equal(skill.skillValue('Charge Strength S (Stockpile)',7).status,'CONTEXT_REQUIRED');
 assert.equal(skill.skillValue('Skill Copy (Transform)',8).status,'INVALID_LEVEL');
 assert.equal(skill.skillValue('UNEXPECTED',1).status,'UNSUPPORTED_SKILL');
});
test('F1-C skill baseline: all non-strength skills preserve distinct physical units',()=>{
 for(const [name,unit] of [
  ['Charge Energy S','SELF_ENERGY_POINTS'],
  ['Energy for Everyone S','TEAM_ENERGY_POINTS_EACH'],
  ['Energizing Cheer S','TARGET_ENERGY_POINTS'],
  ['Ingredient Magnet S','INGREDIENT_ITEMS'],
  ['Cooking Power-Up S','POT_CAPACITY_DELTA'],
  ['Tasty Chance S','EXTRA_TASTY_CHANCE_POINTS'],
  ['Berry Burst','BERRIES'],
  ['Extra Helpful S','EXTRA_HELPS'],
  ['Dream Shard Magnet S (Random)','DREAM_SHARDS_EXPECTED']
 ]){
  assert.equal(skill.skillValue(name,1).unit,unit);
 }
 assert.equal(skill.skillValue('Energy for Everyone S (Berry Juice)',6).status,
  'PARTIAL_SIDE_EFFECT_UNMODELED');
});

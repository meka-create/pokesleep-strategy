'use strict';
/* M4 v134: all 22 pinned real-Box skill identities, no personal Box data. */
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>{const x={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),x,{filename:p,timeout:20000});
 return x.module.exports;};
const model=load('f4/f4-m1-lite-energy-v128.js'),
 values=load('f1/f1-c-skill-values-v1.js'),
 base=load('f1/f1-b-base-rates-v1.js');
const targets=JSON.parse(read('f1/f1-b-target-source-v1.json')).targets;
const skills=[...new Set(targets.map(t=>t.sourceProfile.mainSkill))].sort();
const WEEK='2026-11-23',SOURCE='pokesleep-tool:synthetic verified skill week:'+WEEK;
const official=(effects,target={})=>model.event({weekStart:WEEK,eventId:SOURCE,
 fields:{source:{id:SOURCE,start:WEEK,upstreamRevision:'public-pinned',
  verifiedEffects:effects,verifiedTarget:target,unknownEffects:false}}});
function row(skill,index,options={}){
 return {id:'p'+index,source:'F1_B_PINNED_66_SPECIES',
  pokemonType:'normal',skillSpecialty:'Skills',skillCode:skill,
  selectedMainSkillLevel:options.level??1,carryLimit:40,
  ratesByTeammateBonus:Array.from({length:5},()=>({
   helpSeconds:3600,skillProbabilityPerEligibleHelp:.1,
   ingredientCountsPerHelp:{apple:.1},berryEnergyPerHelp:7,
   berryItemsPerHelp:1,berryCountPerBerryHelp:1
  }))};
}
test('M4 v134: all 22 pinned main skills have independently verified legal level caps',()=>{
 assert.equal(skills.length,22);
 for(const skill of skills){
  assert.equal(values.maxLevel(skill),base.skillMax(skill),skill);
  assert(Number.isSafeInteger(values.maxLevel(skill)));
 }
});
test('M4 v134: a skill-level event never blocks full Box on contextual skills',()=>{
 const ev=official({skillLevel:3});
 assert.equal(ev.status,'EVENT_READY',ev.reason);
 const roster=skills.map((skill,i)=>row(skill,i));
 const frozen=JSON.stringify(roster),result=model.withEvent(roster,ev,values);
 assert.equal(result.status,'ROSTER_READY',result.reason);
 assert.equal(result.profiles.length,22);
 for(const p of result.profiles){
  assert.equal(p.selectedMainSkillLevel,Math.min(4,values.maxLevel(p.skillCode)));
 }
 assert.equal(JSON.stringify(roster),frozen,'original Box projections are read-only');
 for(const name of ['Metronome','Skill Copy (Transform)','Versatile',
  'Charge Strength S (Stockpile)','Helper Boost']){
  const p=result.profiles.find(x=>x.skillCode===name);
  assert(p,'contextual source skill missing '+name);
  assert.equal(values.skillValue(name,p.selectedMainSkillLevel).status,'CONTEXT_REQUIRED');
 }
});
test('M4 v134: level is capped at verified source maximum for each main skill',()=>{
 const ev=official({skillLevel:5});
 const rows=skills.map((s,i)=>row(s,i,{level:values.maxLevel(s)-1}));
 const result=model.withEvent(rows,ev,values);
 assert.equal(result.status,'ROSTER_READY',result.reason);
 for(const p of result.profiles)
  assert.equal(p.selectedMainSkillLevel,values.maxLevel(p.skillCode));
});
test('M4 v134: official target specificity does not inflate unrelated species',()=>{
 const ev=official({skillLevel:3,skillTrigger:1.2},{specialty:'Skills',type:['normal']});
 const a=row('Metronome',0),b={...row('Skill Copy (Transform)',1),pokemonType:'fire'};
 const result=model.withEvent([a,b],ev,values);
 assert.equal(result.status,'ROSTER_READY',result.reason);
 assert.equal(result.profiles[0].selectedMainSkillLevel,4);
 assert.equal(result.profiles[1].selectedMainSkillLevel,1);
 assert.equal(result.profiles[0].ratesByTeammateBonus[0].skillProbabilityPerEligibleHelp,.12);
 assert.equal(result.profiles[1].ratesByTeammateBonus[0].skillProbabilityPerEligibleHelp,.1);
});
test('M4 v134: unknown skill and forged level are still rejected, neutral event untouched',()=>{
 const ev=official({skillLevel:3});
 assert.equal(model.withEvent([row('unknown_new_skill',0)],ev,values).reason,
  'M1_EVENT_SKILL_LEVEL_UNVERIFIED');
 assert.equal(model.withEvent([row('Metronome',0,{level:9})],ev,values).reason,
  'M1_EVENT_SKILL_LEVEL_SOURCE_MISSING');
 assert.equal(model.withEvent([row('Metronome',0)],ev,null).reason,
  'M1_EVENT_SKILL_LEVEL_SOURCE_MISSING');
 const manual=model.event({weekStart:WEEK,eventId:'manual:'+WEEK,fields:{source:null}});
 assert.equal(model.withEvent([row('unknown_new_skill',0)],manual,null).status,'ROSTER_READY');
});
test('M4 v134: M1 uses level cap only, does not fabricate contextual skill energy',()=>{
 const code=read('f4/f4-m1-lite-energy-v128.js');
 const f4=read('f4/f4-c-item-aware-rank-v101.js');
 const f5=read('f5/f5-midweek-v119.js');
 assert.match(code,/skillValues\.maxLevel\?\.\(p\.skillCode\)/);
 assert.match(code,/M1_EVENT_SKILL_LEVEL_UNVERIFIED/);
 assert.match(f4,/effect\.status==='BASE_VALUE_ONLY'/);
 assert.match(f5,/effect\?\.status==='BASE_VALUE_ONLY'/);
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(sw,/v134-contextual-skill-level/);
});

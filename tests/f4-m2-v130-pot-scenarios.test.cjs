'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p){
 const env={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read(p),env,{filename:p,timeout:15000});
 return env.module.exports;
}
const pot=load('f4/f4-m2-pot-scenarios-v130.js');
const cookingSkills=load('f4/f4-c-cooking-skills-v102.js');
const skillValues=load('f1/f1-c-skill-values-v1.js');
const m1=load('f4/f4-m1-lite-energy-v128.js');
const deps={cookingSkills,skillValues};
const recipes=[
 {id:'small',name:'小',type:'curry',strength70:1000,requirements:{apple:30}},
 {id:'medium',name:'中',type:'curry',strength70:5000,requirements:{apple:40}},
 {id:'next',name:'大',type:'curry',strength70:12000,requirements:{apple:45}},
 {id:'large',name:'特大',type:'curry',strength70:24000,requirements:{apple:60}},
 {id:'giant',name:'最大',type:'curry',strength70:100000,requirements:{apple:80}}
];
const ref=extra=>pot.evaluate({basePot:33,skillLevel:1,day:0,camp:false,
 eventPotMultiplier:1,foodMode:'curry',recipes,...extra},deps);
test('M2 v130: 0,1,2 skill casts only compare capacity and recipe size, not drops',()=>{
 const x=ref();
 assert.equal(x.status,'SCENARIOS_READY',x.reason);
 assert.equal(x.rows.length,3);
 assert.deepEqual(x.rows.map(y=>y.capacity),[33,40,47]);
 assert.deepEqual(Array.from(x.rows[1].unlocked,y=>y.id),['medium']);
 assert.deepEqual(Array.from(x.rows[2].unlocked,y=>y.id),['next']);
 assert.equal(x.changed,true);
 assert.equal(x.triggerProbabilityModeled,false);
 assert.equal(x.ingredientInventoryChecked,false);
 assert.equal(x.actualSkillTriggersUnknown,true);
 assert.equal(x.writesSavedData,false);
});
test('M2 v130: Sunday doubling, Good Camp and skill-level are sourced from v102',()=>{
 assert.deepEqual(ref({day:6}).rows.map(x=>x.capacity),[66,73,80]);
 assert.deepEqual(ref({camp:true}).rows.map(x=>x.capacity),[50,60,71]);
 assert.deepEqual(ref({skillLevel:6}).rows.map(x=>x.capacity),[33,60,87]);
});
test('M2 v130: verified event pot factor modifies base before Sunday/camp; fractional lower bound',()=>{
 const e=m1.event({weekStart:'2026-10-05',eventId:'pokesleep-tool:pot week:2026-10-05',
  fields:{source:{id:'pokesleep-tool:pot week:2026-10-05',start:'2026-10-05',
   upstreamRevision:'a'.repeat(40),verifiedEffects:{potSize:2},verifiedTarget:{}}}});
 assert.equal(e.status,'EVENT_READY',e.reason);
 assert.equal(e.potSize,2);
 assert.deepEqual(ref({eventPotMultiplier:e.potSize}).rows.map(x=>x.capacity),[66,73,80]);
 const guarded=ref({eventPotMultiplier:1.6});
 assert.equal(guarded.status,'SCENARIOS_READY');
 assert.deepEqual(guarded.rows.map(x=>x.capacity),[52,59,66]);
 assert.equal(guarded.fractionalEventPotRoundedDown,true);
});
test('M2 v130: no extrapolation for unsupported level, missing skill source or invalid recipes',()=>{
 assert.equal(ref({skillLevel:8}).status,'BLOCKED');
 assert.equal(ref({recipes:[]}).status,'BLOCKED');
 assert.equal(ref({recipes:[{id:'x',type:'curry',strength70:0,requirements:{apple:40}}]}).status,'BLOCKED');
 assert.equal(ref({basePot:0}).status,'BLOCKED');
 assert.equal(ref({camp:1}).status,'BLOCKED');
});
test('M2 v130: UI only adds advice when previous party has verified Cooking Power-Up S',()=>{
 const ui=read('e7-preview/e7-f4c-integrated-v112.js');
 const html=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(ui,/prior\.map\(i=>data\?\.privateBoxRows\?\.\[i\]\)/);
 assert.match(ui,/row\?\.mainSkill==='料理パワーアップS'/);
 assert.match(ui,/result\.changed/);
 assert.match(ui,/必要食材・実際の発動は未確認/);
 assert.match(html,/f4-m2-pot-scenarios-v130\.js/);
 assert.match(sw,/f4-m2-pot-scenarios-v130\.js/);
 const source=read('f4/f4-m2-pot-scenarios-v130.js');
 for(const forbidden of ['localStorage','setItem(', 'fetch(', 'console.log', 'nickname'])
  assert(!source.includes(forbidden),'new model contains: '+forbidden);
});

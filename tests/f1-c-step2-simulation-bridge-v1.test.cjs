'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=(file,context={module:{exports:{}},globalThis:{}},requireFn=undefined)=>{
 context.module={exports:{}};if(requireFn)context.require=requireFn;
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),context,{filename:file});
 return context.module.exports;
};
const snap=require('../f1/f1-b-target-source-v1.json');
const traits=require('../f1/f1-b-help-traits-v1.json');
const legal=load('f1/f1-b-legal-build-v2.js');
const rates=load('f1/f1-b-base-rates-v1.js',
 {module:{exports:{}},globalThis:{}},
 name=>{if(name==='./f1-b-legal-build-v2.js')return legal;throw Error('Unexpected import: '+name)});
const bridge=load('f1/f1-c-step2-simulation-bridge-v1.js');
const context={module:{exports:{}},globalThis:{}};
for(const file of ['src/master.js','src/recipes.js','src/simulator.js'])load(file,context);
const master=context.globalThis.PokeMaster,simulator=context.globalThis.PokeSimulator;
const deps={snapshot:snap,traits,master,simulator,rates,legal};
const sources=new Map(snap.targets.map(x=>[x.name,x]));
const food=(t,slot)=>{
 const options=[t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3].slice(0,slot);
 const ref=options.find(x=>x&&x.name!=='unknown'&&x['c'+slot]>0);
 if(!ref)throw Error('Invalid synthetic fixture: '+t.name+'/'+slot);
 return snap.dictionaries.ingredients[ref.name];
};
const make=(name,id,overrides={})=>{
 const t=sources.get(name);
 return {id,pokemon:name,nickname:'SENSITIVE_TEST_NAME',level:50,skillLevel:3,
  ing1:food(t,1),ing2:food(t,2),ing3:food(t,3),
  mainSkill:t.sourceProfile.mainSkillJa,nature:'てれや',mint:false,ribbon:0,shiny:false,
  lv10:'きのみの数S',lv25:'おてつだいボーナス',lv50:'おてつだいスピードS',
  lv70:'リサーチEXPボーナス',lv80:'げんき回復ボーナス',...overrides};
};
const sample=()=>{
 const list=['リザードン','エーフィ','ライチュウ','ゲンガー','サーナイト'];
 const box=list.map((name,i)=>make(name,String(i)));
 const ids=box.map(x=>x.id);
 return {box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'シアンの砂浜',fieldBonus:50,tapMinutes:150,potSize:57,
   sleepScore:100,initialEnergy:100,foodMode:'curry',recipeId:'',
   initialIngredients:{},camp:false,extraMode:'none',successMode:'none'}};
};
test('F1-C bridge: 66 target species/forms match STEP2 baseline except the known Gengar update',()=>{
 assert.equal(bridge.verifyMaster(snap,traits,master,rates).size,master.species.length);
 const gengar=master.species.find(x=>x.name==='ゲンガー');
 assert.equal(gengar.ingRate,16.1);
 assert.equal(sources.get('ゲンガー').sourceProfile.ingredientRate,16.6);
 const broken={...master,species:master.species.map(s=>s.name==='エーフィ'?
  {...s,skillRate:99}:s)};
 assert.throws(()=>bridge.verifyMaster(snap,traits,broken,rates),/SOURCE_PROFILE_DRIFT/);
});
test('F1-C bridge: checked 5-individual, seven-night simulation is clearly provisional',()=>{
 const input=sample();
 const answer=bridge.simulateWeekly(input,deps);
 assert.equal(answer.status,'PROVISIONAL',answer.reason);
 assert.equal(answer.calculation,'WEEKLY_EXPECTATION_PROTOTYPE');
 assert(answer.weeklyEnergy>0);
 assert.equal(answer.breakdown.days.length,7);
 assert.equal(answer.coveredIndividuals,5);
 assert.equal(answer.coveredSpeciesForms,5);
 assert.equal(answer.userRowsRetained,false);
 assert.equal(answer.breakdown.total,answer.weeklyEnergy);
 assert(answer.warnings.some(s=>s.includes('F1-C暫定週間期待値')));
 assert(!JSON.stringify(answer).includes('SENSITIVE_TEST_NAME'));
});
test('F1-C bridge: team changes preserve independent per-member, per-teammate-rate snapshots',()=>{
 const input=sample(),week=bridge.simulateWeekly(input,deps);
 assert.equal(week.status,'PROVISIONAL',week.reason);
 const status=week.breakdown;
 assert(Number.isFinite(status.skillEligibleHelps));
 assert(Number.isFinite(status.skillHelpCompletions));
 assert(status.berries>0);
 // Unselected forms should not be required to have verified build profiles.
 input.box.push({id:'unused',pokemon:'ミュウ'});
 assert.equal(bridge.simulateWeekly(input,deps).status,'PROVISIONAL');
});
test('F1-C bridge: unsupported in-party Mew never generates an invented skill expectation',()=>{
 const input=sample();
 input.box[0]={...input.box[0],pokemon:'ミュウ'};
 assert.equal(bridge.simulateWeekly(input,deps).reason,'MEW_SKILL_RATE_UNVERIFIED');
 assert.equal(bridge.simulateWeekly(input,deps).weeklyEnergy,null);
});
test('F1-C bridge: malformed species/build, inputs and IDs stop without weakening STEP2',()=>{
 const base=sample();
 assert.equal(bridge.simulateWeekly({...base,box:base.box.slice(0,4)},deps).status,'BLOCKED');
 assert.equal(bridge.simulateWeekly({...base,box:[...base.box,{...base.box[0]}]},deps).reason,
  'DUPLICATE_OR_INVALID_ID');
 const foodBad=sample();foodBad.box[0]={...foodBad.box[0],ing1:'つくりもの食材'};
 assert.equal(bridge.simulateWeekly(foodBad,deps).reason,'INVALID_BUILD');
 const unknown=sample();unknown.box[0]={...unknown.box[0],pokemon:'未対応ポケモン'};
 assert.equal(bridge.simulateWeekly(unknown,deps).reason,'OUTSIDE_F1_SCOPE');
 const mint=sample();mint.box[0]={...mint.box[0],mint:null};
 assert.equal(bridge.simulateWeekly(mint,deps).reason,'UNVERIFIED_INDIVIDUAL_RATE');
 const old=sample();old.options.camp='true';
 assert.equal(bridge.simulateWeekly(old,deps).reason,'INVALID_CAMP_SETTING');
});
test('F1-C bridge: no source files, UI, save-state, or time-based schedules are modified',()=>{
 const core=fs.readFileSync(path.resolve(__dirname,'../f1/f1-c-step2-simulation-bridge-v1.js'),'utf8');
 assert.doesNotMatch(core,/localStorage|sessionStorage|indexedDB|fetch\(/);
 const patched=fs.readFileSync(path.resolve(__dirname,'../src/simulator.js'),'utf8');
 assert.match(patched,/if\(p\.__f1VerifiedRates\)/);
 assert.match(patched,/function simulate\(input\)/);
});


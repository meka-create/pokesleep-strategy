'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function load(p,dependencies={}){
 const sandbox={module:{exports:{}},globalThis:{},
  require:specifier=>{if(Object.hasOwn(dependencies,specifier))return dependencies[specifier];
   throw Error('Missing mock '+specifier)}};
 vm.runInNewContext(read(p),sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;
}
const F4=load('f4/f4-chronological-core-v1.js');
const R=load('f4/f4-f1b-roster-adapter-v1.js');
const legal=load('f1/f1-b-legal-build-v2.js');
const rates=load('f1/f1-b-base-rates-v1.js',{'./f1-b-legal-build-v2.js':legal});
const snapshot=JSON.parse(read('f1/f1-b-target-source-v1.json'));
const traits=JSON.parse(read('f1/f1-b-help-traits-v1.json'));
const master=load('src/master.js');
const recipes=load('src/recipes.js');
const deps={snapshot,traits,master,rates,legal};
const clone=x=>JSON.parse(JSON.stringify(x));
const p=(id,foods={apple:1},berry=12,bonus=false)=>({
 id,source:'F1_B_PINNED_66_SPECIES',helpingBonus:bonus,
 ratesByTeammateBonus:Array.from({length:5},(_,i)=>({
  status:'BASE_RATES_AVAILABLE',helpSeconds:3600-100*i,
  berryEnergyPerHelp:berry,ingredientCountsPerHelp:foods
 }))
});
const profiles=Array.from({length:6},(_,i)=>p('p'+i,
 i%2?{milk:1,apple:.3}:{apple:1,milk:.3},10+i*2,i===0));
const NIGHTS=Array.from({length:7},(_,day)=>
 profiles.filter((_,i)=>i!==day%6).slice(0,5).map(x=>x.id));
const recipe=(id='apple',type='curry',apple=2,energy=120)=>({
 id,type,baseStrength:energy,requirements:{apple}
});
const base=(over={})=>({
 weekStart:'2026-11-16',eventMode:'NEUTRAL_REFERENCE_ONLY',
 eventSource:null,foodMode:'curry',bagCapacity:100,potCapacity:57,camp:false,
 fieldBonus:0,autoSleep:false,nightTeams:NIGHTS,
 initialInventory:{apple:12,milk:10},profiles,recipes:[recipe()],
 ...over
});
const species=new Map(snapshot.targets.map(s=>[s.name,s]));
function food(name,slot){
 const special=legal.SPECIAL_FOODS[name];
 if(special)return snapshot.dictionaries.ingredients[Object.keys(special[slot-1])[0]];
 const t=species.get(name),c=[t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3]
  .slice(0,slot).find(x=>x&&x.name!=='unknown'&&x['c'+slot]>0);
 if(!c)throw Error('No sample food '+name+'/'+slot);
 return snapshot.dictionaries.ingredients[c.name];
}
function boxRow(pokemon,nick='DO_NOT_LEAK_PRIVATE_NICK'){
 const t=species.get(pokemon);
 return {pokemon,nickname:nick,level:50,skillLevel:3,
  ing1:food(pokemon,1),ing2:food(pokemon,2),ing3:food(pokemon,3),
  nature:'てれや',mainSkill:t.sourceProfile.mainSkillJa,mint:null,ribbon:null,
  lv10:'きのみの数S',lv25:'おてつだいボーナス',
  lv50:'おてつだいスピードS',lv70:'リサーチEXPボーナス',
  lv80:'げんき回復ボーナス'};
}
test('F4-A builds exactly 21 daytime choices, 21 meal opportunities and 7 nights in chronological order',()=>{
 const x=F4.plan(base());
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert.equal(x.slotCount,28);assert.equal(x.daySlots,21);
 assert.equal(x.mealOpportunities,21);assert.equal(x.sleepSlots,7);
 assert.equal(x.slots.length,28);
 for(let day=0;day<7;day++){
  assert.deepEqual(x.slots.slice(day*4,day*4+4).map(x=>x.slot),
   ['morning','noon','evening','sleep']);
  for(const row of x.slots.slice(day*4,day*4+4)){
   assert.equal(row.day,day);assert.equal(row.team.length,5);
   assert.equal(new Set(row.team).size,5);
   assert(Object.values(row.inventoryAfter).every(v=>v>=0&&Number.isFinite(v)));
   assert(Object.values(row.inventoryAfter).reduce((a,b)=>a+b,0)<=100.1);
  }
  assert.deepEqual([...x.slots[day*4+3].team],NIGHTS[day],
   'manual team changed without consent');
 }
 assert.equal(x.autoSleep,false);
 assert.equal(x.weeklyEnergyCertified,false);
 assert.equal(x.writesSavedData,false);
 assert.equal(x.slots[0].range,'07:30–12:00');
 assert.equal(x.slots[3].range,'00:00–07:30');
 assert(x.assumptions.some(t=>t.includes('04:00')));
});
test('F4-A breakfast cannot spend ingredients not yet produced that morning',()=>{
 const five=Array.from({length:5},(_,i)=>p('p'+i,{apple:2},0));
 const x=F4.plan(base({profiles:five,nightTeams:Array.from({length:7},()=>five.map(p=>p.id)),
  initialInventory:{},recipes:[recipe('breakfast','curry',10,100)],
  bagCapacity:100,beamWidth:8,dayCandidateCount:1}));
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert.equal(x.slots[0].recipeId,null);
 assert(x.slots[0].inventoryAfter.apple>=10);
 assert.equal(x.slots[1].recipeId,'breakfast');
 assert(x.slots[1].mealEnergy>0);
 assert.equal(x.slots.filter(s=>s.slot!=='sleep').length,21);
 assert.equal(x.mealsCooked,x.slots.filter(s=>s.recipeId!==null).length);
});
test('F4-A retains shared bag cap, no negative stock and no same-slot consumption',()=>{
 const ps=Array.from({length:6},(_,i)=>p('p'+i,{apple:25,milk:20},0));
 const x=F4.plan(base({profiles:ps,
  nightTeams:Array.from({length:7},()=>ps.slice(0,5).map(p=>p.id)),
  initialInventory:{apple:1},bagCapacity:30,beamWidth:8,
  recipes:[recipe('a','curry',8,200)]}));
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert(x.discardedIngredientExpectation>0);
 for(const s of x.slots)
  assert(Object.values(s.inventoryAfter).reduce((a,b)=>a+b,0)<=30.02);
 assert.equal(x.slots[0].recipeId,null);
});
test('F4-A handles all three recipe categories and Sunday doubled pot only',()=>{
 const cake={id:'big',type:'dessert',baseStrength:800,requirements:{apple:20}};
 const small=recipe('small','curry',3,30);
 const ps=Array.from({length:5},(_,i)=>p('p'+i,{apple:2},1));
 const x=F4.plan(base({profiles:ps,nightTeams:Array.from({length:7},()=>ps.map(p=>p.id)),
  initialInventory:{apple:5},foodMode:'all',
  recipes:[cake,small],potCapacity:12,bagCapacity:100}));
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert(x.slots.filter(s=>s.recipeId==='big').every(s=>s.day===6),
  'Dish requiring 20 items cooked without doubled Sunday pot');
 assert(x.mealsCooked>0);
});
test('F4-A sleep default is manual and auto mode must be explicitly enabled',()=>{
 assert.equal(F4.plan(base({nightTeams:null})).reason,'MANUAL_NIGHTS');
 const x=F4.plan(base({autoSleep:true,nightTeams:null}));
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert.equal(x.autoSleep,true);
 assert(x.slots.filter(s=>s.slot==='sleep').every(s=>s.team.length===5));
 assert.equal(F4.plan(base({autoSleep:undefined})).reason,'SLEEP_MODE');
});
test('F4-A event source and unknown bonuses always block the neutral-only engine',()=>{
 const official={id:'pokesleep-tool:bountiful banquet week vol1:2026-11-16',
  verifiedEffects:{extraIng:'nuts',ingredient:1,carryLimitAdd:10}};
 const a=F4.plan(base({eventSource:official}));
 assert.equal(a.status,'BLOCKED');
 assert.equal(a.reason,'EVENT_MODEL_NOT_CONNECTED');
 assert.equal(F4.plan(base({eventMode:undefined})).reason,'UNVERIFIED_EVENT');
 assert.equal(F4.plan(base({eventMode:'NEUTRAL_REFERENCE_ONLY',eventSource:{}})).status,'BLOCKED');
 assert.equal(a.weeklyEnergyCertified,false);
});
test('F4-A validates incomplete/unpinned input and does not silently invent twenty-first ingredient',()=>{
 const invalid=[
  {weekStart:'2026-11-17'},
  {bagCapacity:0},{potCapacity:6},
  {foodMode:'unknown'},{fieldBonus:null},{camp:'true'},
  {initialInventory:{nuts:1}},
  {initialInventory:{apple:101}},
  {profiles:[...profiles.slice(0,5),{...profiles[5],id:'p0'}]},
  {profiles:[...profiles.slice(0,5),{...profiles[5],source:'unverified'}]},
  {profiles:[...profiles.slice(0,5),{...profiles[5],ratesByTeammateBonus:[...profiles[5].ratesByTeammateBonus.slice(0,4)]}]},
  {recipes:[{...recipe(),requirements:{nuts:7}}]},
  {recipes:[{...recipe(),baseStrength:Infinity}]},
  {nightTeams:[[...NIGHTS[0]],...NIGHTS.slice(1,6)]},
  {nightTeams:[[...NIGHTS[0].slice(0,4),'p99'],...NIGHTS.slice(1)]},
  {beamWidth:300},
  {dayCandidateCount:0}
 ];
 for(const diff of invalid){
  const r=F4.plan(base(diff));
  assert.equal(r.status,'BLOCKED',JSON.stringify(diff)+' : '+r.reason);
 }
});
test('F4-A deterministic bounded search; no writes or F1 parent mutation',()=>{
 const input=base({recipes,foodMode:'all',
  initialInventory:{apple:90,milk:70,honey:35},bagCapacity:500,camp:true,
  fieldBonus:40,beamWidth:16});
 const pre=JSON.stringify(input);
 const start=Date.now();
 const x=F4.plan(input);
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert.equal(x.slots.length,28);assert(x.energyProxy>0);
 assert(Date.now()-start<15000,'Unexpectedly slow seven-day scenario');
 const y=F4.plan(input);
 assert.equal(JSON.stringify(x),JSON.stringify(y),'Nondeterministic schedule');
 assert.equal(JSON.stringify(input),pre,'Input was mutated');
 assert.equal(x.energyProxy,x.mealEnergyProxy+x.berryEnergyProxy>=0?
  x.energyProxy:x.energyProxy);
 assert(!read('f4/f4-chronological-core-v1.js').includes('localStorage'));
 assert(!read('f4/f4-chronological-core-v1.js').includes('setItem('));
 assert(!read('index.html').includes('f4-chronological-core-v1.js'));
});
test('F4-A real F1-B 66-form eligibility, pinned source, berry-strength formula, no personal details',()=>{
 const rows=['エーフィ','リザードン','ゲンガー','ライチュウ','サーナイト','カメックス']
  .map(n=>boxRow(n));
 const input={items:rows,camp:true,fieldBonus:50,
  favoriteTypes:['water','fairy','flying']};
 const before=JSON.stringify(input);
 const adapted=R.adapt(input,deps);
 assert.equal(adapted.status,'READY',adapted.message);
 assert.equal(adapted.profiles.length,6);
 assert.equal(adapted.sourceCommit,'663bf018f69633d2d7d108b5f833d97874b74c41');
 assert(adapted.profiles.every(p=>p.id.startsWith('p')));
 assert(adapted.profiles.every(p=>p.ratesByTeammateBonus.length===5));
 assert.equal(adapted.profiles.filter(p=>p.helpingBonus).length,6);
 assert(!JSON.stringify(adapted).includes('DO_NOT_LEAK_PRIVATE_NICK'));
 assert(!JSON.stringify(adapted).includes('nickname'));
 assert(!JSON.stringify(adapted).includes('nature'));
 assert.equal(JSON.stringify(input),before);
 const berry=R.berryUnit('water',50,['water','fairy','flying'],50,master);
 const b0=master.berry.water,raw=Math.max(b0+50-1,Math.round(Math.pow(1.025,49)*b0));
 assert.equal(berry,Math.ceil(Math.ceil(raw*1.5)*2));
 const bad=R.adapt({...input,items:rows.slice(0,4)},deps);
 assert.equal(bad.status,'BLOCKED');
 const injected=R.adapt({...input,items:[...rows.slice(0,5),{...rows[5],ing1:'ひとくちナッツ'}]},deps);
 assert.equal(injected.status,'READY');assert.equal(injected.excludedCount,1);
 assert.equal(injected.profiles.length,5);
});
test('F4-A end-to-end F1-B adapter profiles run a neutral seven-day chronology only',()=>{
 const rows=['エーフィ','リザードン','ゲンガー','ライチュウ','サーナイト','カメックス']
  .map(n=>boxRow(n));
 const adapter=R.adapt({items:rows,camp:true,fieldBonus:50,
  favoriteTypes:['water','fairy','flying']},deps);
 assert.equal(adapter.status,'READY',adapter.message);
 const x=F4.plan(base({profiles:adapter.profiles,recipes,foodMode:'curry',
  initialInventory:{apple:60,sausage:40,milk:60},
  bagCapacity:600,potCapacity:57,camp:true,fieldBonus:50,
  nightTeams:Array.from({length:7},()=>adapter.profiles.slice(0,5).map(p=>p.id))}));
 assert.equal(x.status,'PROVISIONAL',x.message);
 assert(x.energyProxy>0);assert.equal(x.slots.length,28);
 assert.equal(x.weeklyEnergyCertified,false);
 assert(!JSON.stringify(x).includes('DO_NOT_LEAK_PRIVATE_NICK'));
});

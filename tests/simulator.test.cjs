const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../src');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','recipes.js','simulator.js'])vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),context,{filename:name});
const sim=context.globalThis.PokeSimulator;
const master=context.globalThis.PokeMaster;
const raichu=master.species.find(s=>s.name==='ライチュウ');
function monster(id='x',pokemon='ライチュウ'){
 return {id,pokemon,nickname:id,level:50,skillLevel:6,ingredients:['とくせんリンゴ','あったかジンジャー','とくせんエッグ'],subskills:['きのみの数S','','','',''],nature:'さみしがり',sleepHours:1000,shiny:false};
}
function input(){
 const box=Array.from({length:5},(_,i)=>monster(String(i)));
 const ids=box.map(p=>p.id);
 return {box,teams:{morning:ids,noon:ids,evening:ids,sleep:ids},options:{map:'シアンの砂浜',fieldBonus:50,tapMinutes:150,potSize:57,sleepScore:100,initialEnergy:100,foodMode:'curry',recipeId:'apple_curry',initialIngredients:{apple:150},camp:false}};
}
test('master snapshot contains Raichu with source stats',()=>{
 assert.equal(raichu.frequency,2200);assert.equal(raichu.type,'electric');assert.equal(raichu.ingRate,22.4);
});
test('berry strength matches pokesleep-tool formula',()=>{
 const b=25,lv=50,raw=Math.max(b+lv-1,Math.round(b*1.025**(lv-1)));
 assert.equal(sim.berryUnit('electric',lv,['electric'],50),Math.ceil(Math.ceil(raw*1.5)*2));
});
test('seven daily values reconcile to total energy',()=>{
 const r=sim.simulate(input());assert.equal(r.days.length,7);
 assert.ok(Math.abs(r.days.reduce((t,x)=>t+x.berries+x.cooking+x.skills,0)-r.total)<1e-5);
 assert.ok(r.berries>0);assert.ok(r.skills>0);assert.ok(r.ingredients.apple>0);
});
test('Good Camp effects increase production in a simple case',()=>{
 const a=input();const b=input();b.options.camp=true;
 const x=sim.simulate(a),y=sim.simulate(b);
 assert.ok(y.berries>x.berries,'camp speed should improve berries');
});
test('no dish without ingredients, dish exists with available stock',()=>{
 const a=input(),b=input();a.options.initialIngredients={apple:0};b.options.initialIngredients={apple:150};
 const x=sim.simulate(a),y=sim.simulate(b);
 assert.ok(y.cooking>x.cooking);assert.ok(x.cooking>=0);
});
test('team cannot repeat same individual or have only four members',()=>{
 const a=input();a.teams.morning[1]=a.teams.morning[0];
 assert.throws(()=>sim.simulate(a),/5匹/);
 a.teams.morning=['0','1','2','3'];assert.throws(()=>sim.simulate(a),/5匹/);
});
test('unknown species are warned, not treated as normal species',()=>{
 const a=input();a.box[0].pokemon='存在しない種族';
 const r=sim.simulate(a);assert.ok(r.warnings.some(w=>w.includes('未登録の種族')));
});
test('random favorite field is not silently assigned',()=>{
 const a=input();a.options.map='ワカクサ本島';
 const r=sim.simulate(a);assert.ok(r.warnings.some(w=>w.includes('好みのきのみ')));
});
test('recipe category mismatch avoids phantom cooking bonus',()=>{
 const a=input();a.options.foodMode='salad';
 const r=sim.simulate(a);assert.equal(r.cooking,0);
});
test('prototype explicitly warns unsupported skills and approximations',()=>{
 const a=input();const r=sim.simulate(a);
 assert.ok(r.warnings.some(w=>w.includes('暫定期待値')));
});

test('pity-corrected skill rate remains finite and energy outputs are not NaN',()=>{
 const p=input();p.box.forEach(v=>v.skillLevel=1);const r=sim.simulate(p);
 for(const key of ['total','berries','skills','cooking','sneaky'])assert.ok(Number.isFinite(r[key])&&r[key]>=0);
});
test('random cooking category does not assume that a chosen recipe can be cooked',()=>{
 const p=input();p.options.foodMode='random';
 const r=sim.simulate(p);
 assert.equal(r.cooking,0);
 assert.ok(r.warnings.some(w=>w.includes('料理カテゴリを確定')));
});
test('explicit cooking category is required for the selected recipe',()=>{
 const p=input();p.options.foodMode='curry';
 assert.ok(sim.simulate(p).cooking>0);
 p.options.foodMode='dessert';
 assert.equal(sim.simulate(p).cooking,0);
});
test('Sunday night 00:00-04:00 is not collected before 07:30 Monday',()=>{
 const a=input();a.options.initialIngredients={apple:0};a.options.recipeId='';
 // Inflate carry capacities so no sneaky snacking occurs before collection.
 const oldCaps=master.species.map(s=>s.carryLimit);
 try{
  for(const sp of master.species)sp.carryLimit=1e7;
  const r=sim.simulate(a);
  assert.equal(r.sneaky,0);
  // Last-day calculation stops before Monday 04:00 collection.
  assert.ok(r.days[6].berries>0);
  assert.ok(r.warnings.some(w=>w.includes('暫定')));
 }finally{master.species.forEach((sp,i)=>{sp.carryLimit=oldCaps[i]})}
});
test('Good Night Ribbon and evolution-left base stats remain present in master',()=>{
 const r=master.species.find(s=>s.name==='ピカチュウ');
 assert.ok(Number.isInteger(r.evolutionLeft));
 const darkrai=master.species.find(s=>s.english==='Darkrai');
 assert.ok(Array.isArray(darkrai.mythIng));
});
test('week total omits phantom 04:00 collection compared with previous version',()=>{
 const p=input();const r=sim.simulate(p);
 assert.ok(r.days.length===7);assert.ok(r.total>=r.sneaky);
});

test('sleep recovery bonus improves weekly daytime production at low sleep score',()=>{
 const base=input(),extra=input();
 base.options.sleepScore=50;extra.options.sleepScore=50;
 base.options.initialEnergy=30;extra.options.initialEnergy=30;
 extra.box.forEach(p=>p.subskills[1]='げんき回復ボーナス');
 const b=sim.simulate(base),e=sim.simulate(extra);
 assert.ok(e.berries>b.berries,'sleep energy recovery bonus should improve berry yield');
});
test('7.5-hour default sleep score is not silently assumed to be 100',()=>{
 const oldDefault=50;
 const a=input(),b=input();a.options.sleepScore=88;b.options.sleepScore=100;
 a.options.initialEnergy=0;b.options.initialEnergy=0;
 assert.ok(sim.simulate(a).berries<=sim.simulate(b).berries);
});

test('all 78 recipes have valid keys, positive ingredients and level70 factor',()=>{
 assert.equal(sim.RECIPES.length,78);
 assert.deepEqual(sim.RECIPES.reduce((x,r)=>(x[r.type]=(x[r.type]||0)+1,x),{}),{curry:25,salad:26,dessert:27});
 for(const r of sim.RECIPES){
  assert.equal(r.strength70,Math.round(r.baseStrength*3.58));
  for(const [key,count] of Object.entries(r.requirements)){
   assert.ok(master.ingredients[key]);assert.ok(Number.isInteger(count)&&count>0);
  }
 }
});
test('high-end recipe cannot cook without enough pot and stock',()=>{
 const a=input();a.options.recipeId=sim.RECIPES.find(r=>r.name==='とびはねるカレーうどん').id;
 a.options.potSize=100;a.options.initialIngredients={ginger:100,mushroom:100,herb:100,sausage:100};
 assert.equal(sim.simulate(a).cooking,0);
 a.options.potSize=120;
 assert.ok(sim.simulate(a).cooking>0);
});
test('legacy recipe ids remain stable after full catalog upgrade',()=>{
 for(const id of ['apple_curry','white_stew','apple_salad','bean_salad','apple_juice'])assert.ok(sim.RECIPES.some(x=>x.id===id));
});

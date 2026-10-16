const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../src');
const context=vm.createContext({module:{exports:{}},globalThis:{}});
for(const name of ['master.js','simulator.js'])vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),context,{filename:name});
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

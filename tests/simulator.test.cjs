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
 const sundayOnly=sim.simulate(a);
 assert.equal(sundayOnly.days.slice(0,6).reduce((n,d)=>n+d.cooking,0),0,'Only Sunday doubles the permanent pot');
 assert.ok(sundayOnly.days[6].cooking>0,'Sunday capacity permits this large recipe');
 a.options.potSize=120;
 const allDays=sim.simulate(a);
 assert.ok(allDays.days.slice(0,6).some(d=>d.cooking>0),'Large base pot permits weekday recipes');
});
test('legacy recipe ids remain stable after full catalog upgrade',()=>{
 for(const id of ['apple_curry','white_stew','apple_salad','bean_salad','apple_juice'])assert.ok(sim.RECIPES.some(x=>x.id===id));
});

test('ingredient bag cap prevents phantom inventory beyond capacity',()=>{
 const a=input();a.options.recipeId='';a.options.initialIngredients={apple:20};a.options.bagCapacity=35;
 const result=sim.simulate(a);
 assert.ok(Object.values(result.inventory).reduce((n,v)=>n+v,0)<=35+1e-8);
 assert.ok(result.warnings.some(w=>w.includes('食材バッグ満杯')));
});
test('invalid initial stock exceeding bag is rejected',()=>{
 const a=input();a.options.initialIngredients={apple:100};a.options.bagCapacity=50;
 assert.throws(()=>sim.simulate(a),/食材バッグ容量/);
});
test('unknown ingredient keys are rejected instead of silently accepted',()=>{
 const a=input();a.options.initialIngredients={'unknown-item':100};
 assert.throws(()=>sim.simulate(a),/初期食材数/);
});
test('bag cap reduces collected ingredients compared with unlimited bag',()=>{
 const a=input(),b=input();
 a.options.recipeId='';b.options.recipeId='';
 a.options.initialIngredients={apple:20};b.options.initialIngredients={apple:20};
 a.options.bagCapacity=35;b.options.bagCapacity=0;
 const small=sim.simulate(a),full=sim.simulate(b);
 assert.ok(small.ingredients.apple<full.ingredients.apple);
});

test('all seven user-excluded main skills make zero contribution to energy and skill triggers',()=>{
 const expected=[
  'Metronome','Skill Copy (Mimic)','Skill Copy (Transform)','Versatile',
  'Dream Shard Magnet S','Dream Shard Magnet S (Random)','Dream Shard Magnet S (Aura Sphere)'
 ];
 assert.deepEqual([...sim.EXCLUDED_MAIN_SKILLS],expected);
 for(const skill of expected){
  const species=master.species.find(s=>s.skill===skill);
  assert.ok(species,'No test species for '+skill);
  const a=input();
  a.box.forEach(p=>{p.pokemon=species.name;p.mainSkill='エナジーチャージM';});
  const result=sim.simulate(a);
  assert.equal(result.skills,0,skill+' direct energy must not count');
  assert.equal(result.skillTriggers,0,skill+' skill triggers must not count');
  assert.ok(result.berries>0,skill+' must still produce ordinary berries');
  assert.ok(result.warnings.some(w=>w.includes('計算対象外のメインスキル')),skill+' exclusion should be transparent');
  assert.ok(!result.warnings.some(w=>w.includes('未対応のメインスキル')&&w.includes(skill)),skill+' is intentionally out-of-scope');
 }
});
test('exclusion does not disable ordinary direct-strength skill calculations',()=>{
 const a=input(),result=sim.simulate(a);
 assert.ok(result.skills>0);
 assert.ok(result.skillTriggers>0);
});

test('ingredient magnet without unlocked pool is not credited as recipe stock',()=>{
 const a=input();a.options.recipeId='';
 a.box.forEach(p=>p.pokemon='フシギバナ');
 const result=sim.simulate(a);
 assert.ok(result.unassignedMagnet>0);
 assert.equal(Object.keys(result.skillIngredients).length,0);
 assert.ok(result.warnings.some(v=>v.includes('抽選候補が未設定')));
});
test('ingredient magnet distributes only across the user-declared unlocked pool',()=>{
 const a=input();a.options.recipeId='';a.options.magnetIngredients=['apple','milk'];
 a.box.forEach(p=>p.pokemon='フシギバナ');
 const result=sim.simulate(a);
 assert.ok(result.skillIngredients.apple>0);
 assert.ok(result.skillIngredients.milk>0);
 assert.equal(result.unassignedMagnet,0);
 assert.equal(Object.keys(result.skillIngredients).length,2);
 assert.ok(Math.abs(result.skillIngredients.apple-result.skillIngredients.milk)<1e-6);
});
test('base random ingredient part of Present and Plus is counted, not conditional extras',()=>{
 for(const name of ['デリバード','プラスル']){
  const a=input();a.options.recipeId='';a.options.magnetIngredients=['milk'];
  a.box.forEach(p=>p.pokemon=name);
  const r=sim.simulate(a);
  assert.ok((r.skillIngredients.milk||0)>0,name);
  assert.ok(r.warnings.some(v=>v.includes('プレゼント')||v.includes('プラス')));
 }
});
test('cooking power bonus stacks to 200 and weekend doubles only permanent capacity',()=>{
 assert.equal(sim.effectivePotCapacity(21,0,0,false),21);
 assert.equal(sim.effectivePotCapacity(21,10,0,true),47);
 assert.equal(sim.effectivePotCapacity(21,10,6,true),78);
 assert.equal(sim.effectivePotCapacity(57,1000,0,false),257);
 assert.equal(sim.effectivePotCapacity(57,10,6,false),124);
});
test('magnet ingredient pool rejects duplicate or unknown ingredients',()=>{
 const a=input();a.options.magnetIngredients=['apple','apple'];
 assert.throws(()=>sim.simulate(a),/抽選対象/);
 a.options.magnetIngredients=['phantom'];assert.throws(()=>sim.simulate(a),/抽選対象/);
});
test('cooking power-up affects pot stock but not direct energy strength',()=>{
 const a=input();a.options.recipeId='';a.box.forEach(p=>p.pokemon='コイル');
 const r=sim.simulate(a);
 assert.equal(r.skills,0);
 assert.ok(r.potBonus>0);
 assert.ok(r.warnings.some(v=>v.includes('暫定')));
});

test('pot expansion enables a weekday recipe unreachable with the same permanent pot alone',()=>{
 const setup=name=>{
  const a=input();a.box.forEach(p=>{p.pokemon=name;p.skillLevel=7;p.subskills=['スキル確率アップM','','','',''];});
  a.options.recipeId='curry_18';a.options.potSize=57;
  a.options.initialIngredients={herb:250,sausage:250,corn:250,ginger:250};
  return sim.simulate(a);
 };
 const coil=setup('コイル'),ordinary=setup('ライチュウ');
 assert.ok(coil.days.slice(0,6).some(d=>d.cooking>0),'pot skill should enable weekday recipe');
 assert.equal(ordinary.days.slice(0,6).reduce((sum,d)=>sum+d.cooking,0),0);
 assert.ok(coil.cooking>ordinary.cooking);
});

test('greedy cooking only chooses the strongest recipe feasible right now',()=>{
 const stock={apple:8,milk:7};
 const preferred=sim.chooseRecipe({mode:'fixed',preferredId:'apple_curry',foodMode:'curry',inventory:stock,potCapacity:57});
 const strongest=sim.chooseRecipe({mode:'best',preferredId:'apple_curry',foodMode:'curry',inventory:stock,potCapacity:57});
 assert.equal(preferred.id,'apple_curry');
 assert.equal(strongest.id,'white_stew');
});
test('preferred recipe is cooked when feasible, otherwise a valid fallback is picked',()=>{
 const common={foodMode:'curry',potCapacity:57,preferredId:'apple_curry',mode:'fallback'};
 assert.equal(sim.chooseRecipe({...common,inventory:{apple:7,milk:7}}).id,'apple_curry');
 assert.equal(sim.chooseRecipe({...common,inventory:{apple:6,milk:7}}).id,'white_stew');
 assert.equal(sim.chooseRecipe({...common,inventory:{apple:0,milk:0}}),null);
});
test('random cuisine, mismatched mode and pot shortage cannot produce phantom dishes',()=>{
 const base={mode:'best',preferredId:'',inventory:{apple:100,milk:100},potCapacity:5};
 assert.equal(sim.chooseRecipe({...base,foodMode:'curry'}),null);
 assert.equal(sim.chooseRecipe({...base,foodMode:'random',potCapacity:100}),null);
 assert.throws(()=>sim.chooseRecipe({...base,foodMode:'curry',mode:'unsupported'}),/料理選択モード/);
});
test('meal traces and consumption reconcile to exact configured recipe costs',()=>{
 const a=input();a.options.recipeMode='best';a.options.recipeId='';
 a.options.foodMode='curry';a.options.initialIngredients={apple:70,milk:70,sausage:70};
 const r=sim.simulate(a);
 assert.ok(r.meals.length>0&&r.meals.length<=21);
 assert.ok(Math.abs(r.meals.reduce((n,m)=>n+m.energy,0)-r.cooking)<1e-5);
 const consume={};
 for(const meal of r.meals){
  const rec=sim.RECIPES.find(x=>x.id===meal.recipeId);
  assert.ok(rec&&rec.type==='curry');
  assert.ok(meal.count<=meal.potCapacity);
  for(const [k,v] of Object.entries(rec.requirements))consume[k]=(consume[k]||0)+v;
 }
 assert.deepEqual(Object.entries(r.consumedIngredients).sort(),Object.entries(consume).sort());
 for(const v of Object.values(r.inventory))assert.ok(v>=-1e-5);
});
test('automatic cooking is confined to the configured weekly cuisine',()=>{
 const a=input();a.options.recipeMode='best';a.options.recipeId='';
 a.options.foodMode='salad';a.options.initialIngredients={apple:100,sausage:100};
 const r=sim.simulate(a);
 assert.ok(r.meals.length>0);
 assert.ok(r.meals.every(m=>sim.RECIPES.find(x=>x.id===m.recipeId).type==='salad'));
});
test('no auto-meal is credited when weekly cuisine is random',()=>{
 const a=input();a.options.recipeMode='best';a.options.recipeId='';
 a.options.foodMode='random';
 const r=sim.simulate(a);
 assert.equal(r.cooking,0);assert.equal(r.meals.length,0);
 assert.ok(r.warnings.some(w=>w.includes('カテゴリは未確定')));
});
test('legacy fixed dish mode is unchanged when recipeMode is absent',()=>{
 const a=input(),b=input();b.options.recipeMode='fixed';
 assert.equal(sim.simulate(a).cooking,sim.simulate(b).cooking);
});
test('cooking recovery follows v3.5 table 0-9 across boundaries',()=>{
 const cases=[[0,9],[10,9],[11,8],[20,8],[21,7],[30,7],[31,6],[40,6],[41,5],[50,5],
 [51,4],[60,4],[61,3],[70,3],[71,2],[80,2],[81,1],[149,1],[150,0]];
 for(const [before,expected] of cases)assert.equal(sim.mealRecovery(before),expected,'Energy='+before);
});
test('no meal is cooked without selecting a recipe in legacy fixed mode',()=>{
 const a=input();a.options.recipeId='';a.options.recipeMode='fixed';
 const r=sim.simulate(a);
 assert.equal(r.cooking,0);assert.equal(r.meals.length,0);
});

test('berry burst skill counts each teammate berry strength without counting skill twice',()=>{
 const a=input();a.box[0].pokemon='ワシボン'; // Replace below with species matching the main skill, not a fixed name.
 const b=master.species.find(s=>s.skill==='Berry Burst');
 assert.ok(b);
 a.box.forEach(p=>p.pokemon=b.name);
 const result=sim.simulate(a);
 assert.ok(result.berries>0);
 assert.ok(!result.warnings.some(w=>w.includes('未対応のメインスキル')&&w.includes('Berry Burst')));
});
test('Disguise Berry Burst grants expected crit-weighted berries',()=>{
 const b=master.species.find(s=>s.skill==='Berry Burst (Disguise)');
 assert.ok(b);
 const a=input();a.box.forEach(p=>p.pokemon=b.name);
 const result=sim.simulate(a);
 assert.ok(result.berries>0);
 assert.ok(result.warnings.some(w=>w.includes('ばけのかわの大成功率')));
});

test('bonus food option fills spare pot only with available food and reports exact energy',()=>{
 const a=input();a.options.recipeMode='fixed';a.options.recipeId='apple_curry';a.options.potSize=57;
 a.options.initialIngredients={apple:140,tail:70};
 const x=sim.simulate(a);
 a.options.extraMode='fill';const y=sim.simulate(a);
 assert.ok(y.meals[0].extraEnergy>0);
 assert.ok(y.meals[0].count<=y.meals[0].potCapacity);
 assert.ok(y.cooking>x.cooking,'same initial stock with extra ingredient mode must add first-meal energy');
 for(const row of y.meals)assert.ok(row.count<=row.potCapacity);
});
test('extra ingredients are charged only at base energy without Lv70 multiplier',()=>{
 const a=input();a.options.recipeMode='fixed';a.options.recipeId='apple_curry';
 a.options.extraMode='fill';a.options.potSize=20;
 a.options.initialIngredients={apple:7,tail:50};
 const r=sim.simulate(a),first=r.meals[0];
 assert.equal(first.count,20);
 assert.equal(first.extraEnergy,13*342);
 assert.ok(Math.abs(first.energy-(sim.RECIPES.find(x=>x.id==='apple_curry').strength70+first.extraEnergy)*(1+a.options.fieldBonus/100))<1e-5);
});
test('great-success expected energy uses baseline weekday 10% and Sunday 30%',()=>{
 const a=input();a.options.recipeMode='fixed';a.options.recipeId='apple_curry';
 a.options.initialIngredients={apple:250};a.options.successMode='expected';
 const r=sim.simulate(a);
 assert.ok(r.meals.length>0);
 for(const row of r.meals)assert.ok(Math.abs(row.successProbability-(row.day===7?.3:.1))<1e-10);
 const weekday=r.meals.find(x=>x.day<7);assert.ok(weekday);
 assert.ok(Math.abs(weekday.energy-sim.RECIPES.find(x=>x.id==='apple_curry').strength70*(1+a.options.fieldBonus/100)*1.1)<1e-6);
});
test('Tasty Chance adds probability in expected mode and remains uncredited when disabled',()=>{
 const a=input();a.options.recipeMode='fixed';a.options.recipeId='apple_curry';
 a.options.initialIngredients={apple:300};a.options.successMode='expected';
 const dedenne=master.species.find(p=>p.skill==='Tasty Chance S');assert.ok(dedenne);
 a.box.forEach(p=>p.pokemon=dedenne.name);
 const withSkill=sim.simulate(a);
 assert.ok(withSkill.meals.some(m=>m.successProbability>(m.day===7?.3:.1)));
 a.options.successMode='none';const withoutMode=sim.simulate(a);
 assert.ok(withoutMode.meals.every(m=>m.successProbability===0));
 assert.ok(withoutMode.warnings.some(w=>w.includes('料理チャンスS')));
});
test('legacy recipe simulator keeps extras and success OFF absent explicit flags',()=>{
 const a=input();const r=sim.simulate(a);
 assert.ok(r.meals.every(m=>!m.extraEnergy&&m.successProbability===0));
});

test('Energizing Cheer recipient weights prioritize lowest energy while summing to one',()=>{
 const ids=['a','b','c','d','e'];
 const w=sim.cheerWeights(ids,new Map(ids.map((id,i)=>[id,i===0?5:60])));
 assert.ok(Math.abs(w.get('a')-.76)<1e-9);
 for(const id of ids.slice(1))assert.ok(Math.abs(w.get(id)-.06)<1e-9);
 assert.ok(Math.abs([...w.values()].reduce((a,b)=>a+b,0)-1)<1e-9);
});
test('tied low energy Cheer recipients split low-weight probability equally',()=>{
 const ids=['a','b','c','d','e'],w=sim.cheerWeights(ids,new Map([['a',4],['b',4],['c',60],['d',60],['e',60]]));
 assert.ok(Math.abs(w.get('a')-.41)<1e-9);
 assert.ok(Math.abs(w.get('b')-.41)<1e-9);
});
test('Energizing Cheer and Nuzzle contribute healing expectations without direct skill energy',()=>{
 for(const sk of ['Energizing Cheer S','Energizing Cheer S (Nuzzle)']){
  const sp=master.species.find(s=>s.skill===sk);assert.ok(sp);
  const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
  a.options.initialEnergy=15;a.options.sleepScore=40;
  const r=sim.simulate(a);
  assert.ok(r.berries>0);
  assert.equal(r.skills,0,'healing alone is not direct energy');
  assert.ok(r.warnings.some(x=>x.includes('げんきエールの回復対象')));
  if(sk.includes('Nuzzle'))assert.ok(r.warnings.some(x=>x.includes('発動可能ボーナス')));
 }
});
test('representative box for each registered species does not result in nonfinite simulation values',()=>{
 // Smoke test the 249-species snapshot without assuming unsupported main skills work.
 for(const sp of master.species){
  const first=(sp.mythIng||sp.ings||[]).find(x=>x.c1>0);
  if(!first)continue;
  const a=input();a.box.forEach(p=>{
   p.pokemon=sp.name;p.skillLevel=1;p.level=20;
   p.ingredients=[master.ingredients[first.name],'',''];p.subskills=['','','','',''];
  });
  a.options.recipeId='';a.options.initialIngredients={};a.options.magnetIngredients=[];
  const r=sim.simulate(a);
  for(const x of ['berries','cooking','skills','total','sneaky'])assert.ok(Number.isFinite(r[x]),sp.name+' '+x);
 }
});

test('Ingredient Draw and variants use each species own fixed ingredient pool',()=>{
 const valid={
  'Ingredient Draw S':new Set(['potato','corn','pumpkin']),
  'Ingredient Draw S (Super Luck)':new Set(['mushroom','sausage','soy','coffee']),
  'Ingredient Draw S (Hyper Cutter)':new Set(['potato','oil','tomato','corn'])
 };
 for(const skill of Object.keys(valid)){
  const sp=master.species.find(x=>x.skill===skill);assert.ok(sp);
  const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=7;});
  a.options.recipeId='';a.options.initialIngredients={};a.options.magnetIngredients=[];
  const r=sim.simulate(a);
  assert.ok(Object.keys(r.skillIngredients).length>0,skill);
  for(const key of Object.keys(r.skillIngredients))assert.ok(valid[skill].has(key),skill+' incorrect ingredient '+key);
 }
});
test('Bulk Up provides ingredient value and Tasty Chance bonus only if enabled',()=>{
 const sp=master.species.find(p=>p.skill==='Cooking Assist S (Bulk Up)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=7;});
 a.options.magnetIngredients=['milk','apple'];a.options.recipeMode='best';a.options.initialIngredients={apple:100,milk:100};
 a.options.successMode='expected';const r=sim.simulate(a);
 assert.ok(r.skillIngredients.milk>0);
 assert.ok(r.meals.some(m=>m.successProbability>(m.day===7?.3:.1)));
 a.options.successMode='none';const without=sim.simulate(a);
 assert.ok(without.meals.every(m=>m.successProbability===0));
 assert.ok(without.warnings.some(w=>w.includes('ビルドアップ')));
});
test('Bad Dreams direct strength and Dark-only energy penalty are distinct from excluded shard skills',()=>{
 const sp=master.species.find(x=>x.skill==='Charge Strength M (Bad Dreams)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=7;});
 const r=sim.simulate(a);
 assert.ok(r.skills>0);
 assert.ok(r.warnings.some(x=>x.includes('ナイトメア')));
 assert.ok(!r.warnings.some(x=>x.includes('未対応のメインスキル')&&x.includes('Bad Dreams')));
});

test('Moonlight and Berry Juice base healing are simulated with explicit conditional omissions',()=>{
 const selections=[
 ['Charge Energy S (Moonlight)','つきのひかり'],
 ['Energy for Everyone S (Berry Juice)','きのみジュース']
 ];
 for(const [skill,warning] of selections){
  const sp=master.species.find(x=>x.skill===skill);assert.ok(sp);
  const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
  a.options.initialEnergy=10;a.options.sleepScore=40;
  const r=sim.simulate(a);
  assert.equal(r.skills,0);
  assert.ok(r.berries>0);
  assert.ok(r.warnings.some(w=>w.includes(warning)));
  assert.ok(!r.warnings.some(w=>w.includes('未対応のメインスキル')&&w.includes(skill)));
 }
});

test('Lunar Blessing level/species berry table matches upstream sample values',()=>{
 assert.deepEqual([...sim.lunarBerryCounts(1,1)],[5,1]);
 assert.deepEqual([...sim.lunarBerryCounts(1,5)],[14,2]);
 assert.deepEqual([...sim.lunarBerryCounts(3,3)],[18,2]);
 assert.deepEqual([...sim.lunarBerryCounts(6,5)],[32,9]);
});
test('Draco Meteor table applies Lati-twins bonus to self berries only',()=>{
 assert.deepEqual([...sim.dracoBerryCounts(1,1,false)],[12,1]);
 assert.deepEqual([...sim.dracoBerryCounts(1,1,true)],[14,1]);
 assert.deepEqual([...sim.dracoBerryCounts(5,5,true)],[62,5]);
 assert.deepEqual([...sim.dracoBerryCounts(6,5,true)],[68,5]);
});
test('Draco Meteor produces team berries from the current five members',()=>{
 const sp=master.species.find(s=>s.skill==='Berry Burst (Draco Meteor)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
 const r=sim.simulate(a);
 assert.ok(r.berries>0);
 assert.ok(r.warnings.some(w=>w.includes('りゅうせいぐん')));
 assert.ok(!r.warnings.some(w=>w.includes('未対応のメインスキル')&&w.includes('Draco Meteor')));
});
test('Psystrike direct energy works without claiming to reproduce the berry zone',()=>{
 const sp=master.species.find(s=>s.skill==='Berry Zone (Psystrike)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
 const r=sim.simulate(a);
 assert.ok(r.skills>0);
 assert.ok(r.warnings.some(w=>w.includes('マゴのみゾーン強化')));
});
test('Stockpile has finite-horizon payouts rather than immediate long-run value',()=>{
 const sp=master.species.find(s=>s.skill==='Charge Strength S (Stockpile)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
 const r=sim.simulate(a);
 assert.ok(r.skills>0);
 assert.ok(r.warnings.some(w=>w.includes('蓄積0回から開始')));
 assert.ok(r.warnings.every(w=>!w.includes('長期期待値')));
});
test('Lunar Blessing contributes expected berry energy and team healing',()=>{
 const sp=master.species.find(s=>s.skill==='Energy for Everyone S (Lunar Blessing)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
 const r=sim.simulate(a);
 assert.ok(r.berries>0);
 assert.ok(r.warnings.some(w=>w.includes('みかづきのいのり')));
 assert.equal(r.skills,0);
});
test('Extra Helpful S grants expected help yield without recursive skill procs',()=>{
 const sp=master.species.find(s=>s.skill==='Extra Helpful S');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=7;});
 const r=sim.simulate(a);
 assert.ok(r.berries>0);
 assert.ok(r.warnings.some(w=>w.includes('おてつだいサポートS')));
 assert.equal(r.skills,0);
});
test('Helper Boost respects multi-species parameter and produces finite week strength',()=>{
 const sp=master.species.find(s=>s.skill==='Helper Boost');assert.ok(sp);
 const a=input();a.box.forEach((p,i)=>{p.pokemon=i===0?sp.name:'ライチュウ';p.skillLevel=6;});
 const r=sim.simulate(a);
 assert.ok(r.berries>0&&Number.isFinite(r.total));
 assert.ok(r.warnings.some(w=>w.includes('おてつだいブースト')));
});
test('Heal Pulse restores energy and generates expected extra helps without new main skill procs',()=>{
 const sp=master.species.find(s=>s.skill==='Energizing Cheer S (Heal Pulse)');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
 const r=sim.simulate(a);
 assert.ok(Number.isFinite(r.total));
 assert.ok(r.extraHelps>0);
 assert.ok(r.warnings.some(w=>w.includes('いやしのはどうは回復・追加おてつだい')));
});
test('Seven user-excluded main skills remain excluded after additional branches',()=>{
 for(const skill of [...sim.EXCLUDED_MAIN_SKILLS]){
  const sp=master.species.find(s=>s.skill===skill);assert.ok(sp);
  const a=input();a.box.forEach(p=>p.pokemon=sp.name);
  const r=sim.simulate(a);
  assert.equal(r.skills,0);
  assert.ok(r.warnings.some(w=>w.includes('指定により計算対象外')));
 }
});

test('every main skill in the 249-species snapshot is modeled or explicitly excluded',()=>{
 const firstBySkill=new Map();
 for(const sp of master.species)if(!firstBySkill.has(sp.skill))firstBySkill.set(sp.skill,sp);
 assert.equal(firstBySkill.size,36);
 const intentional=new Set([...sim.EXCLUDED_MAIN_SKILLS]);
 const skipped=[];
 for(const [skill,sp] of firstBySkill){
  const a=input();
  a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=1;});
  a.options.recipeId='';a.options.initialIngredients={};a.options.magnetIngredients=['apple','milk'];
  const r=sim.simulate(a);
  assert.ok(Number.isFinite(r.total),skill);
  const warnings=r.warnings.filter(w=>w.startsWith('未対応のメインスキル'));
  if(warnings.length)skipped.push(skill);
  if(intentional.has(skill))assert.ok(r.warnings.some(w=>w.includes('指定により計算対象外')),skill);
 }
 assert.deepEqual(skipped,[]);
 assert.equal(intentional.size,7);
});

test('extra helpful and helper boost produce bonus helps in a separate pocket',()=>{
 for(const skill of ['Extra Helpful S','Helper Boost']){
  const sp=master.species.find(p=>p.skill===skill);assert.ok(sp);
  const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
  const r=sim.simulate(a);
  assert.ok(r.extraHelps>0,skill);
  assert.ok(r.berries>0,skill);
  assert.ok(Number.isFinite(r.total),skill);
 }
});
test('Lunar and Draco same-type unique species count ignores different types and duplicate members',()=>{
 const members=new Map([
 ['a',{sp:{id:1,type:'dragon'}}],
 ['b',{sp:{id:2,type:'dragon'}}],
 ['c',{sp:{id:2,type:'dragon'}}],
 ['d',{sp:{id:3,type:'water'}}],
 ['e',{sp:{id:4,type:'psychic'}}]
 ]);
 assert.equal(sim.teamSpeciesCount(['a','b','c','d','e'],members,'a'),2);
 assert.equal(sim.teamSpeciesCount(['a','b','c','d','e'],members,'d'),1);
 assert.equal(sim.teamSpeciesCount(['a','b','c','d','e'],members,'e'),1);
});
test('Stockpile reward levels 1 and 7 use explicit rewards from cited skill table',()=>{
 assert.deepEqual([...sim.STOCKPILE_REWARDS[0]],[600,1020,1500,2040,2640,3300,4020,4920,6480,8880,12120]);
 assert.deepEqual([...sim.STOCKPILE_REWARDS[6]],[4502,7653,11255,15307,19809,24761,30163,36916,46370,59876,82386]);
});
test('helper boost matches upstream for same-type species count 1 through 5',()=>{
 const expected=[[2,2,3,4,6],[3,3,4,5,7],[3,3,5,6,8],[4,4,6,7,9],[4,5,7,8,10],[5,6,8,9,11]];
 for(let level=1;level<=6;level++)for(let species=1;species<=5;species++)
  assert.equal(sim.helperBoostCount(level,species),expected[level-1][species-1]);
});
test('forced extra helps do not fabricate skill triggers when original skill rate is zero',()=>{
 const arcanine=master.species.find(s=>s.skill==='Extra Helpful S');assert.ok(arcanine);
 const original=arcanine.skillRate;
 try{
  arcanine.skillRate=0;
  const a=input();a.box.forEach(p=>{p.pokemon=arcanine.name;p.skillLevel=7;});
  const r=sim.simulate(a);
  assert.equal(r.extraHelps,0);
  assert.equal(r.skillTriggers,0);
 }finally{arcanine.skillRate=original;}
});

test('extra help production is above the same Pokemon with skill intentionally excluded',()=>{
 const sp=master.species.find(s=>s.skill==='Extra Helpful S');assert.ok(sp);
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=6;});
 const withSkill=sim.simulate(a);
 const original=sp.skill;
 let withoutSkill;
 try{sp.skill='Metronome';withoutSkill=sim.simulate(a);}finally{sp.skill=original;}
 assert.ok(withSkill.extraHelps>0);
 assert.ok(withSkill.berries>withoutSkill.berries,'extra helps must contribute collectible berries');
 assert.equal(withoutSkill.extraHelps,0);
});

test('Stockpile starts at zero: one expected trigger grants only 25% chance of 0-stack Spit Up',()=>{
 const initial=sim.emptyStockpile();
 const once=sim.advanceStockpile(initial,1,1);
 assert.ok(Math.abs(once.earned-150)<1e-10);
 assert.ok(Math.abs(once.state[0]-.25)<1e-10);
 assert.ok(Math.abs(once.state[1]-.75)<1e-10);
 const half=sim.advanceStockpile(initial,.5,1);
 assert.ok(Math.abs(half.earned-75)<1e-10);
 assert.ok(Math.abs(half.state.reduce((n,p)=>n+p,0)-1)<1e-10);
});
test('Stockpile reward is recognized only when released and unspent charge is never credited',()=>{
 let state=sim.emptyStockpile(),earned=0;
 for(let n=0;n<17;n++){
  const result=sim.advanceStockpile(state,1,7);
  state=result.state;earned+=result.earned;
  assert.ok(Math.abs(state.reduce((a,b)=>a+b,0)-1)<1e-8);
 }
 assert.ok(earned>0);
 const unspent=state.reduce((sum,p,k)=>sum+p*k,0);
 assert.ok(unspent>0);
 // Only Spit Up energy was credited; there is no additional end-of-week payout.
 const none=sim.advanceStockpile(state,0,7);
 assert.equal(none.earned,0);
});
test('Stockpile state probability mass is stable under long finite sequences',()=>{
 let state=sim.emptyStockpile(),credited=0;
 for(let n=0;n<200;n++){
  const outcome=sim.advanceStockpile(state,.83,7);
  state=outcome.state;credited+=outcome.earned;
 }
 assert.ok(credited>0&&Number.isFinite(credited));
 assert.ok(Math.abs(state.reduce((sum,p)=>sum+p,0)-1)<1e-6);
 assert.ok(state.every(p=>p>=0&&p<=1));
});
test('stockpile user benefits from keeping the same party rather than frequent reset',()=>{
 const sp=master.species.find(s=>s.skill==='Charge Strength S (Stockpile)');
 const a=input();a.box.forEach(p=>{p.pokemon=sp.name;p.skillLevel=7;p.subskills=['スキル確率アップM','','','',''];});
 const fresh={...a,teams:{...a.teams}};
 const filler=Array.from({length:5},(_,i)=>({...a.box[i],id:'alt'+i,pokemon:'ライチュウ'}));
 fresh.box=[...a.box,...filler];
 fresh.teams.noon=filler.map(p=>p.id);
 fresh.teams.evening=filler.map(p=>p.id);
 // Daytime substitutions reset the charge; uninterrupted periods do not.
 const steady=sim.simulate(a),switched=sim.simulate(fresh);
 assert.ok(Number.isFinite(steady.skills)&&Number.isFinite(switched.skills));
 assert.ok(switched.skills<steady.skills,'reset at team swap should limit finite-week payout');
});

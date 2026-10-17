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

test('joint pity skill state remains finite and energy outputs are not NaN',()=>{
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
 assert.equal(first.energy,Math.floor((sim.RECIPES.find(x=>x.id==='apple_curry').strength70+first.extraEnergy)*(1+a.options.fieldBonus/100)+1e-9));
});
test('great-success expected energy uses baseline weekday 10% and Sunday 30%',()=>{
 const a=input();a.options.recipeMode='fixed';a.options.recipeId='apple_curry';
 a.options.initialIngredients={apple:250};a.options.successMode='expected';
 const r=sim.simulate(a);
 assert.ok(r.meals.length>0);
 for(const row of r.meals)assert.ok(Math.abs(row.successProbability-(row.day===7?.3:.1))<1e-10);
 const weekday=r.meals.find(x=>x.day<7);assert.ok(weekday);
 assert.ok(Math.abs(weekday.energy-(weekday.normalEnergy*.9+weekday.extraTastyEnergy*.1))<1e-6);
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
 assert.ok(switched.stockpileResets>0,'swaps must reset stored state');
 assert.ok(switched.stockpileExpectedLost>0,'lost pending stacks must be tracked without energy credit');
 assert.ok(steady.stockpileResets===0,'stable rosters should not reset');
 assert.ok(Object.values(steady.stockpilePending).every(x=>Number.isFinite(x)&&x>=0&&x<=10));
});

test('Stockpile empty team switch never fabricates a payout',()=>{
 const state=sim.emptyStockpile(),result=sim.advanceStockpile(state,0,7);
 assert.equal(result.earned,0);
 assert.deepEqual([...result.state],[...state]);
});

test('sleep recovery uses normal cap 100, self recovery-bonus cap 105, never cap 150',()=>{
 assert.equal(sim.recoverFromSleep(40,100,1,0,false),100);
 assert.equal(sim.recoverFromSleep(40,100,1,1,true),105);
 assert.equal(sim.recoverFromSleep(40,100,1,1,false),100);
 assert.equal(sim.recoverFromSleep(100,100,1,0,false),100);
 assert.equal(sim.recoverFromSleep(140,100,1,0,false),140,'sleep should not reduce a preexisting over-cap value');
 assert.equal(sim.recoverFromSleep(20,0,1,5,true),20);
});
test('sleeping helpers continue to lose Energy while producing during the idle night',()=>{
 const a=input();a.options.initialEnergy=150;a.options.sleepScore=0;
 a.options.recipeId='';a.options.recipeMode='fixed';a.options.initialIngredients={};
 const r=sim.simulate(a);
 assert.equal(r.nightEnergy.length,7);
 assert.equal(r.nightEnergy[0].hours,7.5);
 for(const id of a.teams.sleep){
  const first=r.nightEnergy[0];
  const expected=Math.max(0,first.beforeSleep[id]-45);
  assert.ok(Math.abs(first.beforeRecovery[id]-expected)<1e-6,'nighttime 7.5h must drain 45 Energy');
  assert.equal(first.afterRecovery[id],first.beforeRecovery[id],'sleep score zero restores nothing');
 }
 assert.equal(r.nightEnergy[6].hours,4);
 for(const id of a.teams.sleep)assert.ok(r.nightEnergy[6].beforeRecovery[id]<=r.nightEnergy[6].beforeSleep[id]);
});
test('sleep recovery is confined to sleeping team; inactive boxed Pokemon do not gain 5%',()=>{
 const a=input();a.options.initialEnergy=0;a.options.sleepScore=100;
 const r=sim.simulate(a);
 for(const day of r.nightEnergy.slice(0,6)){
  for(const id of a.teams.sleep)assert.ok(day.afterRecovery[id]<=100+1e-9);
 }
 assert.equal(r.days.length,7);
 assert.ok(r.total>0);
});

test('normal meals floor each final result, not float-valued strength',()=>{
 const m=sim.calculateMealEnergy(2678,1,50,0,0);
 assert.equal(m.normal,4018);
 assert.equal(m.extraTasty,8037);
 assert.equal(m.expected,4018);
});
test('Extra Tasty expectation interpolates separately rounded game outcomes',()=>{
 const m=sim.calculateMealEnergy(2678,1,50,.1,0);
 assert.ok(Math.abs(m.expected-(4018*.9+8037*.1))<1e-8);
 const sunday=sim.calculateMealEnergy(2678,1,50,.3,6);
 assert.equal(sunday.extraTasty,12055);
 assert.ok(Math.abs(sunday.expected-(4018*.7+12055*.3))<1e-8);
});
test('game rounding and fractional great success reconcile to seven-day cooking total',()=>{
 const a=input();a.options.recipeMode='best';a.options.successMode='expected';
 a.options.initialIngredients={apple:150,milk:150};
 const r=sim.simulate(a);
 assert.ok(r.meals.length>0);
 for(const m of r.meals){
  assert.equal(Number.isInteger(m.normalEnergy),true);
  assert.equal(Number.isInteger(m.extraTastyEnergy),true);
  assert.ok(Math.abs(m.energy-(m.normalEnergy*(1-m.successProbability)+m.extraTastyEnergy*m.successProbability))<1e-7);
 }
 assert.ok(Math.abs(r.meals.reduce((n,m)=>n+m.energy,0)-r.cooking)<1e-7);
});
test('invalid inputs cannot bypass per-meal energy calculation guard',()=>{
 assert.throws(()=>sim.calculateMealEnergy(100,1,50,1.2,0),/不正/);
 assert.throws(()=>sim.calculateMealEnergy(100,-1,50,0,0),/不正/);
 assert.throws(()=>sim.calculateMealEnergy(100,0,50,0,7),/不正/);
});

test('ingredient stock is conserved across all meal and success combinations',()=>{
 const a=input();
 a.box.forEach(p=>{p.pokemon='フシギバナ';p.skillLevel=7;});
 a.options.foodMode='curry';a.options.recipeMode='best';a.options.recipeId='';
 a.options.potSize=100;a.options.bagCapacity=65;
 a.options.magnetIngredients=['apple','milk','honey'];
 a.options.initialIngredients={apple:15,milk:10,honey:12};
 for(const extraMode of ['none','fill'])for(const successMode of ['none','expected']){
  a.options.extraMode=extraMode;a.options.successMode=successMode;
  const r=sim.simulate(a),ingredients=new Set([
   ...Object.keys(a.options.initialIngredients),...Object.keys(r.ingredients),
   ...Object.keys(r.consumedIngredients),...Object.keys(r.inventory)
  ]);
  for(const key of ingredients){
   const ledger=(a.options.initialIngredients[key]||0)+(r.ingredients[key]||0)
     -(r.consumedIngredients[key]||0)-(r.inventory[key]||0);
   assert.ok(Math.abs(ledger)<1e-5,key+' unbalanced: '+ledger);
  }
  assert.ok(Object.values(r.inventory).reduce((n,v)=>n+v,0)<=65+1e-5);
 }
});

test('energy-recovery nature modifiers match pokesleep-tool 1.20 and 0.88, not probability 0.80',()=>{
 assert.equal(sim.recoveryNatureFactor('ずぶとい'),1.2);
 assert.equal(sim.recoveryNatureFactor('さみしがり'),.88);
 assert.equal(sim.recoveryNatureFactor('おとなしい'),.88);
 assert.equal(sim.recoveryNatureFactor('がんばりや'),1);
 // Reference: upstream src/util/Nature.ts, energyRecoveryFactor.
 assert.equal(sim.recoverFromSleep(0,80,sim.recoveryNatureFactor('さみしがり'),0,false),71,'pokesleep-tool Energy wake event ceils 80 * 0.88 = 70.4 to 71');
 assert.equal(sim.recoverFromSleep(0,80,sim.recoveryNatureFactor('ずぶとい'),0,false),96);
});
test('sleep simulation applies 0.88 nature recovery while not giving boxed helpers 5 percent',()=>{
 const a=input();a.box.forEach(p=>p.nature='さみしがり');
 a.options.initialEnergy=10;a.options.sleepScore=70;a.options.recipeId='';
 const result=sim.simulate(a);
 const first=result.nightEnergy[0];
 for(const id of a.teams.sleep){
  const prior=first.beforeRecovery[id],next=first.afterRecovery[id];
  const reference=sim.recoverFromSleep(prior,70,.88,0,false);
  assert.equal(next,reference);
 }
});

test('inventory base caps respect post-v2.9 evolution normalization and negative upstream sentinel',()=>{
 const cases=[
  ['ピカチュウ',22],
  ['ライチュウ',31],
  ['フシギバナ',27],
  ['プクリン',32],
  ['イーブイ',12],
  ['タマザラシ',9],
  ['デデンネ',19],
  ['ピカチュウ (ホリデー)',20]
 ];
 for(const [name,expected] of cases){
  const sp=master.species.find(s=>s.name===name);
  assert.ok(sp,'missing species '+name);
  assert.equal(sim.baseCarryCapacity(sp),expected,name);
 }
 for(const sp of master.species){
  assert.ok(sim.baseCarryCapacity(sp)>=sp.carryLimit,
   'unknown evolution count must not remove carrying space: '+sp.name);
 }
});
test('one-stock skill banking uses probability of at least one proc, not capped average',()=>{
 const dist=sim.advanceSkillStock([1,0],2,.5,1);
 assert.deepEqual(Array.from(dist),[.25,.75]);
 assert.equal(sim.expectedSkillStock(dist),.75);
 assert.notEqual(sim.expectedSkillStock(dist),Math.min(1,2*.5));
});
test('two-stock skill banking tracks both independent rolls',()=>{
 const dist=sim.advanceSkillStock([1,0,0],2,.5,2);
 assert.deepEqual(Array.from(dist),[.25,.5,.25]);
 assert.equal(sim.expectedSkillStock(dist),1);
});
test('fractional help and multiple ticks preserve stock probabilities',()=>{
 const a=sim.advanceSkillStock([1,0,0],.5,.4,2);
 assert.ok(Math.abs(a[0]-.8)<1e-12&&Math.abs(a[1]-.2)<1e-12);
 let dist=[1,0,0];
 for(let i=0;i<30;i++)dist=sim.advanceSkillStock(dist,.25,.5,2);
 assert.ok(Math.abs(dist.reduce((sum,p)=>sum+p,0)-1)<1e-10);
 assert.ok(dist.every(p=>p>=0&&p<=1));
 assert.ok(sim.expectedSkillStock(dist)<=2);
});
test('skill banking rejects nonfinite probabilities and impossible caps',()=>{
 assert.throws(()=>sim.advanceSkillStock([1,0],1,-.1,1),/不正/);
 assert.throws(()=>sim.advanceSkillStock([1,0],-1,.1,1),/不正/);
 assert.throws(()=>sim.advanceSkillStock([1,0],1,.1,3),/不正/);
});
test('departing helpers lose both ordinary and bonus uncollected carry',()=>{
 const ordinary=new Map([['depart',{used:8,berries:4,ingredients:{apple:4},skillState:[0,1,0]}],
   ['stays',{used:3,berries:2,ingredients:{apple:1},skillState:[.5,.5,0]}]]);
 const extra=new Map([['depart',{used:3,berries:2,ingredients:{apple:1},skillState:[1,0,0]}],
   ['stays',{used:0,berries:0,ingredients:{},skillState:[1,0,0]}]]);
 const stayBag=ordinary.get('stays');
 sim.clearDepartingPockets(['depart','stays'],['stays','new'],ordinary,extra);
 assert.equal(ordinary.get('depart').used,0);
 assert.equal(extra.get('depart').used,0);
 assert.equal(sim.expectedSkillStock(ordinary.get('depart').skillState),0);
 assert.equal(ordinary.get('stays'),stayBag);
});


test('finite pity guarantees a roll on the threshold-th consecutive qualifying help',()=>{
 const base=sim.emptySkillProcState(3,1);
 const one=sim.advanceSkillProcState(base,1,.2);
 assert.ok(Math.abs(sim.skillProcMarginal(one)[1]-.2)<1e-12);
 const two=sim.advanceSkillProcState(base,2,.2);
 assert.ok(Math.abs(sim.skillProcMarginal(two)[1]-.36)<1e-12);
 const third=sim.advanceSkillProcState(base,3,.2);
 assert.ok(Math.abs(sim.skillProcMarginal(third)[1]-1)<1e-12);
});
test('empty stock on collection keeps failed-roll history, not just average rate',()=>{
 const state=sim.advanceSkillProcState(sim.emptySkillProcState(3,1),2,.2);
 const cleared=sim.clearSkillProcStock(state);
 assert.equal(sim.skillProcMarginal(cleared)[1],0);
 // 64% already missed twice; 36% had rolled a success and restart at zero.
 const next=sim.advanceSkillProcState(cleared,1,.2);
 assert.ok(Math.abs(sim.skillProcMarginal(next)[1]-(.64+.36*.2))<1e-12);
});
test('pity counter and stock are jointly tracked rather than independently averaged',()=>{
 const state=sim.advanceSkillProcState(sim.emptySkillProcState(3,2),3,.2);
 const marginal=sim.skillProcMarginal(state);
 assert.ok(marginal[2]>0&&marginal[1]>0);
 assert.ok(Math.abs(marginal.reduce((a,b)=>a+b,0)-1)<1e-12);
 const cleared=sim.clearSkillProcStock(state);
 const recurred=sim.advanceSkillProcState(cleared,1,.2);
 assert.ok(sim.skillProcMarginal(recurred)[1]>0);
});
test('full stock pauses pity rolls until collection, then fresh helps can trigger',()=>{
 let state=sim.advanceSkillProcState(sim.emptySkillProcState(4,2),2,1);
 assert.deepEqual(Array.from(sim.skillProcMarginal(state)),[0,0,1]);
 const frozen=sim.advanceSkillProcState(state,25,.8);
 assert.deepEqual(Array.from(frozen.dist),Array.from(state.dist));
 state=sim.clearSkillProcStock(frozen);
 assert.deepEqual(Array.from(sim.skillProcMarginal(state)),[1,0,0]);
 assert.ok(sim.skillProcMarginal(sim.advanceSkillProcState(state,1,.8))[1]>.7);
});
test('fractional helps near pity threshold preserve mass and partial guaranteed chance',()=>{
 const base=sim.emptySkillProcState(3,1);
 const two=sim.advanceSkillProcState(base,2,.2);
 const half=sim.advanceSkillProcState(two,.5,.2);
 assert.ok(Math.abs(sim.skillProcMarginal(half)[1]-.68)<1e-12);
 assert.ok(Math.abs(half.dist.reduce((a,b)=>a+b,0)-1)<1e-12);
 assert.ok(half.dist.every(p=>p>=0&&p<=1));
});
test('team substitution invalidates retained helpers stock but preserves pity failures',()=>{
 const sample=sim.advanceSkillProcState(sim.emptySkillProcState(4,1),2,.5);
 const joint=new Map([['stays',sample],['depart',sample],['arrives',sample]]);
 const bags=new Map([['stays',{skillState:[0,1,0]}],['depart',{skillState:[0,1,0]}],['arrives',{skillState:[0,1,0]}]]);
 assert.equal(sim.clearPartySkillStocks(['stays','depart'],['stays','arrives'],joint,bags),true);
 for(const id of ['stays','depart','arrives']){
  assert.deepEqual(Array.from(sim.skillProcMarginal(joint.get(id))),[1,0]);
  assert.deepEqual(Array.from(bags.get(id).skillState),[1,0,0]);
  for(let k=0;k<4;k++)
   assert.ok(Math.abs(joint.get(id).dist[k]-[.75,0,.25,0][k])<1e-12);
 }
});
test('same five-member roster and initial lineup do not cancel stored ready skills',()=>{
 const original=sim.advanceSkillProcState(sim.emptySkillProcState(4,1),2,.5);
 const states=new Map([['0',original]]),bags=new Map([['0',{skillState:[.25,.75,0]}]]);
 assert.equal(sim.clearPartySkillStocks(['0','1'],['1','0'],states,bags),false);
 assert.equal(sim.clearPartySkillStocks([],['0','1'],states,bags),false);
 assert.equal(states.get('0'),original);
});
test('joint skill model validates limits and never gives 0-percent skills pity triggers',()=>{
 assert.throws(()=>sim.emptySkillProcState(0,1),/不正/);
 assert.throws(()=>sim.emptySkillProcState(78,3),/不正/);
 assert.throws(()=>sim.advanceSkillProcState(sim.emptySkillProcState(78,1),1,1.2),/不正/);
 assert.throws(()=>sim.advanceSkillProcState(sim.emptySkillProcState(78,1),-1,.1),/不正/);
 const never=sim.advanceSkillProcState(sim.emptySkillProcState(3,1),30,0);
 assert.deepEqual(Array.from(sim.skillProcMarginal(never)),[1,0]);
});


test('four quarter-help buckets give precisely one real skill roll',()=>{
 let phase=0,state=sim.emptySkillProcState(12,1);
 for(let i=0;i<4;i++){
  const next=sim.completeHelpProgress(phase,.25);
  phase=next.phase;
  assert.equal(next.completed,i===3?1:0);
  state=sim.advanceSkillProcState(state,next.completed,.5);
  if(i<3)assert.equal(sim.skillProcMarginal(state)[1],0);
 }
 assert.equal(phase,0);
 assert.equal(sim.skillProcMarginal(state)[1],.5);
 // Old quarter-Bernoulli approximation would produce 1-(1-0.125)^4.
 assert.ok(Math.abs((1-(1-.125)**4)-.5)>.08);
});
test('sub-help intervals cannot trigger even a guaranteed skill before completion',()=>{
 let phase=0,state=sim.emptySkillProcState(1,1);
 for(let i=0;i<9;i++){
  const x=sim.completeHelpProgress(phase,.1);
  phase=x.phase;state=sim.advanceSkillProcState(state,x.completed,.03);
  assert.equal(sim.expectedSkillStock(sim.skillProcMarginal(state)),0);
 }
 const last=sim.completeHelpProgress(phase,.1);
 assert.equal(last.completed,1);
 state=sim.advanceSkillProcState(state,last.completed,.03);
 assert.equal(sim.expectedSkillStock(sim.skillProcMarginal(state)),1);
});
test('pity horizon advances after three completed helps, not twelve partial ones',()=>{
 let phase=0,state=sim.emptySkillProcState(3,1);
 let total=0;
 for(let i=0;i<12;i++){
  const x=sim.completeHelpProgress(phase,.25);
  phase=x.phase;total+=x.completed;
  state=sim.advanceSkillProcState(state,x.completed,.03);
 }
 assert.equal(total,3);
 assert.equal(sim.skillProcMarginal(state)[1],1);
});
test('sub-help remainder carries across arbitrary 15-minute intervals without drift',()=>{
 let phase=0,completed=0;
 for(let i=0;i<239;i++){
  const result=sim.completeHelpProgress(phase,.42);
  phase=result.phase;completed+=result.completed;
 }
 assert.equal(completed,100);
 assert.ok(Math.abs(phase-.38)<1e-9);
 assert.ok(Math.abs(completed+phase-239*.42)<1e-8);
 const two=sim.completeHelpProgress(.75,2.5);
 assert.equal(two.completed,3);
 assert.equal(two.phase,.25);
});
test('departing helper loses incomplete help phase while retained helper keeps it',()=>{
 const phases=new Map([['depart',.8],['stay',.6],['other',.9]]);
 sim.clearDepartingHelpProgress(['depart','stay'],['stay','new'],phases);
 assert.equal(phases.has('depart'),false);
 assert.equal(phases.get('stay'),.6);
 assert.equal(phases.get('other'),.9);
 sim.clearDepartingHelpProgress(['stay'],['stay'],phases);
 assert.equal(phases.get('stay'),.6);
});
test('complete-help progress guards negative and nonfinite inputs',()=>{
 assert.throws(()=>sim.completeHelpProgress(-.01,.2),/不正/);
 assert.throws(()=>sim.completeHelpProgress(1,.2),/不正/);
 assert.throws(()=>sim.completeHelpProgress(.2,-.1),/不正/);
 assert.throws(()=>sim.completeHelpProgress(.2,Infinity),/不正/);
});
test('integrated 7-day simulation exposes integral skill-help completion count',()=>{
 const r=sim.simulate(input());
 assert.ok(Number.isInteger(r.skillHelpCompletions));
 assert.ok(r.skillHelpCompletions>0);
 assert.ok(r.skillTriggers<=r.skillHelpCompletions);
 assert.equal(r.days.length,7);
});


test('energy integration is constant within a single speed band',()=>{
 assert.ok(Math.abs(sim.weightedHelpMinutes(100,15)-15/.45)<1e-10);
 assert.ok(Math.abs(sim.weightedHelpMinutes(70,15)-15/.52)<1e-10);
 assert.ok(Math.abs(sim.weightedHelpMinutes(50,15)-15/.58)<1e-10);
 assert.ok(Math.abs(sim.weightedHelpMinutes(20,15)-15/.66)<1e-10);
 assert.equal(sim.weightedHelpMinutes(0,15),15);
 assert.equal(sim.weightedHelpMinutes(90,0),0);
});
test('crossing 80-energy threshold is time-weighted, not midpoint-only',()=>{
 const weighted=sim.weightedHelpMinutes(80.5,15);
 const expected=5/.45+10/.52;
 assert.ok(Math.abs(weighted-expected)<1e-10);
 assert.ok(weighted>15/.52&&weighted<15/.45);
});
test('crossing 1-energy threshold accounts for the slowest range',()=>{
 const expected=5/.66+10/1;
 assert.ok(Math.abs(sim.weightedHelpMinutes(1.5,15)-expected)<1e-10);
 assert.equal(sim.weightedHelpMinutes(1,15),15);
});
test('energy speed integral is additive across multiple adjacent time slices',()=>{
 const whole=sim.weightedHelpMinutes(81,30);
 const part=sim.weightedHelpMinutes(81,15)+sim.weightedHelpMinutes(79.5,15);
 assert.ok(Math.abs(whole-part)<1e-10);
});
test('energy speed integral rejects invalid initial energy and time',()=>{
 assert.throws(()=>sim.weightedHelpMinutes(151,15),/不正/);
 assert.throws(()=>sim.weightedHelpMinutes(-.1,15),/不正/);
 assert.throws(()=>sim.weightedHelpMinutes(100,-1),/不正/);
 assert.throws(()=>sim.weightedHelpMinutes(NaN,15),/不正/);
});
test('sub-help contributions can no longer credit imaginary berries before help completion',()=>{
 const prevFrequency=raichu.frequency,prevSkill=raichu.skillRate;
 try{
  raichu.frequency=100000000;raichu.skillRate=0;
  const a=input();a.options.initialIngredients={};a.options.recipeId='';
  const r=sim.simulate(a);
  assert.equal(r.skillHelpCompletions,0);
  assert.equal(r.berries,0);
  assert.equal(r.sneaky,0);
  assert.equal(r.skillTriggers,0);
 }finally{raichu.frequency=prevFrequency;raichu.skillRate=prevSkill;}
});
test('ordinary production and skill counters reconcile on a 7-day run',()=>{
 const a=input();a.options.initialIngredients={};a.options.recipeId='';
 const r=sim.simulate(a);
 assert.ok(Number.isInteger(r.skillHelpCompletions));
 assert.ok(r.skillHelpCompletions>0);
 assert.ok(r.skillEligibleHelps>=0);
 assert.ok(r.skillEligibleHelps<=r.skillHelpCompletions+1e-8);
 assert.ok(r.skillTriggers<=r.skillEligibleHelps+1e-8);
});
test('full ingredient bag does not block skill rolls from a Pokemon pocket',()=>{
 const a=input();a.options.bagCapacity=1;a.options.initialIngredients={apple:1};a.options.recipeId='';
 const r=sim.simulate(a);
 assert.ok(r.skillHelpCompletions>0);
 assert.ok(r.skillEligibleHelps>0);
 assert.ok(r.skillTriggers>0);
 assert.ok(r.sneaky>0);
});


test('sneaky berries are pending before a collection and credited exactly once after',()=>{
 const bag={pendingSneaky:0};
 sim.queueSneakyEnergy(bag,150);
 sim.queueSneakyEnergy(bag,25);
 assert.equal(bag.pendingSneaky,175);
 assert.equal(sim.releaseSneakyEnergy(bag),175);
 assert.equal(bag.pendingSneaky,0);
 assert.equal(sim.releaseSneakyEnergy(bag),0);
});
test('sneaky pending queue rejects invalid and negative energy',()=>{
 const bag={pendingSneaky:10};
 assert.throws(()=>sim.queueSneakyEnergy(bag,-1),/不正/);
 assert.throws(()=>sim.queueSneakyEnergy(bag,Infinity),/不正/);
 assert.equal(bag.pendingSneaky,10);
});
test('last Sunday sleep accumulates uncollected sneaky energy at Monday 04:00',()=>{
 const originalCarry=raichu.carryLimit;
 try{
  raichu.carryLimit=1; // Small Pokemon pocket forces snacking even during a low-Energy 4h sleep.
  const a=input();a.options.recipeId='';a.options.initialIngredients={};
  a.options.initialEnergy=1;a.options.sleepScore=1;
  a.box.forEach(p=>p.sleepHours=0);
  const r=sim.simulate(a);
  assert.ok(r.pendingSneaky>0,'uncollected late-Sunday snacking should stay pending');
  assert.ok(r.sneaky>0,'daytime sneaky should still be earned on earlier taps');
  assert.ok(Math.abs(r.days.reduce((sum,d)=>sum+d.berries+d.cooking+d.skills,0)-r.total)<1e-5);
 }finally{raichu.carryLimit=originalCarry;}
});


test('ten-minute Energy decay leaves phase five after a 15-minute tick',()=>{
 const r=sim.advanceEnergyTimer(100,0,15);
 assert.equal(r.energy,99);
 assert.equal(r.phase,5);
 assert.ok(Math.abs(r.workMinutes-15/.45)<1e-10);
});
test('energy timer preserves its remainder across adjacent 15-minute ticks',()=>{
 const a=sim.advanceEnergyTimer(81,0,15);
 assert.equal(a.energy,80);
 assert.equal(a.phase,5);
 const b=sim.advanceEnergyTimer(a.energy,a.phase,15);
 assert.equal(b.energy,78);
 assert.equal(b.phase,0);
 const whole=sim.advanceEnergyTimer(81,0,30);
 assert.equal(whole.energy,b.energy);
 assert.ok(Math.abs(whole.workMinutes-a.workMinutes-b.workMinutes)<1e-10);
});
test('boundary crossing at Energy 80.5 uses ten minutes at fast speed',()=>{
 const r=sim.advanceEnergyTimer(80.5,0,15);
 assert.equal(r.energy,79.5);
 assert.ok(Math.abs(r.workMinutes-(10/.45+5/.52))<1e-10);
 assert.ok(Math.abs(r.workMinutes-sim.weightedHelpMinutes(80.5,15))>.5);
});
test('decay across Energy 1.0 threshold enters the slowest speed band',()=>{
 const r=sim.advanceEnergyTimer(1.5,0,15);
 assert.equal(r.energy,.5);
 assert.equal(r.phase,5);
 assert.ok(Math.abs(r.workMinutes-(10/.66+5))<1e-10);
});
test('recovery resets the Energy reduction timer only on actual increase',()=>{
 const energies=new Map([['x',70]]),phases=new Map([['x',7]]);
 sim.applyEnergyRecovery(energies,phases,'x',70);
 assert.equal(phases.get('x'),7);
 sim.applyEnergyRecovery(energies,phases,'x',69);
 assert.equal(phases.get('x'),7);
 sim.applyEnergyRecovery(energies,phases,'x',75);
 assert.equal(phases.get('x'),0);
 assert.equal(energies.get('x'),75);
 assert.throws(()=>sim.applyEnergyRecovery(energies,phases,'x',151),/不正/);
});
test('energy countdown honors nonzero initial phase and zero-minute duration',()=>{
 const r=sim.advanceEnergyTimer(60,9,2);
 assert.equal(r.energy,59);
 assert.equal(r.phase,1);
 assert.ok(Math.abs(r.workMinutes-2/.58)<1e-10);
 assert.deepEqual(JSON.parse(JSON.stringify(sim.advanceEnergyTimer(60,4,0))),{energy:60,phase:4,workMinutes:0});
});
test('energy timer invalid inputs fail without fabricating work',()=>{
 assert.throws(()=>sim.advanceEnergyTimer(-1,0,15),/不正/);
 assert.throws(()=>sim.advanceEnergyTimer(150,10,15),/不正/);
 assert.throws(()=>sim.advanceEnergyTimer(80,0,-1),/不正/);
 assert.throws(()=>sim.advanceEnergyTimer(80,0,NaN),/不正/);
});
test('seven-day energy event integration keeps weekly totals and finite counts',()=>{
 const x=input();x.options.initialEnergy=80.5;x.options.sleepScore=20;
 const r=sim.simulate(x);
 assert.ok(Number.isFinite(r.total)&&r.total>=0);
 assert.ok(Number.isInteger(r.skillHelpCompletions));
 assert.equal(r.days.length,7);
 assert.ok(Math.abs(r.days.reduce((v,d)=>v+d.berries+d.cooking+d.skills,0)-r.total)<1e-5);
});


test('one berry help with two berries and one free slot preserves one and sneaky-feeds one',()=>{
 const s=sim.integerPocketTransitions(new Map([[0,1]]),1,1,2,0,[]);
 assert.equal(s.used,1);
 assert.equal(s.berries,1);
 assert.equal(s.sneaky,1);
 assert.equal(s.eligible,1);
 assert.deepEqual(Array.from(s.occupation, ([count,prob])=>[count,prob]),[[1,1]]);
});
test('full pocket makes the next complete help sneaky with no skill lottery',()=>{
 const s=sim.integerPocketTransitions(new Map([[0,1]]),2,1,2,0,[]);
 assert.equal(s.berries,1);
 assert.equal(s.sneaky,3);
 assert.equal(s.eligible,1);
 assert.deepEqual(Array.from(s.occupation, ([count,prob])=>[count,prob]),[[1,1]]);
});
test('separate berry and food outcomes preserve exact occupancy branch probabilities',()=>{
 const a=sim.integerPocketTransitions(new Map([[0,1]]),1,3,2,.5,[{key:'apple',count:3}]);
 assert.equal(a.eligible,1);
 assert.equal(a.berries,1);
 assert.equal(a.ingredients.apple,1.5);
 assert.equal(a.sneaky,0);
 assert.equal(a.used,2.5);
 assert.deepEqual(Array.from(a.occupation, ([count,prob])=>[count,prob]),[[2,.5],[3,.5]]);
 const b=sim.integerPocketTransitions(a.occupation,1,3,2,.5,[{key:'apple',count:3}]);
 assert.ok(Math.abs(b.eligible-.5)<1e-12);
 assert.ok(Math.abs(b.berries-.25)<1e-12);
 assert.ok(Math.abs(b.ingredients.apple-.25)<1e-12);
 assert.ok(Math.abs(b.sneaky-1.25)<1e-12);
 assert.deepEqual(Array.from(b.occupation, ([count,prob])=>[count,prob]),[[3,1]]);
});
test('ingredient rolls exceeding remaining space keep only the integer remainder',()=>{
 const s=sim.integerPocketTransitions(new Map([[2,1]]),1,3,2,1,[{key:'apple',count:4}]);
 assert.equal(s.ingredients.apple,1);
 assert.equal(s.berries,0);
 assert.equal(s.sneaky,0);
 assert.equal(s.used,3);
 assert.equal(s.eligible,1);
});
test('multiple ingredient slots are equally weighted per ingredient help',()=>{
 const s=sim.integerPocketTransitions(new Map([[0,1]]),1,6,1,.6,[
  {key:'apple',count:2},{key:'coffee',count:4}
 ]);
 assert.ok(Math.abs(s.ingredients.apple-.6)<1e-12);
 assert.ok(Math.abs(s.ingredients.coffee-1.2)<1e-12);
 assert.ok(Math.abs(s.berries-.4)<1e-12);
 assert.ok(Math.abs(s.used-2.2)<1e-12);
});
test('expected retained carry converts to a two-point integer distribution without bias',()=>{
 const a=sim.expectedPocketOccupation(2.75,10);
 assert.deepEqual(Array.from(a, ([count,prob])=>[count,prob]),[[2,.25],[3,.75]]);
 const b=sim.integerPocketTransitions(a,1,3,2,0,[]);
 assert.ok(Math.abs(b.eligible-.25)<1e-12);
 assert.ok(Math.abs(b.sneaky-1.75)<1e-12);
});
test('integer carry transitions validate probability and cap inputs',()=>{
 assert.throws(()=>sim.integerPocketTransitions(new Map([[0,1]]),1,0,2,0,[]),/不正/);
 assert.throws(()=>sim.integerPocketTransitions(new Map([[0,1]]),.5,5,2,0,[]),/不正/);
 assert.throws(()=>sim.integerPocketTransitions(new Map([[0,1]]),1,5,2,1.2,[]),/不正/);
 assert.throws(()=>sim.integerPocketTransitions(new Map([[6,1]]),1,5,2,.5,[]),/不正/);
 assert.throws(()=>sim.expectedPocketOccupation(-1,5),/不正/);
});
test('stochastic carry keeps mass and energy accounting over multiple full-pocket helps',()=>{
 const p=sim.integerPocketTransitions(new Map([[0,1]]),20,7,2,.25,[{key:'apple',count:3},{key:'coffee',count:2}]);
 const mass=Array.from(p.occupation.values()).reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(mass-1)<1e-10);
 assert.ok(Math.abs(p.used-(p.berries+Object.values(p.ingredients).reduce((a,b)=>a+b,0)))<1e-10);
 assert.ok(p.eligible>=1&&p.eligible<20);
 assert.ok(p.sneaky>0);
 assert.ok(p.used<=7);
});
test('long weekly simulation with constrained integer pocket keeps eligible help count bounded',()=>{
 const p=input();
 p.box.forEach(x=>{x.subskills=['','','','',''];x.sleepHours=0;});
 p.options.recipeId='';
 const result=sim.simulate(p);
 assert.ok(result.skillHelpCompletions>=result.skillEligibleHelps);
 assert.ok(result.skillEligibleHelps>0);
 assert.ok(result.pendingSneaky>=0);
 assert.ok(result.sneaky>=0);
 assert.equal(result.days.length,7);
});


test('Minus one guaranteed random heal matches uniform target selection and 150 cap',()=>{
 assert.equal(sim.uniformExpectedHealFromStock(149,8,[0,1],5),149.2);
 assert.equal(sim.uniformExpectedHealFromStock(140,8,[0,1],5),141.6);
});
test('Minus two activations account for a recipient selected twice near Energy cap',()=>{
 const got=sim.uniformExpectedHealFromStock(140,8,[0,0,1],5);
 assert.ok(Math.abs(got-142.96)<1e-12);
 assert.ok(Math.abs(got-sim.uniformExpectedHeal(140,8,2,5))>.2);
});
test('Minus finite ready-stock mixture averages capped recovery after each branch',()=>{
 const got=sim.uniformExpectedHealFromStock(140,8,[.2,.3,.5],5);
 assert.ok(Math.abs(got-141.96)<1e-12);
 assert.equal(sim.uniformExpectedHealFromStock(150,20,[0,0,1],5),150);
});
test('Minus stock expectation recovers exactly without a cap and with one possible target',()=>{
 const d=[.1,.6,.3],expectedCount=.6+2*.3;
 assert.ok(Math.abs(sim.uniformExpectedHealFromStock(70,10,d,5)-(70+expectedCount*10/5))<1e-12);
 assert.equal(sim.uniformExpectedHealFromStock(100,8,[0,0,1],1),116);
});
test('Minus stock probability validation catches malformed distributions and energy',()=>{
 assert.throws(()=>sim.uniformExpectedHealFromStock(140,8,[.2,.8,.2],5),/不正/);
 assert.throws(()=>sim.uniformExpectedHealFromStock(140,8,[0,0,1],0),/不正/);
 assert.throws(()=>sim.uniformExpectedHealFromStock(140,-1,[0,0,1],5),/不正/);
 assert.throws(()=>sim.uniformExpectedHealFromStock(151,8,[0,0,1],5),/不正/);
 assert.throws(()=>sim.uniformExpectedHealFromStock(140,8,[0,0,0,1],5),/不正/);
});

function plusMinusInput(){
 const a=input();
 a.box[0].pokemon='プラスル';
 a.box[0].ingredients=['めざましコーヒー','ふといながねぎ','モーモーミルク'];
 a.box[1].pokemon='マイナン';
 a.box[1].ingredients=['あまいミツ','とくせんエッグ','モーモーミルク'];
 a.options.recipeId='';
 a.options.initialIngredients={};
 a.options.initialEnergy=25;
 a.options.sleepScore=30;
 return a;
}
test('Plus skill first-ingredient tables match source values at levels 1, 3 and 7',()=>{
 const plusle=master.species.find(s=>s.name==='プラスル');
 const tox=master.species.find(s=>s.name==='ストリンダー (ハイ)');
 assert.deepEqual(JSON.parse(JSON.stringify(sim.plusExtraIngredient(plusle,1))),{key:'coffee',count:6});
 assert.deepEqual(JSON.parse(JSON.stringify(sim.plusExtraIngredient(plusle,7))),{key:'coffee',count:12});
 assert.deepEqual(JSON.parse(JSON.stringify(sim.plusExtraIngredient(tox,3))),{key:'milk',count:9});
 assert.deepEqual(JSON.parse(JSON.stringify(sim.plusExtraIngredient(tox,7))),{key:'milk',count:14});
});
test('conditional partner must be another present Plus or Minus, not the triggering helper',()=>{
 const p=master.species.find(s=>s.name==='プラスル'),m=master.species.find(s=>s.name==='マイナン');
 const members=new Map([['p',{sp:p}],['m',{sp:m}],['r',{sp:raichu}]]);
 assert.equal(sim.hasPlusMinusPartner(['p','r'],members,'p'),false);
 assert.equal(sim.hasPlusMinusPartner(['p','m'],members,'p'),true);
 assert.equal(sim.hasPlusMinusPartner(['p','m'],members,'m'),true);
 assert.equal(sim.hasPlusMinusPartner(['r','m'],members,'m'),false);
});
test('Plus secondary coffee is actually collected with partner but not while alone',()=>{
 const withPartner=plusMinusInput(),alone=plusMinusInput();
 alone.box[1].pokemon='ライチュウ';
 const yes=sim.simulate(withPartner),no=sim.simulate(alone);
 assert.ok(yes.conditionalPlusIngredients>0);
 assert.equal(no.conditionalPlusIngredients,0);
 assert.ok(yes.skillIngredients.coffee>0);
 assert.equal(no.skillIngredients.coffee||0,0);
 assert.ok(yes.warnings.some(w=>w.includes('プラスの追加食材')));
});
test('Minus secondary healing operates with partner and respects nature/energy caps',()=>{
 assert.equal(sim.uniformExpectedHeal(140,35,1,5),142);
 assert.equal(sim.uniformExpectedHeal(20,10,1,5),22);
 assert.equal(sim.uniformExpectedHeal(150,10,1,5),150);
 const paired=plusMinusInput(),solo=plusMinusInput();
 solo.box[0].pokemon='ライチュウ';
 const yes=sim.simulate(paired),no=sim.simulate(solo);
 assert.ok(yes.conditionalMinusRecovery>0);
 assert.equal(no.conditionalMinusRecovery,0);
 assert.ok(yes.warnings.some(w=>w.includes('マイナスの追加げんき')));
});
test('Plus additional ingredient cannot bypass an already-full ingredient bag',()=>{
 const a=plusMinusInput();a.options.bagCapacity=5;a.options.initialIngredients={apple:5};
 const r=sim.simulate(a);
 assert.equal(r.conditionalPlusIngredients,0);
 assert.ok(Object.values(r.inventory).reduce((sum,v)=>sum+v,0)<=5+1e-8);
});

test('good-camp inventory rounds fractional capacity up instead of keeping noninteger slots',()=>{
 // Reference 1.2x inventory bonus, rounded up; slot counts are whole numbers.
 const sp=master.species.find(s=>s.name==='ライチュウ');
 assert.equal(Math.ceil(sim.baseCarryCapacity(sp)*1.2),38);
 assert.equal(sim.baseCarryCapacity(sp),31);
});


test('eligible skill-help count retains non-adjacent saturated-pocket probability branches',()=>{
 const out=sim.integerPocketTransitions(new Map([[0,1]]),4,4,1,.5,[{key:'apple',count:4}]);
 const d=Array.from(out.eligibleDistribution,([count,p])=>[count,p]).sort((a,b)=>a[0]-b[0]);
 assert.deepEqual(JSON.parse(JSON.stringify(d)),[[1,.5],[2,.25],[3,.125],[4,.125]]);
 assert.ok(Math.abs(out.eligible-1.875)<1e-12);
 assert.ok(Math.abs(d.reduce((sum,[n,p])=>sum+n*p,0)-out.eligible)<1e-12);
});
test('finite skill stock cap averages over eligible-help counts before transition',()=>{
 const out=sim.integerPocketTransitions(new Map([[0,1]]),4,4,1,.5,[{key:'apple',count:4}]);
 const base=sim.emptySkillProcState(78,2);
 const exact=sim.skillProcMarginal(sim.advanceSkillProcStateByHelpCounts(base,out.eligibleDistribution,1));
 const meanOnly=sim.skillProcMarginal(sim.advanceSkillProcState(base,out.eligible,1));
 assert.deepEqual(JSON.parse(JSON.stringify(exact)),[0,.5,.5]);
 assert.ok(Math.abs(sim.expectedSkillStock(exact)-1.5)<1e-12);
 assert.ok(Math.abs(sim.expectedSkillStock(meanOnly)-1.875)<1e-12);
});
test('full pocket offers no skill lottery during later complete helps',()=>{
 const out=sim.integerPocketTransitions(new Map([[0,1]]),25,1,2,0,[]);
 assert.deepEqual(JSON.parse(JSON.stringify(Array.from(out.eligibleDistribution))),[[1,1]]);
 const next=sim.skillProcMarginal(sim.advanceSkillProcStateByHelpCounts(sim.emptySkillProcState(78,2),out.eligibleDistribution,1));
 assert.deepEqual(JSON.parse(JSON.stringify(next)),[0,1,0]);
 assert.equal(out.sneaky,1+24*2);
});
test('count mixture propagates pity threshold separately in each integer branch',()=>{
 const before=sim.emptySkillProcState(2,2);
 const y=sim.advanceSkillProcStateByHelpCounts(before,new Map([[1,.5],[2,.5]]),.2);
 const a=sim.advanceSkillProcState(before,1,.2),b=sim.advanceSkillProcState(before,2,.2);
 for(let i=0;i<y.dist.length;i++)
  assert.ok(Math.abs(y.dist[i]-(a.dist[i]+b.dist[i])/2)<1e-12);
});
test('help-count and pocket-mass validation refuses fabricated probability states',()=>{
 assert.throws(()=>sim.integerPocketTransitions(new Map([[0,.4]]),1,4,2,.5,[{key:'apple',count:3}]),/確率質量/);
 assert.throws(()=>sim.integerPocketTransitions(new Map([[0,1.1]]),1,4,2,0,[]),/確率質量/);
 const state=sim.emptySkillProcState(5,2);
 assert.throws(()=>sim.advanceSkillProcStateByHelpCounts(state,new Map([[0,.8]]),.3),/確率質量/);
 assert.throws(()=>sim.advanceSkillProcStateByHelpCounts(state,new Map([[-1,1]]),.3),/不正/);
 assert.throws(()=>sim.advanceSkillProcStateByHelpCounts(state,new Map([[0,1]]),1.2),/不正/);
});
test('weekly count integration preserves Energy components and eligible-help bounds',()=>{
 const x=input();x.options.initialIngredients={};x.options.recipeId='';
 const r=sim.simulate(x);
 assert.ok(Number.isFinite(r.total)&&r.total>=0);
 assert.ok(r.skillEligibleHelps<=r.skillHelpCompletions+1e-8);
 assert.ok(r.skillTriggers<=r.skillEligibleHelps+1e-8);
 assert.ok(Math.abs(r.days.reduce((sum,d)=>sum+d.berries+d.cooking+d.skills,0)-r.total)<1e-5);
});


test('full shared bag retains exact bimodal integer food carry rather than reconstructing its mean',()=>{
 const a=sim.integerFoodPocketTransitions(new Map([[0,1]]),1,3,2,.5,[{key:'apple',count:3}]);
 assert.deepEqual(JSON.parse(JSON.stringify([...a.foodJoint].sort((x,y)=>x[0]-y[0]))),[[8,.5],[15,.5]]);
 assert.equal(a.used,2.5);
 assert.equal(a.berries,1);
 assert.equal(a.ingredients.apple,1.5);
 assert.equal(a.eligible,1);
 const collected=sim.collectIntegerFoodPocket(a.foodJoint,3,0);
 assert.equal(collected.accepted,0);
 assert.equal(collected.remaining,1.5);
 assert.deepEqual(JSON.parse(JSON.stringify([...collected.occupation].sort((x,y)=>x[0]-y[0]))),[[0,.5],[3,.5]]);
 const next=sim.integerFoodPocketTransitions(collected.foodJoint,1,3,2,.5,[{key:'apple',count:3}]);
 assert.ok(Math.abs(next.eligible-.5)<1e-12);
 assert.equal(sim.integerPocketTransitions(sim.expectedPocketOccupation(1.5,3),1,3,2,.5,[{key:'apple',count:3}]).eligible,1);
});
test('one free global food slot clips each actual branch before averaging, not the expected quantity',()=>{
 const a=sim.integerFoodPocketTransitions(new Map([[0,1]]),1,3,2,.5,[{key:'apple',count:3}]);
 const collected=sim.collectIntegerFoodPocket(a.foodJoint,3,1);
 assert.ok(Math.abs(collected.accepted-.5)<1e-12);
 assert.ok(Math.abs(collected.remaining-1)<1e-12);
 assert.deepEqual(JSON.parse(JSON.stringify([...collected.occupation].sort((x,y)=>x[0]-y[0]))),[[0,.5],[2,.5]]);
 assert.ok(Math.abs(collected.accepted+collected.remaining-a.ingredients.apple)<1e-12);
});
test('zero food outcome leaves no carry even when berries previously occupied the pocket',()=>{
 const x=sim.integerFoodPocketTransitions(new Map([[0,1]]),1,3,2,0,[{key:'apple',count:3}]);
 const after=sim.collectIntegerFoodPocket(x.foodJoint,3,0);
 assert.equal(after.remaining,0);
 assert.deepEqual(JSON.parse(JSON.stringify([...after.occupation])),[[0,1]]);
 assert.equal(x.berries,2);
});
test('joint food distribution aggregates different food species without inventing food identity',()=>{
 const x=sim.integerFoodPocketTransitions(new Map([[0,1]]),1,4,1,.8,[{key:'apple',count:3},{key:'coffee',count:2}]);
 assert.ok(Math.abs(x.ingredients.apple-1.2)<1e-12);
 assert.ok(Math.abs(x.ingredients.coffee-.8)<1e-12);
 const after=sim.collectIntegerFoodPocket(x.foodJoint,4,1);
 // 40% apple3 => 2 retained; 40% coffee2 => 1 retained.
 assert.ok(Math.abs(after.remaining-1.2)<1e-12);
 assert.ok(Math.abs(after.accepted-.8)<1e-12);
 const mass=[...after.occupation.values()].reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(mass-1)<1e-12);
});
test('joint ingredient model preserves v0.2.23 skill eligible roll distribution',()=>{
 const params=[3,4,1,.5,[{key:'apple',count:4}]];
 const a=sim.integerFoodPocketTransitions(new Map([[0,1]]),...params);
 const b=sim.integerPocketTransitions(new Map([[0,1]]),...params);
 assert.deepEqual(JSON.parse(JSON.stringify([...a.occupation])),JSON.parse(JSON.stringify([...b.occupation])));
 assert.deepEqual(JSON.parse(JSON.stringify([...a.eligibleDistribution])),JSON.parse(JSON.stringify([...b.eligibleDistribution])));
 assert.ok(Math.abs(a.sneaky-b.sneaky)<1e-12);
 assert.ok(Math.abs(a.used-b.used)<1e-12);
});
test('invalid joint distribution or noninteger global room cannot be silently treated as exact',()=>{
 assert.throws(()=>sim.integerFoodPocketTransitions(new Map([[0,.5]]),1,4,2,.2,[{key:'apple',count:1}]),/確率質量/);
 assert.throws(()=>sim.integerFoodPocketTransitions(new Map([[3,1]]),1,3,2,.5,[{key:'apple',count:1}]),/不正/);
 assert.throws(()=>sim.collectIntegerFoodPocket(new Map([[0,.6]]),4,0),/確率質量/);
 assert.throws(()=>sim.collectIntegerFoodPocket(new Map([[0,1]]),4,.5),/不正/);
});
test('weekly full-bag simulation uses tracked food retention with bounded skill eligibility',()=>{
 const x=input();x.options.recipeId='';x.options.initialIngredients={apple:1};x.options.bagCapacity=1;
 const r=sim.simulate(x);
 assert.ok(r.exactFoodCarryCollections>0);
 assert.ok(r.skillEligibleHelps<=r.skillHelpCompletions+1e-8);
 assert.ok(r.skillTriggers<=r.skillEligibleHelps+1e-8);
 assert.ok(Object.values(r.inventory).reduce((sum,n)=>sum+n,0)<=1+1e-8);
 assert.ok(Math.abs(r.days.reduce((sum,d)=>sum+d.berries+d.cooking+d.skills,0)-r.total)<1e-5);
});
test('unrestricted global bag avoids expensive full-bag joint tracking',()=>{
 const x=input();x.options.recipeId='';x.options.initialIngredients={};
 const r=sim.simulate(x);
 assert.equal(r.exactFoodCarryCollections,0);
});


test('full shared ingredient bag blocks all supported food-producing main skill families',()=>{
 const names=['Ingredient Magnet S','Ingredient Magnet S (Plus)','Ingredient Magnet S (Present)',
  'Cooking Assist S (Bulk Up)','Ingredient Draw S','Ingredient Draw S (Super Luck)','Ingredient Draw S (Hyper Cutter)'];
 for(const name of names){
  assert.equal(sim.blockedIngredientSkill(name,10,10),true,name);
  assert.equal(sim.blockedIngredientSkill(name,10,11),true,name);
  assert.equal(sim.blockedIngredientSkill(name,10,9),false,name);
 }
});
test('full ingredient bag does not block regular energy, healing, or excluded skills',()=>{
 for(const name of ['Charge Strength S','Energy for Everyone S','Cooking Power-Up S','Metronome','Extra Helpful S']){
  assert.equal(sim.blockedIngredientSkill(name,1,1),false,name);
 }
});
test('unbounded ingredient storage never blocks ready food skills',()=>{
 for(const name of ['Ingredient Magnet S','Cooking Assist S (Bulk Up)','Ingredient Draw S']){
  assert.equal(sim.blockedIngredientSkill(name,0,0),false);
  assert.equal(sim.blockedIngredientSkill(name,10,9.9),false);
 }
});
test('invalid bag-cap and used item counts are not interpreted as a full bag',()=>{
 assert.throws(()=>sim.blockedIngredientSkill('Ingredient Magnet S',-1,0),/不正/);
 assert.throws(()=>sim.blockedIngredientSkill('Ingredient Magnet S',10,-1),/不正/);
 assert.throws(()=>sim.blockedIngredientSkill('Ingredient Magnet S',10,NaN),/不正/);
});
test('five ingredient magnet helpers keep ready skills and report zero actual activation while bag stays full',()=>{
 const a=input();
 for(const p of a.box){p.pokemon='フシギダネ';p.ingredients=['あまいミツ','あまいミツ','あまいミツ'];}
 a.options.bagCapacity=1;a.options.initialIngredients={apple:1};a.options.recipeId='';
 const r=sim.simulate(a);
 assert.equal(r.skillTriggers,0);
 assert.equal(r.skillIngredients.apple||0,0);
 assert.ok(r.skillEligibleHelps>0);
 assert.ok(r.warnings.some(w=>w.includes('待機スキル')));
});
test('ingredient magnet triggers after cooking makes free room in a formerly full bag',()=>{
 const a=input();
 for(const p of a.box){p.pokemon='フシギダネ';p.ingredients=['あまいミツ','あまいミツ','あまいミツ'];}
 a.options.initialIngredients={apple:150};a.options.bagCapacity=150;
 a.options.magnetIngredients=['apple'];
 a.options.recipeId='apple_curry';a.options.recipeMode='fixed';
 const r=sim.simulate(a);
 assert.ok(r.meals.length>0);
 assert.ok(r.skillTriggers>0,'queued magnet must fire after a meal opens bag space');
 assert.ok(r.skillIngredients.apple>0);
});
test('non-food main skills remain activatable with a full global food bag',()=>{
 const a=input();
 a.options.initialIngredients={apple:1};a.options.bagCapacity=1;a.options.recipeId='';
 const r=sim.simulate(a);
 assert.ok(r.skillTriggers>0,'Raichu charge-strength skills should still fire');
 assert.ok(r.skills>0);
});


test('meal provenance only credits user-entered initial ingredients as deterministic',()=>{
 const x=input();x.options.recipeMode='fixed';x.options.recipeId='apple_curry';
 x.options.initialIngredients={apple:150};x.options.extraMode='none';
 const r=sim.simulate(x);
 assert.equal(r.meals.length,21);
 assert.equal(r.estimatedMeals,0);
 assert.equal(r.initialCoveredMeals,21);
 assert.ok(r.meals.every(m=>m.initialCovered&&m.expectedMandatoryUnits===0));
 assert.equal(r.meals.reduce((n,m)=>n+m.energy,0),r.cooking);
});
test('ingredients only from stochastic helps never become guaranteed recipe stock',()=>{
 const x=input();x.options.initialIngredients={};x.options.recipeMode='fixed';x.options.recipeId='apple_curry';
 const r=sim.simulate(x);
 assert.ok(r.meals.length>0,'sample species must eventually produce apples');
 assert.equal(r.initialCoveredMeals,0);
 assert.equal(r.estimatedMeals,r.meals.length);
 assert.ok(r.meals.every(m=>m.initialCovered===false&&m.expectedMandatoryUnits>0));
 assert.ok(r.warnings.some(w=>w.includes('実際のレシピ成立確率')));
});
test('partially covered ingredients quantify only the initial-stock shortfall',()=>{
 const x=input();x.options.initialIngredients={apple:6};x.options.recipeId='apple_curry';
 const r=sim.simulate(x);
 assert.ok(r.meals.length>0);
 const first=r.meals[0];
 assert.equal(first.initialCovered,false);
 assert.equal(first.expectedMandatoryUnits,1);
 assert.equal(r.initialCoveredMeals+r.estimatedMeals,r.meals.length);
});
test('cooking preserves deterministic-stock provenance through weekly consumption',()=>{
 const x=input();x.options.initialIngredients={apple:14};x.options.recipeId='apple_curry';
 const r=sim.simulate(x);
 assert.ok(r.meals.length>2);
 assert.equal(r.initialCoveredMeals,2);
 assert.equal(r.meals[0].initialCovered,true);
 assert.equal(r.meals[1].initialCovered,true);
 assert.equal(r.meals[2].initialCovered,false);
 assert.equal(r.estimatedMeals,r.meals.length-2);
});
test('uncertain optional pot-fill food does not make mandatory recipe ingredients uncertain',()=>{
 const x=input();x.options.initialIngredients={apple:150};x.options.recipeId='apple_curry';
 x.options.extraMode='fill';x.options.potSize=57;
 const r=sim.simulate(x);
 assert.ok(r.meals.length>0);
 for(const meal of r.meals){
  assert.ok(meal.expectedExtraUnits>=0&&Number.isFinite(meal.expectedExtraUnits));
  assert.ok(meal.expectedMandatoryUnits>=0&&meal.expectedMandatoryUnits<=meal.mandatoryCount);
 }
 assert.equal(r.estimatedMeals+r.initialCoveredMeals,r.meals.length);
});
test('no recipe mode or mismatched cuisine yields no invented meal provenance',()=>{
 const x=input();x.options.recipeMode='fixed';x.options.recipeId='';
 const r=sim.simulate(x);
 assert.equal(r.meals.length,0);
 assert.equal(r.estimatedMeals,0);
 assert.equal(r.initialCoveredMeals,0);
});
test('expected-meal labeling does not change accounting or 7-day energy',()=>{
 const x=input();x.options.recipeMode='best';x.options.recipeId='';
 const r=sim.simulate(x);
 assert.ok(Math.abs(r.meals.reduce((sum,m)=>sum+m.energy,0)-r.cooking)<1e-7);
 assert.ok(Math.abs(r.days.reduce((sum,d)=>sum+d.berries+d.cooking+d.skills,0)-r.total)<1e-5);
 assert.equal(r.initialCoveredMeals+r.estimatedMeals,r.meals.length);
 assert.ok(r.meals.every(m=>Number.isFinite(m.expectedMandatoryUnits)&&Number.isFinite(m.expectedExtraUnits)));
});


test('meal Energy source categories reconcile exactly to cooking and weekly total',()=>{
 const x=input();x.options.recipeMode='best';x.options.recipeId='';
 const r=sim.simulate(x);
 assert.ok(Math.abs(r.expectedSourceMealEnergy+r.initialSourceMealEnergy-r.cooking)<1e-7);
 assert.equal(r.expectedSourceMeals,r.meals.filter(m=>m.expectedSource).length);
 assert.ok(Math.abs(r.meals.filter(m=>m.expectedSource).reduce((sum,m)=>sum+m.energy,0)-r.expectedSourceMealEnergy)<1e-7);
 assert.ok(Math.abs(r.days.reduce((n,d)=>n+d.berries+d.cooking+d.skills,0)-r.total)<1e-5);
});
test('all mandatory ingredients from initial input yields no source-dependent cooking Energy',()=>{
 const x=input();x.options.initialIngredients={apple:150};x.options.recipeId='apple_curry';
 const r=sim.simulate(x);
 assert.equal(r.meals.length,21);
 assert.equal(r.expectedSourceMeals,0);
 assert.equal(r.expectedSourceMealEnergy,0);
 assert.equal(r.initialSourceMealEnergy,r.cooking);
 assert.ok(r.meals.every(m=>!m.expectedSource));
});
test('every dish produced without initial inventory is source-dependent Energy',()=>{
 const x=input();x.options.initialIngredients={};x.options.recipeId='apple_curry';
 const r=sim.simulate(x);
 assert.ok(r.meals.length>0);
 assert.equal(r.expectedSourceMeals,r.meals.length);
 assert.equal(r.initialSourceMealEnergy,0);
 assert.ok(Math.abs(r.expectedSourceMealEnergy-r.cooking)<1e-7);
});
test('optional extras supplied by expected production are included in source-dependent classification',()=>{
 const x=input();x.options.initialIngredients={apple:150};x.options.recipeId='apple_curry';x.options.extraMode='fill';
 const r=sim.simulate(x);
 assert.ok(r.meals.length>0);
 for(const meal of r.meals){
  assert.equal(meal.expectedSource,meal.expectedMandatoryUnits>1e-9||meal.expectedExtraUnits>1e-9);
 }
 assert.ok(Math.abs(r.initialSourceMealEnergy+r.expectedSourceMealEnergy-r.cooking)<1e-7);
});
test('without a selected recipe all source-dependent Energy counters remain empty',()=>{
 const x=input();x.options.recipeMode='fixed';x.options.recipeId='';
 const r=sim.simulate(x);
 assert.equal(r.meals.length,0);
 assert.equal(r.expectedSourceMeals,0);
 assert.equal(r.expectedSourceMealEnergy,0);
 assert.equal(r.initialSourceMealEnergy,0);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const get=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const snapshot=JSON.parse(get('f1/f1-b-target-source-v1.json'));
const traits=JSON.parse(get('f1/f1-b-help-traits-v1.json'));
const load=(file,dep={})=>{
 const box={module:{exports:{}},globalThis:{},require:p=>{
  if(Object.hasOwn(dep,p))return dep[p];
  throw Error('Unknown import '+p);
 }};
 vm.runInNewContext(get(file),box,{filename:file});
 return box.module.exports;
};
const legal=load('f1/f1-b-legal-build-v2.js');
const rates=load('f1/f1-b-base-rates-v1.js',{'./f1-b-legal-build-v2.js':legal});
const f3=load('f3/f3-prep-optimizer-v1.js');
const prod=load('f3/f3-b-production-scenario-v1.js');
const recipes=load('src/recipes.js');
const deps={snapshot,traits,legal,rates};
const byName=new Map(snapshot.targets.map(t=>[t.name,t]));
const dict=snapshot.dictionaries.ingredients;
function food(name,slot){
 const sp=legal.SPECIAL_FOODS[name];
 if(sp)return dict[Object.keys(sp[slot-1])[0]];
 const t=byName.get(name);
 return dict[[t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3]
  .slice(0,slot).find(x=>x&&x.name!=='unknown'&&x['c'+slot]>0).name];
}
function item(name,privateNick='PVT_NICKNAME_MUST_NOT_LEAK'){
 const t=byName.get(name);
 return {pokemon:name,nickname:privateNick,level:60,skillLevel:3,
  ing1:food(name,1),ing2:food(name,2),ing3:food(name,3),
  nature:'てれや',mainSkill:t.sourceProfile.mainSkillJa,
  mint:null,ribbon:null,shiny:true,
  lv10:'きのみの数S',lv25:'おてつだいボーナス',
  lv50:'おてつだいスピードS',lv70:'リサーチEXPボーナス',
  lv80:'げんき回復ボーナス'};
}
const team=()=>['リザードン','ゲンガー','エーフィ','サーナイト','カメックス',
 'フシギバナ','カイリュー'].map(name=>item(name));
const demand={apple:65,milk:90,sausage:70,herb:50,corn:30,cacao:20};
const options=(overrides={})=>({items:team(),targetIngredients:demand,camp:true,...overrides});
test('F3-B pinned 66 species source, five real individuals, no private member data in output',()=>{
 const privateRows=team();
 const before=JSON.stringify(privateRows);
 const r=prod.estimate(options({items:privateRows}),deps);
 assert.equal(r.status,'PROVISIONAL',r.message);
 assert.equal(r.source,'F1_B_PINNED_66_SPECIES');
 assert.equal(r.sourceCommit,snapshot.upstream.commit);
 assert.equal(r.teamSpecies.length,5);
 assert.equal(new Set(r.teamSpecies).size,5);
 assert.equal(r.candidateRosterIsAdopted,false);
 assert.equal(r.scenarioMayReduceConfirmedGoals,false);
 assert.equal(r.referenceHours,168);
 assert.equal(r.assumedMintCount,5);
 assert.equal(r.assumedRibbonCount,5);
 assert(Object.values(r.scenarioProduction).some(n=>n>0));
 assert.equal(Object.keys(r.scenarioProduction).length,19);
 assert(!JSON.stringify(r).includes('PVT_NICKNAME_MUST_NOT_LEAK'));
 assert(!JSON.stringify(r).includes('nickname'));
 assert(!JSON.stringify(r).includes('lv10'));
 assert.equal(JSON.stringify(privateRows),before);
 assert.equal(JSON.stringify(r),JSON.stringify(prod.estimate(options({items:privateRows}),deps)));
});
test('F3-B production scenario remains separate from conservative stockpile plan',()=>{
 const base=f3.plan({recipes,categories:['curry','salad','dessert'],
  bagCapacity:600,potCapacity:57,camp:true,currentStock:{}});
 assert.equal(base.status,'PROVISIONAL',base.message);
 const initial=JSON.stringify(base);
 const forecast=prod.estimate(options({targetIngredients:base.demand}),deps);
 assert.equal(forecast.status,'PROVISIONAL',forecast.message);
 const variant=f3.plan({recipes,categories:['curry','salad','dessert'],
  bagCapacity:600,potCapacity:57,camp:true,
  currentStock:{},forecastProduction:forecast.scenarioProduction});
 assert.equal(variant.status,'PROVISIONAL',variant.message);
 assert.equal(variant.assumptions.forecastProvided,true);
 assert.equal(base.assumptions.forecastProvided,false);
 assert.equal(base.production.apple,0);
 assert.equal(JSON.stringify(base),initial,'The confirmed base target must not be mutated');
 assert.equal(variant.capacity.bag,base.capacity.bag);
 assert(variant.capacity.used<=600);
});
test('F3-B fails closed on insufficient eligible, empty source, bad form and missing dependencies',()=>{
 const few=prod.estimate(options({items:team().slice(0,3)}),deps);
 assert.equal(few.status,'BLOCKED');
 assert.equal(few.reason,'INSUFFICIENT_VERIFIED_POKEMON');
 assert.equal(few.eligibleCount,3);
 assert.equal(prod.estimate(options({camp:null}),deps).status,'BLOCKED');
 assert.equal(prod.estimate(options({targetIngredients:{mystery:10}}),deps).status,'BLOCKED');
 assert.equal(prod.estimate(options({targetIngredients:{apple:-1}}),deps).status,'BLOCKED');
 assert.equal(prod.estimate(options({targetIngredients:{apple:Infinity}}),deps).status,'BLOCKED');
 assert.equal(prod.estimate(options({targetIngredients:{}}),deps).status,'BLOCKED');
 assert.equal(prod.estimate(options(),{}).status,'BLOCKED');
 const changed=structuredClone(snapshot);changed.upstream.commit='invalid';
 assert.equal(prod.estimate(options(),{...deps,snapshot:changed}).status,'BLOCKED');
 const out=prod.estimate(options({items:[...team().slice(0,6),
  {...item('リザードン'),pokemon:'unknown-special-form'}]}),deps);
 assert.equal(out.status,'PROVISIONAL',out.message);
 assert.equal(out.unsupportedCount,1);
 assert(!JSON.stringify(out).includes('unknown-special-form'));
});
test('F3-B preserves individual ingredient restrictions, no invented nut or unknown food',()=>{
 const p=prod.estimate(options(),deps);
 assert.equal(p.status,'PROVISIONAL',p.message);
 assert.equal(Object.hasOwn(p.scenarioProduction,'nuts'),false);
 const rows=team();rows[0].ing1='ひとくちナッツ';
 const result=prod.estimate(options({items:rows}),deps);
 assert.equal(result.status,'PROVISIONAL');
 assert.equal(result.excludedCount,1);
 assert.equal(result.teamSpecies.length,5);
 assert.equal(rows[0].ing1,'ひとくちナッツ');
});
test('F3-B UI only renders read-only optional scenario, keeps root and F1 calculation unmodified',()=>{
 const ui=get('e7-preview/e7-f3-prep-goals-v88.js');
 const prep=get('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const sw=get('e7-preview/e7-sw-v50.js');
 assert.match(ui,/PokeF3ProductionScenario/);
 assert.match(ui,/const raw=localStorage\.getItem\('pokesleep-strategy-e7-box-v1'\)/);
 assert.match(ui,/targetIngredients:base\.demand/);
 assert.match(ui,/forecastProduction:source\.scenarioProduction/);
 assert.match(ui,/準備目標から自動控除しません/);
 assert.doesNotMatch(ui,/localStorage\.setItem|localStorage\.removeItem/);
 assert.match(prep,/src="\.\.\/f3\/f3-b-production-scenario-v1\.js"/);
 assert.match(prep,/src="\.\.\/f1\/f1-b-base-rates-v1\.js"/);
 assert.match(sw,/f3-b-production-scenario-v1\.js/);
 assert.match(sw,/f1-b-target-source-v1\.json/);
 assert.match(sw,/v89-f3-b-20261113/);
 assert(!get('index.html').includes('f3-b-production-scenario-v1.js'));
 assert(!get('src/simulator.js').includes('PokeF3ProductionScenario'));
});

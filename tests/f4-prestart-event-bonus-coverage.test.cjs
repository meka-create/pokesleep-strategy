'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const sandbox={module:{exports:{}},globalThis:{}};
vm.runInNewContext(read('f4/f4-event-model-gate-v1.js'),sandbox);
const G=sandbox.module.exports;
const options={
 id:G.EVENT_ID,sourceKey:'bountiful banquet week vol1',
 start:'2026-11-16',end:'2026-11-23',upstreamRevision:'a'.repeat(40),
 verifiedTarget:{specialty:'Ingredients'},
 verifiedEffects:{extraIng:'nuts',ingredient:1,carryLimitAdd:10},
 unknownEffects:true
};
const source=()=>JSON.parse(JSON.stringify(options));
const normalEffects=['extraIng','ingredient','carryLimitAdd'];
const modelRules=Array.from(G.BOUNTIFUL_BANQUET.requiredImplementations);
const recipes=require('../src/recipes.js');
const legacyCodes=['leek','mushroom','egg','potato','apple','herb','sausage','milk','honey',
 'oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado'];
const provenance={verifiedAgainstOfficialRelease:true,sourceCommit:'a'.repeat(40)};
const newRows=['curry','salad','dessert'].map(type=>({
 id:'synthetic-audit-'+type,name:'合成試験',type,baseStrength:1,
 requirements:{nuts:10,apple:10}
}));
test('F4 preflight: official 11/16 rule manifest independently captures event.json omissions',()=>{
 assert.equal(G.BOUNTIFUL_BANQUET.officialURL,
  'https://www.pokemonsleep.net/news/343537333535313639323130383236373539/');
 assert.equal(G.BOUNTIFUL_BANQUET.potCapacityBonus,30);
 assert.equal(G.BOUNTIFUL_BANQUET.mandatoryNutsRecipeMultiplier,1.5);
 assert.equal(G.BOUNTIFUL_BANQUET.extraNutsIngredientMultiplier,1.5);
 assert.equal(G.BOUNTIFUL_BANQUET.allFoodCategories,true);
 assert.deepEqual(JSON.parse(JSON.stringify(G.BOUNTIFUL_BANQUET.sourceEffects)),
  options.verifiedEffects);
 assert.equal(G.BOUNTIFUL_BANQUET.releaseDate,'2026-11-16T04:00:00+09:00');
 assert.equal(G.BOUNTIFUL_BANQUET.requiredImplementations.length,7);
});
test('F4 gate must BLOCK a source with fully recognized upstream fields but unimplemented official rules',()=>{
 const r=G.inspect({source:source(),implementedEffects:normalEffects});
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'OFFICIAL_EVENT_RULES_NOT_MODELED');
 assert(r.unmodeledRules.some(k=>k.includes('pot-capacity-plus-thirty')));
 assert(r.unmodeledRules.some(k=>k.includes('recipe-energy-times-1.5')));
 assert.equal(r.weeklyOptimizationCertified,false);
 assert.equal(G.inspect({source:source()}).reason,'EVENT_EFFECT_NOT_MODELED');
});
test('F4 gate refuses current 19 ingredients / 78 recipes even when event effects are hypothetically declared supported',()=>{
 const r=G.inspect({source:source(),implementedEffects:normalEffects,
  implementedOfficialRules:modelRules,ingredientCodes:legacyCodes,recipes});
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'NEW_INGREDIENT_OR_RECIPES_MISSING');
 assert.equal(recipes.length,78);assert.equal(legacyCodes.length,19);
});
test('F4 gate requires nuts-containing dishes for each category and provenance; never certifies weekly optimization',()=>{
 const params={source:source(),implementedEffects:normalEffects,
  implementedOfficialRules:modelRules,
  ingredientCodes:[...legacyCodes,'nuts'],
  recipes:[...recipes,...newRows],catalogProvenance:provenance};
 const pass=G.inspect(params);
 assert.equal(pass.status,'BONUS_COVERAGE_DECLARED');
 assert.equal(pass.weeklyOptimizationCertified,false);
 assert.equal(pass.sourceAuthenticityCertified,false);
 const partial=G.inspect({...params,recipes:[...recipes,...newRows.slice(0,2),{
  id:'synthetic-no-nuts',name:'食材なし',type:'dessert',requirements:{apple:2}
 }]});
 assert.equal(partial.reason,'RECIPE_CATEGORY_GAP');
 const unverified=G.inspect({...params,catalogProvenance:{...provenance,verifiedAgainstOfficialRelease:false}});
 assert.equal(unverified.reason,'RECIPE_PROVENANCE_UNVERIFIED');
 assert.equal(G.inspect({...params,catalogProvenance:{...provenance,sourceCommit:'fake'}}).reason,
  'RECIPE_PROVENANCE_UNVERIFIED');
});
test('F4 gate does not allow renamed official event, bad source target or unexpected modifier to sneak through',()=>{
 for(const s of [
  {...source(),sourceKey:'bountiful banquet week vol2'},
  {...source(),start:'2026-11-15'},
  {...source(),verifiedTarget:{}},
  {...source(),verifiedEffects:{...options.verifiedEffects,ingredient:2}}
 ]){
  const r=G.inspect({source:s,implementedEffects:normalEffects});
  assert.equal(r.reason,'UPSTREAM_OFFICIAL_CONFLICT',JSON.stringify(s));
 }
 const surprise=G.inspect({source:{...source(),verifiedEffects:{
  ...options.verifiedEffects,unknownNewEffect:3}},implementedEffects:[...normalEffects,'unknownNewEffect']});
 assert.equal(surprise.reason,'UNKNOWN_EVENT_EFFECT');
 assert.equal(G.inspect({source:null}).reason,'EVENT_SOURCE_NOT_CONFIRMED');
});
test('F4 event gate distinguishes less complex event, but does not make a full engine claim',()=>{
 const other={id:'pokesleep-tool:dream shard week 3:2026-11-23',
  sourceKey:'dream shard week 3',start:'2026-11-23',upstreamRevision:'a'.repeat(40),
  verifiedTarget:{},verifiedEffects:{skillTrigger:1.25,dreamShard:1.5}};
 assert.equal(G.inspect({source:other}).reason,'EVENT_EFFECT_NOT_MODELED');
 const yes=G.inspect({source:other,implementedEffects:['skillTrigger','dreamShard']});
 assert.equal(yes.status,'UPSTREAM_EFFECT_COVERAGE_DECLARED');
 assert.equal(yes.weeklyOptimizationCertified,false);
});
test('F4 audit guard cannot modify private records, production root or existing plan',()=>{
 const sourceFile=read('f4/f4-event-model-gate-v1.js');
 assert.doesNotMatch(sourceFile,/localStorage|sessionStorage|fetch\(|setItem\(|removeItem\(/);
 assert.doesNotMatch(sourceFile,/nickname|sourceFileSHA256|PokeE7BoxCsv/);
 assert.doesNotMatch(read('index.html'),/f4-event-model-gate-v1/);
 const src=source(),before=JSON.stringify(src);
 G.inspect({source:src,implementedEffects:normalEffects,implementedOfficialRules:[]});
 assert.equal(JSON.stringify(src),before);
});
test('F4 lazy reference must skip private box scan and pinned JSON until explicit expansion',()=>{
 const s=read('e7-preview/e7-f3-prep-goals-v88.js');
 assert.match(s,/detail\.addEventListener\('toggle',requestOpenScenario\)/);
 assert.match(s,/productionDetails\.addEventListener\('toggle',requestOpenScenario\)/);
 assert.match(s,/if\(!detail\.open\|\|!productionDetails\.open\|\|!currentScenario\)return/);
 assert.match(s,/if\(lastRequestedToken===token\)return/);
 assert.doesNotMatch(s,/^\s*void refreshProduction\(ctx,result,token\);/m);
 assert.doesNotMatch(s,/localStorage\.setItem|localStorage\.removeItem/);
});

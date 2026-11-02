const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/prep-handoff.js','utf8');
function fixture(){
 const context={PokeMaster:{ingredients:{apple:'リンゴ',milk:'ミルク',honey:'ミツ'}},PokeRecipes:[
  {id:'apple',name:'リンゴ料理',type:'curry',requirements:{apple:7}},
  {id:'milk',name:'ミルク料理',type:'curry',requirements:{milk:5,honey:3}}
 ]};
 vm.runInNewContext(source,context);
 return context.PokePrepHandoff;
}
const targets=[{recipeId:'apple',meals:3},{recipeId:'milk',meals:18}];
test('targets prioritize first three scheduled meals without pretending to stock all 21',()=>{
 const api=fixture(),result=api.targets({recipeTargets:targets,bagCapacity:50,potSize:10});
 assert.equal(result.totalMeals,21);assert.equal(result.target.apple,21);
 assert.equal(result.allNeed.milk,90);assert.equal(result.target.milk||0,0);
 assert.equal(result.earlyCount,3);assert.equal(result.covered,true);
 assert.equal(result.firstPotShortfall,0);
});
test('when capacity cannot hold three meals, never claim full coverage',()=>{
 const r=fixture().targets({recipeTargets:targets,bagCapacity:10,potSize:7});
 assert.equal(r.covered,false);assert.equal(r.target.apple,10);
 assert.equal(r.targetTotal,10);
});
test('Sunday actual stock is distinct from targets and supports consumed-meal carry-forward',()=>{
 const api=fixture(),plan=api.targets({recipeTargets:targets,bagCapacity:100,potSize:7});
 const r=api.evaluate(plan,{inventory:{apple:14,milk:10},potBonus:0,skillStocks:{p1:{count:2,confirmed:false}},eventStart:''},new Set(['p1']));
 assert.equal(r.meals.length,3);assert.equal(r.meals[0].canCook,true);
 assert.equal(r.meals[1].canCook,true);assert.equal(r.meals[2].canCook,false);
 assert.equal(r.ready,2);assert.equal(r.remaining.apple,0);
 assert.equal(r.shortages.apple,7);assert.equal(r.stockUnconfirmed,1);
});
test('pot bonus applies to the first successful cooking, not all meals',()=>{
 const api=fixture(),plan=api.targets({recipeTargets:[{recipeId:'milk',meals:2}],bagCapacity:100,potSize:7});
 const r=api.evaluate(plan,{inventory:{milk:10,honey:6},potBonus:3,skillStocks:{},eventStart:''},new Set());
 assert.equal(r.meals[0].canCook,true);
 assert.equal(r.meals[1].potOk,false);
 assert.equal(r.ready,1);
});
test('invalid Sunday figures or fabricated Pokemon IDs cannot become an event plan',()=>{
 const api=fixture(),plan=api.targets({recipeTargets:targets,bagCapacity:30,potSize:10});
 assert.throws(()=>api.evaluate(plan,{inventory:{apple:31},potBonus:0,skillStocks:{}},new Set()),/バッグ容量/);
 assert.throws(()=>api.evaluate(plan,{inventory:{},potBonus:201,skillStocks:{}},new Set()),/鍋拡張/);
 assert.throws(()=>api.evaluate(plan,{inventory:{},potBonus:0,skillStocks:{absent:{count:2,confirmed:true}}},new Set()),/スキルストック/);
 assert.throws(()=>api.targets({recipeTargets:[{recipeId:'apple',meals:22}],bagCapacity:100,potSize:10}),/予定食数/);
});

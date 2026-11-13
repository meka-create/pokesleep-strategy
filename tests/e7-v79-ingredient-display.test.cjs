'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>{
 const env={window:{},module:{exports:{}}};
 vm.runInNewContext(read(p),env,{filename:p});
 return env.module.exports;
};
const counts=load('e7-preview/e7-ingredient-quantities-v79.js');
const legality=load('f1/f1-b-legal-build-v2.js');
const snapshot=JSON.parse(read('f1/f1-b-target-source-v1.json'));
test('E7 v79 has pinned ingredient quantities for 66 scoped species/forms, no user Pokémon data',()=>{
 assert.equal(counts.speciesCount,66);
 const src=read('e7-preview/e7-ingredient-quantities-v79.js');
 assert(src.includes(snapshot.upstream.commit));
 assert(src.includes(snapshot.upstream.pokemonJson.gitBlob));
 assert.doesNotMatch(src,/nickname\s*:|localStorage|sessionStorage|setItem\(/);
});
test('E7 v79 64 regular species return all 3 slot count candidates, never slot 1 counts for slot 3',()=>{
 let checked=0;
 for(const target of snapshot.targets){
  if(Object.hasOwn(legality.SPECIAL_FOODS,target.name))continue;
  for(let slot=1;slot<=3;slot++){
   const possible=[target.sourceProfile.ing1,target.sourceProfile.ing2,target.sourceProfile.ing3]
    .slice(0,slot).filter(x=>x&&x.name!=='unknown'&&x['c'+slot]>0);
   assert(possible.length>0,target.name+' slot '+slot);
   for(const candidate of possible){
    const japanese=snapshot.dictionaries.ingredients[candidate.name];
    assert.equal(counts.get(target.name,japanese,slot),candidate['c'+slot],
     target.name+' '+japanese+' slot '+slot);
    checked++;
   }
  }
 }
 assert(checked>=200,checked);
 assert.equal(counts.get('エーフィ','モーモーミルク',1),1);
 assert.equal(counts.get('エーフィ','モーモーミルク',2),2);
 assert.equal(counts.get('エーフィ','モーモーミルク',3),4);
 assert.equal(counts.get('カメックス','リラックスカカオ',2),3);
});
test('E7 v79 special Mew / Darkrai food counts match independently audited F1-B candidate choices',()=>{
 for(const [name,slots] of Object.entries(legality.SPECIAL_FOODS)){
  for(let slot=1;slot<=3;slot++){
   for(const [code,n] of Object.entries(slots[slot-1])){
    const ingredient=snapshot.dictionaries.ingredients[code];
    assert.equal(counts.get(name,ingredient,slot),n,name+' '+ingredient+' '+slot);
   }
  }
 }
 assert.equal(counts.get('ミュウ','とくせんエッグ',2),4);
 assert.equal(counts.get('ダークライ','あまいミツ',3),6);
});
test('E7 v79 missing/unknown species and mismatched ingredient must not display fake numbers',()=>{
 assert.equal(counts.get('未対応のポケモン','とくせんリンゴ',1),null);
 assert.equal(counts.get('エーフィ','マメミート',1),null);
 assert.equal(counts.get('エーフィ','モーモーミルク',0),null);
 assert.equal(counts.get('エーフィ','モーモーミルク',4),null);
 assert.equal(counts.get('タマザラシ(ホリデー)','ピュアなオイル',1),1);
});
test('E7 v79 U2 keeps original name-keyed inventory persistence and hides only visible text',()=>{
 const src=read('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 assert.match(src,/const foodName=i=>i\.closest\('\.food'\)\.querySelector\('\.name'\)\.textContent\.trim\(\)/);
 assert.match(src,/<style id="e7-v79-compact-ingredient-grid">/);
 assert.match(src,/<span class="name">とくせんリンゴ<\/span>/);
 assert.match(src,/clip-path:inset\(50%\)!important/);
 assert.match(src,/grid-template-rows:46px 30px/);
 assert.match(src,/\.goal-grid \.food-media,\.actual-grid \.food-media/);
 assert.match(src,/\.actual-grid \.food input\{/);
});
test('E7 v81 both views use the one ingredient icon + quantity renderer',()=>{
 const u3=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const box=read('e7-preview/e7-box-detail-v60.js');
 const u4=read('e7-preview/U4_Box_Preview_20261109_v50_E7.html');
 const shared=read('e7-preview/e7-pokemon-detail-shared-v81.js');
 assert.match(u3,/PokeE7PokemonDetail\.render\('plan'/);
 assert.match(box,/detail\.render\('box'/);
 assert.match(shared,/frame\.append\(badge\)/);
 assert.match(shared,/ingredient\.append\(frame\);group\.append\(ingredient\)/);
 assert.doesNotMatch(shared,/ingredient-name|name-caption/);
 assert.match(box,/root\.PokeE7IngredientQuantities\?\.get\(item\.pokemon,name,i\+1\)/);
 assert.match(shared,/badge\.textContent=count===null\?'—':'×'\+count/);
 assert.match(u4,/<script src="e7-pokemon-detail-shared-v81\.js"><\/script>/);
 assert.match(read('e7-preview/e7-sw-v50.js'),/'e7-pokemon-detail-shared-v81\.js'/);
 assert.match(read('e7-preview/e7-pokemon-detail-shared-v81.css'),/#pokemon-dialog \.iv-ingredient-quantity,#box-detail-dialog \.iv-ingredient-quantity/);
});

test('E7 v81 pokesleep-tool ribbon display is shared and never rewrites stored hours',()=>{
 const sandbox={window:{}};
 vm.runInNewContext(read('e7-preview/e7-pokemon-detail-shared-v81.js'),sandbox);
 vm.runInNewContext(read('e7-preview/e7-box-detail-v60.js'),sandbox);
 const format=sandbox.window.E7BoxDetail.formatSharedSleepHours;
 assert.equal(format,sandbox.window.PokeE7PokemonDetail.formatSharedSleepHours);
 for(const [input,expected] of [
  [null,'—'],[-1,'—'],[0,'200時間未満'],[199,'200時間未満'],
  [200,'200～500時間'],[499,'200～500時間'],
  [500,'500～1000時間'],[999,'500～1000時間'],
  [1000,'1000～2000時間'],[1999,'1000～2000時間'],
  [2000,'2000時間以上'],[2500,'2000時間以上']
 ])assert.equal(format(input),expected,String(input));
 const shared=read('e7-preview/e7-pokemon-detail-shared-v81.js');
 assert.match(shared,/field\(doc,'一緒に眠った時間',formatSharedSleepHours\(data\.ribbon\)\)/);
 assert.match(shared,/label\.textContent=key\+'：'/);
 assert.match(read('e7-preview/e7-pokemon-detail-shared-v81.js'),/extra:'pokemon-extra'/);
});

test('E7 v80 preserves both prep grids and tightens detail rows without changing inventory fields',()=>{
 const prep=read('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const plan=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const css=read('e7-preview/e7-pokemon-detail-shared-v81.css');
 assert.match(prep,/<style id="e7-v80-square-food-grid">/);
 assert.match(prep,/aspect-ratio:1\/1/);
 assert.match(prep,/\.goal-grid,\.actual-grid\{max-width:370px/);
 assert.equal((prep.match(/<img class="pic" src="assets\/ingredients\/ingredient-\d{2}\.png"/g)||[]).length,38);
 assert.doesNotMatch(plan,/<style id="e7-v80-status-compact-rows">/);
 assert.doesNotMatch(plan,/<style id="e7-v79-status-ingredients">/);
 assert.match(css,/#pokemon-dialog #pokemon-base-rows>\.iv-value/);
 assert.match(css,/#box-detail-fields>\.iv-value/);
 assert.match(css,/#box-detail-extra>\.iv-value/);
});

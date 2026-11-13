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
 assert.doesNotMatch(src,/nickname|localStorage|sessionStorage|setItem\(/);
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
test('E7 v79 U3 / Box display icons plus badges, without visible ingredient captions',()=>{
 const u3=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const box=read('e7-preview/e7-box-detail-v60.js');
 const u4=read('e7-preview/U4_Box_Preview_20261109_v50_E7.html');
 assert.match(u3,/<style id="e7-v79-status-ingredients">/);
 assert.match(u3,/imageFrame\.append\(countBadge\)/);
 assert.match(u3,/ingredient\.append\(imageFrame\);ingredientGroup\.append\(ingredient\)/);
 assert.doesNotMatch(u3,/ingredient\.append\(imageFrame,caption\)/);
 assert.match(box,/root\.PokeE7IngredientQuantities\?\.get\(item\.pokemon,ing,index\+1\)/);
 assert.match(box,/quantity\.textContent=count===null\?'—':'×'\+count/);
 assert.match(box,/el\.append\(icon\);ingredientGroup\.append\(el\)/);
 assert.doesNotMatch(box,/el\.append\(icon,label\)/);
 assert.match(u4,/<script src="e7-ingredient-quantities-v79\.js"><\/script>/);
 assert.match(read('e7-preview/e7-sw-v50.js'),/'e7-ingredient-quantities-v79\.js'/);
 const source=read('e7-preview/e7-box-detail-v60.css');
 assert.match(source,/\.box-detail-dialog \.iv-ingredient-quantity/);
});

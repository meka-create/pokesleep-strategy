'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const shared=read('e7-pokemon-detail-shared-v81.js');
const style=read('e7-pokemon-detail-shared-v81.css');
const strategy=read('U3_Strategy_UI_20261109_v50_E7.html');
const box=read('U4_Box_Preview_20261109_v50_E7.html');
test('E7 v81 one metadata/renderer implementation serves both Strategy and Box',()=>{
 const sandbox={window:{PokeMaster:{species:[
  {name:'エーフィ',type:'psychic'},{name:'カイリュー',type:'dragon'},
  {name:'ロコン (アローラ)',type:'ice'}]}}};
 vm.runInNewContext(shared,sandbox);
 const d=sandbox.window.PokeE7PokemonDetail;
 assert.equal(d.tone('エーフィ'),'#c4a3e7');
 assert.equal(d.tone('カイリュー'),'#a7d294');
 assert.equal(d.tone('ロコン（アローラ）'),'#a1d9e4');
 assert.equal(d.tone('未照合のフォーム'),'#8ca2b5');
 assert.equal(d.grade('おてつだいボーナス'),'gold');
 assert.equal(d.grade('スキル確率アップM'),'blue');
 assert.equal(d.grade('最大所持数アップS'),'white');
 assert.equal(d.grade('未知'),'unknown');
 assert.equal(Object.keys(d.ingredientIcons).length,19);
 assert.equal(d.ingredientIcons['とくせんリンゴ'],'assets/ingredients/ingredient-05.png');
 assert.equal(d.ingredientIcons['つやつやアボカド'],'assets/ingredients/ingredient-19.png');
 assert.doesNotMatch(shared,/localStorage|sessionStorage|setItem|removeItem|deleteItem/);
 assert.doesNotMatch(shared,/box-delete|\.shiny|色違い/);
});
test('E7 v81 shared status styles and scripts are loaded by both tabs, with Box-only deletion',()=>{
 for(const html of [strategy,box]){
  assert.match(html,/<link rel="stylesheet" href="e7-pokemon-detail-shared-v81.css">/);
  assert.match(html,/<script src="e7-species-v59.js"><\/script>/);
  assert.match(html,/<script src="e7-pokemon-detail-shared-v81.js"><\/script>/);
 }
 assert.match(strategy,/PokeE7PokemonDetail\.render\('plan'/);
 assert.match(read('e7-box-detail-v60.js'),/detail\.render\('box'/);
 assert.match(strategy,/id="pokemon-extra"/);
 assert.doesNotMatch(strategy,/id="box-delete"/);
 assert.match(box,/id="box-delete"/);
 assert.match(style,/#pokemon-dialog \.status-portrait,#box-detail-dialog \.status-portrait/);
 assert.match(style,/#pokemon-dialog \.iv-key,#box-detail-dialog \.iv-key/);
 assert.match(style,/#pokemon-dialog \.iv-subskills,#box-detail-dialog \.iv-subskills/);
 const sw=read('e7-sw-v50.js');
 for(const name of ['e7-pokemon-detail-shared-v81.js','e7-pokemon-detail-shared-v81.css'])
  assert.ok(sw.includes("'"+name+"'"),name);
 assert.match(sw,/pokesleep-strategy-e7-v81-shared-pokemon-detail-20261113/);
});
test('E7 v81 no duplicate embedded ingredient artwork or metadata/skills tables in Strategy',()=>{
 assert.ok(strategy.length<190000,'U3 HTML must not re-embed the 19 image PNGs');
 assert.match(strategy,/const INGREDIENT_ICONS=window\.PokeE7PokemonDetail\.ingredientIcons/);
 assert.doesNotMatch(strategy,/data:image\/png;base64/);
 assert.doesNotMatch(strategy,/const NATURE_GRID=/);
 assert.doesNotMatch(strategy,/const SUBSKILL_GRADES=/);
 const boxAdapter=read('e7-box-detail-v60.js');
 assert.doesNotMatch(boxAdapter,/const TYPES=|const NATURE_GRID=|const GRADES=/);
 assert.match(boxAdapter,/root\.PokeE7IngredientQuantities\?\.get\(item\.pokemon,name,i\+1\)/);
 assert.match(boxAdapter,/root\.PokeSprite\.icon\(item\)/);
 assert.match(boxAdapter,/root\.PokeSprite\.enhance/);
 assert.match(shared,/label\.textContent=key\+'：'/);
 assert.match(shared,/field\(doc,'一緒に眠った時間',formatSharedSleepHours\(data\.ribbon\)\)/);
 assert.match(shared,/if\(data\.favorite\)/);
 assert.doesNotMatch(shared,/if\(data\.shiny\)/);
});

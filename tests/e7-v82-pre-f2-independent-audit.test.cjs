'use strict';
/* Independent F2 entry gate: source-to-source checks, not just UI snapshots.
 * Snapshot labels refer to the source catalog, not the user's private CSV. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),E7=path.join(ROOT,'e7-preview');
const text=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const blob=p=>{const data=fs.readFileSync(path.join(ROOT,p));return crypto.createHash('sha1')
 .update(Buffer.from('blob '+data.length+'\0','utf8')).update(data).digest('hex');};
const catalog=JSON.parse(text('e7-preview/e7-species-v59.js').match(/root\.PokeMaster=\{species:(\[[\s\S]*?\])\};/)[1]);
const targets=JSON.parse(text('f1/f1-b-target-source-v1.json')).targets;
const shared=text('e7-preview/e7-pokemon-detail-shared-v81.js');
const css=text('e7-preview/e7-pokemon-detail-shared-v81.css');
const cssBox=text('e7-preview/e7-box-detail-v60.css');
const normalize=v=>String(v||'').normalize('NFKC').replace(/\s*\(/g,' (').trim();
test('pre-F2 independent audit: all 249 canonical species/forms map to supported type colors; 66 F1 targets covered',()=>{
 const root={PokeMaster:{species:catalog}};
 vm.runInNewContext(shared,{window:root});
 const api=root.PokeE7PokemonDetail;
 assert.equal(catalog.length,249);
 assert.equal(targets.length,66);
 const used=new Set();
 for(const row of catalog){
  const key=normalize(row.name);
  assert(!used.has(key),'duplicate form '+key);used.add(key);
  assert.notEqual(api.tone(row.name),'#8ca2b5','unknown type '+key+'/'+row.type);
  assert.equal(api.tone(row.name),api.tone(row.name.replaceAll(' (','（').replaceAll(')','）')));
 }
 for(const t of targets)assert(used.has(normalize(t.name)),t.name);
 assert.equal(api.grade('きのみの数S'),'gold');
 assert.equal(api.grade('スキル確率アップM'),'blue');
 assert.equal(api.grade('最大所持数アップS'),'white');
 assert.equal(api.grade('未対応'),'unknown');
});
test('pre-F2 independent audit: 19 shared ingredient icons exactly match both U2 grids and precached assets',()=>{
 const root={};vm.runInNewContext(shared,{window:root});
 const icons=root.PokeE7PokemonDetail.ingredientIcons;
 const u2=text('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const rows=[...u2.matchAll(/<img class="pic" src="(assets\/ingredients\/ingredient-\d{2}\.png)"[^>]*><\/span><span class="name">([^<]+)<\/span>/g)];
 assert.equal(Object.keys(icons).length,19);
 assert.equal(rows.length,38,'19 icons in both food views');
 for(let i=0;i<19;i++){
  assert.equal(rows[i][2],rows[i+19][2]);
  assert.equal(rows[i][1],rows[i+19][1]);
  assert.equal(icons[rows[i][2]],rows[i][1],rows[i][2]);
  assert(fs.existsSync(path.join(E7,rows[i][1])),rows[i][1]);
 }
 const sw=text('e7-preview/e7-sw-v50.js');
 assert.match(sw,/Array\.from\(\{length:19\}/);
 for(const file of ['e7-pokemon-detail-shared-v81.js','e7-pokemon-detail-shared-v81.css'])
  assert(sw.includes("'"+file+"'"),file);
 const fileList=sw.match(/const FILES=\[([\s\S]+?)\];/)[1];
 for(const match of fileList.matchAll(/'([^']+)'/g)){
  const file=match[1];
  assert(fs.existsSync(path.join(E7,file)),'missing precache file '+file);
 }
});
test('pre-F2 independent audit: Box-only CSS has no common status implementations left',()=>{
 assert(cssBox.length<1700,'duplicated CSS still present in Box adapter');
 for(const legacy of [
  /\.box-detail-dialog \.iv-ingredients\s*\{/,
  /\.box-detail-dialog \.iv-subskills\s*\{/,
  /\.box-detail-dialog \.iv-nature-row\s*\{/,
  /\.box-detail-dialog \.iv-ingredient-quantity\s*\{/,
  /\.box-detail-dialog \.status-portrait\s*\{/
 ])assert.doesNotMatch(cssBox,legacy);
 assert.match(cssBox,/\.box-detail-dialog #box-delete\s*\{/);
 for(const common of ['.iv-ingredients','.iv-subskills','.iv-nature-row','.iv-ingredient-quantity','.status-portrait'])
  assert(css.includes('#pokemon-dialog '+common)&&css.includes('#box-detail-dialog '+common),
   'missing shared style for '+common);
 assert.doesNotMatch(shared,/localStorage|sessionStorage|setItem|removeItem|box-delete|\.shiny/);
});
test('pre-F2 independent audit: immutable production/STEP2, Box ownership and E7 PWA identity',()=>{
 assert.equal(blob('index.html'),'65d5dc64dc757d24875418bd815983f73f6a9cd0');
 assert.equal(blob('src/simulator.js'),'f32a6ec04b0a89c950b04a3b2364fa95702dbd39');
 const box=text('e7-preview/U4_Box_Preview_20261109_v50_E7.html');
 const plan=text('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(box,/id="box-delete"/);
 assert.doesNotMatch(plan,/id="box-delete"/);
 assert.match(box,/E7BoxDetail\.render\(item\)/);
 assert.match(plan,/PokeE7PokemonDetail\.render\('plan'/);
 assert(text('e7-preview/e7-inventory-scope-v78.js').includes("return PREFIX+week+':'+encodeURIComponent(id)+':timeline';"));
 const m=JSON.parse(text('e7-preview/e7-manifest-v50.webmanifest'));
 assert.equal(m.name,'作戦室');
 assert.equal(m.id,'./U5_Integrated_20261109_v50_E7.html');
 assert.equal(m.icons.filter(i=>i.purpose==='maskable').length,2);
});

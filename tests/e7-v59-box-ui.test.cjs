'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),base=path.join(root,'e7-preview');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
test('E7 v59 retains E7 v58 UI invariants and adds safe compact Box',()=>{
 const box=read('U4_Box_Preview_20261109_v50_E7.html');
 const bridge=read('e7-unified-bridge-v51.js'),sw=read('e7-sw-v50.js');
 const species=read('e7-species-v59.js'),sprites=read('e7-sprites-v59.js');
 assert.match(box,/id="box-registration"/);
 assert.match(box,/id="box-clear">全削除/);
 assert.ok(box.indexOf('id="box-registration"')<box.indexOf('id="box-title"'));
 assert.match(box,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(box,/normalizeSearch\(item.nickname\).startsWith\(q\)/);
 assert.match(box,/normalizeSearch\(item.pokemon\).startsWith\(q\)/);
 assert.match(box,/\.normalize\('NFKC'\)/);
 assert.match(box,/replace\(\/\[ぁ-ゖ\]\/g/);
 assert.match(box,/id="box-detail-dialog"/);
 assert.match(box,/function saveBox\(next\)/);
 assert.match(box,/JSON.stringify\(current\)!==JSON.stringify\(box\)/);
 assert.match(box,/items:box.items.filter\(\(_,i\)=>i!==selectedIndex\)/);
 assert.match(box,/saveBox\(\{\.\.\.box,items:\[\]\}\)/);
 assert.match(box,/getItem\(BOX\)!==encoded/);
 assert.match(bridge,/#u2-week-label\{display:none!important\}/);
 assert.match(bridge,/header.mast \.brand,header.header \.brand/);
 assert.match(sw,/pokesleep-strategy-e7-v81-shared-pokemon-detail/);
 assert.match(sw,/'e7-species-v59\.js','e7-sprites-v59\.js'/);
 assert.match(read('index.html'),/E7 v78/);
 assert.match(sprites,/const COSTUME_BASE=new Map/);
 assert.match(sprites,/VARIANTS.get\(name\)/);
 assert.match(sprites,/COSTUME_BASE.has\(name\)/);
 assert.match(box,/E7BoxDetail.render\(item\)/);
 assert.ok((species.match(/"name":/g)||[]).length>=240);
 assert.match(species,/"name":"ピカチュウ","id":25/);
 for(const [i,source] of [...box.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].entries())
  assert.doesNotThrow(()=>new vm.Script(source[1]),'inline Box script '+i);
 for(const s of [bridge,sw,species,sprites])assert.doesNotThrow(()=>new vm.Script(s));
});
test('E7 v59 actual Chromium acceptance: duplicate deletes and prefix grid', {timeout:120000},()=>{
 require('node:child_process').execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v59.py')],{
  cwd:root,timeout:115000,stdio:'pipe'
 });
});

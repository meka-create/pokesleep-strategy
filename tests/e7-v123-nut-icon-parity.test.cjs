'use strict';
/* E7 v123: visually size nuts consistently across all ingredient icon usages. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=[
 'e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'e7-preview/U3_Strategy_UI_20261109_v50_E7.html',
 'e7-preview/U4_Box_Preview_20261109_v50_E7.html'
];
test('v123 uses exactly one canonical size rule in all three E7 tab frames',()=>{
 const css=read('e7-preview/e7-ingredient-size-v123.css');
 assert.match(css,/img\[src\$="\/ingredient-20\.png"\]/);
 assert.match(css,/transform:\s*scale\(1\.13\)/);
 assert.match(css,/transform-origin:\s*center center/);
 assert.doesNotMatch(css,/ingredient-0[1-9]\.png|ingredient-1[0-9]\.png|width:|height:|aspect-ratio:|grid-template/);
 for(const path of pages){
  const html=read(path);
  const match=html.match(/href="e7-ingredient-size-v123\.css"/g)||[];
  assert.equal(match.length,1,path);
 }
});
test('v123 retains the same nut file in Prep goals, inventory and both details',()=>{
 const prep=read(pages[0]);
 assert.equal((prep.match(/src="assets\/ingredients\/ingredient-20\.png"/g)||[]).length,2);
 assert.match(prep,/id="e7-v94-landscape-food-grid"/);
 assert.match(prep,/aspect-ratio:5 \/ 4/);
 const detail=read('e7-preview/e7-pokemon-detail-shared-v81.js');
 assert.match(detail,/'つやつやアボカド','ひとくちナッツ'/);
 assert.match(detail,/ingredient-'\+String\(i\+1\)\.padStart\(2,'0'\)\+'\.png'/);
 assert.match(detail,/function foodGroup\(doc,foods\)/);
 assert.match(detail,/function render\(mode,data,paintPortrait\)/);
 const style=read('e7-preview/e7-pokemon-detail-shared-v81.css');
 assert.match(style,/#pokemon-dialog \.iv-ingredient-image img,#box-detail-dialog \.iv-ingredient-image img/);
});
test('v123 offline resources include the new stylesheet and rotate only the E7 preview cache',()=>{
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(sw,/v123-nut-size-parity/);
 assert.match(sw,/'e7-ingredient-size-v123\.css'/);
 assert.match(sw,/Array\.from\(\{length:20\}/);
 const expected=fs.readFileSync(path.join(root,'e7-preview/assets/ingredients/ingredient-20.png'));
 const hash=require('node:crypto').createHash('sha1');
 hash.update(Buffer.from('blob '+expected.length+'\0','utf8'));hash.update(expected);
 assert.equal(hash.digest('hex'),'29cd95052c370da268108d319f2017c147517056');
});

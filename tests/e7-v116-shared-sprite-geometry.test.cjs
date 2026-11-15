'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');

test('E7 v116 one canonical sprite-markup contract covers Box, Plan, Sleep and picker',()=>{
 const css=read('e7-preview/e7-pokemon-detail-shared-v81.css');
 const sprite=read('e7-preview/e7-sprites-v59.js');
 const strategy=read('e7-preview/e7-f4c-integrated-v112.js');
 const box=read('e7-preview/U4_Box_Preview_20261109_v50_E7.html');
 const plan=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(sprite,/class="poke-art/);
 assert.match(sprite,/data-sprite-url/);
 assert.match(sprite,/classList\.add\('is-loaded'\)/);
 for(const parent of ['.box-avatar','.avatar','.pick-status','.status-portrait'])
  assert(css.includes(parent),'Missing common PokeSprite image parent '+parent);
 assert.match(css,/> img\[data-sprite-url\]\s*\{/);
 assert.match(css,/object-fit:contain;object-position:center center/);
 assert.match(css,/> \.poke-art\.is-loaded > img\[data-sprite-url\]/);
 assert.match(css,/> \.poke-art\.is-loaded > \.poke-art-fallback/);
 assert.match(strategy,/className='[^']*avatar avatar-tap sprite-stage'|,'avatar avatar-tap sprite-stage'/);
 assert.match(strategy,/,'pick-status sprite-stage'/);
 assert.match(strategy,/node\.innerHTML=root\.PokeSprite\?\.icon\(item\)/);
 for(const html of [box,plan])
  assert.match(html,/href="e7-pokemon-detail-shared-v81\.css"/);
});
test('E7 v116 common and sleep sheet are centered, while approved Box HTML stays pinned',()=>{
 const css=read('e7-preview/e7-pokemon-detail-shared-v81.css');
 const plan=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(css,/inset:auto auto 0 50%/);
 assert.match(css,/transform:translateX\(-50%\)/);
 assert.match(plan,/dialog\.modal:not\(\.pokemon-detail-modal\)\{inset:auto auto 0 50%;margin:0;transform:translateX\(-50%\)/);
 assert(sw.includes('v116-shared-sprites-modal-20261115'));
 assert(sw.includes("'e7-pokemon-detail-shared-v81.css'"));
});

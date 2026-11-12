'use strict';
// Independent E7 pre-F1 release guard: source-code checks, not a substitute
// for Android user acceptance or F1's later real-game model validation.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const html=[
 'index.html',
 'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html',
 'U4_Box_Preview_20261109_v50_E7.html'
];
test('E7 publishing has a single deployment owner; preflight is read-only',()=>{
 const wf=read('.github/workflows/publish-e7-preview.yml');
 assert.match(wf,/^name: Verify E7 preview publication inputs/m);
 assert.match(wf,/^permissions:\s*\n\s+contents:\s+read/m);
 assert.doesNotMatch(wf,/actions\/(?:upload-pages-artifact|deploy-pages|configure-pages)@/);
 assert.doesNotMatch(wf,/^\s+(?:pages|id-token):\s+write/m);
 assert.doesNotMatch(wf,/^\s+(?:cp\s+-R\s+e7-preview|mkdir\s+-p\s+_site)/m);
 assert.match(wf,/node --test tests\/e7-pre-f1-publish-guard\.test\.cjs/);
 assert.match(read('.github/workflows/ci.yml'),/npm run check/);
 assert.match(read('.github/workflows/check.yml'),/npm run check/);
 for(const workflow of ['.github/workflows/ci.yml','.github/workflows/check.yml']){
  const source=read(workflow);
  assert.match(source,/python -m playwright install chromium/);
  assert.doesNotMatch(source,/playwright install --with-deps/);
 }
});
test('E7 offline installation precaches every local script, stylesheet and image',()=>{
 const sw=read('e7-preview/e7-sw-v50.js');
 const icon='icons/icon-header-96.png';
 assert.match(sw,/new URL\(x,self\.registration\.scope\)/);
 assert.match(sw,/\.then\(\(\)=>self\.skipWaiting\(\)\)/);
 assert.match(sw,/caches\.open\(CACHE\)\.then\(cache=>cache\.addAll/);
 assert.match(sw,/\.then\(\(\)=>self\.clients\.claim\(\)\)/);
 assert.match(sw,/icons\/icon-header-96\.png/);
 assert.ok(sw.includes("'e7-inventory-scope-v78.js'"));
 for(const f of html){
  assert(exists('e7-preview/'+f),f);
  assert(sw.includes("'"+f+"'"),'not precached: '+f);
  const s=read('e7-preview/'+f);
  const assets=[...s.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)=["']([^"'#]+)["']/g)]
   .map(m=>m[1]).filter(u=>!/^https?:|^data:|^\//i.test(u));
  for(const u of assets){
   const a=u.split('?')[0];
   if(!a||a==='#')continue;
   const local='e7-preview/'+a;
   assert(exists(local),'not present: '+f+' -> '+a);
   if(a.startsWith('assets/ingredients/'))
    assert.match(sw,/\.\.\.IMAGE_FILES/);
   else assert(sw.includes("'"+a+"'"),'not precached: '+f+' -> '+a);
  }
 }
 for(let i=1;i<=19;i++){
  const icon='assets/ingredients/ingredient-'+String(i).padStart(2,'0')+'.png';
  assert(exists('e7-preview/'+icon),icon);
 }
 assert(exists('e7-preview/'+icon));
});
test('E7 shows one selected event across three tabs, not a Box-only subtitle',()=>{
 const bridge=read('e7-preview/e7-unified-bridge-v51.js');
 const plan=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 assert.match(bridge,/const isEventTab=\/\^U\[234\]_\//);
 assert.match(bridge,/const result=plan\?\.__e7CurrentEventHeader\?\.\(\)/);
 assert.match(bridge,/caption\.textContent=name\|\|'for Pokémon Sleep'/);
 assert.match(bridge,/calendar\.toggleAttribute\('hidden',!name\)/);
 assert.match(plan,/window\.__e7CurrentEventHeader=\(\)=>/);
 assert.match(bridge,/icon\.src='icons\/icon-header-96\.png'/);
 const manifest=JSON.parse(read('e7-preview/e7-manifest-v50.webmanifest'));
 assert.equal(manifest.icons[0].src,'icons/icon-192.png');
});
test('E7 confirms destructive actions with custom UI, not native browser dialogs',()=>{
 for(const file of html.concat('e7-settings-v56.js')){
  const s=read('e7-preview/'+file);
  const native=/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;
  const matches=[...s.matchAll(native)].filter(m=>!s.slice(Math.max(0,m.index-10),m.index).includes('PokeUI.'));
  assert.equal(matches.length,0,'native dialog remains in '+file);
 }
 const feedback=read('e7-preview/e7-feedback-v66.js');
 assert.match(feedback,/function confirm\(message,options=\{\}\)/);
 assert.match(feedback,/if\(active\.type==='confirm'\)cancel\.focus\(\)/);
 assert.match(read('e7-preview/e7-feedback-v66.css'),/bottom:var\(--e7-toast-bottom,1px\)/);
});

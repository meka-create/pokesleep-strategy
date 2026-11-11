'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const names=['U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html',
 'U4_Box_Preview_20261109_v50_E7.html'];
const auditedSHA=['05c20d9d4af870364a45b8c7eabe50ab30c36c92',
 '40eab947173fc5477070e5a5a6dc2c3025b3aeef',
 '9b2774cff0052ba2f03ef61f42ff87b1371ba4ec'];
const gitBlobSHA=text=>{
 const bytes=Buffer.from(text,'utf8');
 return crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0','utf8')).update(bytes).digest('hex');
};
test('E7 v53 midterm preserves production root and records F1–F6 as separate gates',()=>{
 const root=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 assert.equal(gitBlobSHA(root),'65d5dc64dc757d24875418bd815983f73f6a9cd0',
  'Do not silently deploy E7 mock UI over the approved production root');
 const roadmap=fs.readFileSync(path.resolve(__dirname,'../development/ROADMAP_CURRENT.md'),'utf8');
 assert.match(roadmap,/E7 v53/);
 assert.match(roadmap,/F1–F6/);
 assert.match(roadmap,/実ゲーム精度/);
});
test('E7 v51 architecture: one persistent frame per tab, one common footer',()=>{
 const html=read('index.html');
 assert.equal((html.match(/class="view"/g)||[]).length,3);
 assert.equal((html.match(/id="tab-(?:plan|prep|box)"/g)||[]).length,3);
 assert.equal((html.match(/id="tabbar"/g)||[]).length,1);
 assert.match(html,/function activate\(tab/);
 assert.match(html,/function stampFor\(tab\)/);
 assert.match(html,/function setDevClock\(tab,stage\)/);
 assert.match(html,/function resetDev\(tab\)/);
 assert.match(html,/if\(tab!=='box'&&state\[tab\]\.devOpen\)/);
 assert.match(html,/setDevClock\(originTab,event\.data\.stage\)/);
 assert.match(html,/resetDev\(originTab\)/);
 assert.match(html,/grid-template-columns:repeat\(3,1fr\)/);
 for(const x of ['tab-plan','tab-prep','tab-box'])assert.ok(html.includes('id="'+x+'"'));
 assert.match(html,/tab==='box'\?'global-box-v1':stamp\(\)/);
 assert.match(html,/views\[t\]\.hidden=!active/);
 assert.match(html,/if\(!s\.requested\)begin\(tab\)/);
 assert.match(html,/else if\(s\.ready\&\&\(s\.hard\|\|s\.stamp!==next\)\)reload\(tab\)/);
 assert.match(html,/views\[tab\]\.contentWindow\.location\.replace\(urlFor\(tab\)\)/);
 assert.match(html,/requestIdleCallback/);
 assert.match(html,/window\.addEventListener\('popstate'/);
 assert.match(html,/window\.addEventListener\('storage'/);
 assert.match(html,/document\.documentElement\.dataset\.activeTab=tab/);
 assert.doesNotMatch(html,/frame\.src=buildUrl\(tab\)/);
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
test('E7 v59 pins U2/U3 audited bytes and reviewed compact Box with unchanged persistence contract',()=>{
 for(let i=0;i<names.length;i++){
  const s=read(names[i]);
  assert.ok(s.includes('<script src="e7-unified-bridge-v51.js"></script>'));
  assert.equal(gitBlobSHA(s),auditedSHA[i],'Unreviewed change to E7 protected UI: '+names[i]);
  for(const m of s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
   new vm.Script(m[1]);
 }
 const strategy=read(names[1]),box=read(names[2]);
 assert.match(strategy,/__pokesleepE7ResetRevoked/);
 assert.match(strategy,/hasEnteredConditions/);
 assert.match(strategy,/restoredUnmodified/);
 assert.match(box,/const boxOptionalText=/);
 assert.match(box,/function validBox\(v\)/);
});
test('E7 v51 bridge navigates only trusted internal child pages; hides duplicated footer',()=>{
 const s=read('e7-unified-bridge-v51.js');
 assert.match(s,/if\(window\.parent===window\)return/);
 assert.match(s,/#e6-footer\{display:none!important\}/);
 assert.doesNotMatch(s,/#e6-dev\{display:none!important\}/);
 assert.match(s,/const dev=document\.getElementById\('e6-dev'\)/);
 assert.match(s,/event\.target\?\.closest\?\.\('button\[data-e6-stage\],button#e6-reset'\)/);
 assert.match(s,/action:button\.id==='e6-reset'\?'dev-reset':'dev-clock'/);
 assert.match(s,/event\.preventDefault\(\);event\.stopImmediatePropagation\(\)/);
 assert.match(s,/window\.parent\.postMessage\(\{protocol:'pokesleep-e7-v51'/);
 assert.match(s,/window\.addEventListener\('message'/);
 assert.match(s,/e\.origin!==location\.origin\|\|e\.source!==window\.parent/);
 assert.match(s,/new MutationObserver/);
 assert.match(s,/window\.dispatchEvent\(new Event\('pageshow'\)\)/);
 new vm.Script(s);
});
test('E7 v51 manifest uses a persistent app ID with start URL at fast shell',()=>{
 const m=JSON.parse(read('e7-manifest-v50.webmanifest'));
 assert.equal(m.start_url,'./');
 assert.equal(m.scope,'./');
 assert.equal(m.display,'standalone');
 assert.equal(m.id,'./U5_Integrated_20261109_v50_E7.html');
});
test('E7 v51 preview cache updates online and supports offline, independent of production root',()=>{
 const sw=read('e7-sw-v50.js');
 assert.match(sw,/pokesleep-strategy-e7-v63-compact-card-ui/);
 assert.match(sw,/'index\.html'/);
 assert.match(sw,/'e7-unified-bridge-v51\.js'/);
 assert.match(sw,/fetch\(event\.request,\{cache:'no-store'\}\)/);
 assert.match(sw,/cache\.match\(canonical\.href\)\|\|Response\.error\(\)/);
 assert.doesNotMatch(sw,/scope:\s*'\/'/);
 new vm.Script(sw);
 const redirect=read('U5_Integrated_20261109_v50_E7.html');
 assert.match(redirect,/location\.replace\('\.\/'\+location\.search\+location\.hash\)/);
});

test('E7 v52 reset revokes stale event frames before deleting event-week storage',()=>{
 const html=read('index.html');
 const plan=read(names[1]);
 const begin=html.indexOf('function resetDev(tab){');
 const end=html.indexOf('function begin(tab){',begin);
 assert.ok(begin>0&&end>begin);
 const reset=html.slice(begin,end);
 assert.match(reset,/win\.__pokesleepE7ResetRevoked=true/);
 assert.ok(reset.indexOf('win.__pokesleepE7ResetRevoked=true')<
   reset.indexOf('localStorage.removeItem(key)'),'iframe must be revoked before deleting saved plan');
 assert.match(reset,/localStorage\.key\(i\)/);
 assert.match(reset,/for\(const \[key,value\] of saved\)/);
 assert.match(reset,/state\[id\]\.hard=true/);
 assert.match(reset,/activate\('plan',\{fromHistory:true\}\)/);
 assert.match(reset,/url\.searchParams\.delete\(key\)/);
 assert.match(plan,/function storeState\(\)\{\s*\/\/ A developer reset must never be undone/);
 assert.match(plan,/if\(window\.__pokesleepE7ResetRevoked\)return false/);
 assert.match(plan,/window\.addEventListener\('beforeunload',storeState\)/);
});

test('E7 v54 images: 38 placements reuse 19 real external PNGs; no embedded base64',()=>{
 const prep=read(names[0]);
 const entries=[...prep.matchAll(/<img class="pic" src="(assets\/ingredients\/ingredient-\d{2}\.png)" alt="" draggable="false" loading="lazy" decoding="async">/g)];
 assert.equal(entries.length,38,'Both ingredient grids must contain 19 icons');
 const unique=[...new Set(entries.map(x=>x[1]))];
 assert.equal(unique.length,19,'The same icon asset should be reused across both grids');
 assert.doesNotMatch(prep,/data:image\/png;base64,/);
 for(let i=1;i<=19;i++){
  const name='assets/ingredients/ingredient-'+String(i).padStart(2,'0')+'.png';
  assert.ok(unique.includes(name),'Missing icon in source: '+name);
  const png=fs.readFileSync(path.join(base,name));
  assert.ok(png.length>100&&png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),
   'Damaged PNG: '+name);
 }
});
test('E7 v54 first paint: child DOM-ready handshake is generation-guarded and load remains fallback',()=>{
 const shell=read('index.html'),bridge=read('e7-unified-bridge-v51.js'),sw=read('e7-sw-v50.js');
 assert.match(shell,/function finishReady\(tab,href,via\)/);
 assert.match(shell,/interactive-ready/);
 assert.match(shell,/target\.searchParams\.get\('e7Doc'\)!==String\(s\.loads\)/);
 assert.match(shell,/url\.searchParams\.set\('e7Doc',String\(state\[tab\]\.loads\)\)/);
 assert.match(shell,/document\.documentElement\.dataset\.e7ReadyVia=via/);
 assert.match(bridge,/addEventListener\('DOMContentLoaded',announceInteractive/);
 assert.match(bridge,/action:'interactive-ready'/);
 assert.match(sw,/\.\.\.IMAGE_FILES/);
 assert.match(sw,/if\(imageUrls\.has\(canonical\.href\)\)/);
 assert.match(sw,/canonical\.href===self\.registration\.scope/);
 assert.match(sw,/canonical\.href=new URL\('index\.html',self\.registration\.scope\)\.href/);
 assert.match(sw,/cache\.match\(canonical\.href\)/);
});

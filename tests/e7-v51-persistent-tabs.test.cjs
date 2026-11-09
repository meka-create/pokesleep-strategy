'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const names=['U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html',
 'U4_Box_Preview_20261109_v50_E7.html'];
const auditedSHA=['3132baa909da049a053740153ca83e2ae4ec417e',
 '6854930024c111acffc01da0094b0d3151746adc',
 'f44094d0936f09aec53f932454c6b5cd73b1374a'];
const gitBlobSHA=text=>{
 const bytes=Buffer.from(text,'utf8');
 return crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0','utf8')).update(bytes).digest('hex');
};
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
test('E7 v53 audit pins exact U2/U3/U4 source bytes, including reset and box safety fixes',()=>{
 for(let i=0;i<names.length;i++){
  const s=read(names[i]);
  assert.ok(s.includes('<script src="e7-unified-bridge-v51.js"></script>'));
  assert.equal(gitBlobSHA(s),auditedSHA[i],'Unreviewed change to E7 protected UI: '+names[i]);
  for(const m of s.matchAll(/<script(?:[^>]*)>([\\s\\S]*?)<\\/script>/g))
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
 assert.match(sw,/pokesleep-strategy-e7-v52-reset/);
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

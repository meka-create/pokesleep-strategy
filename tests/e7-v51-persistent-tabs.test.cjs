'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const base=path.resolve(__dirname,'../e7-preview');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const names=['U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html',
 'U4_Box_Preview_20261109_v50_E7.html'];
const oldSHA=['0f03f3cee68c7b60631c69d30957ed9daa0fc6ad',
 '03988efbc1e2ddf27c6c61290bb68d3e34e15281',
 '328a5b9e2d6e0605105e175de6b7f3dd275925da'];
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
test('E7 v51 U2/U3/U4 protected: no byte changes beyond version labels and bridge entrypoint',()=>{
 for(let i=0;i<names.length;i++){
  let s=read(names[i]);
  assert.ok(s.includes('<script src="e7-unified-bridge-v51.js"></script>'));
  s=s.replace('<script src="e7-unified-bridge-v51.js"></script>',
   '<script src="e7-unified-bridge-v50.js"></script>');
  if(i===0)s=s.replace('<title>ポケスリ作戦室 U2 v51',
                         '<title>ポケスリ作戦室 U2 v50');
  if(i===1){
   s=s.replace('<title>ポケスリ作戦室 U3 v51',
               '<title>ポケスリ作戦室 U3 v50');
   s=s.replace('<span class="mock-tag">U3 v51 / E7</span>',
               '<span class="mock-tag">U3 v50 / E7</span>');
  }
  if(i===2){
   s=s.replace('<title>ポケスリ作戦室 U4 v51',
               '<title>ポケスリ作戦室 U4 v50');
   s=s.replace('U4 / E7 v51</span>','U4 / E7 v50</span>');
  }
  assert.equal(gitBlobSHA(s),oldSHA[i],'Changed protected UI source: '+names[i]);
 }
});
test('E7 v51 bridge navigates only trusted internal child pages; hides duplicated footer',()=>{
 const s=read('e7-unified-bridge-v51.js');
 assert.match(s,/if\(window\.parent===window\)return/);
 assert.match(s,/#e6-footer\{display:none!important\}/);
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
 assert.match(sw,/pokesleep-strategy-e7-v51/);
 assert.match(sw,/'index\.html'/);
 assert.match(sw,/'e7-unified-bridge-v51\.js'/);
 assert.match(sw,/fetch\(event\.request,\{cache:'no-store'\}\)/);
 assert.match(sw,/cache\.match\(canonical\.href\)\|\|Response\.error\(\)/);
 assert.doesNotMatch(sw,/scope:\s*'\/'/);
 new vm.Script(sw);
 const redirect=read('U5_Integrated_20261109_v50_E7.html');
 assert.match(redirect,/location\.replace\('\.\/'\+location\.search\+location\.hash\)/);
});

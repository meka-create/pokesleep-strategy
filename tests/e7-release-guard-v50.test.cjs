'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=["U5_Integrated_20261109_v50_E7.html","U2_Prep_Local_Ingredients_20261109_v50_E7.html","U3_Strategy_UI_20261109_v50_E7.html","U4_Box_Preview_20261109_v50_E7.html","e7-box-csv-v50.js","e7-unified-bridge-v50.js","e7-manifest-v50.webmanifest","e7-sw-v50.js","e7-icon-v50.svg"];
const zip=path.join(root,'deliverables','PokeSleep_Strategy_E7_v50_ONLY_20261109.zip');
test('E7 version-locked ZIP has only README and all v50 app assets, byte-for-byte',{timeout:15000},()=>{
 const listing=execFileSync('unzip',['-Z','-1',zip],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/);
 assert.deepEqual(listing,['00_README_START_HERE.txt',...names]);
 for(const name of listing){
  const data=execFileSync('unzip',['-p',zip,name],{maxBuffer:3_000_000,timeout:10000});
  if(name===listing[0])assert.match(data.toString('utf8'),/E7 v50/);
  else assert.ok(data.equals(fs.readFileSync(path.join(root,'previews',name))),'stale/mismatched ZIP: '+name);
 }
});
test('E7 SW and manifest are scoped to preview folder, not production',()=>{
 const script=fs.readFileSync(path.join(root,'previews','e7-sw-v50.js'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'previews','e7-manifest-v50.webmanifest'),'utf8'));
 assert.equal(manifest.scope,'./');
 assert.match(manifest.start_url,/U5_Integrated_20261109_v50_E7\.html/);
 assert.match(script,/canonical\.search=''/);
 assert.match(script,/pokesleep-strategy-e7-v50/);
 for(const name of names)if(name!=='e7-sw-v50.js')assert.ok(script.includes(name)||name==='e7-icon-v50.svg');
});

test('E7 preview SW fetches online assets before using offline cache (avoid stale v50)',()=>{
 const script=fs.readFileSync(path.join(root,'previews','e7-sw-v50.js'),'utf8');
 const network=script.indexOf("fetch(event.request,{cache:'no-store'})");
 const fallback=script.indexOf('cache.match(canonical.href)');
 assert.ok(network>0&&fallback>network,'network-first then offline fallback is required');
 assert.match(script,/if\(response\.ok\)await cache\.put\(canonical\.href,response\.clone\(\)\)/);
});

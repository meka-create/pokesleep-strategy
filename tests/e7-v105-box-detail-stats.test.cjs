'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const css=read('e7-preview/e7-pokemon-detail-shared-v81.css');
const box=read('e7-preview/U4_Box_Preview_20261109_v50_E7.html');
const js=read('e7-preview/e7-box-individual-stats-v105.js');
test('v105 dialog equal inset, no close row spacer, reset scroll',()=>{
 assert.match(css,/padding:15px 15px 23px/);
 assert.match(css,/position:absolute;top:15px;right:15px;z-index:2/);
 assert.match(css,/padding-top:5px;padding-right:68px/);
 assert.match(box,/detail\.showModal\(\);detail\.scrollTop=0/);
});
test('v105 source order, offline assets and read-only isolation',()=>{
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(sw,/'e7-box-individual-stats-v105.js'/);
 assert(box.indexOf('../f1/f1-b-legal-build-v2.js')<box.indexOf('e7-box-individual-stats-v105.js'));
 assert(box.indexOf('e7-box-individual-stats-v105.js')<box.indexOf('e7-box-detail-v60.js'));
 assert.doesNotMatch(js,/localStorage|sessionStorage|setItem|removeItem|sendBeacon/);
 assert.match(read('e7-preview/e7-box-detail-v60.js'),/PokeE7BoxStats\.calculate\(item\)/);
 new vm.Script(js);new vm.Script(read('e7-preview/e7-box-detail-v60.js'));
});
test('v105 real F1-B 60-level Blastoise, incomplete CSV and out-of-scope cases',async()=>{
 const snapshot=require('../f1/f1-b-target-source-v1.json');
 const traits=require('../f1/f1-b-help-traits-v1.json');
 const load=relative=>{
  const ctx={module:{exports:{}},globalThis:{},
   require:dep=>dep==='./f1-b-legal-build-v2.js'?load('f1/f1-b-legal-build-v2.js'):
    (()=>{throw Error('Unexpected dependency '+dep);})()};
  vm.runInNewContext(read(relative),ctx,{filename:relative});
  return ctx.module.exports;
 };
 const rates=load('f1/f1-b-base-rates-v1.js');
 const legal=load('f1/f1-b-legal-build-v2.js');
 const sandbox={window:{PokeF1BaseRates:rates,PokeF1LegalBuild:legal,
  fetch:async url=>({ok:true,json:async()=>url.includes('target-source')?snapshot:traits})}};
 vm.runInNewContext(js,sandbox);
 const row={pokemon:'カメックス',nickname:'テスト',level:60,skillLevel:5,
  ing1:'モーモーミルク',ing2:'モーモーミルク',ing3:'モーモーミルク',
  mainSkill:'食材ゲットS',nature:'がんばりや',mint:false,ribbon:500,
  lv10:'おてつだいスピードM',lv25:'最大所持数アップL',
  lv50:'おてつだいスピードS',lv70:'スキル確率アップM',lv80:'食材確率アップS'};
 const expected=rates.evaluate(row,snapshot,traits,{goodCamp:false,teammateHelpingBonusCount:0});
 assert.notEqual(expected.status,'BLOCKED');
 const actual=await sandbox.window.PokeE7BoxStats.calculate(row);
 assert.equal(actual.state,'F1_REFERENCE');
 assert.equal(actual.carry,String(expected.carryLimit)+'（参考）');
 assert.equal(actual.helpTime,sandbox.window.PokeE7BoxStats.duration(expected.referenceHelpSeconds)+'（参考）');
 const missing=await sandbox.window.PokeE7BoxStats.calculate({...row,mint:null,ribbon:null});
 assert.equal(missing.state,'SPECIES_BASE_ONLY');assert.equal(missing.carry,'17（種族基礎）');
 const unknown=await sandbox.window.PokeE7BoxStats.calculate({...row,pokemon:'未対象フォーム'});
 assert.equal(unknown.state,'OUT_OF_SCOPE');
});

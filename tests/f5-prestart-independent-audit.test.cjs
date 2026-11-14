'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const snapshot=require('../f1/f1-b-target-source-v1.json');
const source=read('f1/f1-b-target-source-v1.json');
const audit=read('development/F1_B_TARGET_DATA_AUDIT_20261113.md');
const privacyFields=['sourceFileSHA256'];
test('F5 prestart: public F1 sources never contain source CSV file fingerprint',()=>{
 for(const p of privacyFields){
  assert(!Object.hasOwn(snapshot.initialInput,p));
  assert(!source.includes(p));
  assert(!audit.includes(p));
 }
 assert.equal(snapshot.initialInput.rowCount,69);
 assert.equal(snapshot.initialInput.distinctSpeciesForms,66);
 assert.equal(snapshot.targets.length,66);
 assert.match(snapshot.upstream.commit,/^[0-9a-f]{40}$/);
 assert.match(snapshot.upstream.pokemonJson.gitBlob,/^[0-9a-f]{40}$/);
 assert.doesNotMatch(audit,/ユーザー元CSVの SHA-256：/);
 assert.doesNotMatch(audit,/box202611130136\.csv/);
});
test('F5 prestart: pinned upstream provenance still protects the full 66-form profile',()=>{
 const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read('f1/f1-b-legal-build-v2.js'),box);
 const legal=box.module.exports;
 assert.equal(legal.validateSource(snapshot).size,66);
 const bad=structuredClone(snapshot);
 bad.upstream.pokemonJson.gitBlob='f'.repeat(40);
 assert.throws(()=>legal.validateSource(bad),e=>e.code==='PROVENANCE');
 const badCount=structuredClone(snapshot);
 badCount.targets.pop();
 assert.throws(()=>legal.validateSource(badCount),e=>e.code==='PROVENANCE');
});
test('F5 prestart: immutable 04:00/29-window boundaries and no premature formal adoption',()=>{
 const box={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(read('f4/f4-b-game-week-v1.js'),box);
 const week=box.module.exports.build('2026-11-16','2026-11-18T13:00:00+09:00');
 assert.equal(week.status,'TIMELINE_READY');assert.equal(week.windowCount,29);
 assert.equal(week.totalHours,168);
 assert.equal(week.windows[0].source,'PREVIOUS_WEEK_SLEEP');
 assert.equal(week.windows[0].hours,3.5);
 assert.equal(week.windows.at(-1).hours,4);
 const release=read('f4/f4-c-banquet-release-v103.js');
 assert.match(release,/const PINNED_RELEASE_SHA=null/);
 const local=read('f4/f4-c-local-draft-v104.js');
 assert.match(local,/officialPlanAdopted:false,weeklyEnergyCertified:false/);
 assert.doesNotMatch(read('e7-preview/index.html'),/f4-c-local-draft-v104\.js/);
 assert.doesNotMatch(read('index.html'),/f4-c-local-draft-v104\.js/);
});

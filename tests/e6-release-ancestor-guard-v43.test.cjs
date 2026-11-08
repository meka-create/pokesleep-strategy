'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=[
 'U2_Prep_Local_Ingredients_20261108_v43_E6.html',
 'U3_Strategy_UI_20261108_v43_E6.html',
 'U4_Box_Preview_20261108_v43_E6.html'
];
const packagePath=path.join(root,'deliverables','PokeSleep_Strategy_E6_v43_ONLY_20261108.zip');
const payloads=names.map(n=>({name:n,data:fs.readFileSync(path.join(root,'previews',n))}));

test('E6 delivery: ZIP contains only exact current v43 files and one README; never older previews',{timeout:15000},()=>{
 // Read the central directory through the platform ZIP validator rather than
 // an ad-hoc parser. unzip verifies offsets and CRC while -p yields exact bytes.
 const listing=execFileSync('unzip',['-Z','-1',packagePath],{encoding:'utf8',timeout:10000});
 const observed=listing.trim().split(/\r?\n/);
 assert.deepEqual(observed,['00_README_START_HERE.txt',...names],'no ancestor files and no unrelated repository payloads');
 for(const name of observed){
  const entry=execFileSync('unzip',['-p',packagePath,name],{timeout:10000,maxBuffer:2_500_000});
  if(name==='00_README_START_HERE.txt'){
   assert.match(entry.toString('utf8'),/v43/);
   assert.match(entry.toString('utf8'),/旧v42版のHTMLと混ぜず/);
  }else{
   const expected=payloads.find(p=>p.name===name);
   assert.ok(expected,'unapproved or ancestor filename in ZIP: '+name);
   assert.ok(entry.equals(expected.data),'ZIP source mismatch: '+name);
  }
 }
 for(const payload of payloads){
  const s=payload.data.toString('utf8');
  for(const n of names)assert.ok(s.includes(n),'mixed-version navigation: '+payload.name+' => '+n);
  assert.doesNotMatch(s,/U[234]_[^"']*2026110(?:7_v40|8_v4[012])_E6\.html/);
  assert.doesNotMatch(s,/<small>(?:当日編成|目標・在庫|個体管理)<\/small>/);
  const htmlTitle=s.slice(s.indexOf('<title>'),s.indexOf('</title>')+8);
  assert.ok(htmlTitle.includes('v43'),'browser title must identify current v43: '+payload.name);
  assert.ok(!/v(?:24|29|30|33|39|40|41|42)/.test(htmlTitle),'ancestor browser title: '+payload.name);
 }
});

test('E6 event stockpile has precisely one editor in U2, not a hidden ancestor editor in U3',()=>{
 const u2=payloads[0].data.toString('utf8'),u3=payloads[1].data.toString('utf8');
 assert.match(u2,/id="e6-prep-category-card"/);
 assert.match(u2,/data-stock-count="3"/);
 assert.match(u2,/data-stock-count="2"/);
 assert.match(u2,/data-stock-count="1"/);
 assert.match(u2,/id="e6-prep-save"/);
 assert.match(u2,/pokesleep-strategy-u2-e6-prep-v1:/);
 assert.match(u3,/function importPrepFromU2\(\)/);
 assert.match(u3,/importPrepFromU2\(\);\s*const nextSource/);
 assert.match(u3,/const prep=sameEvent\?normalizePrep\(eventInfo\.prep\):readEventPrep\(nextSource,d\)/);
 assert.doesNotMatch(u3,/class="field wide e6-stock-config"/);
 assert.doesNotMatch(u3,/\bprepDraft\b|\bcheckedPrep\b|\brenderPrep\s*\(/);
 assert.doesNotMatch(u3,/querySelectorAll\('\[data-stock-count\]'\)/);
});

test('E6 latest explicitly approved UI rules remain mandatory in all future ZIPs',()=>{
 const u2=payloads[0].data.toString('utf8'),u3=payloads[1].data.toString('utf8');
 assert.ok(u2.indexOf('class="grid goal-grid"')<u2.indexOf('id="e6-prep-category-card"'));
 assert.ok(u2.indexOf('id="e6-prep-category-card"')<u2.indexOf('<section id="inventory-panel"'));
 assert.match(u3,/>好みのきのみ<\/span>/);
 assert.doesNotMatch(u3,/好みのきのみ（タイプ）|<label>[①②③]<select/);
 for(const n of ['e6-berry-main','e6-berry-sub1','e6-berry-sub2'])assert.match(u3,new RegExp(n+'\\x27,\\x27好みのきのみ'));
 assert.match(u3,/data-berry-type/);
 assert.match(u3,/main\.dataset\.hasProposed=String\(hasProposed\)/);
 assert.match(u3,/const nodes=\[primary,week,sleep,conditions,actions,intro\]/);
 assert.match(u3,/function resolveE6PrimaryAction\(/);
 assert.match(u3,/function e6DraftProblems\(\)/);
 assert.match(u3,/footerPlan\.dataset\.reproposal=String\(action==='REPROPOSE'\)/);
 for(const s of [u2,u3,payloads[2].data.toString('utf8')]){
  assert.match(s,/#e6-footer-plan\[data-reproposal="true"\]::after/);
  assert.match(s,/function refreshReproposalDot\(\)/);
 }
 assert.match(u3,/<option value="all">すべて<\/option>/);
 assert.match(u3,/id="e6-ex-effect"/);
 assert.match(u3,/const CLOCKS=\{prep:dateAt\(-1,'16:00'\),start:dateAt\(0,'06:00'\)/);
});

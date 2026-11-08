'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=[
 'U2_Prep_Local_Ingredients_20261108_v41_E6.html',
 'U3_Strategy_UI_20261108_v41_E6.html',
 'U4_Box_Preview_20261108_v41_E6.html'
];
const packagePath=path.join(root,'deliverables','PokeSleep_Strategy_E6_v41_ONLY_20261108.zip');
const payloads=names.map(n=>({name:n,data:fs.readFileSync(path.join(root,'previews',n))}));

test('E6 delivery: ZIP contains only exact current v41 files and one README; never older previews',{timeout:15000},()=>{
 const zip=fs.readFileSync(packagePath);
 const eocd=zip.length-22;
 assert.equal(zip.readUInt32LE(eocd),0x06054b50,'ZIP end-of-central-directory');
 const count=zip.readUInt16LE(eocd+10);
 assert.equal(count,names.length+1,'no unrelated files or legacy previews');
 let cur=zip.readUInt32LE(eocd+16);
 const observed=[];
 for(let i=0;i<count;i++){
  assert.equal(zip.readUInt32LE(cur),0x02014b50,'central directory header');
  const method=zip.readUInt16LE(cur+10);
  assert.equal(method,0,'uncompressed archive keeps exact source HTML');
  const nlen=zip.readUInt16LE(cur+28),elen=zip.readUInt16LE(cur+30),clen=zip.readUInt16LE(cur+32);
  const name=zip.subarray(cur+46,cur+46+nlen).toString('utf8');
  const dataSize=zip.readUInt32LE(cur+24),localOffset=zip.readUInt32LE(cur+42);
  assert.equal(zip.readUInt32LE(localOffset),0x04034b50,'local header');
  const dataOffset=localOffset+30+zip.readUInt16LE(localOffset+26)+zip.readUInt16LE(localOffset+28);
  const entry=zip.subarray(dataOffset,dataOffset+dataSize);
  observed.push(name);
  if(name==='00_README_START_HERE.txt'){
   assert.match(entry.toString('utf8'),/v41/);
   assert.match(entry.toString('utf8'),/旧版HTMLやGitHub全体は含みません/);
  }else{
   const expected=payloads.find(p=>p.name===name);
   assert.ok(expected,'unapproved or ancestor filename in ZIP: '+name);
   assert.ok(entry.equals(expected.data),'ZIP source mismatch: '+name);
  }
  cur+=46+nlen+elen+clen;
 }
 assert.deepEqual(observed,['00_README_START_HERE.txt',...names]);
 for(const payload of payloads){
  const s=payload.data.toString('utf8');
  for(const n of names)assert.ok(s.includes(n),'mixed-version navigation: '+payload.name+' => '+n);
  assert.doesNotMatch(s,/U[234]_[^"']*20261107_v40_E6\.html/);
  assert.doesNotMatch(s,/<small>(?:当日編成|目標・在庫|個体管理)<\/small>/);
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
 assert.match(u3,/const nodes=stage==='start'\?\[conditions,actions,sleep,week,intro\]:\s*\[week,sleep,actions,conditions,intro\]/);
 assert.match(u3,/earlyReady=state\.phase==='BEFORE'&&canPlanNow\(\)/);
 assert.match(u3,/<option value="all">すべて<\/option>/);
 assert.match(u3,/id="e6-ex-effect"/);
 assert.match(u3,/const CLOCKS=\{prep:dateAt\(-1,'16:00'\),start:dateAt\(0,'06:00'\)/);
});

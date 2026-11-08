'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=['U2_Prep_Local_Ingredients_20261108_v44_E6.html','U3_Strategy_UI_20261108_v44_E6.html','U4_Box_Preview_20261108_v44_E6.html'];
const archive=path.join(root,'deliverables','PokeSleep_Strategy_E6_v44_ONLY_20261108.zip');
test('v44 only: exact ZIP sources, no unrelated ancestor previews',()=>{
 const entries=execFileSync('unzip',['-Z','-1',archive],{encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(entries,['00_README_START_HERE.txt',...names]);
 for(const n of entries){
  const file=execFileSync('unzip',['-p',archive,n],{maxBuffer:2_500_000});
  if(n===entries[0])assert.match(file.toString('utf8'),/v44/);
  else assert.ok(file.equals(fs.readFileSync(path.join(root,'previews',n))),'stale ZIP '+n);
 }
});

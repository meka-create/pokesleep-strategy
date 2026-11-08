'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=['U2_Prep_Local_Ingredients_20261108_v46_E6.html',
'U3_Strategy_UI_20261108_v46_E6.html','U4_Box_Preview_20261108_v46_E6.html'];
const archive=path.join(root,'deliverables','PokeSleep_Strategy_E6_v46_ONLY_20261108.zip');
test('E6 v46 ZIP contains only current exact HTML bytes and README',{timeout:15000},()=>{
 const actual=execFileSync('unzip',['-Z','-1',archive],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/);
 assert.deepEqual(actual,['00_README_START_HERE.txt',...names]);
 for(const n of actual){
  const bytes=execFileSync('unzip',['-p',archive,n],{maxBuffer:2500000,timeout:10000});
  if(n===actual[0])assert.match(bytes.toString('utf8'),/v46/);
  else assert.ok(bytes.equals(fs.readFileSync(path.join(root,'previews',n))),'stale ZIP '+n);
 }
});

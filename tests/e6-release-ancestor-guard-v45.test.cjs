'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=['U2_Prep_Local_Ingredients_20261108_v45_E6.html',
'U3_Strategy_UI_20261108_v45_E6.html','U4_Box_Preview_20261108_v45_E6.html'];
const archive=path.join(root,'deliverables','PokeSleep_Strategy_E6_v45_ONLY_20261108.zip');
test('v45 ZIP contains only three byte-identical HTMLs and README',{timeout:15000},()=>{
 const list=execFileSync('unzip',['-Z','-1',archive],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/);
 assert.deepEqual(list,['00_README_START_HERE.txt',...names]);
 for(const name of list){
  const contents=execFileSync('unzip',['-p',archive,name],{maxBuffer:2500000,timeout:10000});
  if(name===list[0])assert.match(contents.toString('utf8'),/v45/);
  else assert.ok(contents.equals(fs.readFileSync(path.join(root,'previews',name))),'stale ZIP: '+name);
 }
});

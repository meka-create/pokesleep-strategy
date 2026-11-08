'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=['U2_Prep_Local_Ingredients_20261109_v48_E6.html',
'U3_Strategy_UI_20261109_v48_E6.html','U4_Box_Preview_20261109_v48_E6.html'];
const bundle=path.join(root,'deliverables','PokeSleep_Strategy_E6_v48_ONLY_20261109.zip');
test('v48 ZIP contains exact three updated HTMLs and README only',{timeout:15000},()=>{
 const entries=execFileSync('unzip',['-Z','-1',bundle],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/);
 assert.deepEqual(entries,['00_README_START_HERE.txt',...names]);
 for(const name of entries){
  const bytes=execFileSync('unzip',['-p',bundle,name],{maxBuffer:2500000,timeout:10000});
  if(name===entries[0])assert.match(bytes.toString('utf8'),/v48/);
  else assert.ok(bytes.equals(fs.readFileSync(path.join(root,'previews',name))),'stale ZIP '+name);
 }
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const names=['U2_Prep_Local_Ingredients_20261109_v47_E6.html','U3_Strategy_UI_20261109_v47_E6.html','U4_Box_Preview_20261109_v47_E6.html'];
const artifact=path.join(root,'deliverables','PokeSleep_Strategy_E6_v47_ONLY_20261109.zip');
test('E6 v47 ZIP is exactly current three HTMLs + readme, byte for byte',()=>{
 const listing=execFileSync('unzip',['-Z','-1',artifact],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/);
 assert.deepEqual(listing,['00_README_START_HERE.txt',...names]);
 for(const name of listing){
  const bytes=execFileSync('unzip',['-p',artifact,name],{maxBuffer:2500000,timeout:10000});
  if(name===listing[0])assert.match(bytes.toString('utf8'),/v47/);
  else assert.ok(bytes.equals(fs.readFileSync(path.join(root,'previews',name))),'stale ZIP '+name);
 }
});

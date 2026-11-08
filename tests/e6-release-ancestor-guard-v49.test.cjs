'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),names=["U2_Prep_Local_Ingredients_20261109_v49_E6.html","U3_Strategy_UI_20261109_v49_E6.html","U4_Box_Preview_20261109_v49_E6.html"];
const zip=path.join(root,'deliverables','PokeSleep_Strategy_E6_v49_ONLY_20261109.zip');
test('v49 dedicated ZIP contains README and only exact current previews',{timeout:15000},()=>{
 const entries=execFileSync('unzip',['-Z','-1',zip],{encoding:'utf8',timeout:10000}).trim().split(/\r?\n/);
 assert.deepEqual(entries,['00_README_START_HERE.txt',...names]);
 for(const name of entries){
  const data=execFileSync('unzip',['-p',zip,name],{maxBuffer:2600000,timeout:10000});
  if(name===entries[0])assert.match(data.toString('utf8'),/v49/);
  else assert.ok(data.equals(fs.readFileSync(path.join(root,'previews',name))),'ZIP stale '+name);
 }
});

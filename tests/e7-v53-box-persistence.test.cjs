'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../e7-preview/U4_Box_Preview_20261109_v50_E7.html'),'utf8');
const start=html.indexOf(' const boxKeys=[');
const end=html.indexOf(' let player,box,blocked=',start);
assert.ok(start>0&&end>start,'U4 validator location changed; review test before proceeding');
const validate=vm.runInNewContext('(()=>{'+html.slice(start,end)+';return validBox;})()');
const seed=()=>Object.assign(Object.fromEntries([
 'nickname','pokemon','level','skillLevel','ing1','ing2','ing3','mainSkill',
 'nature','mint','lv10','lv25','lv50','lv70','lv80','ribbon','shiny','favorite'
].map(key=>[key,null])),{
 nickname:'試験個体',pokemon:'ピカチュウ',level:50,skillLevel:5,nature:'いじっぱり',
 ing1:'とくせんリンゴ',ing2:'あったかジンジャー',ing3:'とくせんリンゴ',
 mainSkill:'エナジーチャージS',lv10:'きのみの数S',mint:null,shiny:false,ribbon:500,favorite:'💛'
});
test('E7 box saved-record validator rejects data types that CSV importer never emits',()=>{
 const good=seed();
 assert.equal(validate({version:1,items:[good]}),true);
 const cases=[
  {...good,nickname:{unexpected:true}},
  {...good,favorite:['💛']},
  {...good,lv70:15},
  {...good,ing1:{name:'とくせんリンゴ'}},
  {...good,mint:'true'},
  {...good,shiny:1},
  {...good,ribbon:-1},
  {...good,nature:''},
  {...good,level:150.5}
 ];
 for(const [index,item] of cases.entries())
  assert.equal(validate({version:1,items:[item]}),false,'Malformed persisted item accepted, case '+index);
});

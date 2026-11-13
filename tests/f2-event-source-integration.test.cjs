'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context=vm.createContext({window:{},Date,AbortController,setTimeout,clearTimeout,URL});
vm.runInContext(read('e7-preview/e7-f2-event-catalog-v1.js'),context);
const F2=context.window.PokeE7F2Catalog;
const data={
 bonus:[
  {name:'bountiful banquet week vol1',start:'2026-11-16T04:00:00',end:'2026-11-23T04:00:00',
   target:{specialty:'Ingredients'},effects:{extraIng:'nuts',ingredient:1,carryLimitAdd:10}},
  {name:'dream shard week 3',start:'2026-11-23T04:00:00',end:'2026-11-30T04:00:00',
   target:{},effects:{skillTrigger:1.25,dreamShard:1.5}},
  {name:'super skill week part 3',start:'2026-01-19T04:00:00',end:'2026-01-26T04:00:00',
   target:{specialty:'Skills'},effects:{skillTrigger:1.5,skillLevel:3}}
 ],
 drowsy:[{name:'GSD',day:'2026-11-23',bonus:1.5},{name:'GSD',day:'2026-11-24',bonus:3}]
};
const lang={events:{
 'bountiful banquet week vol1':'なんでもペロリ！ごちそうウィーク vol.1',
 'dream shard week 3':'ゆめのかけらGETウィーク vol.3',
 'super skill week part 3':'$t(events.super skill week) vol.3',
 'super skill week':'連発！スキルウィーク'
}};
const SHA='a'.repeat(40);
const mirror=v=>JSON.parse(JSON.stringify(v));
const catalog=()=>mirror(F2.prepare(data,lang,{revision:SHA,checkedAt:'2026-11-13T10:00:00Z'}));
const store=()=>{const map=new Map([['pokesleep-strategy-u3-e3-v1:selected','PRIVATE'],
 ['pokesleep-strategy-u3-e3-v1:2026-11-16:event:conditions','PROTECTED']]);
 return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const responder=(up,ja,s=SHA)=>(url)=>{
 if(url===F2.API)return Promise.resolve({ok:true,text:async()=>JSON.stringify({sha:s})});
 if(url.endsWith('/'+F2.DATA))return Promise.resolve({ok:true,text:async()=>JSON.stringify(up)});
 if(url.endsWith('/'+F2.LANG))return Promise.resolve({ok:true,text:async()=>JSON.stringify(ja)});
 throw Error('Unexpected fetch URL '+url);
};
test('F2: source-pinned bilingual import validates 7-day JST and keeps daily drowsy separate',()=>{
 const result=catalog();
 assert.equal(result.bonus.length,3);assert.equal(result.drowsy.length,2);
 assert.equal(result.bonus[0].name,'super skill week part 3');
 assert.equal(result.translations['super skill week part 3'],'連発！スキルウィーク vol.3');
 const out=mirror(F2.candidate(result.bonus.find(e=>e.name==='dream shard week 3'),result));
 assert.equal(out.id,'pokesleep-tool:dream shard week 3:2026-11-23');
 assert.equal(out.eligibleFields,null);
 assert.deepEqual(out.dailyDrowsy.map(x=>x.bonus),[1.5,3]);
 assert.deepEqual(out.verifiedEffects,{skillTrigger:1.25,dreamShard:1.5});
 assert.match(out.bonus,/スキル発生率/);
 assert.doesNotMatch(out.bonus,/ねむけパワー/);
 const meal=mirror(F2.candidate(result.bonus.find(e=>e.name==='bountiful banquet week vol1'),result));
 assert.equal(meal.foodAll,true);assert.equal(meal.unknownEffects,true);
 assert.equal(meal.verifiedTarget.specialty,'Ingredients');
});
test('F2: quarantine 6/14/backwards/offset/seconds/shape/translation anomalies without losing normal events',()=>{
 const wrong=[
  {...data.bonus[0],end:'2026-11-22T04:00:00'},
  {...data.bonus[0],end:'2026-11-30T04:00:00'},
  {...data.bonus[0],end:'2026-11-09T04:00:00'},
  {...data.bonus[0],start:'2026-11-16T04:00:00+00:00'},
  {...data.bonus[0],start:'2026-11-16T04:00:30'},
  {...data.bonus[0],effects:null},
  {...data.bonus[0],target:{specialty:'Unknown'}},
  {...data.bonus[0],effects:{skillTrigger:-1}},
  {...data.bonus[0],effects:{fixedBerries:['ghost','ghost',null]}},
  {...data.bonus[0],name:'untranslated event'}
 ];
 const result=mirror(F2.prepare({bonus:[data.bonus[1],...wrong],drowsy:[
  ...data.drowsy,{name:'GSD',day:'2026-11-24',bonus:-2}]},lang,{revision:SHA}));
 assert.equal(result.bonus.length,1);
 assert.equal(result.invalidCount,11);
 assert.equal(result.drowsy.length,2);
 assert.throws(()=>F2.prepare({bonus:[],drowsy:[]},lang,{revision:SHA}),/No valid/);
 assert.throws(()=>F2.prepare({bonus:data.bonus},lang,{revision:SHA}),/schema/);
});
test('F2: fixed berries preserve null slots; area indices are not promoted to confirmed field',()=>{
 const row={...data.bonus[0],effects:{fixedBerries:['ghost',null,null],fixedAreas:[0,7]}};
 const got=mirror(F2.candidate(row,F2.prepare({bonus:[row],drowsy:[]},lang,{revision:SHA})));
 assert.deepEqual(got.verifiedEffects.fixedBerries,['ghost',null,null]);
 assert.equal(got.eligibleFields,null);
 assert.equal(got.changesBerries,true);
 assert.equal(got.unknownEffects,true);
});
test('F2: pinned same-commit fetch persists only public catalog; readback validates LKG',async()=>{
 const storage=store();
 const got=mirror(await F2.refresh({fetchImpl:responder(data,lang),storage,timeoutMs:1500,nowISO:'2026-11-13T10:00:00Z'}));
 assert.equal(got.revision,SHA);
 assert.equal(got.bonus.length,3);
 assert.equal(storage.map.get('pokesleep-strategy-u3-e3-v1:selected'),'PRIVATE');
 assert.equal(storage.map.get('pokesleep-strategy-u3-e3-v1:2026-11-16:event:conditions'),'PROTECTED');
 assert.equal(mirror(F2.readLastKnownGood(storage)).bonus.length,3);
 assert(!JSON.stringify(got).includes('PRIVATE'));
 assert.equal(storage.map.size,3);
});
test('F2: failed pair fetch, invalid commit, corrupted source, suspicious shrink cannot overwrite LKG',async()=>{
 const storage=store();
 await F2.refresh({fetchImpl:responder(data,lang),storage});
 const before=storage.getItem(F2.KEY);
 const invalidFns=[
  async()=>{throw Error('offline');},
  responder(data,lang,'invalid'),
  responder({bonus:[],drowsy:[]},lang),
  responder({bonus:[data.bonus[0]],drowsy:[]},lang),
  url=>url.endsWith('/'+F2.LANG)?Promise.reject(Error('Japanese source failed')):responder(data,lang)(url)
 ];
 for(const fn of invalidFns){
  await assert.rejects(()=>F2.refresh({fetchImpl:fn,storage,timeoutMs:1500}));
  assert.equal(storage.getItem(F2.KEY),before);
  assert.equal(mirror(F2.readLastKnownGood(storage)).bonus.length,3);
 }
 storage.setItem(F2.KEY,JSON.stringify({...catalog(),bonus:[{...data.bonus[0],start:'2026-11-16T04:00:00+00:00'}]}));
 assert.equal(F2.readLastKnownGood(storage),null);
});
test('F2: E7 selection is read-only until Save; service worker offline asset and root protection retained',()=>{
 const u3=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(u3,/e7-f2-event-catalog-v1\.js/);
 assert.match(u3,/const cached=F2\.readLastKnownGood\(localStorage\)/);
 assert.match(u3,/F2\.refresh\(\{fetchImpl:fetch,storage:localStorage/);
 assert.match(u3,/Catalog refresh never mutates e3Selected, eventInfo, ledger, adopted plan or stock/);
 assert.match(u3,/pendingEventSource=structuredClone\(latest\)/);
 assert.match(u3,/const confirmed=E1\.confirmEventConditions\(edited,\{userConfirmed:true\}\)/);
 assert.match(u3,/localStorage\.setItem\(E3_SELECTED_KEY,JSON\.stringify\(selection\)\)/);
 assert.match(sw,/e7-f2-event-catalog-v1\.js/);
 assert.match(sw,/v86-f2-event-catalog-20261113/);
 assert(!read('index.html').includes('e7-f2-event-catalog-v1.js'));
});

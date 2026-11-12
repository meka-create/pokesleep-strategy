'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../e7-preview');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const scope={window:{},Date,JSON,encodeURIComponent};
vm.runInNewContext(read('e7-inventory-scope-v78.js'),scope);
const keys=scope.window.PokeE7InventoryScope;
vm.runInNewContext(read('e7-event-delete-v71.js'),scope);
const deletion=scope.window.PokeE7EventDeletion;
const WEEK='2026-11-09',A='manual:'+WEEK,B='official-nov-event';
function store(initial={}){
 const m=new Map(Object.entries(initial));
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),
  removeItem:k=>m.delete(k),get length(){return m.size;},key:i=>[...m.keys()][i]??null,
  snapshot:()=>Object.fromEntries(m)};
}
function stock(id,count){return {version:1,weekStart:WEEK,eventId:id,
 preparationLatest:null,startInventory:null,currentInventory:{
 weekStart:WEEK,savedAt:'2026-11-10T00:00:00Z',revision:'stock-'+count,values:{'とくせんリンゴ':count}}};}
function records(id){
 const source=id===A?null:{id,name:'イベントB'};
 const k='pokesleep-strategy-u3-e3-v1:'+WEEK+':'+encodeURIComponent(id)+':';
 return {[k+'conditions']:JSON.stringify({version:1,weekStart:WEEK,eventId:id,
  confirmed:{weekStart:WEEK,eventId:id,status:'CONFIRMED',fields:{field:'シアンの砂浜',food:'all',camp:true,source},
   revision:'r1',savedAt:'2026-11-10T00:00:00Z',missingFields:[]}}),
 [k+'plan']:JSON.stringify({version:1,weekStart:WEEK,eventInfo:{start:WEEK,source}})};
}
test('E7 v78 same-week events have distinct persistent inventory owners',()=>{
 const s=store(),a=stock(A,21),b=stock(B,47);
 assert.notEqual(keys.scopedKey(WEEK,A),keys.scopedKey(WEEK,B));
 s.setItem(keys.writeKey(WEEK,A),JSON.stringify(a));
 s.setItem(keys.writeKey(WEEK,B),JSON.stringify(b));
 assert.equal(keys.read(s,WEEK,A).currentInventory.values['とくせんリンゴ'],21);
 assert.equal(keys.read(s,WEEK,B).currentInventory.values['とくせんリンゴ'],47);
 assert.equal(s.getItem(keys.legacyKey(WEEK)),null);
});
test('E7 v78 owner-matched week-only stock stays readable but never overwritten',()=>{
 const old=stock(A,25),s=store({[keys.legacyKey(WEEK)]:JSON.stringify(old)});
 assert.equal(keys.read(s,WEEK,A).currentInventory.values['とくせんリンゴ'],25);
 assert.equal(keys.read(s,WEEK,B),null,'foreign old inventory is not adopted by B');
 s.setItem(keys.writeKey(WEEK,B),JSON.stringify(stock(B,80)));
 assert.equal(keys.read(s,WEEK,B).currentInventory.values['とくせんリンゴ'],80);
 assert.equal(s.getItem(keys.legacyKey(WEEK)),JSON.stringify(old),'legacy remains byte-identical');
 s.setItem(keys.writeKey(WEEK,A),JSON.stringify(stock(A,30)));
 assert.equal(keys.read(s,WEEK,A).currentInventory.values['とくせんリンゴ'],30);
 assert.equal(JSON.parse(s.getItem(keys.legacyKey(WEEK))).currentInventory.values['とくせんリンゴ'],25);
});
test('E7 v78 corrupt own record fails closed and invalid ownership is rejected',()=>{
 const s=store({[keys.scopedKey(WEEK,A)]:JSON.stringify(stock(B,1))});
 assert.throws(()=>keys.read(s,WEEK,A),/所有イベント/);
 s.setItem(keys.scopedKey(WEEK,A),'{broken');
 assert.throws(()=>keys.read(s,WEEK,A),/破損/);
 assert.throws(()=>keys.scopedKey('2026-11-10',A),/Invalid/);
 assert.throws(()=>keys.scopedKey(WEEK,''),/Invalid/);
});
test('E7 v78 deletion removes only selected event inventory, preserving same-week other',()=>{
 const sel={weekStart:WEEK,id:A};
 const s=store({...records(A),...records(B),
  [keys.scopedKey(WEEK,A)]:JSON.stringify(stock(A,21)),
  [keys.scopedKey(WEEK,B)]:JSON.stringify(stock(B,47)),
  [keys.legacyKey(WEEK)]:JSON.stringify(stock(A,25)),
  ['pokesleep-strategy-u3-e3-v1:selected']:JSON.stringify(sel)});
 const before=deletion.snapshot(s,sel,{requireSelected:true});
 const removed=deletion.remove(s,before);
 assert(removed.deletedKeys.includes(keys.scopedKey(WEEK,A)));
 assert(removed.deletedKeys.includes(keys.legacyKey(WEEK)));
 assert.equal(s.getItem(keys.scopedKey(WEEK,A)),null);
 assert.equal(s.getItem(keys.legacyKey(WEEK)),null);
 assert(s.getItem(keys.scopedKey(WEEK,B)));
 assert(s.getItem('pokesleep-strategy-u3-e3-v1:'+WEEK+':'+encodeURIComponent(B)+':conditions'));
});
test('E7 v78 foreign owner in event-specific key blocks deletion, preserving all records',()=>{
 const sel={weekStart:WEEK,id:A};
 const s=store({...records(A),...records(B),
  [keys.scopedKey(WEEK,A)]:JSON.stringify(stock(B,21)),
  [keys.scopedKey(WEEK,B)]:JSON.stringify(stock(B,47)),
  ['pokesleep-strategy-u3-e3-v1:selected']:JSON.stringify(sel)});
 const before=s.snapshot();
 assert.throws(()=>deletion.snapshot(s,sel,{requireSelected:true}),/所有イベント/);
 assert.deepEqual(s.snapshot(),before);
});
test('E7 v78 both historical standalone and new event-aware reader are supported',()=>{
 const s=store({[keys.legacyKey(WEEK)]:JSON.stringify(stock(A,10))});
 assert.equal(keys.read(s,WEEK).currentInventory.values['とくせんリンゴ'],10);
 assert.equal(keys.read(s,WEEK,B),null);
});
test('E7 v78 every event-aware screen and shared footer imports the same resolver',()=>{
 const paths=['U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html','U4_Box_Preview_20261109_v50_E7.html'];
 for(const p of paths){
  const s=read(p);
  assert.match(s,/<script src="e7-inventory-scope-v78\.js"><\/script>/,p);
  assert.match(s,/PokeE7InventoryScope\.read\(localStorage/,p);
 }
 const u2=read(paths[0]),u3=read(paths[1]);
 assert.match(u2,/PokeE7InventoryScope\.writeKey\(week,validEventId\?selectedEventId:null\)/);
 assert.match(u3,/PokeE7InventoryScope\.read\(localStorage,eventInfo\.start,e3Selected\.id\)/);
 assert.match(read('e7-unified-bridge-v51.js'),/PokeE7InventoryScope\.read\(localStorage,week,id\)/);
 assert.match(read('e7-sw-v50.js'),/'e7-inventory-scope-v78\.js'/);
});

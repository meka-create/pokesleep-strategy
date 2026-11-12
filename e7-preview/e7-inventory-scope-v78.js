/* E7 v78: event-owned inventory timelines, with read-only legacy fallback.
 * Existing week-only records are NEVER silently attached to a different event.
 * All writers use event-specific keys; reads prefer the new event-specific key.
 */
((root)=>{
'use strict';
const PREFIX='pokesleep-strategy-u2-e2-v1:';
function validWeek(week){
 if(typeof week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week))return false;
 const date=new Date(week+'T12:00:00Z');
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===week&&date.getUTCDay()===1;
}
function validEventId(id){return typeof id==='string'&&id.length>0&&id.length<=160&&!!id.trim();}
function legacyKey(week){
 if(!validWeek(week))throw Error('Invalid inventory week');
 return PREFIX+week+':timeline';
}
function scopedKey(week,id){
 if(!validWeek(week)||!validEventId(id))throw Error('Invalid inventory ownership');
 return PREFIX+week+':'+encodeURIComponent(id)+':timeline';
}
function parse(raw,week,id){
 let obj;try{obj=JSON.parse(raw);}catch(e){throw Error('保存された食材在庫が破損しています。');}
 if(!obj||obj.version!==1||obj.weekStart!==week||
   (id!==null&&obj.eventId!==id))
  throw Error('食材在庫の所有イベントを検証できません。');
 return obj;
}
// No-event standalone previews retain the historical week-only read contract.
// With an explicit event, week-only records may be read ONLY by that owner;
// foreign or unknown-owner records must never be adopted as another event's stock.
function read(storage,week,id=null){
 if(id!==null){
  const specific=storage.getItem(scopedKey(week,id));
  if(specific!==null)return parse(specific,week,id);
  const historical=storage.getItem(legacyKey(week));
  if(historical===null)return null;
  let parsed;try{parsed=JSON.parse(historical);}catch(e){throw Error('保存された食材在庫が破損しています。');}
  if(parsed?.eventId!==id)return null;
  return parse(historical,week,id);
 }
 const raw=storage.getItem(legacyKey(week));
 return raw===null?null:parse(raw,week,null);
}
function writeKey(week,id=null){return id===null?legacyKey(week):scopedKey(week,id);}
const api=Object.freeze({validWeek,validEventId,legacyKey,scopedKey,writeKey,read});
root.PokeE7InventoryScope=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

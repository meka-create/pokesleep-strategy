/* E7 v71: event-scoped deletion; shared by the calendar and developer reset.
 * Never delete records by matching a week prefix. This module does not
 * mutate until the caller has displayed an explicit confirmation.
 */
((root)=>{
'use strict';
const PREFIX='pokesleep-strategy-u3-e3-v1:';
const SELECTED=PREFIX+'selected';
const PREP='pokesleep-strategy-u2-e6-prep-v1:';
const TIMELINE='pokesleep-strategy-u2-e2-v1:';
function valid(selection){
 if(!selection||typeof selection.id!=='string'||!selection.id.trim()||
    selection.id.length>160||typeof selection.weekStart!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(selection.weekStart))return false;
 const d=new Date(selection.weekStart+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===selection.weekStart&&d.getUTCDay()===1;
}
function same(a,b){return !!a&&a.id===b.id&&a.weekStart===b.weekStart;}
function readJSON(raw){try{return JSON.parse(raw);}catch(e){throw Error('保存内容が壊れています。削除を中止しました。');}}
function snapshot(storage,selection,{requireSelected=false}={}){
 if(!valid(selection))throw Error('削除対象のイベントを特定できません。');
 const week=selection.weekStart,id=selection.id,encoded=encodeURIComponent(id);
 const base=PREFIX+week+':'+encoded+':';
 const keys=[base+'conditions',base+'plan',PREP+week+':'+encoded];
 const values={};
 for(const key of keys)values[key]=storage.getItem(key);
 const ledger=values[base+'conditions']===null?null:readJSON(values[base+'conditions']);
 const plan=values[base+'plan']===null?null:readJSON(values[base+'plan']);
 if(!ledger||ledger.weekStart!==week||ledger.eventId!==id||
    !ledger.confirmed||ledger.confirmed.weekStart!==week||ledger.confirmed.eventId!==id)
  throw Error('イベント条件を検証できません。データを保護しました。');
 if(!plan||plan.version!==1||plan.weekStart!==week||
    plan.eventInfo?.start!==week||
    (plan.eventInfo?.source?.id||'manual:'+week)!==id)
  throw Error('作戦データを検証できません。データを保護しました。');
 const prep=values[keys[2]]===null?null:readJSON(values[keys[2]]);
 if(prep&&(prep.weekStart!==week||prep.eventId!==id))
  throw Error('備蓄設定の所有イベントが一致しません。');
 const stockKey=TIMELINE+week+':timeline',stockRaw=storage.getItem(stockKey);
 if(stockRaw!==null){
  // The inventory key is week-wide. Delete it only if the stored owner
  // exactly matches this event; never remove another event's inventory.
  const stock=readJSON(stockRaw);
  if(stock?.eventId===id&&stock.weekStart===week){
   keys.push(stockKey);values[stockKey]=stockRaw;
  }
 }
 const pointerRaw=storage.getItem(SELECTED);
 const pointer=pointerRaw===null?null:readJSON(pointerRaw);
 const selected=same(pointer,selection);
 if(requireSelected&&!selected)throw Error('選択中のイベントが変更されました。削除を中止しました。');
 if(selected){keys.push(SELECTED);values[SELECTED]=pointerRaw;}
 return {selection:{weekStart:week,id},keys,values,selected};
}
function remove(storage,before){
 if(!before||!valid(before.selection))throw Error('削除対象が不正です。');
 // Compare all contents and key ownership again after an async dialog.
 const latest=snapshot(storage,before.selection,{requireSelected:before.selected});
 if(latest.keys.length!==before.keys.length||
    latest.keys.some((key,i)=>key!==before.keys[i]||
      latest.values[key]!==before.values[key]))
  throw Error('確認中に保存内容が変更されました。削除を中止しました。');
 let removed=false;
 try{
  for(const key of before.keys)storage.removeItem(key);
  removed=true;
  for(const key of before.keys)if(storage.getItem(key)!==null)
   throw Error('削除結果を確認できませんでした。');
 }catch(e){
  let restored=true;
  for(const key of before.keys){
   try{storage.setItem(key,before.values[key]);}
   catch(err){restored=false;}
  }
  throw Error(restored?'削除に失敗しました。元の保存内容を復元しました。':
   '削除に失敗しました。保存領域を確認し、バックアップからの復元を検討してください。');
 }
 return {selected:before.selected,deletedKeys:removed?before.keys.slice():[]};
}
root.PokeE7EventDeletion=Object.freeze({valid,snapshot,remove});
})(typeof window!=='undefined'?window:globalThis);

/* F1-D: strictly read-only bridge from approved E7 local records to F1-C.
 * This module NEVER creates or updates E7 records. No mock U3 IDs are used.
 * Preview uses a fixed five-individual team for all 28 slots: NOT optimization.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF1DE7Input=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const BOX='pokesleep-strategy-e7-box-v1';
 const PLAYER='pokesleep-strategy-e7-player-v1';
 const SELECTED='pokesleep-strategy-u3-e3-v1:selected';
 const PREFIX='pokesleep-strategy-u3-e3-v1:';
 const CATS=['curry','salad','dessert'];
 const FIELDS=new Set(['ワカクサ本島','シアンの砂浜','トープ洞窟','ウノハナ雪原',
  'ラピスラズリ湖畔','ゴールド旧発電所','アンバー渓谷','ワカクサ本島EX','シアンの砂浜EX']);
 const REASONS=Object.freeze({
  NO_EVENT:'イベントを選択・保存してください。',
  EVENT_NOT_CONFIRMED:'イベント条件を保存してください。',
  MISMATCHED_EVENT:'イベントの保存内容が一致しません。',
  INVALID_EVENT:'イベント設定が不正です。',
  NO_BOX:'ボックスに個体を登録してください。',
  BOX_INVALID:'ボックスの保存情報を確認してください。',
  SELECT_FIVE:'実個体を重複なしで5匹選択してください。',
  INVALID_INVENTORY:'イベント別の食材在庫を確認してください。',
  INVALID_PLAYER:'プレイヤー設定を確認してください。',
  SET_FOOD_CATEGORY:'試算する料理カテゴリを選択してください。',
  BAD_TEAM_OPTIONS:'試算条件が不正です。'
 });
 const blocked=reason=>Object.freeze({status:'BLOCKED',reason,message:REASONS[reason]||'試算条件を確認してください。'});
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const parse=(store,key)=>{const raw=store.getItem(key);if(raw===null)return null;return JSON.parse(raw);};
 const eventKey=(w,id)=>PREFIX+w+':'+encodeURIComponent(id)+':conditions';
 function context(store,scope){
  try{
   if(!store||typeof store.getItem!=='function'||!scope?.validWeek||
       !scope?.read)return blocked('INVALID_EVENT');
   const selected=parse(store,SELECTED);
   if(!selected||!scope.validWeek(selected.weekStart)||!scope.validEventId(selected.id))
    return blocked('NO_EVENT');
   const key=eventKey(selected.weekStart,selected.id);
   const ledger=parse(store,key),condition=ledger?.confirmed;
   if(ledger?.version!==1||ledger.weekStart!==selected.weekStart||
      ledger.eventId!==selected.id||!condition||
      condition.weekStart!==selected.weekStart||condition.eventId!==selected.id||
      condition.status!=='CONFIRMED'||!Array.isArray(condition.missingFields)||
      condition.missingFields.length)return blocked('EVENT_NOT_CONFIRMED');
   const fields=condition.fields;
   if(!fields||!FIELDS.has(fields.field)||
      ![...CATS,'all'].includes(fields.food)||typeof fields.camp!=='boolean')
    return blocked('INVALID_EVENT');
   const box=parse(store,BOX);
   if(!box||box.version!==1||!Array.isArray(box.items)||!box.items.length)return blocked('NO_BOX');
   if(box.items.length>10000||box.items.some(item=>!item||
     typeof item.pokemon!=='string'||!Number.isInteger(item.level)||
     !Number.isInteger(item.skillLevel)))return blocked('BOX_INVALID');
   const player=parse(store,PLAYER);
   if(player!==null&&(player.version!==1||!player.bonuses||
     (player.pot!==null&&(!Number.isSafeInteger(player.pot)||player.pot<=0))||
     (player.bag!==null&&(!Number.isSafeInteger(player.bag)||player.bag<=0))))
    return blocked('INVALID_PLAYER');
   const inventory=scope.read(store,selected.weekStart,selected.id);
   const values=inventory?.currentInventory?.values||
    inventory?.startInventory?.values||
    inventory?.preparationLatest?.values||null;
   if(inventory&&(!values||typeof values!=='object'||Array.isArray(values)))
    return blocked('INVALID_INVENTORY');
   const keyId=selected.weekStart+'|'+selected.id;
   return Object.freeze({status:'READY',key:keyId,selection:Object.freeze({...selected}),
    fields:Object.freeze({...fields}),items:box.items,player,inventory:values,
    inventoryRevision:inventory?.currentInventory?.revision||
      inventory?.startInventory?.revision||inventory?.preparationLatest?.revision||null,
    eventRevision:condition.revision||null});
  }catch(_){return blocked('INVALID_INVENTORY');}
 }
 function modelInput(current,selectedIndices,options,dict){
  if(current?.status!=='READY')return current||blocked('NO_EVENT');
  if(!Array.isArray(selectedIndices)||selectedIndices.length!==5||
     new Set(selectedIndices).size!==5||
     selectedIndices.some(n=>!Number.isSafeInteger(n)||n<0||n>=current.items.length))
   return blocked('SELECT_FIVE');
  if(!dict||typeof dict!=='object'||!Object.keys(dict).length)return blocked('BAD_TEAM_OPTIONS');
  const food=current.fields.food==='all'?options?.foodCategory:current.fields.food;
  if(!CATS.includes(food))return blocked('SET_FOOD_CATEGORY');
  const tap=options?.tapMinutes??150,score=options?.sleepScore??100;
  if(!Number.isSafeInteger(tap)||tap<120||tap>180||
      !Number.isSafeInteger(score)||score<0||score>100)return blocked('BAD_TEAM_OPTIONS');
  const notes=[];
  const pot=current.player?.pot??57;
  const bag=current.player?.bag??0;
  const fieldBonus=current.player?.bonuses?.[current.fields.field]??0;
  if(!Number.isSafeInteger(pot)||pot<7||pot>300||
     !Number.isSafeInteger(bag)||bag<0||bag>10000||
     !Number.isSafeInteger(fieldBonus)||fieldBonus<0||fieldBonus>100)
   return blocked('INVALID_PLAYER');
  if(current.player?.pot==null)notes.push('鍋容量は仮に57枠で計算');
  if(current.player?.bag==null)notes.push('食材バッグ容量が未設定のため満杯制限は未反映');
  if(current.player?.bonuses?.[current.fields.field]==null)
   notes.push('フィールドボーナス未入力：0%で仮計算');
  const counts={};
  if(!current.inventory)notes.push('食材在庫が未登録：初期在庫0個として仮計算');
  else{
   for(const [code,japanese] of Object.entries(dict)){
    const raw=current.inventory[japanese];
    if(raw===null||raw===undefined)continue;
    if(!Number.isSafeInteger(raw)||raw<0||raw>10000)return blocked('INVALID_INVENTORY');
    counts[code]=raw;
   }
   if(Object.keys(current.inventory).some(jp=>!Object.values(dict).includes(jp)))
    return blocked('INVALID_INVENTORY');
  }
  if(Object.values(counts).reduce((a,b)=>a+b,0)>bag&&bag>0)
   return blocked('INVALID_INVENTORY');
  if(current.fields.field.endsWith('EX')||
     current.fields.source?.unknownEffects||
     current.fields.source?.bonus)
   notes.push('イベント固有の追加補正は未計上');
  const box=selectedIndices.map((i,k)=>{
   const raw=current.items[i];
   if(!raw||typeof raw.pokemon!=='string')return null;
   const mintUnknown=raw.mint===null||raw.mint===undefined;
   const sleepUnknown=raw.ribbon===null||raw.ribbon===undefined;
   if(mintUnknown)notes.push('ミント未記入の個体は未使用と仮定');
   if(sleepUnknown)notes.push('睡眠時間未記入の個体は0時間と仮定');
   return {...raw,id:'f1d-member-'+k,mint:mintUnknown?false:raw.mint,
    ribbon:sleepUnknown?0:raw.ribbon};
  });
  if(box.some(p=>!p))return blocked('BOX_INVALID');
  const ids=box.map(x=>x.id);
  const week=Array.from({length:7},()=>({
   morning:[...ids],noon:[...ids],evening:[...ids]
  }));
  const sleeps=Array.from({length:7},()=>[...ids]);
  return Object.freeze({
   status:'READY',
   input:{box,teamsByDay:week,sleepTeamsByDay:sleeps,
    options:{map:current.fields.field,fieldBonus,tapMinutes:tap,
     potSize:pot,sleepScore:score,initialEnergy:100,
     foodMode:food,recipeMode:'best',initialIngredients:counts,
     camp:current.fields.camp,bagCapacity:bag,extraMode:'fill',
     successMode:'expected'}},
   notes:Object.freeze([...new Set(notes)]),
   key:current.key,inventoryRevision:current.inventoryRevision,
   eventRevision:current.eventRevision,
   mode:'FIVE_FIXED_ALL_28_SLOTS_NOT_OPTIMIZED'
  });
 }
 return Object.freeze({BOX,PLAYER,SELECTED,eventKey,context,modelInput});
});

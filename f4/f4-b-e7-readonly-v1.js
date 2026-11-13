/* F4-B v92: read-only actual E7 context and guarded F4-A invocation.
 * E7's stored U3 manualSleep entries are illustrative POOL IDs, NOT box IDs.
 * Never coerce mock IDs into real individuals, guess fixed-field berries,
 * overwrite a record, or convert a verified event into a neutral event.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4BE7ReadOnly=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const K={selected:'pokesleep-strategy-u3-e3-v1:selected',
  box:'pokesleep-strategy-e7-box-v1',player:'pokesleep-strategy-e7-player-v1'};
 const FOODS=['leek','mushroom','egg','potato','apple','herb','sausage','milk',
  'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado'];
 const CATS=['curry','salad','dessert','all'];
 const fail=(reason,message)=>Object.freeze({status:'BLOCKED',reason,
  message:message||reason,weeklyEnergyCertified:false,writesSavedData:false,
  privateIndividualDataInResult:false});
 const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
 function readJson(store,key){
  const raw=store.getItem(key);
  if(raw===null)return null;
  if(raw.length>4000000)throw Error('PERSISTENCE_SIZE');
  return JSON.parse(raw);
 }
 function keyFor(w,id,suffix){
  return 'pokesleep-strategy-u3-e3-v1:'+w+':'+encodeURIComponent(id)+':'+suffix;
 }
 // This context intentionally retains private box rows IN MEMORY ONLY.
 // It must not be serialized, logged, put in URL or used as a visible report.
 function readContext(storage,deps={},instant){
  if(!storage||typeof storage.getItem!=='function'||
   !deps.scope?.validWeek||!deps.scope?.validEventId||
   !deps.scope?.read||!deps.e1?.validateConditionLedger||
   !deps.e1?.validateInventoryTimeline||!deps.weekClock?.build)
   return fail('DEPENDENCIES_MISSING','検証済みのE7データ読込機能がありません。');
  try{
   const sel=readJson(storage,K.selected);
   if(!sel||!deps.scope.validWeek(sel.weekStart)||!deps.scope.validEventId(sel.id))
    return fail('EVENT_NOT_SELECTED','保存済みイベントがありません。');
   const clock=deps.weekClock.build(sel.weekStart,instant);
   if(clock.status!=='TIMELINE_READY')
    return fail('INVALID_CLOCK','JSTのゲーム週境界を検証できません。');
   const ledger=readJson(storage,keyFor(sel.weekStart,sel.id,'conditions'));
   if(!ledger)return fail('CONDITIONS_MISSING','イベント条件が未保存です。');
   const saved=deps.e1.validateConditionLedger(ledger);
   const cond=saved.confirmed;
   if(saved.weekStart!==sel.weekStart||saved.eventId!==sel.id||
    !cond||cond.status!=='CONFIRMED'||cond.missingFields?.length)
    return fail('CONDITIONS_UNCONFIRMED','保存済みイベント条件が未確定です。');
   const fields=cond.fields;
   if(!plain(fields)||typeof fields.field!=='string'||
    !CATS.includes(fields.food)||typeof fields.camp!=='boolean')
    return fail('CONDITIONS_INVALID','イベントのフィールド・料理条件が不正です。');
   if(fields.source!==null&&fields.source!==undefined){
    if(!plain(fields.source)||fields.source.id!==sel.id)
     return fail('EVENT_SOURCE_MISMATCH','イベントの原典と選択情報が一致しません。');
   }else if(sel.id!=='manual:'+sel.weekStart)
    return fail('EVENT_SOURCE_MISSING','イベント原典が一致しません。');
   const box=readJson(storage,K.box);
   if(!box||box.version!==1||!Array.isArray(box.items)||box.items.length<5||
    box.items.length>10000||box.items.some(x=>!plain(x)||
     typeof x.pokemon!=='string'||!Number.isSafeInteger(x.level)))
    return fail('BOX_INVALID','実ボックスの登録状態を確認してください。');
   const original=deps.scope.read(storage,sel.weekStart,sel.id);
   if(!original||original.eventId!==sel.id)
    return fail('EVENT_INVENTORY_MISSING','イベント別の食材在庫がありません。');
   const timeline=deps.e1.validateInventoryTimeline(original,sel.weekStart);
   const stock=timeline.currentInventory;
   if(!stock)return fail('EVENT_INVENTORY_MISSING','確定済み食材在庫がありません。');
   const player=readJson(storage,K.player);
   if(player!==null&&(player.version!==1||!plain(player.bonuses)))
    return fail('PLAYER_INVALID','プレイヤー情報が不正です。');
   const savedPlan=readJson(storage,keyFor(sel.weekStart,sel.id,'plan'));
   if(savedPlan&&
    (savedPlan.version!==1||savedPlan.weekStart!==sel.weekStart||
     savedPlan.eventInfo?.start!==sel.weekStart||
     (savedPlan.eventInfo?.source?.id||'manual:'+sel.weekStart)!==sel.id||
     savedPlan.eventInfo.field!==fields.field||
     savedPlan.eventInfo.food!==fields.food||
     savedPlan.eventInfo.camp!==fields.camp||
     JSON.stringify(savedPlan.eventInfo.source||null)!==JSON.stringify(fields.source||null)))
    return fail('SAVED_PLAN_OWNER_MISMATCH','作戦の保存情報とイベント条件が一致しません。');
   if(savedPlan&&
    (typeof savedPlan.autoSleep!=='boolean'||
     !Array.isArray(savedPlan.manualSleep)||savedPlan.manualSleep.length!==7||
     savedPlan.manualSleep.some(row=>!Array.isArray(row)||row.length!==5)))
    return fail('SAVED_SLEEP_INVALID','睡眠編成の保存形式を確認してください。');
   return {
    status:'CONTEXT_READY',weekStart:sel.weekStart,eventId:sel.id,
    fields:{...fields},clock,inventoryValues:{...stock.values},
    inventoryRevision:stock.revision,conditionRevision:cond.revision,
    player,privateBoxRows:box.items,
    // Current U3 manualSleep is NEVER mapped or passed to F4-A.
    illustrativeSleepOnly:true,autoSleep:savedPlan?.autoSleep===true,
    hasSavedSleepSetting:!!savedPlan,
    savedBerrySetup:savedPlan?.eventInfo.berrySetup||null,
    weeklyEnergyCertified:false,writesSavedData:false
   };
  }catch(_){
   return fail('INVALID_SAVED_DATA','イベント別の保存情報を検証できません。');
  }
 }
 function publicStatus(ctx){
  if(ctx?.status!=='CONTEXT_READY')return ctx||fail('NO_CONTEXT');
  return Object.freeze({status:'CONTEXT_READY',weekStart:ctx.weekStart,
   eventIsOfficial:ctx.fields.source!=null,
   registeredIndividuals:ctx.privateBoxRows.length,
   gameWeekPhase:ctx.clock.phase,inventoryAvailable:true,
   previousWeekCarryHours:ctx.clock.previousWeekCarryHours,
   finalNightWithinWeekHours:ctx.clock.finalNightWithinWeekHours,
   illustrativeSleepOnly:true,weeklyEnergyCertified:false,
   writesSavedData:false,privateIndividualDataInResult:false});
 }
 function buildNeutralInput(ctx,options={},deps={}){
  if(ctx?.status!=='CONTEXT_READY')return ctx||fail('NO_CONTEXT');
  // Explicit opt-in ONLY for an *unbonused manual* engineering reference.
  // A live official event is never reduced to eventSource:null.
  if(ctx.fields.source!=null)
   return fail('EVENT_MODEL_NOT_CONNECTED',
    '公式イベントの補正が未実装のため、正式な週間試算は停止しています。');
  if(options.neutralReferenceOnly!==true)
   return fail('NEUTRAL_OPT_IN_REQUIRED','中立参考計算は明示的な指定が必要です。');
  if(ctx.fields.field.endsWith('EX'))
   return fail('EX_MODIFIERS_NOT_MODELED','EX固有の補正は未実装です。');
  if(!ctx.hasSavedSleepSetting)
   return fail('SLEEP_SETTING_NOT_SAVED','睡眠編成の設定が未保存です。');
  const player=ctx.player;
  const pot=player?.pot,bag=player?.bag,bonus=player?.bonuses?.[ctx.fields.field];
  if(!Number.isSafeInteger(pot)||pot<7||pot>5000||
   !Number.isSafeInteger(bag)||bag<1||bag>5000||
   !Number.isSafeInteger(bonus)||bonus<0||bonus>100)
   return fail('PLAYER_VALUES_UNCONFIRMED',
    '鍋・バッグ・フィールドボーナスの実際の値を登録してください。');
  const master=deps.master,dict=master?.ingredients;
  if(!plain(dict)||FOODS.some(k=>typeof dict[k]!=='string')||
   Object.keys(dict).length!==FOODS.length||
   new Set(Object.values(dict)).size!==FOODS.length)
   return fail('FOOD_DICTIONARY_MISSING');
  if(Object.keys(ctx.inventoryValues).length!==FOODS.length||
   Object.keys(ctx.inventoryValues).some(j=>!Object.values(dict).includes(j)))
   return fail('INVENTORY_FOOD_MISMATCH');
  const stocks={};
  for(const code of FOODS){
   const v=ctx.inventoryValues[dict[code]];
   if(!Number.isSafeInteger(v)||v<0||v>10000)return fail('INVENTORY_INVALID');
   stocks[code]=v;
  }
  if(Object.values(stocks).reduce((a,b)=>a+b,0)>bag)
   return fail('BAG_OVER_CAPACITY');
  const labels=master.types||{};
  const chosen=options.favoriteTypes??ctx.savedBerrySetup?.types;
  if(!Array.isArray(chosen)||chosen.length!==3||
   new Set(chosen).size!==3)
   return fail('FAVORITE_TYPES_NOT_VERIFIED','好みのきのみ3種類が未確認です。');
  const favoriteTypes=chosen.map(x=>Object.hasOwn(labels,x)?x:
   Object.keys(labels).find(k=>labels[k]===x));
  if(favoriteTypes.some(x=>!x)||new Set(favoriteTypes).size!==3)
   return fail('FAVORITE_TYPES_NOT_VERIFIED');
  const roster=deps.roster?.adapt({items:ctx.privateBoxRows,
   camp:ctx.fields.camp,fieldBonus:bonus,favoriteTypes},
   {snapshot:deps.snapshot,traits:deps.traits,legal:deps.legal,
    rates:deps.rates,master});
  if(roster?.status!=='READY')return fail(roster?.reason||'ROSTER_BLOCKED',
   '実ボックスの合法個体と基礎速度を検証できません。');
  let nights=null;
  if(!ctx.autoSleep){
   // The explicit indices are ephemeral user choices. Saved E7 POOL IDs
   // are deliberately ignored, even if their strings resemble real IDs.
   const rows=options.realNightTeamIndices;
   if(!Array.isArray(rows)||rows.length!==7||
    rows.some(row=>!Array.isArray(row)||row.length!==5||
     new Set(row).size!==5||row.some(i=>
      !Number.isSafeInteger(i)||i<0||i>=ctx.privateBoxRows.length)))
    return fail('REAL_NIGHTS_REQUIRED','7晩それぞれ実個体5匹の明示指定が必要です。');
   const eligible=new Set(roster.profiles.map(p=>p.id));
   nights=rows.map(row=>row.map(i=>'p'+i));
   if(nights.some(row=>row.some(id=>!eligible.has(id))))
    return fail('UNVERIFIED_NIGHT_MEMBER','睡眠編成に未対応・未検証個体が含まれています。');
  }
  if(!Array.isArray(deps.recipes))
   return fail('RECIPE_SOURCE_MISSING');
  return {
   status:'READY',
   input:{weekStart:ctx.weekStart,eventSource:null,
    eventMode:'NEUTRAL_REFERENCE_ONLY',foodMode:ctx.fields.food,
    camp:ctx.fields.camp,fieldBonus:bonus,potCapacity:pot,
    bagCapacity:bag,initialInventory:stocks,
    profiles:roster.profiles,recipes:deps.recipes,
    autoSleep:ctx.autoSleep,nightTeams:nights},
   sourceCommit:roster.sourceCommit,
   warning:'実ゲーム週04:00境界・前週睡眠引継ぎ・げんき・スキル・回収は未計算です。',
   weeklyEnergyCertified:false,writesSavedData:false
  };
 }
 function reference(storage,options={},deps={}){
  const ctx=readContext(storage,deps,options.instant);
  if(ctx.status!=='CONTEXT_READY')return ctx;
  const prepared=buildNeutralInput(ctx,options,deps);
  if(prepared.status!=='READY')return prepared;
  if(typeof deps.core?.plan!=='function')return fail('CORE_MISSING');
  const result=deps.core.plan(prepared.input);
  if(result.status!=='PROVISIONAL')return fail(result.reason||'CORE_BLOCKED');
  return {status:'PROVISIONAL',stage:'F4_B_READONLY_NEUTRAL',
   result,sourceCommit:prepared.sourceCommit,readOnly:true,
   gameWeek:{startsAt:ctx.clock.startsAt,endsAt:ctx.clock.endsAt,
    boundaryCarryHours:3.5,lastSleepHours:4,
    fullyModeled:false},
   weeklyEnergyCertified:false,writesSavedData:false,
   privateIndividualDataInResult:false};
 }
 return Object.freeze({readContext,publicStatus,buildNeutralInput,reference,keyFor});
});

/* F4-B v93: read-only E7 context and exact-window F4-B reference.
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
   if(Date.parse(stock.savedAt)>Date.parse(clock.asOf))
    return fail('INVENTORY_FROM_FUTURE','指定時刻より未来の在庫を使用できません。');
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
    inventoryRevision:stock.revision,inventorySavedAt:stock.savedAt,
    conditionRevision:cond.revision,
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
  if(Date.parse(ctx.inventorySavedAt)>=Date.parse(ctx.clock.startsAt))
   return fail('MIDWEEK_STOCK_NOT_WEEK_START',
    'イベント開始後の現在庫から過去の21食・編成を再構成しません。');
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
  // Even with sleep automation ON, the preceding Sunday's already-used
  // sleeping team cannot be inferred from this event's mock roster.
  const previous=options.previousWeekSleepIndices;
  if(!Array.isArray(previous)||previous.length!==5||
   new Set(previous).size!==5||previous.some(i=>
    !Number.isSafeInteger(i)||i<0||i>=ctx.privateBoxRows.length))
   return fail('PREVIOUS_WEEK_SLEEP_REQUIRED',
    '前週日曜の睡眠に使った実個体5匹を明示してください。');
  const eligible=new Set(roster.profiles.map(p=>p.id));
  const previousWeekSleepTeam=previous.map(i=>'p'+i);
  if(previousWeekSleepTeam.some(id=>!eligible.has(id)))
   return fail('UNVERIFIED_PREVIOUS_WEEK_MEMBER',
    '前週睡眠に未検証・未対応個体が含まれています。');
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
   nights=rows.map(row=>row.map(i=>'p'+i));
   if(nights.some(row=>row.some(id=>!eligible.has(id))))
    return fail('UNVERIFIED_NIGHT_MEMBER','睡眠編成に未対応・未検証個体が含まれています。');
  }
  if(!Array.isArray(deps.recipes))
   return fail('RECIPE_SOURCE_MISSING');
  return {
   status:'READY',
   input:{weekStart:ctx.weekStart,asOf:ctx.clock.asOf,eventSource:null,
    eventMode:'NEUTRAL_REFERENCE_ONLY',foodMode:ctx.fields.food,
    camp:ctx.fields.camp,fieldBonus:bonus,potCapacity:pot,
    bagCapacity:bag,initialInventory:stocks,
    profiles:roster.profiles,recipes:deps.recipes,
    autoSleep:ctx.autoSleep,nightTeams:nights,previousWeekSleepTeam},
   sourceCommit:roster.sourceCommit,
   warning:'04:00ゲーム週の29時間窓のみ計算接続済み。げんき・スキル・所持・回収・週切替動作は未検証です。',
   weeklyEnergyCertified:false,writesSavedData:false
  };
 }
 function reference(storage,options={},deps={}){
  const ctx=readContext(storage,deps,options.instant);
  if(ctx.status!=='CONTEXT_READY')return ctx;
  const prepared=buildNeutralInput(ctx,options,deps);
  if(prepared.status!=='READY')return prepared;
  if(typeof deps.exactCore?.plan!=='function'||
   !deps.baseCore?.normalizeProfiles||!deps.weekClock?.build)
   return fail('EXACT_CORE_MISSING');
  const result=deps.exactCore.plan(prepared.input,
   {base:deps.baseCore,gameWeek:deps.weekClock});
  if(result.status!=='PROVISIONAL')return fail(result.reason||'CORE_BLOCKED');
  if(result.slotCount!==29||result.totalHours!==168||
   result.startsAt!==ctx.clock.startsAt||result.endsAt!==ctx.clock.endsAt||
   result.slots?.[0]?.source!=='PREVIOUS_WEEK_SLEEP'||
   result.slots?.[28]?.source!=='FINAL_NIGHT_TRUNCATED'||
   result.weeklyEnergyCertified!==false||result.writesSavedData!==false)
   return fail('EXACT_CORE_CONTRACT');
  return {status:'PROVISIONAL',stage:'F4_B_EXACT_READONLY_REFERENCE',
   result,sourceCommit:prepared.sourceCommit,readOnly:true,
   gameWeek:{startsAt:ctx.clock.startsAt,endsAt:ctx.clock.endsAt,
    boundaryCarryHours:3.5,lastSleepHours:4,
    windowTimelineModeled:true,fullyModeled:false},
   weeklyEnergyCertified:false,writesSavedData:false,
   privateIndividualDataInResult:false};
 }
 // F4-C: opt-in read-only replay, never an E7 plan adoption.
 // No new storage keys, and no guessed historic health/tap/skill state.
 function statefulScenario(storage,options={},deps={}){
  if(options.scenarioConsent!=='EXPLICIT_OBSERVATIONS_AND_SLEEP_PROXY')
   return fail('STATE_SCENARIO_EXPLICIT_REQUIRED');
  if(typeof deps.stateReplay?.replay!=='function'||
   typeof deps.stateKernel?.tier!=='function')
   return fail('STATEFUL_DEPENDENCIES_MISSING');
  const ctx=readContext(storage,deps,options.instant);
  if(ctx.status!=='CONTEXT_READY')return ctx;
  const prepared=buildNeutralInput(ctx,options,deps);
  if(prepared.status!=='READY')return prepared;
  if(typeof deps.exactCore?.plan!=='function')return fail('EXACT_CORE_MISSING');
  const referenceResult=deps.exactCore.plan(prepared.input,
   {base:deps.baseCore,gameWeek:deps.weekClock});
  if(referenceResult.status!=='PROVISIONAL'||referenceResult.slotCount!==29||
   referenceResult.startsAt!==ctx.clock.startsAt||
   referenceResult.endsAt!==ctx.clock.endsAt||
   referenceResult.weeklyEnergyCertified!==false||
   referenceResult.writesSavedData!==false)
   return fail(referenceResult.reason||'EXACT_CORE_CONTRACT');
  const replayResult=deps.stateReplay.replay({
   ...prepared.input,reference:referenceResult,
   scenarioConsent:options.scenarioConsent,
   initialEnergy:options.initialEnergy,initialHeld:options.initialHeld,
   collections:options.collections,recoveries:options.recoveries
  },{stateKernel:deps.stateKernel,baseCore:deps.baseCore,gameWeek:deps.weekClock});
  if(replayResult.status!=='PROVISIONAL')
   return fail(replayResult.reason||'STATEFUL_REPLAY_BLOCKED');
  if(replayResult.weeklyEnergyCertified!==false||
   replayResult.writesSavedData!==false||
   replayResult.privateIndividualDataInResult!==false)
   return fail('STATEFUL_REPLAY_PRIVACY_CONTRACT');
  return {status:'PROVISIONAL',stage:'F4_C_EXPLICIT_STATE_REFERENCE',
   readOnly:true,result:replayResult,sourceCommit:prepared.sourceCommit,
   weekStart:ctx.weekStart,eventId:ctx.eventId,
   optimizedForHealth:false,weeklyEnergyCertified:false,
   writesSavedData:false,privateIndividualDataInResult:false};
 }
 // F4-C v100: the user's fixed healer schedule is the default strategy
 // policy, NOT a health-recovery estimation or a saved E7 roster mutation.
 // Real individuals still use ephemeral indices for this one calculation only.
 function healerFirstReference(storage,options={},deps={}){
  if(typeof deps.healerSearch?.plan!=='function'||
   typeof deps.healerPolicy?.validate!=='function')
   return fail('HEALER_SEARCH_DEPENDENCIES_MISSING');
  const ctx=readContext(storage,deps,options.instant);
  if(ctx.status!=='CONTEXT_READY')return ctx;
  if(ctx.autoSleep)
   return fail('MANUAL_SLEEP_REQUIRED',
    '睡眠編成を自動変更せず、7晩の育成用5匹を指定してください。');
  // Reuse all event-id, inventory revision, source, legal individual,
  // favorite berries, previous week and 7 night team guards from v93.
  const prepared=buildNeutralInput(ctx,options,deps);
  if(prepared.status!=='READY')return prepared;
  const primary=options.primaryHealerIndex,secondary=options.secondaryHealerIndex;
  const n=ctx.privateBoxRows.length;
  if(!Number.isSafeInteger(primary)||!Number.isSafeInteger(secondary)||
   primary<0||secondary<0||primary>=n||secondary>=n||primary===secondary)
   return fail('EXPLICIT_HEALERS_REQUIRED');
  const available=new Set(prepared.input.profiles.map(p=>p.id));
  const primaryId='p'+primary,secondaryId='p'+secondary;
  if(!available.has(primaryId)||!available.has(secondaryId)||
   prepared.input.profiles.find(p=>p.id===primaryId)?.healerRole!=='TEAM_WIDE_HEALER'||
   prepared.input.profiles.find(p=>p.id===secondaryId)?.healerRole!=='TEAM_WIDE_HEALER')
   return fail('VERIFIED_TEAM_WIDE_HEALERS_REQUIRED');
  const result=deps.healerSearch.plan({
   ...prepared.input,
   healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',
   sleepScore:100,primaryHealerId:primaryId,secondaryHealerId:secondaryId,
   beamWidth:options.beamWidth,dayCandidateCount:options.dayCandidateCount
  },{base:deps.baseCore,clock:deps.weekClock,policy:deps.healerPolicy});
  if(result.status!=='PROVISIONAL')return fail(result.reason||'HEALER_SEARCH_BLOCKED');
  if(result.slotCount!==29||result.totalHours!==168||
   result.startsAt!==ctx.clock.startsAt||result.endsAt!==ctx.clock.endsAt||
   result.weeklyEnergyCertified!==false||result.writesSavedData!==false||
   result.privateIndividualDataInResult!==false)
   return fail('HEALER_SEARCH_CONTRACT');
  return {status:'PROVISIONAL',stage:'F4_C_HEALER_FIRST_READONLY',
   readOnly:true,result,sourceCommit:prepared.sourceCommit,
   weekStart:ctx.weekStart,eventId:ctx.eventId,
   sleepScoreAssumed:100,weeklyEnergyCertified:false,
   writesSavedData:false,privateIndividualDataInResult:false};
 }
 // F4-C v101: optional higher-fidelity rerank. Existing saved plan, sleep
 // teams, event owner and storage values stay read-only. No inferred taps.
 function itemAwareReference(storage,options={},deps={}){
  if(typeof deps.itemRank?.rank!=='function'||typeof deps.skillValues?.skillValue!=='function')
   return fail('ITEM_AWARE_DEPENDENCIES_MISSING');
  if(options.collectionScenario!=='ASSUMED_AT_0730_1200_1800'||
   options.initialHeldScenario!=='EMPTY_AT_0400_ASSUMED'||
   options.skillScenario!=='CAPPED_EXPECTED_DIRECT_ONLY'||
   !['NO_CRITICAL','BASE_10_30_EXPECTATION'].includes(options.criticalScenario))
   return fail('REFERENCE_ASSUMPTIONS_NOT_SELECTED');
  const ctx=readContext(storage,deps,options.instant);
  if(ctx.status!=='CONTEXT_READY')return ctx;
  if(ctx.autoSleep)return fail('MANUAL_SLEEP_REQUIRED');
  const prepared=buildNeutralInput(ctx,options,deps);
  if(prepared.status!=='READY')return prepared;
  const a=options.primaryHealerIndex,b=options.secondaryHealerIndex;
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a===b||
   a<0||b<0||a>=ctx.privateBoxRows.length||b>=ctx.privateBoxRows.length)
   return fail('EXPLICIT_HEALERS_REQUIRED');
  const profiles=prepared.input.profiles;
  if(profiles.find(p=>p.id==='p'+a)?.healerRole!=='TEAM_WIDE_HEALER'||
   profiles.find(p=>p.id==='p'+b)?.healerRole!=='TEAM_WIDE_HEALER')
   return fail('VERIFIED_TEAM_WIDE_HEALERS_REQUIRED');
  const result=deps.itemRank.rank({...prepared.input,
   primaryHealerId:'p'+a,secondaryHealerId:'p'+b,
   healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',sleepScore:100,
   collectionScenario:options.collectionScenario,
   initialHeldScenario:options.initialHeldScenario,
   skillScenario:options.skillScenario,criticalScenario:options.criticalScenario,
   displayedRecipeEnergies:options.displayedRecipeEnergies,
   // v102 remains opt-in. Undefined values keep exact v101 behavior.
   cookingSkillScenario:options.cookingSkillScenario,
   cookingSkillEvents:options.cookingSkillEvents,
   initialCookingBuffs:options.initialCookingBuffs,
   recipeChoicePolicy:options.recipeChoicePolicy,
   unlockedIngredientCodes:options.unlockedIngredientCodes,
   beamWidth:options.beamWidth,dayCandidateCount:options.dayCandidateCount
  },{search:deps.healerSearch,policy:deps.healerPolicy,
   base:deps.baseCore,clock:deps.weekClock,skillValues:deps.skillValues,
   cookingSkills:deps.cookingSkills});
  if(result.status!=='PROVISIONAL')
   return fail(result.reason||'ITEM_AWARE_REFERENCE_BLOCKED');
  if(result.weekStart!==ctx.weekStart||result.slotCount!==29||
   result.startsAt!==ctx.clock.startsAt||result.endsAt!==ctx.clock.endsAt||
   result.weeklyEnergyCertified!==false||result.writesSavedData!==false||
   result.privateIndividualDataInResult!==false)
   return fail('ITEM_AWARE_REFERENCE_CONTRACT');
  return {status:'PROVISIONAL',readOnly:true,
   stage:'F4_C_V101_E7_LOCAL_REFERENCE',
   weekStart:ctx.weekStart,eventId:ctx.eventId,
   sourceCommit:prepared.sourceCommit,result,
   weeklyEnergyCertified:false,writesSavedData:false,
   privateIndividualDataInResult:false};
 }
 return Object.freeze({readContext,publicStatus,buildNeutralInput,reference,
  statefulScenario,healerFirstReference,itemAwareReference,keyFor});
});

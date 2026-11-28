/* F4-C v112 integrated real-Box, automatic primary+secondary healers.
 * Candidate comparison explicitly includes favorite berry energy of healers,
 * other members, cooking, team bonuses, and bounded healing coverage proxy.
 * No persistence, UI, private Pokemon rows or event-owner mutation.
 * An unknown pre-week carry is an EMPTY/UNOBSERVED time window, never a
 * fabricated actual sleeping team. Whole week is a provisional scenario.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PokeF4CAutoV112=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const FIXED=Object.freeze({
  'シアンの砂浜':['water','fairy','flying'],
  'トープ洞窟':['fire','ground','rock'],
  'ウノハナ雪原':['ice','normal','dark'],
  'ラピスラズリ湖畔':['grass','fighting','psychic'],
  'ゴールド旧発電所':['electric','ghost','steel'],
  'アンバー渓谷':['poison','bug','dragon']
 });
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,canAdopt:false,
  weeklyEnergyCertified:false,officialEventEnergyCertified:false});
 const five=x=>Array.isArray(x)&&x.length===5&&new Set(x).size===5&&
  x.every(i=>Number.isSafeInteger(i)&&i>=0&&i<10000);
 const sum=(arr,fn)=>arr.reduce((n,x)=>n+fn(x),0);
 function favorites(ctx,master){
  const types=master?.types;
  if(!types)return null;
  const source=ctx?.savedBerrySetup?.types;
  const select=Array.isArray(source)?source:FIXED[ctx?.fields?.field];
  if(!Array.isArray(select)||select.length!==3)return null;
  const codes=select.map(v=>Object.hasOwn(types,v)?v:
   Object.keys(types).find(k=>types[k]===v));
  return codes.every(Boolean)&&new Set(codes).size===3?codes:null;
 }
 // v127: A healer's role is an eligibility constraint, not a berry
 // preference. The fixed-100%-energy strategy needs strong HEALING even
 // though it does not simulate minute-by-minute recovery.
 // Conservative reference thresholds; NOT a guarantee of actual 100% energy.
 const HEALER_MIN_EFFECT_PER_CAST=15; // verified E4E/Berry Juice Lv5+ (Lv6=18)
 const HEALER_MIN_RECOVERY_PER_DAY=30;
 const HEALER_MIN_PRIMARY=20; // 16.5h reference
 const HEALER_MIN_SECONDARY=5; // 4.5h reference
 const HEALER_MIN_PAIR=30; // each member's expected recovery over 21h combined
 const HEALER_SKILLS=new Set(['Energy for Everyone S',
  'Energy for Everyone S (Berry Juice)']);
 function assessHealer(p,skillValues){
  const invalid=(reason)=>Object.freeze({qualified:false,reason,
   expectedDaily:0,expectedPrimary:0,expectedSecondary:0,
   level:p?.selectedMainSkillLevel??null,healPerCast:0});
  if(p?.healerRole!=='TEAM_WIDE_HEALER'||!HEALER_SKILLS.has(p.skillCode))
   return invalid('NOT_VERIFIED_TEAM_HEALER');
  const rate=p.ratesByTeammateBonus?.[0];
  if(!rate||!Number.isFinite(rate.helpSeconds)||rate.helpSeconds<=0||
   !Number.isFinite(rate.skillProbabilityPerEligibleHelp)||
   rate.skillProbabilityPerEligibleHelp<0||rate.skillProbabilityPerEligibleHelp>1)
   return invalid('HEALER_RATE_UNVERIFIED');
  const skill=skillValues?.skillValue?.(p.skillCode,p.selectedMainSkillLevel);
  // Berry Juice has a separately unpriced item bonus, but its team healing
  // amount (5/7/9/11/15/18) is still verified and usable.
  if(!['BASE_VALUE_ONLY','PARTIAL_SIDE_EFFECT_UNMODELED'].includes(skill?.status)||
   skill.unit!=='TEAM_ENERGY_POINTS_EACH'||!Number.isFinite(skill.value)||
   skill.value<=0)return invalid('HEALER_SKILL_LEVEL_UNVERIFIED');
  const expectedPerDay=24*3600/(rate.helpSeconds*.45)*
   rate.skillProbabilityPerEligibleHelp*skill.value;
  const qualified=skill.value>=HEALER_MIN_EFFECT_PER_CAST&&
   expectedPerDay>=HEALER_MIN_RECOVERY_PER_DAY;
  return Object.freeze({qualified,
   reason:qualified?null:'HEALER_RECOVERY_TOO_LOW',
   expectedDaily:expectedPerDay,
   expectedPrimary:expectedPerDay*16.5/24,
   expectedSecondary:expectedPerDay*4.5/24,
   level:p.selectedMainSkillLevel,healPerCast:skill.value});
 }
 function healerPairQuality(pair,profiles,skillValues){
  const p=assessHealer(profiles.get(pair[0]),skillValues);
  const s=assessHealer(profiles.get(pair[1]),skillValues);
  const expected=p.expectedPrimary+s.expectedSecondary;
  return Object.freeze({qualified:p.qualified&&s.qualified&&
   p.expectedPrimary>=HEALER_MIN_PRIMARY&&
   s.expectedSecondary>=HEALER_MIN_SECONDARY&&
   expected>=HEALER_MIN_PAIR,
   expected,primary:p,secondary:s});
 }
 function healerScore(p,skillValues,hours){
  const metric=assessHealer(p,skillValues);
  return metric.qualified?metric.expectedDaily*hours/24*5:0;
 }
 function quickScore(p,skillValues,primary){
  const rate=p.ratesByTeammateBonus[0];
  const hours=primary?16.5:4.5;
  return (rate.berryEnergyPerHelp+
   sum(Object.values(rate.ingredientCountsPerHelp),v=>v)*8)*
   3600/Math.max(rate.helpSeconds,1)*hours+
   healerScore(p,skillValues,hours)*2+
   Number(p.helpingBonus)*1000;
 }
 function nightScores(profiles,skillValues,hours,fieldBonus){
  // Quick overnight screen still uses ingredient potential, but all known
  // direct-energy skill gains are priced at the *actual* main-skill level.
  return profiles.map(p=>{
   const rate=p.ratesByTeammateBonus[0],helps=hours*3600/rate.helpSeconds;
   const food=sum(Object.values(rate.ingredientCountsPerHelp),x=>x);
   const items=helps*(food+rate.berryItemsPerHelp);
   const accepted=items>0&&Number.isFinite(p.carryLimit)?Math.min(1,p.carryLimit/items):1;
   const cap=['Skills','All'].includes(p.skillSpecialty)?2:1;
   const berryUnit=rate.berryItemsPerHelp>0?rate.berryEnergyPerHelp/rate.berryItemsPerHelp:0;
   const berries=helps*(accepted*rate.berryEnergyPerHelp+
    (accepted<1?(1-accepted)*rate.berryCountPerBerryHelp*berryUnit:0));
   const effect=skillValues?.skillValue?.(p.skillCode,p.selectedMainSkillLevel,
    {fieldBonusPercent:fieldBonus});
   const direct=['Charge Strength S','Charge Strength M',
    'Charge Strength S (Random)'].includes(p.skillCode)&&
    effect?.status==='BASE_VALUE_ONLY'&&
    ['ENERGY_PER_ACTIVATION','ENERGY_PER_ACTIVATION_EXPECTED'].includes(effect.unit)&&
    Number.isFinite(effect.value)&&
    Number.isFinite(rate.skillProbabilityPerEligibleHelp)?
    effect.value*Math.min(cap,rate.skillProbabilityPerEligibleHelp*helps*accepted):0;
   return {id:p.id,direct,score:(berries+food*helps*accepted*100+direct)/hours+Number(p.helpingBonus)*80};
  }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 }
 function selectNight(profiles,skillValues,hours=7.5,fieldBonus=0){
  return nightScores(profiles,skillValues,hours,fieldBonus).slice(0,5).map(p=>Number(p.id.slice(1)));
 }
 // This compares energy earned IN THE FULL DAYTIME ROSTER (berry/food/meal/
 // skill) with expected availability of sustained high-energy helping.
 // Coverage is a bounded engineering scenario, not recorded heal triggers.
 function rankingScore(result,pair,profiles,skillValues){
  const quality=healerPairQuality(pair,profiles,skillValues);
  // The user-approved fixed-energy scenario does not convert healing into
  // additional Snorlax energy. Healing is a strict eligibility gate.
  return {score:quality.qualified?result.energyExpected:-Infinity,
   recoveryProxyPoints:Math.round(quality.expected*7*10)/10,
   coverage:quality.qualified?1:0,healerQualified:quality.qualified};
 }
 function extract(input,ctx,deps){
  const pairSet=new Set(input.profiles.filter(p=>
   p.healerRole==='TEAM_WIDE_HEALER').map(p=>p.id));
  if(pairSet.size<2)return {error:'TWO_VERIFIED_HEALERS_MISSING'};
  if(input.profiles.filter(p=>p.healerRole!== 'TEAM_WIDE_HEALER').length<4)
   return {error:'FOUR_NON_HEALERS_MISSING'};
  const healers=input.profiles.filter(p=>pairSet.has(p.id)&&
   assessHealer(p,deps.skillValues).qualified);
  if(healers.length<2)return {error:'TWO_QUALIFIED_HEALERS_REQUIRED'};
  const map=new Map(healers.map(p=>[p.id,p]));
  const mains=[...healers].sort((a,b)=>quickScore(b,deps.skillValues,true)-
   quickScore(a,deps.skillValues,true)||a.id.localeCompare(b.id));
  const seconds=[...healers].sort((a,b)=>quickScore(b,deps.skillValues,false)-
   quickScore(a,deps.skillValues,false)||a.id.localeCompare(b.id));
  const choices=[];
  const append=(a,b)=>{if(a.id===b.id||
   !healerPairQuality([a.id,b.id],map,deps.skillValues).qualified)return;
   const key=a.id+'|'+b.id;
   if(!choices.some(x=>x.key===key))choices.push({key,ids:[a.id,b.id],
    rough:quickScore(a,deps.skillValues,true)+quickScore(b,deps.skillValues,false)});
  };
  // Score all pairs when <=5 healers (20 pairs max). At larger roster
  // sizes keep recovery-first AND favorite-berry-first profiles in pool.
  const lim=healers.length<=5?healers.length:Math.min(6,healers.length);
  for(const a of mains.slice(0,lim))for(const b of seconds.slice(0,lim))append(a,b);
  const shortlist=choices.sort((a,b)=>b.rough-a.rough||a.key.localeCompare(b.key))
   .slice(0,healers.length<=5?20:18).map(p=>p.ids);
  return shortlist.length?{shortlist}:{error:'HEALER_PAIR_RECOVERY_INSUFFICIENT'};
 }
 function propose(ctx,options={},deps={}){
  try{
   if(ctx?.status!=='CONTEXT_READY'||ctx.clock?.status!=='TIMELINE_READY'||
    ctx.clock.windowCount!==29||ctx.clock.phase!=='BEFORE')
    return fail('FULL_WEEK_REQUIRES_PRESTART_VERIFIED_CONTEXT');
   if(!deps.bridge?.buildNeutralInput||!deps.roster?.adapt||
    !deps.itemRank?.rank||!deps.healerSearch?.plan||
    !deps.healerPolicy?.validate||!deps.skillValues?.skillValue||
    !deps.baseCore?.normalizeProfiles||!deps.weekClock?.build)
    return fail('F4_C_DEPENDENCIES_MISSING');
   if(ctx.fields.field.endsWith('EX'))
    return fail('EX_EVENT_CONDITIONS_UNVERIFIED');
   const m1=!!(deps.m1Lite&&deps.cookingSkills);
   // Never label an official event optimized when its verified effects
   // cannot be priced. Legacy tests may still use the neutral-only model.
   if(ctx.fields.source!=null&&!m1)return fail('M1_EVENT_EVALUATOR_REQUIRED');
   const event=m1?deps.m1Lite.event(ctx):null;
   if(m1&&event.status!=='EVENT_READY')
    return fail(event.reason||'M1_EVENT_EFFECT_UNMODELED');
   const favorite=favorites(ctx,deps.master);
   if(!favorite)return fail('EVENT_FAVORITE_BERRIES_UNKNOWN');
   const player=ctx.player;
   if(!Number.isSafeInteger(player?.bonuses?.[ctx.fields.field]))
    return fail('FIELD_BONUS_REQUIRED');
   const basic=deps.roster.adapt({items:ctx.privateBoxRows,
    camp:ctx.fields.camp,fieldBonus:player.bonuses[ctx.fields.field],
    favoriteTypes:favorite},
    {snapshot:deps.snapshot,traits:deps.traits,legal:deps.legal,
     rates:deps.rates,master:deps.master});
   if(basic?.status!=='READY')return fail(basic?.reason||'LEGAL_ROSTER_MISSING');
   const elig=new Set(basic.profiles.map(p=>Number(p.id.slice(1))));
   let nights=options.manualNights,alternative=null;
   if(ctx.autoSleep===true){
    const roster=m1?deps.m1Lite.withEvent(basic.profiles,event,deps.skillValues):basic;
    if(!roster.profiles)return fail(roster.reason||'M1_EVENT_PROFILE_INVALID');
    const order=Array.from({length:7},(_,day)=>{
     const w=ctx.clock.windows.find(w=>w.slot==='sleep'&&w.day===day);
     return nightScores(roster.profiles,deps.skillValues,w?.hours??(day===6?4:7.5),
      player.bonuses[ctx.fields.field]);
    });
    nights=order.map(rows=>rows.slice(0,5).map(p=>Number(p.id.slice(1))));
    // Compare one skill-focused substitution. Preserve the rest of the night team.
    alternative=order.map((rows,day)=>{
     const chosen=rows.slice(0,5);
     const weakest=chosen.filter(p=>p.direct>0).sort((a,b)=>a.direct-b.direct)[0];
     const bench=rows.slice(5).filter(p=>p.direct>0).sort((a,b)=>b.direct-a.direct)[0];
     if(!weakest||!bench||bench.direct<=weakest.direct)return nights[day];
     return chosen.map(p=>Number((p===weakest?bench:p).id.slice(1)));
    });
   }
   if(!Array.isArray(nights)||nights.length!==7||
    nights.some(t=>!five(t)||t.some(i=>!elig.has(i))))
    return fail('SLEEP_PARTIES_NOT_CONFIGURED');
   const unknown=options.previousWeekSleepIndices==null;
   if(!unknown&&(!five(options.previousWeekSleepIndices)||
    options.previousWeekSleepIndices.some(i=>!elig.has(i))))
    return fail('PREVIOUS_SLEEP_INVALID');
   const copy={...ctx,autoSleep:false,hasSavedSleepSetting:true,
    fields:{...ctx.fields,source:null}};
   const prepared=deps.bridge.buildNeutralInput(copy,{
    neutralReferenceOnly:true,favoriteTypes:favorite,
    // The bridge still requires an index array for its legacy preflight;
    // the model explicitly empties the historical carry BEFORE search.
    previousWeekSleepIndices:unknown?nights[0]:options.previousWeekSleepIndices,
    realNightTeamIndices:nights
   },deps);
   if(prepared?.status!=='READY')return fail(prepared?.reason||'INPUT_NOT_READY');
   const input={...prepared.input,previousWeekCarryUnknown:unknown,
    previousWeekSleepTeam:unknown?[]:prepared.input.previousWeekSleepTeam,
    autoSleep:false};
   if(m1){
    const adjusted=deps.m1Lite.withEvent(input.profiles,event,deps.skillValues);
    if(adjusted.status!=='ROSTER_READY')
     return fail(adjusted.reason||'M1_EVENT_PROFILE_INVALID');
    input.profiles=adjusted.profiles;
    input.m1Event=event;
    input.m1Mode='M1_LIGHTWEIGHT_EVENT_V128';
    // Event potSize acts on the base pot, before Sunday and camp.
    // Fractional input is conservatively rounded downward.
    input.potCapacity=Math.floor(input.potCapacity*event.potSize+1e-9);
    if(!Number.isSafeInteger(input.potCapacity)||
     input.potCapacity<7||input.potCapacity>5000)
     return fail('M2_EVENT_POT_CAPACITY_UNVERIFIED');
   }
   if(![78,81].includes(input.recipes.length)||input.eventSource!==null)
    return fail('RECIPE_OR_EVENT_SOURCE_INVALID');
   if(options.prepPreference){
     input.preferredRecipes=options.prepPreference.selectedRecipes;
     input.preferredMealCounts=options.prepPreference.targetCounts;
    }
    const found=extract(input,ctx,deps);
   if(found.error)return fail(found.error);
   const profileMap=new Map(input.profiles.map(p=>[p.id,p]));
   const v125=typeof deps.diversity?.selectTeams==='function';
   const considered=[],errors=[];
   function evaluate(pair,nightTeams){
    const result=deps.itemRank.rank({...input,nightTeams,
     primaryHealerId:pair[0],secondaryHealerId:pair[1],
     healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',
     sleepScore:100,
     collectionScenario:'ASSUMED_AT_0730_1200_1800',
     initialHeldScenario:'EMPTY_AT_0400_ASSUMED',
     skillScenario:'CAPPED_EXPECTED_DIRECT_ONLY',
     criticalScenario:m1?'BASE_10_30_EXPECTATION':'NO_CRITICAL',
     beamWidth:12,
     dayCandidateCount:v125?12:8,
     candidateStrategy:v125?'V125_DIVERSE':'LEGACY_WEIGHTED'
    },{search:deps.healerSearch,policy:deps.healerPolicy,
     base:deps.baseCore,clock:deps.weekClock,skillValues:deps.skillValues,
     diversity:deps.diversity,m1Lite:deps.m1Lite,
     cookingSkills:deps.cookingSkills});
    if(result?.status!=='PROVISIONAL'||result.slots?.length!==29||
     result.weeklyEnergyCertified!==false){errors.push(result?.reason||'BAD_RESULT');return null;}
    const ranked=rankingScore(result,pair,profileMap,deps.skillValues);
    if(!ranked.healerQualified||!Number.isFinite(ranked.score))return null;
    return {pair,result,...ranked};
   }
   for(const pair of found.shortlist){
    const ranked=evaluate(pair,input.nightTeams);
    if(ranked)considered.push(ranked);
   }
   if(!considered.length)return fail(errors[0]||'NO_FEASIBLE_HEALER_PAIR');
   const compare=(a,b)=>(input.preferredRecipes?(b.result.preferredAchieved||0)-(a.result.preferredAchieved||0):0)||
     b.score-a.score||
    b.result.energyExpected-a.result.energyExpected||
    a.pair.join('|').localeCompare(b.pair.join('|'));
   considered.sort(compare);
   let win=considered[0];
   if(m1&&alternative?.some((team,day)=>team!==nights[day])){
    const other=evaluate(win.pair,alternative.map(team=>team.map(i=>'p'+i)));
    if(other&&compare(other,win)<0){win=other;nights=alternative;}
   }
   const slots=win.result.slots;
   for(let i=0;i<29;i++){
    const w=slots[i],ref=ctx.clock.windows[i];
    if(w.day!==ref.day||w.slot!==ref.slot||
     w.source!==ref.source||w.startsAt!==ref.startsAt||
     w.endsAt!==ref.endsAt)return fail('TIMELINE_MISMATCH');
    if(unknown&&i===0){
     if(w.team.length!==0)return fail('PREVIOUS_SLEEP_MUST_BE_UNOBSERVED');
     continue;
    }
    if(!five(w.team.map(x=>/^p\d+$/.test(x)?Number(x.slice(1)):-1)))
     return fail('INVALID_REAL_TEAM');
   }
   for(let day=0;day<7;day++){
    const [morning,noon,evening,night]=slots.slice(day*4+1,day*4+5);
    if(morning.team[4]!==win.pair[0]||morning.team[3]!==win.pair[1]||
     noon.team[4]!==win.pair[0]||evening.team[4]!==win.pair[0]||
     noon.team.includes(win.pair[1])||evening.team.includes(win.pair[1])||
     night.team.join('|')!==nights[day].map(i=>'p'+i).join('|'))
     return fail('DAYTIME_HEALER_OR_SLEEP_POLICY');
   }
   return Object.freeze({status:'PROVISIONAL',
    stage:'F4_C_INTEGRATED_V112',eventId:ctx.eventId,weekStart:ctx.weekStart,
    sourceCommit:prepared.sourceCommit,
    conditionRevision:ctx.conditionRevision,inventoryRevision:ctx.inventoryRevision,
    planningBasis:JSON.stringify([ctx.fields,ctx.player,ctx.savedBerrySetup??null,ctx.autoSleep,ctx.previousCarryRevision??null,
      ...(ctx.prepPreferenceRevision?[ctx.prepPreferenceRevision]:[])]),
    selectedPrimary:win.pair[0],selectedSecondary:win.pair[1],
    candidatePairsChecked:considered.length,
    candidateStrategy:v125?'V125_DIVERSE_STRATEGY_SCREEN':'LEGACY_WEIGHTED',
    favoriteTypes:favorite,previousWeekCarryUnknown:unknown,
    autoSleep:ctx.autoSleep===true,
    healerRecoveryProxyPoints:win.recoveryProxyPoints,
    healerCoverageScenario:win.coverage,
    expectedEnergy:win.result.energyExpected,
    rankingEnergyProxy:win.score,
    officialEffectsExcluded:ctx.fields.source!=null&&!m1,
    ...(m1?{m1Reference:true,eventSourceId:event.sourceId,
     eventDishMultiplier:event.dish}:{}),
    slots:slots.map(s=>({day:s.day,slot:s.slot,source:s.source,
     startsAt:s.startsAt,endsAt:s.endsAt,team:[...s.team],
     recipeId:Object.hasOwn(s,'cookedRecipeId')?s.cookedRecipeId:s.recipeId??null})),
    // Only the user may adopt after seeing the review; not yet certified.
    canAdopt:true,weeklyEnergyCertified:false,
    officialEventEnergyCertified:false,writesSavedData:false,
    scopeNote:m1?'Lv70料理・大成功確率・料理チャンスの発動期待値と、確認済みのイベント倍率を考慮する軽量週間参考計算。鍋拡張・特殊イベントの未評価効果やげんき実測は含まない':
     v125?'きのみ・食材・料理・スキル候補を保護した限定探索。未評価のスキル効果・げんき実測は含まない':
     '20食材/81料理の限定探索。主副ヒーラーのきのみと回復を含む参考シナリオ'});
  }catch(_){return fail('INVALID_INTEGRATED_PROPOSAL_INPUT');}
 }
 return Object.freeze({favorites,propose,rankingScore,selectNight,
  assessHealer,healerPairQuality});
});

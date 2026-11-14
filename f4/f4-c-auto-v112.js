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
 function healerScore(p,skillValues,hours){
  const rate=p.ratesByTeammateBonus?.[0];
  if(!rate||!['Energy for Everyone S','Energy for Everyone S (Berry Juice)']
   .includes(p.skillCode))return 0;
  const skill=skillValues?.skillValue(p.skillCode,p.selectedMainSkillLevel);
  if(skill?.unit!=='TEAM_ENERGY_POINTS_EACH'||
   !Number.isFinite(skill.value)||skill.value<0||
   !Number.isFinite(rate.skillProbabilityPerEligibleHelp))return 0;
  const helps=hours*3600/(rate.helpSeconds*.45);
  return Math.max(0,helps*rate.skillProbabilityPerEligibleHelp*skill.value*5);
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
 function selectNight(profiles){
  const available=[...profiles].map(p=>{
   const rate=p.ratesByTeammateBonus[0];
   return {id:p.id,score:rate.berryEnergyPerHelp*3600/
    Math.max(1,rate.helpSeconds)+
    sum(Object.values(rate.ingredientCountsPerHelp),x=>x)*150+
    Number(p.helpingBonus)*80};
  }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return available.slice(0,5).map(p=>Number(p.id.slice(1)));
 }
 // This compares energy earned IN THE FULL DAYTIME ROSTER (berry/food/meal/
 // skill) with expected availability of sustained high-energy helping.
 // Coverage is a bounded engineering scenario, not recorded heal triggers.
 function rankingScore(result,pair,profiles,skillValues){
  const p=profiles.get(pair[0]),s=profiles.get(pair[1]);
  const total=healerScore(p,skillValues,16.5*7)+
   healerScore(s,skillValues,4.5*7);
  const coverage=Math.min(1,total/(5*7*40));
  return {score:result.energyExpected*(.65+.35*coverage),
   recoveryProxyPoints:Math.round(total*10)/10,coverage};
 }
 function extract(input,ctx,deps){
  const pairSet=new Set(input.profiles.filter(p=>
   p.healerRole==='TEAM_WIDE_HEALER').map(p=>p.id));
  if(pairSet.size<2)return {error:'TWO_VERIFIED_HEALERS_MISSING'};
  if(input.profiles.filter(p=>p.healerRole!== 'TEAM_WIDE_HEALER').length<4)
   return {error:'FOUR_NON_HEALERS_MISSING'};
  const healers=input.profiles.filter(p=>pairSet.has(p.id));
  const mains=[...healers].sort((a,b)=>quickScore(b,deps.skillValues,true)-
   quickScore(a,deps.skillValues,true)||a.id.localeCompare(b.id));
  const seconds=[...healers].sort((a,b)=>quickScore(b,deps.skillValues,false)-
   quickScore(a,deps.skillValues,false)||a.id.localeCompare(b.id));
  const choices=[];
  const append=(a,b)=>{if(a.id===b.id)return;
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
  return {shortlist};
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
   const nights=ctx.autoSleep===true?
    Array.from({length:7},()=>selectNight(basic.profiles)):
    options.manualNights;
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
   if(input.recipes.length!==78||input.eventSource!==null)
    return fail('RECIPE_OR_EVENT_SOURCE_INVALID');
   const found=extract(input,ctx,deps);
   if(found.error)return fail(found.error);
   const profileMap=new Map(input.profiles.map(p=>[p.id,p]));
   const considered=[],errors=[];
   for(const pair of found.shortlist){
    const result=deps.itemRank.rank({...input,
     primaryHealerId:pair[0],secondaryHealerId:pair[1],
     healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',
     sleepScore:100,
     collectionScenario:'ASSUMED_AT_0730_1200_1800',
     initialHeldScenario:'EMPTY_AT_0400_ASSUMED',
     skillScenario:'CAPPED_EXPECTED_DIRECT_ONLY',
     criticalScenario:'NO_CRITICAL',beamWidth:12,dayCandidateCount:8
    },{search:deps.healerSearch,policy:deps.healerPolicy,
     base:deps.baseCore,clock:deps.weekClock,skillValues:deps.skillValues});
    if(result?.status!=='PROVISIONAL'||result.slots?.length!==29||
     result.weeklyEnergyCertified!==false){errors.push(result?.reason||'BAD_RESULT');continue;}
    const ranked=rankingScore(result,pair,profileMap,deps.skillValues);
    considered.push({pair,result,...ranked});
   }
   if(!considered.length)return fail(errors[0]||'NO_FEASIBLE_HEALER_PAIR');
   considered.sort((a,b)=>b.score-a.score||
    b.result.energyExpected-a.result.energyExpected||
    a.pair.join('|').localeCompare(b.pair.join('|')));
   const win=considered[0],slots=win.result.slots;
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
    planningBasis:JSON.stringify([ctx.fields,ctx.player,ctx.savedBerrySetup??null,ctx.autoSleep,ctx.previousCarryRevision??null]),
    selectedPrimary:win.pair[0],selectedSecondary:win.pair[1],
    candidatePairsChecked:considered.length,
    favoriteTypes:favorite,previousWeekCarryUnknown:unknown,
    autoSleep:ctx.autoSleep===true,
    healerRecoveryProxyPoints:win.recoveryProxyPoints,
    healerCoverageScenario:win.coverage,
    expectedEnergy:win.result.energyExpected,
    rankingEnergyProxy:win.score,
    officialEffectsExcluded:ctx.fields.source!=null,
    slots:slots.map(s=>({day:s.day,slot:s.slot,source:s.source,
     startsAt:s.startsAt,endsAt:s.endsAt,team:[...s.team],
     recipeId:Object.hasOwn(s,'cookedRecipeId')?s.cookedRecipeId:s.recipeId??null})),
    // Only the user may adopt after seeing the review; not yet certified.
    canAdopt:true,weeklyEnergyCertified:false,
    officialEventEnergyCertified:false,writesSavedData:false,
    scopeNote:'現行19食材/78料理の限定探索。主副ヒーラーのきのみと回復を含む参考シナリオ'});
  }catch(_){return fail('INVALID_INTEGRATED_PROPOSAL_INPUT');}
 }
 return Object.freeze({favorites,propose,rankingScore,selectNight});
});

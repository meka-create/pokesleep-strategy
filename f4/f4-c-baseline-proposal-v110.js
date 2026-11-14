/* F4-C v110: read-only 19/78 real-Box 29-window proposal. No F5 / adoption. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PokeF4CBaselineProposalV110=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const fail=reason=>Object.freeze({status:'BLOCKED',reason,weeklyEnergyCertified:false,writesSavedData:false,privateIndividualDataInResult:false});
const five=x=>Array.isArray(x)&&x.length===5&&new Set(x).size===5&&x.every(i=>Number.isSafeInteger(i)&&i>=0&&i<10000);
function propose(ctx,opts={},deps={}){
try{
 if(ctx?.status!=='CONTEXT_READY'||ctx.clock?.status!=='TIMELINE_READY'||ctx.clock.windowCount!==29||ctx.clock.totalHours!==168||!ctx.eventId||!ctx.weekStart)return fail('VERIFIED_E7_CONTEXT_REQUIRED');
 if(ctx.clock.phase!=='BEFORE')return fail('MIDWEEK_REQUIRES_F5');
 if(ctx.autoSleep!==false)return fail('MANUAL_REAL_SLEEP_REQUIRED');
 if(typeof ctx.fields?.field!=='string'||ctx.fields.field.endsWith('EX'))return fail('EX_NOT_MODELED');
 const official=ctx.fields.source!=null;
 if(official&&opts.explicitBaselineConsent!==true)return fail('OFFICIAL_BONUS_EXCLUSION_CONSENT_REQUIRED');
 if(!five(opts.previousWeekSleepIndices)||!five(opts.sleepTeamIndices))return fail('EXPLICIT_SLEEP_TEAMS_REQUIRED');
 if(!Number.isSafeInteger(opts.primaryHealerIndex)||!Number.isSafeInteger(opts.secondaryHealerIndex)||opts.primaryHealerIndex<0||opts.secondaryHealerIndex<0||opts.primaryHealerIndex===opts.secondaryHealerIndex)return fail('TWO_HEALERS_REQUIRED');
 if(!Array.isArray(opts.favoriteTypes)||opts.favoriteTypes.length!==3||new Set(opts.favoriteTypes).size!==3||opts.favoriteTypes.some(x=>typeof x!=='string'||!x))return fail('THREE_FAVORITES_REQUIRED');
 if(typeof deps.bridge?.buildNeutralInput!=='function'||typeof deps.itemRank?.rank!=='function'||!deps.healerSearch?.plan||!deps.healerPolicy?.validate||!deps.baseCore?.normalizeProfiles||!deps.weekClock?.build||!deps.skillValues?.skillValue)return fail('F4C_DEPENDENCIES_MISSING');
 // Only the temporary mathematical context is unbonused. Stored official
 // event ID, provenance, conditions and inventory are never changed.
 const local=official?{...ctx,fields:{...ctx.fields,source:null}}:ctx;
 const prepared=deps.bridge.buildNeutralInput(local,{
  neutralReferenceOnly:true,favoriteTypes:opts.favoriteTypes,
  previousWeekSleepIndices:opts.previousWeekSleepIndices,
  realNightTeamIndices:Array.from({length:7},()=>[...opts.sleepTeamIndices])
 },deps);
 if(prepared?.status!=='READY')return fail(prepared?.reason||'ROSTER_INVALID');
 const input=prepared.input;
 if(input.eventSource!==null||input.eventMode!=='NEUTRAL_REFERENCE_ONLY'||input.autoSleep!==false||input.recipes?.length!==78||!/^[a-f0-9]{40}$/.test(prepared.sourceCommit||''))return fail('BASELINE_PROVENANCE_INVALID');
 const profiles=new Map(input.profiles.map(p=>[p.id,p]));
 const main='p'+opts.primaryHealerIndex,secondary='p'+opts.secondaryHealerIndex;
 if(profiles.get(main)?.healerRole!=='TEAM_WIDE_HEALER'||profiles.get(secondary)?.healerRole!=='TEAM_WIDE_HEALER')return fail('PINNED_HEALERS_REQUIRED');
 const outcome=deps.itemRank.rank({...input,
  primaryHealerId:main,secondaryHealerId:secondary,
  healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',sleepScore:100,
  collectionScenario:'ASSUMED_AT_0730_1200_1800',
  initialHeldScenario:'EMPTY_AT_0400_ASSUMED',
  skillScenario:'CAPPED_EXPECTED_DIRECT_ONLY',criticalScenario:'NO_CRITICAL',
  beamWidth:12,dayCandidateCount:8
 },{search:deps.healerSearch,policy:deps.healerPolicy,
   base:deps.baseCore,clock:deps.weekClock,skillValues:deps.skillValues});
 if(outcome?.status!=='PROVISIONAL'||outcome.slotCount!==29||outcome.slots?.length!==29||
  outcome.weeklyEnergyCertified!==false||outcome.writesSavedData!==false||
  outcome.privateIndividualDataInResult!==false||
  outcome.startsAt!==ctx.clock.startsAt||outcome.endsAt!==ctx.clock.endsAt)
   return fail(outcome?.reason||'UNVERIFIED_CALCULATION_RESULT');
 const validRecipes=new Set(input.recipes.map(r=>r.id));
 for(let i=0;i<29;i++){
  const w=outcome.slots[i],t=ctx.clock.windows[i];
  if(w.day!==t.day||w.slot!==t.slot||w.source!==t.source||
   w.startsAt!==t.startsAt||w.endsAt!==t.endsAt||
   !five(w.team.map(id=>/^p(?:0|[1-9]\d*)$/.test(id)?Number(id.slice(1)):-1))||
   w.team.some(id=>!profiles.has(id))||
   (w.recipeId!==null&&!validRecipes.has(w.recipeId)))return fail('UNVERIFIED_WINDOW_OR_RECIPE');
 }
 if(outcome.slots[0].team.join(',')!==opts.previousWeekSleepIndices.map(i=>'p'+i).join(','))return fail('PREVIOUS_WEEK_SLEEP_MISMATCH');
 for(let day=0;day<7;day++){
  const list=outcome.slots.slice(1+day*4,5+day*4);
  if(list[3]?.slot!=='sleep'||list[3].team.join(',')!==opts.sleepTeamIndices.map(i=>'p'+i).join(',')||
   list[0].team[3]!==secondary||list[0].team[4]!==main||
   list[1].team[4]!==main||list[2].team[4]!==main||
   list[1].team.includes(secondary)||list[2].team.includes(secondary))return fail('HEALER_SLEEP_POLICY_MISMATCH');
 }
 return Object.freeze({status:'PROVISIONAL',stage:'F4_C_BASELINE_V110',
  eventId:ctx.eventId,weekStart:ctx.weekStart,sourceCommit:prepared.sourceCommit,
  conditionRevision:ctx.conditionRevision,inventoryRevision:ctx.inventoryRevision,
  mode:official?'EXPLICIT_OFFICIAL_BONUS_EXCLUDED':'NEUTRAL_BASELINE',
  officialEffectsExcluded:official,newFoodExcluded:true,scenarioBased:true,
  energyExpected:outcome.energyExpected,mealEnergyExpected:outcome.mealsExpected,
  slots:outcome.slots.map(w=>({day:w.day,slot:w.slot,source:w.source,
    startsAt:w.startsAt,endsAt:w.endsAt,team:[...w.team],
    recipeId:w.cookedRecipeId??w.recipeId??null})),
  canAdopt:false,weeklyEnergyCertified:false,officialEventEnergyCertified:false,
  writesSavedData:false,privateIndividualDataInResult:false});
}catch(_){return fail('INVALID_F4C_BASELINE_INPUT');}
}
return Object.freeze({propose});
});

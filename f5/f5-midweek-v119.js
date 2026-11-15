/* F5 v119: event-owned, stock-anchored remaining-window reference.
 * Past adopted forecasts are NOT observed history. Never run a full-week
 * optimizer with a midweek inventory as its initial week-start inventory.
 * The active window is frozen to the previously adopted lineup, with only
 * its unelapsed hours simulated. No meal or collection is invented at anchor.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PokeF5MidweekV119=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PREFIX='pokesleep-strategy-f5-v119:partial:',HOUR=3600000;
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,weeklyEnergyCertified:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const five=x=>Array.isArray(x)&&x.length===5&&new Set(x).size===5;
 const oldKey=(store,c)=>store.key('plan',c.weekStart,c.eventId);
 const key=c=>PREFIX+c.weekStart+':'+encodeURIComponent(c.eventId);
 const basis=c=>JSON.stringify([c.fields,c.player,c.savedBerrySetup??null,c.autoSleep,c.previousCarryRevision??null]);
 const rev=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();
 const clockFields=(a,b)=>a.day===b.day&&a.slot===b.slot&&a.source===b.source&&
  a.startsAt===b.startsAt&&a.endsAt===b.endsAt;
 const statusFor=(w,anchor)=>Date.parse(w.endsAt)<=anchor?'PAST_FORECAST_ONLY':
  Date.parse(w.startsAt)<anchor?'ACTIVE_REMAINDER':'FUTURE_FORECAST';
 const idsOK=(ids,identity)=>Array.isArray(ids)&&ids.every(id=>identity.byId.has(id));
 const sameLine=(a,b)=>a.join('|')===b.join('|');
 function reference(ctx,previous,identity,deps={}){
  try{
   if(ctx?.status!=='CONTEXT_READY'||ctx.clock?.phase!=='DURING'||
    !['ADOPTED','STALE_ADOPTED'].includes(previous?.status)||
    identity?.status!=='IDENTITIES_READY'||!deps.weekClock?.build||
    !deps.roster?.adapt||!deps.base?.normalizeProfiles||
    !deps.base?.normalizeRecipes||!deps.policy?.validate||
    !deps.policy?.candidateTeams||!deps.auto?.favorites||
    !deps.auto?.rankingScore||!deps.skillValues?.skillValue)
    return fail('F5_CONTEXT_OR_PREVIOUS_PLAN_REQUIRED');
   const anchor=Date.parse(ctx.inventorySavedAt),now=Date.parse(ctx.clock.asOf);
   const start=Date.parse(ctx.clock.startsAt),end=Date.parse(ctx.clock.endsAt);
   // The inventory is a user-confirmed snapshot, not a measurement now.
   // An old snapshot cannot be silently projected forward across unknown taps.
   if(!Number.isFinite(anchor)||anchor<start||anchor>=end||
    now<anchor||now-anchor>30*60000)return fail('FRESH_MIDWEEK_INVENTORY_REQUIRED');
   const clock=deps.weekClock.build(ctx.weekStart,ctx.inventorySavedAt);
   if(clock.status!=='TIMELINE_READY'||clock.windowCount!==29||
    !Array.isArray(previous.slots)||previous.slots.length!==29)
    return fail('F5_TIMELINE_INVALID');
   const rootRaw=deps.storage?.getItem(oldKey(deps.store,ctx));
   if(!rootRaw)return fail('F5_ORIGINAL_ADOPTION_MISSING');
   const original=JSON.parse(rootRaw);
   if(original.kind!=='REAL_BOX_PLAN_V112'||original.weekStart!==ctx.weekStart||
    original.eventId!==ctx.eventId||typeof original.revision!=='string')
    return fail('F5_ORIGINAL_OWNER_INVALID');
   if(previous.plan?.kind==='F5_PARTIAL_PLAN_V119'&&
      previous.plan.rootPlanRevision!==original.revision)
    return fail('F5_PREVIOUS_PLAN_ROOT_CHANGED');
   const partialRaw=deps.storage.getItem(key(ctx));
   if(partialRaw!==null&&previous.plan?.kind!=='F5_PARTIAL_PLAN_V119')
    return fail('F5_LATEST_ADOPTION_NOT_LOADED');
   if(partialRaw===null&&previous.plan?.kind==='F5_PARTIAL_PLAN_V119')
    return fail('F5_LATEST_ADOPTION_CHANGED');
   if(partialRaw!==null&&partialRaw!==previous.revision)
    return fail('F5_LATEST_ADOPTION_CHANGED');
   const favorite=deps.auto.favorites(ctx,deps.master);
   if(!favorite||ctx.fields.field.endsWith('EX'))return fail('F5_BERRY_OR_EX_MODEL_UNVERIFIED');
   const player=ctx.player,fieldBonus=player?.bonuses?.[ctx.fields.field];
   if(!Number.isSafeInteger(fieldBonus)||fieldBonus<0||fieldBonus>100||
    !Number.isSafeInteger(player?.bag)||player.bag<1||player.bag>5000||
    !Number.isSafeInteger(player?.pot)||player.pot<7||player.pot>5000)
    return fail('F5_PLAYER_VALUES_REQUIRED');
   const foods=deps.base.FOOD,dict=deps.master?.ingredients;
   if(!Array.isArray(foods)||foods.length!==19||!plain(dict)||
    Object.keys(dict).length!==19||Object.keys(ctx.inventoryValues||{}).length!==19||
    !Array.isArray(deps.recipes)||deps.recipes.length!==78)
    return fail('F5_PINNED_19_78_INPUT_REQUIRED');
   const inventory={};
   for(const f of foods){
    const val=ctx.inventoryValues[dict[f]];
    if(!Number.isSafeInteger(val)||val<0||val>10000)
     return fail('F5_STOCK_INVALID');
    inventory[f]=val;
   }
   if(Object.values(inventory).reduce((a,b)=>a+b,0)>player.bag)
    return fail('F5_STOCK_OVER_CAPACITY');
   const roster=deps.roster.adapt({items:ctx.privateBoxRows,
    camp:ctx.fields.camp,fieldBonus,favoriteTypes:favorite},
    {snapshot:deps.snapshot,traits:deps.traits,legal:deps.legal,
     rates:deps.rates,master:deps.master});
   if(roster?.status!=='READY')return fail(roster?.reason||'F5_ROSTER_INVALID');
   if(roster.sourceCommit!==deps.snapshot?.upstream?.commit)
    return fail('F5_SOURCE_COMMIT_MISMATCH');
   const profiles=deps.base.normalizeProfiles(roster.profiles);
   const people=new Map(profiles.map(p=>[p.id,p]));
   const eligible=new Set(profiles.map(p=>p.id));
   const old=previous.slots.map((w,i)=>{
    if(!clockFields(w,clock.windows[i])||!Array.isArray(w.teamIndices))
     throw Error('PRIOR_SLOT_TIMELINE_INVALID');
    const team=w.teamIndices.map(j=>'p'+j);
    if(team.some(id=>!eligible.has(id))||
       !(five(team)||(i===0&&team.length===0))||
       clock.windows[i].slot==='sleep'&&w.recipeId!==null)
     throw Error('PRIOR_SLOT_ID_INVALID');
    return {day:w.day,slot:w.slot,source:w.source,startsAt:w.startsAt,
     endsAt:w.endsAt,team,recipeId:w.recipeId??null};
   });
   const anchorIndex=clock.windows.findIndex(w=>Date.parse(w.endsAt)>anchor);
   if(anchorIndex<0)return fail('F5_NO_REMAINING_WINDOWS');
   const recipes=deps.base.normalizeRecipes(deps.recipes)
    .filter(r=>ctx.fields.food==='all'||r.type===ctx.fields.food);
   if(!recipes.length)return fail('F5_NO_ALLOWED_RECIPES');
   const healerIds=roster.profiles.filter(p=>p.healerRole==='TEAM_WIDE_HEALER')
    .map(p=>p.id);
   if(healerIds.length<2||roster.profiles.length-healerIds.length<4)
    return fail('F5_HEALER_ROSTER_INSUFFICIENT');
   function rate(id,team){
    const p=people.get(id);
    if(!p)throw Error('UNKNOWN_POKEMON');
    const bonus=team.reduce((n,other)=>n+Number(other!==id&&people.get(other)?.helpingBonus),0);
    if(!p.rates[bonus])throw Error('MISSING_TEAM_RATE');
    return p.rates[bonus];
   }
   const demand=Object.fromEntries(foods.map(f=>[f,0]));
   for(const r of [...recipes].sort((a,b)=>b.baseStrength-a.baseStrength).slice(0,7))
    for(const f of foods)demand[f]+=r.requirements[f]||0;
   const totalDemand=Math.max(1,Object.values(demand).reduce((a,b)=>a+b,0));
   function teamValue(team,weight){
    return team.reduce((sum,id)=>{
     const r=rate(id,team),hourly=3600/r.helpSeconds;
     return sum+hourly*(r.berryEnergyPerHelp+weight*
      foods.reduce((s,f)=>s+r.ingredientCountsPerHelp[f]*demand[f]/totalDemand,0));
    },0);
   }
   function produce(stock,team,hours,slot,carry){
    const got={...stock},items=Object.fromEntries(foods.map(f=>[f,0]));
    let berry=0;
    for(const id of team){
     const r=rate(id,team),help=hours*3600/(r.helpSeconds*(slot==='sleep'?1:0.45));
     berry+=help*r.berryEnergyPerHelp;
     for(const f of foods)items[f]+=help*r.ingredientCountsPerHelp[f];
    }
    const used=Object.values(got).reduce((a,b)=>a+b,0);
    const incoming=Object.values(items).reduce((a,b)=>a+b,0);
    const factor=incoming?Math.min(1,Math.max(0,player.bag-used)/incoming):0;
    for(const f of foods)got[f]+=items[f]*factor;
    return {stock:got,berry:carry?0:berry};
   }
   const rank=s=>s.energy+Object.values(s.stock).reduce((a,b)=>a+b,0)*8;
   const pairs=[],profileMap=new Map(roster.profiles.map(p=>[p.id,p]));
   for(const primary of healerIds)for(const secondary of healerIds){
    if(primary===secondary)continue;
    const ids=[primary,secondary],energy=teamValue(ids,100);
    const recover=deps.auto.rankingScore({energyExpected:energy},ids,
     profileMap,deps.skillValues);
    if(!finite(recover?.score)||!finite(recover?.recoveryProxyPoints))
     return fail('F5_HEALER_RECOVERY_MODEL_INVALID');
    pairs.push({ids,energy,recovery:recover.recoveryProxyPoints,
     joint:recover.score});
   }
   // Do not preselect only strongest berry producers. Include independent
   // recovery-leading and total-energy-leading ordered pairs in bounded pool.
   const by=(key)=>[...pairs].sort((a,b)=>b[key]-a[key]||
    a.ids.join().localeCompare(b.ids.join()));
   const short=[],used=new Set(),cap=healerIds.length<=5?20:18;
   for(const keyName of ['joint','recovery','energy']){
    for(const pair of by(keyName).slice(0,cap)){
     const id=pair.ids.join('|');
     if(!used.has(id)){short.push(pair);used.add(id);}
     if(short.length>=cap)break;
    }
    if(short.length>=cap)break;
   }
   const possibilities=[];
   for(const pair of short){
    const [primary,secondary]=pair.ids;
    const policy=deps.policy.validate({profiles:roster.profiles,
     primaryHealerId:primary,secondaryHealerId:secondary,sleepScore:100});
    if(policy.status!=='POLICY_READY')continue;
    const choices={};
    let bad=false;
    for(const slot of ['morning','noon','evening']){
     const candidates=new Map();
     for(const weight of [0,300,1500,5000]){
      const sorted=[...policy.fillerIds].sort((a,b)=>
       teamValue([b],weight)-teamValue([a],weight)||a.localeCompare(b));
      const teams=deps.policy.candidateTeams(policy,slot,sorted,24);
      if(teams.status!=='CANDIDATES_READY'){bad=true;break;}
      for(const t of teams.teams)candidates.set(t.join('|'),t);
     }
     if(bad)break;
     choices[slot]=[...candidates.values()].sort((a,b)=>
      teamValue(b,600)-teamValue(a,600)||a.join().localeCompare(b.join())).slice(0,6);
     if(!choices[slot].length){bad=true;break;}
    }
    if(bad)continue;
    let beam=[{stock:{...inventory},energy:0,slots:[],signature:''}];
    for(let i=anchorIndex;i<29;i++){
     const w=clock.windows[i],future=Date.parse(w.startsAt)>=anchor;
     const remaining=Math.max(0,(Date.parse(w.endsAt)-
      Math.max(Date.parse(w.startsAt),anchor))/HOUR);
     const teams=!future?[old[i].team]:w.slot==='sleep'?
      [old[i].team]:choices[w.slot];
     const expanded=[];
     for(const state of beam){
      const pot=Math.round(player.pot*(w.day===6?2:1)*(ctx.fields.camp?1.5:1));
      const feasible=!future||w.slot==='sleep'?[]:recipes.filter(r=>
       r.size<=pot&&foods.every(f=>state.stock[f]+1e-8>=r.requirements[f]))
       .sort((a,b)=>b.baseStrength-a.baseStrength).slice(0,3);
      for(const dish of [null,...feasible]){
       const eaten={...state.stock};
       if(dish)for(const f of foods)eaten[f]-=dish.requirements[f];
       const meal=dish?Math.floor(dish.baseStrength*(1+fieldBonus/100)+1e-9):0;
       for(const team of teams){
        const estimated=produce(eaten,team,remaining,w.slot,
         w.source==='PREVIOUS_WEEK_SLEEP');
        const row=future?{...old[i],team:[...team],recipeId:dish?.id||null}:
         {...old[i]};
        row.windowPhase=future?'FUTURE_FORECAST':'ACTIVE_REMAINDER';
        row.remainingHours=remaining;
        expanded.push({stock:estimated.stock,
         energy:state.energy+meal+estimated.berry,
         slots:[...state.slots,row],
         signature:state.signature+(dish?.id||'-')+':'+team.join(',')+';'});
       }
      }
     }
     expanded.sort((a,b)=>rank(b)-rank(a)||a.signature.localeCompare(b.signature));
     beam=expanded.slice(0,8);
     if(!beam.length){bad=true;break;}
    }
    if(bad||!beam.length)continue;
    const winner=[...beam].sort((a,b)=>b.energy-a.energy||
     a.signature.localeCompare(b.signature))[0];
    // Same bounded recovery coverage proxy as F4-C, NOT actual skill procs.
    const ranked=deps.auto.rankingScore({energyExpected:winner.energy},
     pair.ids,profileMap,deps.skillValues);
    if(!finite(ranked?.score))continue;
    possibilities.push({primary,secondary,winner,score:ranked.score,
     recoveryProxyPoints:ranked.recoveryProxyPoints});
   }
   if(!possibilities.length)return fail('F5_NO_FEASIBLE_REMAINING_PLAN');
   possibilities.sort((a,b)=>b.score-a.score||
    (a.primary+'|'+a.secondary).localeCompare(b.primary+'|'+b.secondary));
   const best=possibilities[0];
   const prefix=old.slice(0,anchorIndex).map(w=>({...w,
    windowPhase:'PAST_FORECAST_ONLY',remainingHours:0}));
   const slots=[...prefix,...best.winner.slots];
   if(slots.length!==29||slots.some((s,i)=>!clockFields(s,clock.windows[i])))
    return fail('F5_OUTPUT_TIMELINE_MISMATCH');
   return Object.freeze({
    status:'PROVISIONAL',stage:'F5_REMAINING_V119',weekStart:ctx.weekStart,
    eventId:ctx.eventId,sourceCommit:roster.sourceCommit,
    conditionRevision:ctx.conditionRevision,inventoryRevision:ctx.inventoryRevision,
    inventorySavedAt:ctx.inventorySavedAt,planningBasis:basis(ctx),
    anchorAt:clock.asOf,anchorIndex,rootPlanRaw:rootRaw,
    expectedPartialRaw:partialRaw,baseRaw:previous.revision,
    selectedPrimary:best.primary,selectedSecondary:best.secondary,
    expectedRemainingEnergy:Math.round(best.winner.energy*1000)/1000,
    candidatePairsChecked:possibilities.length,
    healerRecoveryProxyPoints:best.recoveryProxyPoints,slots,
    pastEvidence:'UNOBSERVED_ADOPTED_FORECAST_ONLY',actualObservedCount:0,
    officialEffectsExcluded:ctx.fields.source!=null,autoSleep:ctx.autoSleep,
    weeklyEnergyCertified:false,officialEventEnergyCertified:false,
    canAdopt:true,writesSavedData:false,
    scopeNote:'現在庫からACTIVE残部と未来のみ参考試算。経過済み編成と料理は旧採用予測であり、実績未確認'});
  }catch(_){return fail('F5_REFERENCE_INPUT_OR_MODEL_INVALID');}
 }
 function shape(p,clock,recipes){
  if(!plain(p)||p.kind!=='F5_PARTIAL_PLAN_V119'||
   !Array.isArray(p.slots)||p.slots.length!==29||
   !Number.isInteger(p.anchorIndex)||p.anchorIndex<0||p.anchorIndex>=29||
   !Number.isFinite(Date.parse(p.anchorAt))||
   p.pastEvidence!=='UNOBSERVED_ADOPTED_FORECAST_ONLY'||
   p.actualObservedCount!==0||
   !Array.isArray(recipes)||clock?.status!=='TIMELINE_READY')return 'F5_RECORD_SHAPE_INVALID';
  const at=Date.parse(p.anchorAt),allowed=new Set(recipes.map(r=>r.id));
  for(let i=0;i<29;i++){
   const w=p.slots[i],ref=clock.windows[i];
   if(!plain(w)||!clockFields(w,ref)||
    w.windowPhase!==statusFor(ref,at)||
    !Array.isArray(w.teamIds)||
    !(five(w.teamIds)||i===0&&w.teamIds.length===0)||
    w.recipeId!==null&&(!allowed.has(w.recipeId)||ref.slot==='sleep'))
    return 'F5_RECORD_TIMELINE_OR_SOURCE_INVALID';
   if(i<p.anchorIndex&&w.remainingHours!==0)return 'F5_PAST_RECOMPUTED';
   if(i===p.anchorIndex&&
    (w.remainingHours<=0||w.remainingHours>ref.hours))
    return 'F5_ACTIVE_REMAINDER_INVALID';
   if(i>p.anchorIndex&&w.remainingHours!==ref.hours)
    return 'F5_FUTURE_HOURS_INVALID';
   if(i>p.anchorIndex&&ref.slot==='morning'&&
    (w.teamIds[3]!==p.secondaryId||w.teamIds[4]!==p.primaryId))
    return 'F5_FUTURE_HEALER_INVALID';
   if(i>p.anchorIndex&&['noon','evening'].includes(ref.slot)&&
    (w.teamIds[4]!==p.primaryId||w.teamIds.includes(p.secondaryId)))
    return 'F5_FUTURE_HEALER_INVALID';
  }
  if(p.slots.findIndex(w=>w.windowPhase!=='PAST_FORECAST_ONLY')!==p.anchorIndex)
   return 'F5_SPLIT_INDEX_INVALID';
  return null;
 }
 function read(storage,ctx,identity,sourceCommit,recipes,clock,store){
  try{
   if(ctx?.status!=='CONTEXT_READY'||identity?.status!=='IDENTITIES_READY')
    return fail('F5_READ_CONTEXT_REQUIRED');
   const raw=storage.getItem(key(ctx));
   if(raw===null)return {status:'EMPTY'};
   if(raw.length>4000000)return fail('F5_RECORD_TOO_BIG');
   const p=JSON.parse(raw),root=storage.getItem(oldKey(store,ctx));
   if(!root)return fail('F5_ORIGINAL_PLAN_MISSING');
   const original=JSON.parse(root);
   if(original.kind!=='REAL_BOX_PLAN_V112'||original.weekStart!==ctx.weekStart||
    original.eventId!==ctx.eventId||original.revision!==p.rootPlanRevision||
    p.eventId!==ctx.eventId||p.weekStart!==ctx.weekStart||
    p.sourceCommit!==sourceCommit)return fail('F5_SAVED_OWNER_SOURCE_OR_ROOT_CHANGED');
   const wrong=shape(p,clock,recipes);
   if(wrong)return fail(wrong);
   const all=[p.primaryId,p.secondaryId,...p.slots.flatMap(w=>w.teamIds)];
   if(!idsOK(all,identity)||all.some(id=>
     identity.digests.filter(x=>x===identity.digests[identity.byId.get(id)]).length!==1))
    return fail('F5_SAVED_BOX_CHANGED_OR_AMBIGUOUS');
   const stale=p.conditionRevision!==ctx.conditionRevision||
    p.inventoryRevision!==ctx.inventoryRevision||
    p.planningBasis!==basis(ctx)||
    p.autoSleep!==ctx.autoSleep;
   return {status:stale?'STALE_ADOPTED':'ADOPTED',
    ...(stale?{reason:'F5_SAVED_INPUTS_CHANGED'}:{}),
    plan:p,revision:raw,slots:p.slots.map(w=>({...w,
     teamIndices:w.teamIds.map(id=>identity.byId.get(id))}))};
  }catch(_){return fail('F5_SAVED_READ_FAILED');}
 }
 function adopt(storage,ctx,proposal,identity,sourceCommit,recipes,clock,store){
  try{
   if(proposal?.status!=='PROVISIONAL'||proposal.stage!=='F5_REMAINING_V119'||
    ctx?.status!=='CONTEXT_READY'||identity?.status!=='IDENTITIES_READY'||
    ctx.weekStart!==proposal.weekStart||ctx.eventId!==proposal.eventId||
    ctx.inventoryRevision!==proposal.inventoryRevision||
    ctx.conditionRevision!==proposal.conditionRevision||
    ctx.inventorySavedAt!==proposal.inventorySavedAt||
    basis(ctx)!==proposal.planningBasis||
    proposal.sourceCommit!==sourceCommit)
    return fail('F5_PROPOSAL_CONTEXT_CHANGED');
   const currentRoot=storage.getItem(oldKey(store,ctx));
   const currentPartial=storage.getItem(key(ctx));
   if(currentRoot!==proposal.rootPlanRaw||
    currentPartial!==proposal.expectedPartialRaw||
    proposal.baseRaw!==(currentPartial??currentRoot))
    return fail('F5_ADOPTION_CHANGED_SINCE_REVIEW');
   if(storage.getItem('pokesleep-strategy-e7-box-v1')!==identity.boxRaw||
    storage.getItem(store.LEDGER)!==identity.ledgerRevision)
    return fail('F5_BOX_CHANGED_SINCE_REVIEW');
   const old=JSON.parse(currentRoot);
   const translate=team=>team.map(id=>{
    if(typeof id!=='string'||!/^p(?:0|[1-9]\d*)$/.test(id))
     throw Error('BAD_ROSTER_REFERENCE');
    const ret=identity.ids[Number(id.slice(1))];
    if(!ret)throw Error('BAD_ROSTER_REFERENCE');
    return ret;
   });
   const slots=proposal.slots.map(w=>({
    day:w.day,slot:w.slot,source:w.source,
    startsAt:w.startsAt,endsAt:w.endsAt,teamIds:translate(w.team),
    recipeId:w.recipeId,windowPhase:w.windowPhase,
    remainingHours:w.remainingHours
   }));
   const record={kind:'F5_PARTIAL_PLAN_V119',version:1,
    weekStart:ctx.weekStart,eventId:ctx.eventId,
    rootPlanRevision:old.revision,conditionRevision:ctx.conditionRevision,
    inventoryRevision:ctx.inventoryRevision,inventorySavedAt:ctx.inventorySavedAt,
    planningBasis:proposal.planningBasis,sourceCommit,
    anchorAt:proposal.anchorAt,anchorIndex:proposal.anchorIndex,
    primaryId:translate([proposal.selectedPrimary])[0],
    secondaryId:translate([proposal.selectedSecondary])[0],
    expectedRemainingEnergy:proposal.expectedRemainingEnergy,
    candidatePairsChecked:proposal.candidatePairsChecked,
    pastEvidence:'UNOBSERVED_ADOPTED_FORECAST_ONLY',
    actualObservedCount:0,autoSleep:ctx.autoSleep,
    sourceMode:proposal.officialEffectsExcluded?'UNBONUSED_EVENT_REFERENCE':'NEUTRAL',
    weeklyEnergyCertified:false,slots,revision:rev()};
   const issue=shape(record,clock,recipes);
   if(issue)return fail('PROPOSED_'+issue);
   // All earlier windows + active team's historical projection remain byte-
   // equivalent in stable-ID space. No past is made into a verified observation.
   const baseline=currentPartial?JSON.parse(currentPartial):old;
   for(let i=0;i<=proposal.anchorIndex;i++){
    const a=record.slots[i],b=baseline.slots[i];
    if(a.recipeId!==b.recipeId||!sameLine(a.teamIds,b.teamIds))
     return fail('F5_PAST_OR_ACTIVE_TEAM_CHANGED');
   }
   const dup=record.slots.flatMap(w=>w.teamIds)
    .concat(record.primaryId,record.secondaryId);
   if(!idsOK(dup,identity))return fail('F5_IDENTITY_INVALID');
   if(storage.getItem(key(ctx))!==currentPartial||
    storage.getItem(oldKey(store,ctx))!==currentRoot)
    return fail('F5_CONCURRENT_PLAN_CHANGE');
   const raw=JSON.stringify(record);
   storage.setItem(key(ctx),raw);
   if(storage.getItem(key(ctx))!==raw)return fail('F5_WRITE_NOT_CONFIRMED');
   return read(storage,ctx,identity,sourceCommit,recipes,clock,store);
  }catch(_){return fail('F5_ADOPTION_FAILED_WITHOUT_CONFIRMED_SAVE');}
 }
 return Object.freeze({key,reference,read,adopt,shape});
});
/* F4-C v104: local-only, opt-in REFERENCE draft persistence.
 * Bridges p{rowIndex} from the provisional week optimizer to stable opaque
 * individual IDs. It DOES NOT adopt a strategy into the existing E7 plan.
 *
 * Data protection: raw Pokemon rows and nicknames never appear in the
 * sidecar. SHA-256 digests have a per-device local salt. All 29 slots and
 * stored teams are anonymized before serialization. No browser globals,
 * network APIs, automatic writes, or changes to accepted E7 storage keys.
 *
 * Important: exact duplicate builds have no immutable discriminator in
 * the pokesleep-tool export. Referencing such individuals is BLOCKED even
 * when their input indices have not changed. A level/trait edit will not
 * silently preserve an identity; re-approval is required.
 *
 * Store uses optimistic revision compare/readback. localStorage cannot
 * provide transaction isolation across concurrently open browser tabs.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CLocalDraftV104=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const KEY='pokesleep-strategy-f4c-v104:local-reference-only';
 const FIELDS=['nickname','pokemon','level','skillLevel','ing1','ing2','ing3',
  'mainSkill','nature','mint','lv10','lv25','lv50','lv70','lv80',
  'ribbon','shiny','favorite'];
 const ALLOWED=new Set(FIELDS);
 const STAGES=new Set(['F4_C_V101_ITEM_AWARE_RERANK',
  'F4_C_V102_COOKING_STATE_REFERENCE']);
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  officialPlanAdopted:false,weeklyEnergyCertified:false,
  writesExistingE7Data:false,privateIndividualDataInResult:false});
 const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
 const validId=s=>typeof s==='string'&&/^f4c_[a-f0-9-]{32,40}$/.test(s);
 const validRev=s=>typeof s==='string'&&/^[a-f0-9-]{32,40}$/.test(s);
 const validSourceRev=s=>typeof s==='string'&&s.length>0&&s.length<=160&&
  !/[\u0000-\u001f]/.test(s);
 const validSHA=s=>typeof s==='string'&&/^[0-9a-f]{40}$/.test(s);
 const validSalt=s=>typeof s==='string'&&/^[0-9a-f]{32}$/.test(s);
 const validISO=s=>typeof s==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(s)&&
  Number.isFinite(Date.parse(s));
 const unique=a=>Array.isArray(a)&&new Set(a).size===a.length;
 const number=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
 const foodOK=r=>r===null||(typeof r==='string'&&
  /^[a-z][a-z0-9_]{0,79}$/.test(r));
 const idFor=i=>'p'+i;
 const digestOK=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
 function secure(deps){
  const crypto=deps?.crypto;
  return crypto&&crypto.subtle&&typeof crypto.subtle.digest==='function'&&
   typeof crypto.getRandomValues==='function'&&
   typeof crypto.randomUUID==='function'&&
   typeof TextEncoder!=='undefined';
 }
 function freshSalt(crypto){
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
 }
 function canonical(row){
  if(!plain(row)||Object.keys(row).some(k=>!ALLOWED.has(k))||
   typeof row.pokemon!=='string'||!row.pokemon||
   !number(row.level,1,150)||!number(row.skillLevel,1,8))
   return null;
  const vals=[];
  for(const key of FIELDS){
   let v=Object.hasOwn(row,key)?row[key]:null;
   if(v===undefined)v=null;
   if(v!==null&&typeof v!=='string'&&typeof v!=='boolean'&&
    !(typeof v==='number'&&Number.isFinite(v)))
    return null;
   if(typeof v==='string'&&v.length>400)return null;
   vals.push(v);
  }
  return JSON.stringify(['pokesleep-strategy:canonical:v104',...vals]);
 }
 async function digestsFor(rows,salt,deps){
  if(!Array.isArray(rows)||rows.length<5||rows.length>10000||
   !validSalt(salt)||!secure(deps))return null;
  const encoder=new TextEncoder();
  const digests=[];
  for(const row of rows){
   const data=canonical(row);
   if(data===null)return null;
   const bytes=encoder.encode('f4c-v104|'+salt+'|'+data);
   const hash=new Uint8Array(await deps.crypto.subtle.digest('SHA-256',bytes));
   digests.push([...hash].map(x=>x.toString(16).padStart(2,'0')).join(''));
  }
  return digests;
 }
 function validDraft(d){
  if(!plain(d)||d.kind!=='REFERENCE_ONLY'||d.status!=='REFERENCE_DRAFT'||
   !validRev(d.draftId)||typeof d.eventId!=='string'||
   d.eventId.length>160||!/^manual:\d{4}-\d\d-\d\d$/.test(d.eventId)||
   !/^\d{4}-\d\d-\d\d$/.test(d.weekStart)||
   d.eventId!=='manual:'+d.weekStart||
   !validSourceRev(d.conditionsRevision)||!validSourceRev(d.inventoryRevision)||
   !validSHA(d.sourceCommit)||!validId(d.primaryId)||
   !validId(d.secondaryId)||d.primaryId===d.secondaryId||
   !validISO(d.createdAt)||!STAGES.has(d.sourceStage)||
   !Array.isArray(d.slots)||d.slots.length!==29)return false;
  return d.slots.every((w,i)=>plain(w)&&w.index===i&&
   number(w.day,-1,6)&&['morning','noon','evening','sleep'].includes(w.slot)&&
   ['PREVIOUS_WEEK_SLEEP','CURRENT_WEEK','FINAL_NIGHT_TRUNCATED'].includes(w.source)&&
   validISO(w.startsAt)&&validISO(w.endsAt)&&
   Array.isArray(w.teamIds)&&w.teamIds.length===5&&
   unique(w.teamIds)&&w.teamIds.every(validId)&&foodOK(w.recipeId));
 }
 function validState(v,identity){
  if(!plain(v)||v.version!==1||!validSalt(v.salt)||
   !validRev(v.revision)||!identity?.validate(v.ledger)||
   !Array.isArray(v.drafts)||v.drafts.length>16||
   v.drafts.some(d=>!validDraft(d)))return false;
  return unique(v.drafts.map(d=>d.eventId))&&
   v.ledger.entries.every(e=>digestOK(e.digest)&&validId(e.id));
 }
 function read(storage,identity){
  try{
   if(!storage||typeof storage.getItem!=='function')return fail('STORAGE_UNAVAILABLE');
   const raw=storage.getItem(KEY);
   if(raw===null)return {status:'EMPTY',state:null};
   if(typeof raw!=='string'||raw.length>3000000)return fail('LOCAL_STATE_TOO_LARGE');
   const obj=JSON.parse(raw);
   if(!validState(obj,identity))return fail('LOCAL_STATE_CORRUPTED');
   return {status:'LOADED',state:obj};
  }catch(_){return fail('LOCAL_STATE_CORRUPTED');}
 }
 function summary(storage,identity){
  const r=read(storage,identity);
  if(r.status==='BLOCKED')return r;
  return Object.freeze({status:r.status,revision:r.state?.revision||null,
   draftCount:r.state?.drafts?.length||0,hasLocalReference:r.status==='LOADED',
   officialPlanAdopted:false,weeklyEnergyCertified:false,
   writesExistingE7Data:false,privateIndividualDataInResult:false});
 }
 function contextOK(ctx,prepared,clock){
  if(ctx?.status!=='CONTEXT_READY'||typeof ctx.eventId!=='string'||
   !/^manual:\d{4}-\d\d-\d\d$/.test(ctx.eventId)||
   ctx.eventId!=='manual:'+ctx.weekStart||
   ctx.fields?.source!=null||ctx.autoSleep!==false||
   !validSourceRev(ctx.conditionRevision)||!validSourceRev(ctx.inventoryRevision)||
   !Array.isArray(ctx.privateBoxRows)||ctx.privateBoxRows.length<6||
   !validISO(ctx.clock?.asOf)||
   prepared?.status!=='READY'||!validSHA(prepared.sourceCommit)||
   prepared.input?.weekStart!==ctx.weekStart||
   prepared.input.eventSource!==null||
   prepared.input.eventMode!=='NEUTRAL_REFERENCE_ONLY'||
   prepared.input.autoSleep!==false||
   !Array.isArray(prepared.input.profiles)||
   !Array.isArray(prepared.input.recipes))
   return false;
  const c=clock?.build?.(ctx.weekStart,ctx.clock.asOf);
  return c?.status==='TIMELINE_READY'&&c.windowCount===29&&c.totalHours===168;
 }
 function verifyPath(ctx,prepared,plan,options,clock){
  if(plan?.status!=='PROVISIONAL'||!STAGES.has(plan.stage)||
   plan.weeklyEnergyCertified!==false||plan.writesSavedData!==false||
   plan.privateIndividualDataInResult!==false||
   plan.weekStart!==ctx.weekStart||plan.slotCount!==29||
   plan.sleepScoreAssumed!==100||
   !Array.isArray(plan.slots)||plan.slots.length!==29||
   !number(options?.primaryHealerIndex,0,9999)||
   !number(options?.secondaryHealerIndex,0,9999)||
   options.primaryHealerIndex===options.secondaryHealerIndex||
   options.explicitReferenceConsent!=='SAVE_PROVISIONAL_LOCAL_DRAFT')
   return fail('REFERENCE_PLAN_OR_CONSENT_INVALID');
  const profiles=new Map(prepared.input.profiles.map(p=>[p.id,p]));
  const a=idFor(options.primaryHealerIndex),b=idFor(options.secondaryHealerIndex);
  if(profiles.get(a)?.healerRole!=='TEAM_WIDE_HEALER'||
   profiles.get(b)?.healerRole!=='TEAM_WIDE_HEALER'||
   profiles.size!==prepared.input.profiles.length)
   return fail('VERIFIED_HEALERS_REQUIRED');
  const clocked=clock.build(ctx.weekStart,ctx.clock.asOf);
  if(plan.startsAt!==clocked.startsAt||plan.endsAt!==clocked.endsAt)
   return fail('REFERENCE_WEEK_MISMATCH');
  const hasFood=new Set(prepared.input.recipes.map(r=>r.id));
  const all=[];
  for(let i=0;i<29;i++){
   const w=plan.slots[i],window=clocked.windows[i];
   const team=w?.team;
   const recipe=Object.hasOwn(w||{},'cookedRecipeId')?
    w.cookedRecipeId:w?.recipeId;
   if(w?.day!==window.day||w.slot!==window.slot||
    w.source!==window.source||w.startsAt!==window.startsAt||
    w.endsAt!==window.endsAt||
    !Array.isArray(team)||team.length!==5||!unique(team)||
    team.some(id=>!profiles.has(id)||!/^p(?:0|[1-9]\d*)$/.test(id)||
     Number(id.slice(1))>=ctx.privateBoxRows.length)||
    !foodOK(recipe)||(recipe!==null&&!hasFood.has(recipe))||
    (w.slot==='sleep'&&recipe!==null))
    return fail('REFERENCE_WINDOW_OR_ROSTER_INVALID');
   if(w.source==='PREVIOUS_WEEK_SLEEP'){
    if(JSON.stringify(team)!==JSON.stringify(prepared.input.previousWeekSleepTeam))
     return fail('PREVIOUS_SLEEP_TEAM_CHANGED');
   }else if(w.slot==='sleep'){
    if(JSON.stringify(team)!==JSON.stringify(prepared.input.nightTeams?.[w.day]))
     return fail('FIXED_SLEEP_TEAM_CHANGED');
   }else{
    if(team[4]!==a||
     (w.slot==='morning'&&team[3]!==b)||
     (w.slot!=='morning'&&team.includes(b))||
     team.slice(0,w.slot==='morning'?3:4).some(id=>
      profiles.get(id).healerRole==='TEAM_WIDE_HEALER'))
     return fail('HEALER_DAYTIME_POLICY_CHANGED');
   }
   all.push({index:i,day:window.day,slot:window.slot,source:window.source,
    startsAt:window.startsAt,endsAt:window.endsAt,
    teamIndex:team.map(id=>Number(id.slice(1))),recipeId:recipe});
  }
  return {status:'PATH_VERIFIED',rows:all,primaryIndex:options.primaryHealerIndex,
   secondaryIndex:options.secondaryHealerIndex};
 }
 function usedRefs(draft){
  return [...new Set([draft.primaryId,draft.secondaryId,
   ...draft.slots.flatMap(w=>w.teamIds)])];
 }
 function duplicateUsed(digests,ledger,ids){
  const freq=new Map();
  for(const d of digests)freq.set(d,(freq.get(d)||0)+1);
  const byId=new Map(ledger.entries.map(e=>[e.id,e.digest]));
  return ids.some(id=>!byId.has(id)||freq.get(byId.get(id))!==1);
 }
 function validateReferenceAgainst(ctx,record,clock){
  if(record.eventId!==ctx.eventId||record.weekStart!==ctx.weekStart||
   record.conditionsRevision!==ctx.conditionRevision||
   record.inventoryRevision!==ctx.inventoryRevision)
   return fail('EVENT_REVISIONS_CHANGED');
  const time=clock.build(ctx.weekStart,ctx.clock.asOf);
  if(time.status!=='TIMELINE_READY'||time.windowCount!==29||
   record.slots.some((w,i)=>w.index!==i||
    w.day!==time.windows[i].day||w.slot!==time.windows[i].slot||
    w.source!==time.windows[i].source||
    w.startsAt!==time.windows[i].startsAt||
    w.endsAt!==time.windows[i].endsAt))
   return fail('SAVED_29_WINDOWS_MISMATCH');
  return {status:'CONSISTENT'};
 }
 async function saveLocalReference(args={},deps={}){
  const {storage,context:ctx,prepared,plan,options={}}=args;
  if(!secure(deps)||typeof storage?.setItem!=='function'||
   typeof deps.identity?.reconcile!=='function'||
   !contextOK(ctx,prepared,deps.clock))
   return fail('LOCAL_REFERENCE_DEPENDENCIES_MISSING');
  let rawAtStart;
  try{rawAtStart=storage.getItem(KEY);}catch(_){return fail('LOCAL_STATE_CORRUPTED');}
  const saved=read(storage,deps.identity);
  if(saved.status==='BLOCKED')return saved;
  if((saved.state?.revision||null)!==(options.expectedRevision??null))
   return fail('LOCAL_REFERENCE_CONFLICT');
  const policy=verifyPath(ctx,prepared,plan,options,deps.clock);
  if(policy.status!=='PATH_VERIFIED')return policy;
  const salt=saved.state?.salt||freshSalt(deps.crypto);
  const digests=await digestsFor(ctx.privateBoxRows,salt,deps);
  if(!digests)return fail('PRIVATE_BOX_HASH_UNAVAILABLE');
  const fresh=deps.identity.reconcile(digests,saved.state?.ledger||null,
   ()=> 'f4c_'+deps.crypto.randomUUID());
  if(fresh.status!=='IDENTITY_READY')return fail(fresh.reason);
  const entries=fresh.ledger.entries;
  const source=policy.rows.map(w=>({
   index:w.index,day:w.day,slot:w.slot,source:w.source,
   startsAt:w.startsAt,endsAt:w.endsAt,
   teamIds:w.teamIndex.map(i=>entries[i].id),recipeId:w.recipeId
  }));
  const draft={
   kind:'REFERENCE_ONLY',status:'REFERENCE_DRAFT',
   draftId:deps.crypto.randomUUID(),eventId:ctx.eventId,weekStart:ctx.weekStart,
   conditionsRevision:ctx.conditionRevision,
   inventoryRevision:ctx.inventoryRevision,
   sourceCommit:prepared.sourceCommit,
   sourceStage:plan.stage,createdAt:ctx.clock.asOf,
   primaryId:entries[policy.primaryIndex].id,
   secondaryId:entries[policy.secondaryIndex].id,
   slots:source
  };
  if(!validDraft(draft))return fail('LOCAL_REFERENCE_INVALID');
  if(duplicateUsed(digests,fresh.ledger,usedRefs(draft)))
   return fail('SELECTED_INDIVIDUAL_IDENTITY_AMBIGUOUS');
  const priorDrafts=saved.state?.drafts||[];
  const others=priorDrafts.filter(d=>d.eventId!==draft.eventId);
  if(others.length>=16)return fail('REFERENCE_DRAFT_CAPACITY_REACHED');
  const state={version:1,salt,revision:deps.crypto.randomUUID(),
   ledger:fresh.ledger,drafts:[...others,draft]};
  if(!validState(state,deps.identity))return fail('LOCAL_REFERENCE_INVALID');
  const payload=JSON.stringify(state);
  if(payload.length>3000000)return fail('LOCAL_STATE_TOO_LARGE');
  try{
   // Best-effort compare-and-swap, not cross-tab atomicity.
   if(storage.getItem(KEY)!==rawAtStart)
    return fail('LOCAL_REFERENCE_WRITE_RACE');
   const latest=read(storage,deps.identity);
   if(latest.status==='BLOCKED'||(latest.state?.revision||null)!==
    (options.expectedRevision??null))
    return fail('LOCAL_REFERENCE_CONFLICT');
   storage.setItem(KEY,payload);
   if(storage.getItem(KEY)!==payload)
    return fail('LOCAL_REFERENCE_WRITE_NOT_CONFIRMED');
  }catch(_){return fail('LOCAL_REFERENCE_WRITE_FAILED');}
  return Object.freeze({status:'REFERENCE_DRAFT_SAVED',
   eventId:ctx.eventId,weekStart:ctx.weekStart,
   revision:state.revision,referenceWindowCount:29,
   selectedIndividualCount:usedRefs(draft).length,
   officialPlanAdopted:false,weeklyEnergyCertified:false,
   writesExistingE7Data:false,privateIndividualDataInResult:false});
 }
 async function restoreLocalReference(args={},deps={}){
  const {storage,context:ctx}=args;
  if(!secure(deps)||typeof deps.identity?.reconcile!=='function'||
   !contextOK(ctx,args.prepared,deps.clock))
   return fail('LOCAL_REFERENCE_DEPENDENCIES_MISSING');
  const saved=read(storage,deps.identity);
  if(saved.status==='BLOCKED')return saved;
  if(saved.status==='EMPTY')return fail('REFERENCE_DRAFT_NOT_SAVED');
  const draft=saved.state.drafts.find(x=>x.eventId===ctx.eventId);
  if(!draft)return fail('REFERENCE_DRAFT_NOT_SAVED');
  const ownership=validateReferenceAgainst(ctx,draft,deps.clock);
  if(ownership.status!=='CONSISTENT')return ownership;
  if(draft.sourceCommit!==args.prepared.sourceCommit)
   return fail('VERIFIED_SOURCE_REVISION_CHANGED');
  const digests=await digestsFor(ctx.privateBoxRows,saved.state.salt,deps);
  if(!digests)return fail('PRIVATE_BOX_HASH_UNAVAILABLE');
  const mapped=deps.identity.reconcile(digests,saved.state.ledger,
   ()=> 'f4c_'+deps.crypto.randomUUID());
  if(mapped.status!=='IDENTITY_READY')return fail(mapped.reason);
  const used=usedRefs(draft);
  if(duplicateUsed(digests,mapped.ledger,used))
   return fail('SELECTED_INDIVIDUAL_IDENTITY_AMBIGUOUS');
  const ix=new Map(mapped.ledger.entries.map((e,i)=>[e.id,i]));
  if(used.some(id=>!ix.has(id)))return fail('REFERENCE_MEMBER_MISSING');
  const profiles=new Set(args.prepared.input.profiles.map(p=>p.id));
  if(used.some(id=>!profiles.has(idFor(ix.get(id)))))
   return fail('REFERENCE_MEMBER_NO_LONGER_ELIGIBLE');
  const primary=ix.get(draft.primaryId),secondary=ix.get(draft.secondaryId);
  const pmap=new Map(args.prepared.input.profiles.map(p=>[p.id,p]));
  if(pmap.get(idFor(primary))?.healerRole!=='TEAM_WIDE_HEALER'||
   pmap.get(idFor(secondary))?.healerRole!=='TEAM_WIDE_HEALER')
   return fail('RESTORED_HEALERS_CHANGED');
  const restored=draft.slots.map(w=>({
   index:w.index,day:w.day,slot:w.slot,source:w.source,
   startsAt:w.startsAt,endsAt:w.endsAt,
   teamIndices:w.teamIds.map(id=>ix.get(id)),recipeId:w.recipeId
  }));
  const knownRecipes=new Set(args.prepared.input.recipes.map(r=>r.id));
  for(const w of restored){
   if(w.recipeId!==null&&!knownRecipes.has(w.recipeId))
    return fail('REFERENCE_RECIPE_NO_LONGER_VERIFIED');
   if(w.slot==='sleep'){
    if(w.recipeId!==null)return fail('REFERENCE_SLEEP_RECIPE_INVALID');
    continue;
   }
   const team=w.teamIndices.map(idFor);
   if(team[4]!==idFor(primary)||
    (w.slot==='morning'&&team[3]!==idFor(secondary))||
    (w.slot!=='morning'&&team.includes(idFor(secondary)))||
    team.slice(0,w.slot==='morning'?3:4).some(id=>
     pmap.get(id)?.healerRole==='TEAM_WIDE_HEALER'))
    return fail('RESTORED_HEALER_POLICY_CHANGED');
  }
  // Do not silently upgrade to current E7 saved plan. Full-week engine is
  // still a provisional scenario, and official bonuses remain BLOCKED.
  return Object.freeze({status:'REFERENCE_DRAFT_RESTORED',
   eventId:draft.eventId,weekStart:draft.weekStart,
   revision:saved.state.revision,sourceStage:draft.sourceStage,
   sourceCommit:draft.sourceCommit,
   primaryHealerIndex:primary,secondaryHealerIndex:secondary,
   slots:restored,
   officialPlanAdopted:false,weeklyEnergyCertified:false,
   writesExistingE7Data:false,privateIndividualDataInResult:false});
 }
 return Object.freeze({KEY,FIELDS,summary,saveLocalReference,
  restoreLocalReference});
});

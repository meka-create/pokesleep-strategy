/* F4-C v112 local real-individual persistence, event-scoped.
 * Only opaque stable IDs, selected recipe IDs and owner revisions enter plans.
 * No private rows/nicknames, logs, URL data, network or automatic adoption.
 * A Box canonical-row change or ambiguous duplicates fail closed.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PokeF4CRealStoreV112=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PREFIX='pokesleep-strategy-f4c-v112:',BOX='pokesleep-strategy-e7-box-v1';
 const LEDGER=PREFIX+'box-ledger';
 const FIELDS=['nickname','pokemon','level','skillLevel','ing1','ing2','ing3',
  'mainSkill','nature','mint','lv10','lv25','lv50','lv70','lv80',
  'ribbon','shiny','favorite'];
 const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const idOK=x=>typeof x==='string'&&/^f4c_[0-9a-f-]{32,40}$/.test(x);
 const five=a=>Array.isArray(a)&&a.length===5&&new Set(a).size===5&&a.every(idOK);
 const fail=reason=>Object.freeze({status:'BLOCKED',reason});
 const key=(kind,week,id)=>PREFIX+kind+':'+week+':'+encodeURIComponent(id);
 const weekOK=week=>typeof week==='string'&&/^\d{4}-\d\d-\d\d$/.test(week)&&
  Number.isFinite(Date.parse(week+'T04:00:00+09:00'));
 const ownerOK=ctx=>ctx?.status==='CONTEXT_READY'&&weekOK(ctx.weekStart)&&
  typeof ctx.eventId==='string'&&ctx.eventId.length>0&&ctx.eventId.length<=160&&
  typeof ctx.conditionRevision==='string'&&typeof ctx.inventoryRevision==='string';
 const planningBasis=ctx=>JSON.stringify([ctx.fields,ctx.player,
  ctx.savedBerrySetup??null,ctx.autoSleep]);
 const canonical=row=>{
  if(!isObj(row)||!FIELDS.every(f=>Object.hasOwn(row,f)))return null;
  const vals=FIELDS.map(k=>row[k]===undefined?null:row[k]);
  if(vals.some(v=>v!==null&&!['string','boolean','number'].includes(typeof v)||
   typeof v==='number'&&!Number.isFinite(v)||
   typeof v==='string'&&v.length>400))return null;
  return JSON.stringify(['f4c-real-identity-v112',...vals]);
 };
 const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
 async function hashes(rows,salt,crypto){
  if(!Array.isArray(rows)||rows.length<5||rows.length>10000||
   !/^[0-9a-f]{32}$/.test(salt)||!crypto?.subtle||
   typeof TextEncoder==='undefined')return null;
  const encoder=new TextEncoder(),out=[];
  for(const row of rows){
   const c=canonical(row);if(!c)return null;
   out.push(hex(new Uint8Array(await crypto.subtle.digest('SHA-256',
    encoder.encode('f4c-v112|'+salt+'|'+c)))));
  }
  return out;
 }
 function entry(storage,k){
  const value=storage.getItem(k);
  if(value===null)return {raw:null,value:null};
  if(value.length>4000000)throw Error('STORAGE_TOO_BIG');
  return {raw:value,value:JSON.parse(value)};
 }
 // Called before proposal, save or restore. A ledger write changes NO
 // registered Pokemon / event / inventory. Revoked if concurrent update.
 async function identities(storage,rows,deps={}){
  try{
   if(!deps.identity?.reconcile||!deps.identity?.validate||
    !deps.crypto?.subtle||!deps.crypto?.randomUUID||
    !deps.crypto?.getRandomValues||!storage?.getItem)return fail('SECURE_LOCAL_IDENTITY_UNAVAILABLE');
   const old=entry(storage,LEDGER),boxRaw=storage.getItem(BOX);
   if(!boxRaw||!Array.isArray(rows)||JSON.stringify(JSON.parse(boxRaw)?.items)!==
    JSON.stringify(rows))return fail('BOX_CHANGED_BEFORE_MAPPING');
   const salt=old.value?.salt||hex(deps.crypto.getRandomValues(new Uint8Array(16)));
   const digests=await hashes(rows,salt,deps.crypto);
   if(!digests)return fail('UNSUPPORTED_PRIVATE_BOX_ROW');
   const prior=old.value?.ledger||null;
   if(old.value&&(!/^[0-9a-f]{32}$/.test(old.value.salt)||
     !deps.identity.validate(prior)))return fail('BOX_LEDGER_CORRUPTED');
   const mapped=deps.identity.reconcile(digests,prior,
    ()=>'f4c_'+deps.crypto.randomUUID());
   if(mapped.status!=='IDENTITY_READY')return fail(mapped.reason);
   if(storage.getItem(BOX)!==boxRaw||storage.getItem(LEDGER)!==old.raw)
    return fail('BOX_OR_IDENTITY_CONCURRENT_MODIFICATION');
   const encoded=JSON.stringify({version:1,salt,ledger:mapped.ledger});
   if(encoded!==old.raw){
    storage.setItem(LEDGER,encoded);
    if(storage.getItem(LEDGER)!==encoded)return fail('IDENTITY_SAVE_FAILED');
   }
   const byId=new Map(mapped.ledger.entries.map((e,i)=>[e.id,i]));
   return {status:'IDENTITIES_READY',ids:mapped.ledger.entries.map(x=>x.id),
    byId,digests,boxRaw,ledgerRevision:encoded};
  }catch(_){return fail('IDENTITY_READ_OR_SAVE_FAILED');}
 }
 function uniqueUsed(ids,identity){
  const used=ids.map(id=>identity.byId.get(id));
  if(used.some(i=>i===undefined))return false;
  const count=new Map();
  for(const d of identity.digests)count.set(d,(count.get(d)||0)+1);
  return used.every(i=>count.get(identity.digests[i])===1);
 }
 function planShape(p){
  if(!isObj(p)||p.kind!=='REAL_BOX_PLAN_V112'||
   !weekOK(p.weekStart)||typeof p.eventId!=='string'||
   typeof p.sourceCommit!=='string'||!/^[0-9a-f]{40}$/.test(p.sourceCommit)||
   typeof p.conditionRevision!=='string'||typeof p.inventoryRevision!=='string'||
   typeof p.planningBasis!=='string'||p.planningBasis.length>50000||
   !idOK(p.primaryId)||!idOK(p.secondaryId)||p.primaryId===p.secondaryId||
   !Array.isArray(p.slots)||p.slots.length!==29)return false;
  for(let i=0;i<29;i++){
   const w=p.slots[i];
   if(!isObj(w)||!Number.isInteger(w.day)||
    typeof w.slot!=='string'||typeof w.source!=='string'||
    typeof w.startsAt!=='string'||typeof w.endsAt!=='string'||
    (!five(w.teamIds)&&!(i===0&&p.previousWeekCarryUnknown===true&&
       Array.isArray(w.teamIds)&&w.teamIds.length===0))||
    !(w.recipeId===null||typeof w.recipeId==='string'&&
       /^[a-z][a-z0-9_]{0,79}$/.test(w.recipeId)))return false;
   if(i===0&&w.source!=='PREVIOUS_WEEK_SLEEP')return false;
   if(i===28&&w.source!=='FINAL_NIGHT_TRUNCATED')return false;
  }
  return true;
 }
 function createRecord(ctx,proposal,identity){
  if(!ownerOK(ctx)||proposal?.status!=='PROVISIONAL'||
   proposal.eventId!==ctx.eventId||proposal.weekStart!==ctx.weekStart||
   proposal.conditionRevision!==ctx.conditionRevision||
   proposal.inventoryRevision!==ctx.inventoryRevision||
   proposal.planningBasis!==planningBasis(ctx)||
   !/^[0-9a-f]{40}$/.test(proposal.sourceCommit||'')||
   proposal.slots?.length!==29)return fail('PROPOSAL_CONTEXT_MISMATCH');
  const translate=ids=>{
   if(!Array.isArray(ids))return null;
   const resolved=ids.map(id=>{
    if(typeof id!=='string'||!/^p(?:0|[1-9]\d*)$/.test(id))return null;
    return identity.ids[Number(id.slice(1))]||null;
   });
   return resolved.every(Boolean)?resolved:null;
  };
  const slots=proposal.slots.map(s=>({...s,teamIds:translate(s.team)}));
  if(slots.some(s=>s.teamIds===null))return fail('INVALID_TEMPORARY_BOX_REF');
  const primaryId=translate([proposal.selectedPrimary])?.[0];
  const secondaryId=translate([proposal.selectedSecondary])?.[0];
  const allIds=[primaryId,secondaryId,...slots.flatMap(s=>s.teamIds)];
  if(!uniqueUsed(allIds,identity))return fail('DUPLICATE_INDIVIDUAL_IDENTITY_AMBIGUOUS');
  const out={kind:'REAL_BOX_PLAN_V112',weekStart:ctx.weekStart,eventId:ctx.eventId,
   conditionRevision:ctx.conditionRevision,inventoryRevision:ctx.inventoryRevision,
   planningBasis:proposal.planningBasis,
   sourceCommit:proposal.sourceCommit,primaryId,secondaryId,
   previousWeekCarryUnknown:proposal.previousWeekCarryUnknown===true,
   sourceMode:proposal.officialEffectsExcluded?'UNBONUSED_EVENT_REFERENCE':'NEUTRAL',
   scoreModel:'BOUND_HEALER_RECOVERY_PROXY',candidatePairsChecked:proposal.candidatePairsChecked,
   expectedEnergy:proposal.expectedEnergy,rankingEnergyProxy:proposal.rankingEnergyProxy,
   autoSleep:proposal.autoSleep===true,
   slots:slots.map(s=>({day:s.day,slot:s.slot,source:s.source,
    startsAt:s.startsAt,endsAt:s.endsAt,
    teamIds:s.teamIds,recipeId:s.recipeId}))};
  return planShape(out)?{status:'PLAN_READY',plan:out}:fail('PLAN_SHAPE_INVALID');
 }
 function readPlan(storage,ctx,identity,sourceCommit,recipes,clock){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY')
    return fail('VERIFIED_CONTEXT_AND_BOX_REQUIRED');
   const r=entry(storage,key('plan',ctx.weekStart,ctx.eventId));
   if(!r.value)return {status:'EMPTY'};
   const p=r.value;
   if(!planShape(p)||p.weekStart!==ctx.weekStart||p.eventId!==ctx.eventId)
    return fail('STORED_PLAN_INVALID_OR_FOREIGN');
   // Changed settings/inventory mark a saved lineup STALE, but do not erase
   // it before the next explicit adoption. Invalid owner/Box still fail.
   if(p.sourceCommit!==sourceCommit)return fail('VERIFIED_SOURCE_CHANGED');
   const staleReason=p.autoSleep!==ctx.autoSleep?'SAVED_SLEEP_MODE_CHANGED':
    (p.conditionRevision!==ctx.conditionRevision||
     p.inventoryRevision!==ctx.inventoryRevision)?'SAVED_PLAN_INPUTS_CHANGED':
    p.planningBasis!==planningBasis(ctx)?'PLAYER_OR_BERRY_SETTINGS_CHANGED':null;
   if(clock?.windows?.length!==29||p.slots.some((w,i)=>{
    const c=clock.windows[i];return w.day!==c.day||w.slot!==c.slot||
     w.source!==c.source||w.startsAt!==c.startsAt||w.endsAt!==c.endsAt;
   }))return fail('SAVED_PLAN_TIMELINE_CHANGED');
   const allowed=new Set(recipes.map(r=>r.id));
   if(p.slots.some(s=>s.recipeId!==null&&!allowed.has(s.recipeId)))
    return fail('SAVED_RECIPE_SOURCE_CHANGED');
   const all=[p.primaryId,p.secondaryId,...p.slots.flatMap(s=>s.teamIds)];
   if(!uniqueUsed(all,identity))return fail('SAVED_BOX_CHANGED_OR_AMBIGUOUS');
   const index=identity.byId;
   const slots=p.slots.map(w=>({...w,
    teamIndices:w.teamIds.map(id=>index.get(id))}));
   const healer1=slots.slice(1).filter(w=>w.slot==='morning');
   const others=slots.slice(1).filter(w=>w.slot==='noon'||w.slot==='evening');
   if(healer1.length!==7||others.length!==14||
    healer1.some(w=>w.teamIds[3]!==p.secondaryId||w.teamIds[4]!==p.primaryId)||
    others.some(w=>w.teamIds.includes(p.secondaryId)||w.teamIds[4]!==p.primaryId))
    return fail('SAVED_HEALER_POSITIONS_CHANGED');
   return {status:staleReason?'STALE_ADOPTED':'ADOPTED',
    ...(staleReason?{reason:staleReason}:{}),plan:p,slots,revision:r.raw};
  }catch(_){return fail('SAVED_PLAN_READ_FAILED');}
 }
 function adopt(storage,ctx,proposal,identity,sourceCommit,recipes,clock){
  try{
   const made=createRecord(ctx,proposal,identity);
   if(made.status!=='PLAN_READY')return made;
   if(made.plan.sourceCommit!==sourceCommit)return fail('MODEL_SOURCE_CHANGED');
   if(storage.getItem(BOX)!==identity.boxRaw||
     storage.getItem(LEDGER)!==identity.ledgerRevision)
    return fail('BOX_CHANGED_BEFORE_ADOPTION');
   const check=entry(storage,key('plan',ctx.weekStart,ctx.eventId));
   if(check.value&&(!planShape(check.value)||
    check.value.eventId!==ctx.eventId))return fail('FOREIGN_OR_CORRUPT_OLD_PLAN');
   const now=JSON.stringify({...made.plan,revision:depsRevision()});
   if(storage.getItem(key('plan',ctx.weekStart,ctx.eventId))!==check.raw)
    return fail('CONCURRENT_PLAN_EDIT');
   storage.setItem(key('plan',ctx.weekStart,ctx.eventId),now);
   if(storage.getItem(key('plan',ctx.weekStart,ctx.eventId))!==now)
    return fail('PLAN_WRITE_NOT_CONFIRMED');
   return readPlan(storage,ctx,identity,sourceCommit,recipes,clock);
  }catch(_){return fail('PLAN_WRITE_FAILED');}
 }
 function depsRevision(){
  if(typeof crypto!=='undefined'&&crypto?.randomUUID)return crypto.randomUUID();
  return ''+Date.now();
 }
 function readSleep(storage,ctx,identity){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY')return fail('BOX_NOT_VERIFIED');
   const r=entry(storage,key('sleep',ctx.weekStart,ctx.eventId));
   if(!r.value)return {status:'EMPTY',teams:null};
   const v=r.value;
   if(v.version!==1||v.eventId!==ctx.eventId||v.weekStart!==ctx.weekStart||
    !Array.isArray(v.teams)||v.teams.length!==7||
    v.teams.some(row=>row!==null&&!five(row)))return fail('SLEEP_SAVE_INVALID');
   const refs=v.teams.filter(Boolean).flat();
   if(!uniqueUsed(refs,identity))return fail('SAVED_SLEEP_INDIVIDUAL_CHANGED');
   return {status:'SLEEP_READY',teams:v.teams.map(row=>row===null?null:
    row.map(id=>identity.byId.get(id)))};
  }catch(_){return fail('SAVED_SLEEP_READ_FAILED');}
 }
 function saveSleep(storage,ctx,identity,teams){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY'||
    !Array.isArray(teams)||teams.length!==7||teams.some(t=>
     t!==null&&(!Array.isArray(t)||t.length!==5||
      new Set(t).size!==5||t.some(i=>!Number.isSafeInteger(i)||
       i<0||i>=identity.ids.length))))return fail('SLEEP_INPUT_INVALID');
   const ids=teams.map(t=>t===null?null:t.map(i=>identity.ids[i]));
   if(!uniqueUsed(ids.filter(Boolean).flat(),identity))
    return fail('DUPLICATE_SLEEP_INDIVIDUAL_AMBIGUOUS');
   if(storage.getItem(BOX)!==identity.boxRaw||
    storage.getItem(LEDGER)!==identity.ledgerRevision)
    return fail('BOX_CHANGED_BEFORE_SLEEP_SAVE');
   const k=key('sleep',ctx.weekStart,ctx.eventId),current=entry(storage,k);
   if(current.value&&(current.value.eventId!==ctx.eventId||
    current.value.weekStart!==ctx.weekStart))return fail('SLEEP_OWNER_MISMATCH');
   const raw=JSON.stringify({version:1,eventId:ctx.eventId,
    weekStart:ctx.weekStart,teams:ids,revision:depsRevision()});
   if(storage.getItem(k)!==current.raw)return fail('SLEEP_CONCURRENT_UPDATE');
   storage.setItem(k,raw);
   return storage.getItem(k)===raw?{status:'SLEEP_SAVED'}:
    fail('SLEEP_SAVE_FAILED');
  }catch(_){return fail('SLEEP_SAVE_FAILED');}
 }
 return Object.freeze({PREFIX,LEDGER,key,identities,createRecord,
  readPlan,adopt,readSleep,saveSleep,planShape});
});

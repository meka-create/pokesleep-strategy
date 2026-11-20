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
 const SLEEP_GLOBAL=PREFIX+'sleep-template-global-v126';
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
  ctx.savedBerrySetup??null,ctx.autoSleep,ctx.previousCarryRevision??null,
  ...(ctx.prepPreferenceRevision?[ctx.prepPreferenceRevision]:[])]);
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
    !deps.crypto?.getRandomValues||!storage?.getItem)
    return fail('SECURE_LOCAL_IDENTITY_UNAVAILABLE');
   const boxRaw=storage.getItem(BOX);
   if(!boxRaw||!Array.isArray(rows)||
      JSON.stringify(JSON.parse(boxRaw)?.items)!==JSON.stringify(rows))
    return fail('BOX_CHANGED_BEFORE_MAPPING');
   // Parallel E7 lifecycle refreshes may both read an empty ledger.
   // Only a SAME-Box ledger race is retried. A changed Box, malformed
   // ledger, changed user row, or reused ID still fails closed.
   for(let attempt=0;attempt<4;attempt++){
    const old=entry(storage,LEDGER);
    if(old.value&&(!/^[0-9a-f]{32}$/.test(old.value.salt)||
       !deps.identity.validate(old.value.ledger)))
     return fail('BOX_LEDGER_CORRUPTED');
    const salt=old.value?.salt||hex(deps.crypto.getRandomValues(new Uint8Array(16)));
    const digests=await hashes(rows,salt,deps.crypto);
    if(!digests)return fail('UNSUPPORTED_PRIVATE_BOX_ROW');
    const mapped=deps.identity.reconcile(digests,old.value?.ledger||null,
      ()=>'f4c_'+deps.crypto.randomUUID());
    if(mapped.status!=='IDENTITY_READY')return fail(mapped.reason);
    if(storage.getItem(BOX)!==boxRaw)return fail('BOX_CHANGED_BEFORE_MAPPING');
    if(storage.getItem(LEDGER)!==old.raw)continue;
    const encoded=JSON.stringify({version:1,salt,ledger:mapped.ledger});
    if(encoded!==old.raw)storage.setItem(LEDGER,encoded);
    if(storage.getItem(BOX)!==boxRaw)return fail('BOX_CHANGED_BEFORE_MAPPING');
    if(storage.getItem(LEDGER)!==encoded)continue;
    const byId=new Map(mapped.ledger.entries.map((e,i)=>[e.id,i]));
    return {status:'IDENTITIES_READY',ids:mapped.ledger.entries.map(x=>x.id),
     byId,digests,boxRaw,ledgerRevision:encoded};
   }
   return fail('IDENTITY_LEDGER_CONTENTION_EXCEEDED');
  }catch(_){return fail('IDENTITY_READ_OR_SAVE_FAILED');}
 }
 // F3 v124: verify an already-established ledger WITHOUT reconciling or
 // writing it. A changed Box or stale ledger is not a reason to assign new IDs.
 async function verifyExistingIdentities(storage,rows,deps={}){
  try{
   if(!deps.crypto?.subtle||!deps.identity?.validate||!storage?.getItem)
    return fail('SECURE_READONLY_IDENTITY_UNAVAILABLE');
   const boxRaw=storage.getItem(BOX),ledgerRaw=storage.getItem(LEDGER);
   if(!boxRaw||!ledgerRaw||!Array.isArray(rows)||
    JSON.stringify(JSON.parse(boxRaw)?.items)!==JSON.stringify(rows))
    return fail('BOX_CHANGED_BEFORE_READONLY_MAPPING');
   const record=JSON.parse(ledgerRaw);
   if(!/^[0-9a-f]{32}$/.test(record?.salt||'')||
    !deps.identity.validate(record.ledger)||record.ledger.entries.length!==rows.length)
    return fail('BOX_LEDGER_NOT_CURRENT');
   const digests=await hashes(rows,record.salt,deps.crypto);
   if(!digests||digests.some((d,i)=>record.ledger.entries[i].digest!==d))
    return fail('BOX_LEDGER_DIGEST_MISMATCH');
   if(storage.getItem(BOX)!==boxRaw||storage.getItem(LEDGER)!==ledgerRaw)
    return fail('BOX_CHANGED_DURING_READONLY_MAPPING');
   const ids=record.ledger.entries.map(e=>e.id);
   return {status:'IDENTITIES_READY',ids,
    byId:new Map(ids.map((id,i)=>[id,i])),
    digests,boxRaw,ledgerRevision:ledgerRaw,readOnly:true};
  }catch(_){return fail('READONLY_IDENTITY_VERIFICATION_FAILED');}
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
 // Use the SAME invariants before any write and at restoration time.
 // A rejected proposal must never leave a malformed plan in localStorage.
 function planSourcesReason(p,clock,recipes){
  if(!planShape(p))return 'PLAN_SHAPE_INVALID';
  if(clock?.status!=='TIMELINE_READY'||clock.windows?.length!==29||
     !Array.isArray(recipes))return 'SAVED_PLAN_TIMELINE_CHANGED';
  for(let i=0;i<29;i++){
   const w=p.slots[i],c=clock.windows[i];
   if(w.day!==c.day||w.slot!==c.slot||w.source!==c.source||
      w.startsAt!==c.startsAt||w.endsAt!==c.endsAt)
    return 'SAVED_PLAN_TIMELINE_CHANGED';
   if(w.slot==='sleep'&&w.recipeId!==null)
    return 'SLEEP_WINDOW_RECIPE_NOT_ALLOWED';
   if(i===0){
    if(p.previousWeekCarryUnknown===true&&w.teamIds.length!==0||
       p.previousWeekCarryUnknown!==true&&w.teamIds.length!==5)
     return 'PREVIOUS_WEEK_CARRY_TEAM_MISMATCH';
   }else if(w.teamIds.length!==5)return 'INCOMPLETE_REAL_TEAM';
  }
  const allowed=new Set(recipes.map(r=>r.id));
  if(p.slots.some(w=>w.recipeId!==null&&!allowed.has(w.recipeId)))
   return 'SAVED_RECIPE_SOURCE_CHANGED';
  const mornings=p.slots.filter(w=>w.slot==='morning');
  const others=p.slots.filter(w=>w.slot==='noon'||w.slot==='evening');
  const nights=p.slots.filter(w=>w.slot==='sleep'&&w.day>=0);
  if(mornings.length!==7||others.length!==14||nights.length!==7||
     mornings.some(w=>w.teamIds[3]!==p.secondaryId||w.teamIds[4]!==p.primaryId)||
     others.some(w=>w.teamIds.includes(p.secondaryId)||w.teamIds[4]!==p.primaryId))
   return 'SAVED_HEALER_POSITIONS_CHANGED';
  return null;
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
   const invalid=planSourcesReason(p,clock,recipes);
   if(invalid)return fail(invalid);
   const all=[p.primaryId,p.secondaryId,...p.slots.flatMap(s=>s.teamIds)];
   if(!uniqueUsed(all,identity))return fail('SAVED_BOX_CHANGED_OR_AMBIGUOUS');
   const index=identity.byId;
   const slots=p.slots.map(w=>({...w,
    teamIndices:w.teamIds.map(id=>index.get(id))}));
   return {status:staleReason?'STALE_ADOPTED':'ADOPTED',
    ...(staleReason?{reason:staleReason}:{}),plan:p,slots,revision:r.raw};
  }catch(_){return fail('SAVED_PLAN_READ_FAILED');}
 }
 function adopt(storage,ctx,proposal,identity,sourceCommit,recipes,clock,expectedOldPlanRaw){
  try{
   const made=createRecord(ctx,proposal,identity);
   if(made.status!=='PLAN_READY')return made;
   if(made.plan.sourceCommit!==sourceCommit)return fail('MODEL_SOURCE_CHANGED');
   const invalid=planSourcesReason(made.plan,clock,recipes);
   if(invalid)return fail('PROPOSED_'+invalid);
   if(storage.getItem(BOX)!==identity.boxRaw||
     storage.getItem(LEDGER)!==identity.ledgerRevision)
    return fail('BOX_CHANGED_BEFORE_ADOPTION');
   const check=entry(storage,key('plan',ctx.weekStart,ctx.eventId));
   // A proposal reviewed before another tab's adoption cannot overwrite it.
   if(expectedOldPlanRaw!==undefined&&check.raw!==expectedOldPlanRaw)
    return fail('SAVED_PLAN_CHANGED_AFTER_REVIEW');
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
 // Manual seven-night teams belong to the player, not an event/week.
 // Event-owned adopted plans and confirmed previous-Sunday carry are separate.
 function sleepIDs(teams,identity){
  if(!Array.isArray(teams)||teams.length!==7||
   teams.some(t=>t!==null&&(!Array.isArray(t)||t.length!==5||
    new Set(t).size!==5||t.some(i=>!Number.isSafeInteger(i)||
     i<0||i>=identity.ids.length))))return null;
  const ids=teams.map(t=>t===null?null:t.map(i=>identity.ids[i]));
  return uniqueUsed(ids.filter(Boolean).flat(),identity)?ids:null;
 }
 const sleepShape=v=>v?.version===1&&
  Array.isArray(v.teams)&&v.teams.length===7&&
  v.teams.some(Boolean)&&v.teams.every(row=>row===null||five(row));
 function mapSleep(v,identity,scope){
  if(!sleepShape(v))return fail('SLEEP_SAVE_INVALID');
  if(!uniqueUsed(v.teams.filter(Boolean).flat(),identity))
   return fail('SAVED_SLEEP_INDIVIDUAL_CHANGED');
  return {status:'SLEEP_READY',source:scope,
   teams:v.teams.map(row=>row===null?null:row.map(id=>identity.byId.get(id))),
   revision:v.revision??null};
 }
 function legacySleep(storage,ctx,identity){
  const own=entry(storage,key('sleep',ctx.weekStart,ctx.eventId));
  if(own.value){
   const v=own.value;
   if(v.version!==1||v.weekStart!==ctx.weekStart||v.eventId!==ctx.eventId)
    return fail('SLEEP_OWNER_MISMATCH');
   return mapSleep(v,identity,'LEGACY_EVENT');
  }
  // Old UUID revisions carry no timestamp. For a previous event use the
  // newest event WEEK, but fail closed if multiple events share that week.
  if(typeof storage.length!=='number'||typeof storage.key!=='function')
   return {status:'EMPTY',teams:null};
  const matches=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i),m=/^pokesleep-strategy-f4c-v112:sleep:(\d{4}-\d\d-\d\d):(.+)$/.exec(k||'');
   if(!m||!weekOK(m[1]))continue;
   let id;try{id=decodeURIComponent(m[2]);}catch(_){continue;}
   if(encodeURIComponent(id)!==m[2])continue;
   const raw=entry(storage,k);
   if(!raw.value||raw.value.weekStart!==m[1]||
    raw.value.eventId!==id||!sleepShape(raw.value))continue;
   matches.push({week:m[1],entry:raw.value});
  }
  matches.sort((a,b)=>b.week.localeCompare(a.week));
  if(!matches.length)return {status:'EMPTY',teams:null};
  if(matches.length>1&&matches[0].week===matches[1].week)
   return fail('LEGACY_SLEEP_MULTIPLE_EVENTS_AMBIGUOUS');
  return mapSleep(matches[0].entry,identity,'LEGACY_PREVIOUS_EVENT');
 }
 function readSleep(storage,ctx,identity){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY')
    return fail('BOX_NOT_VERIFIED');
   const current=entry(storage,SLEEP_GLOBAL);
   if(current.raw!==null){
    const v=current.value;
    if(v?.kind!=='GLOBAL_MANUAL_SLEEP_V126'||!sleepShape(v)||
      typeof v.revision!=='string'||!v.revision)
     return fail('GLOBAL_SLEEP_SAVE_INVALID');
    return mapSleep(v,identity,'GLOBAL');
   }
   return legacySleep(storage,ctx,identity);
  }catch(_){return fail('SAVED_SLEEP_READ_FAILED');}
 }
 function saveSleep(storage,ctx,identity,teams){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY')
    return fail('BOX_NOT_VERIFIED');
   const ids=sleepIDs(teams,identity);
   if(!ids||!ids.some(Boolean))return fail('SLEEP_INPUT_INVALID');
   if(storage.getItem(BOX)!==identity.boxRaw||
      storage.getItem(LEDGER)!==identity.ledgerRevision)
    return fail('BOX_CHANGED_BEFORE_SLEEP_SAVE');
   const before=entry(storage,SLEEP_GLOBAL);
   if(before.raw!==null){
    if(before.value?.kind!=='GLOBAL_MANUAL_SLEEP_V126'||
     !sleepShape(before.value))return fail('GLOBAL_SLEEP_SAVE_INVALID');
   }
   const raw=JSON.stringify({version:1,kind:'GLOBAL_MANUAL_SLEEP_V126',
     teams:ids,revision:depsRevision()});
   if(storage.getItem(SLEEP_GLOBAL)!==before.raw)
    return fail('SLEEP_CONCURRENT_UPDATE');
   storage.setItem(SLEEP_GLOBAL,raw);
   return storage.getItem(SLEEP_GLOBAL)===raw?
    {status:'SLEEP_SAVED',scope:'GLOBAL'}:fail('SLEEP_SAVE_FAILED');
  }catch(_){return fail('SLEEP_SAVE_FAILED');}
 }
 function migrateSleep(storage,ctx,identity){
  // Never replace an existing global choice with a legacy event snapshot.
  if(storage.getItem(SLEEP_GLOBAL)!==null)return readSleep(storage,ctx,identity);
  const legacy=readSleep(storage,ctx,identity);
  if(legacy.status!=='SLEEP_READY'||!legacy.source.startsWith('LEGACY_'))
   return legacy;
  const written=saveSleep(storage,ctx,identity,legacy.teams);
  if(written.status!=='SLEEP_SAVED')return fail('LEGACY_SLEEP_MIGRATION_FAILED');
  return readSleep(storage,ctx,identity);
 }
 const previousSunday=week=>{
  const d=Date.parse(week+'T12:00:00Z');
  return Number.isFinite(d)?new Date(d-86400000).toISOString().slice(0,10):null;
 };
 // An adopted prior-week PLAN is not evidence of an actually played Sunday.
 // Use a user-confirmed, event-scoped lineup; never fill in a missing record.
 function readCarry(storage,ctx,identity){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY')return fail('BOX_NOT_VERIFIED');
   const r=entry(storage,key('carry',ctx.weekStart,ctx.eventId));
   if(!r.value)return {status:'EMPTY',team:null,revision:null};
   const v=r.value;
   if(v.version!==1||v.eventId!==ctx.eventId||v.weekStart!==ctx.weekStart||
      v.previousSunday!==previousSunday(ctx.weekStart)||
      v.source!=='USER_CONFIRMED_PREVIOUS_SUNDAY'||!five(v.teamIds)||
      typeof v.revision!=='string'||!v.revision)
    return fail('PREVIOUS_SUNDAY_CONFIRMATION_INVALID');
   if(!uniqueUsed(v.teamIds,identity))
    return fail('PREVIOUS_SUNDAY_BOX_CHANGED_OR_AMBIGUOUS');
   return {status:'CARRY_READY',team:v.teamIds.map(id=>identity.byId.get(id)),
    revision:v.revision};
  }catch(_){return fail('PREVIOUS_SUNDAY_READ_FAILED');}
 }
 function saveCarry(storage,ctx,identity,team){
  try{
   if(!ownerOK(ctx)||identity?.status!=='IDENTITIES_READY'||
      !Array.isArray(team)||team.length!==5||new Set(team).size!==5||
      team.some(i=>!Number.isSafeInteger(i)||i<0||i>=identity.ids.length))
    return fail('PREVIOUS_SUNDAY_INPUT_INVALID');
   const teamIds=team.map(i=>identity.ids[i]);
   if(!uniqueUsed(teamIds,identity))return fail('PREVIOUS_SUNDAY_IDENTITY_AMBIGUOUS');
   if(storage.getItem(BOX)!==identity.boxRaw||
      storage.getItem(LEDGER)!==identity.ledgerRevision)
    return fail('BOX_CHANGED_BEFORE_PREVIOUS_SUNDAY_SAVE');
   const k=key('carry',ctx.weekStart,ctx.eventId),before=entry(storage,k);
   if(before.value&&(before.value.weekStart!==ctx.weekStart||
      before.value.eventId!==ctx.eventId||
      before.value.source!=='USER_CONFIRMED_PREVIOUS_SUNDAY'))
    return fail('PREVIOUS_SUNDAY_OWNER_MISMATCH');
   const raw=JSON.stringify({version:1,weekStart:ctx.weekStart,eventId:ctx.eventId,
    previousSunday:previousSunday(ctx.weekStart),
    source:'USER_CONFIRMED_PREVIOUS_SUNDAY',teamIds,revision:depsRevision()});
   if(storage.getItem(k)!==before.raw)return fail('PREVIOUS_SUNDAY_CONCURRENT_EDIT');
   storage.setItem(k,raw);
   return storage.getItem(k)===raw?{status:'CARRY_SAVED'}:
    fail('PREVIOUS_SUNDAY_WRITE_FAILED');
  }catch(_){return fail('PREVIOUS_SUNDAY_SAVE_FAILED');}
 }
 return Object.freeze({PREFIX,LEDGER,SLEEP_GLOBAL,key,identities,verifyExistingIdentities,createRecord,
  readPlan,adopt,readSleep,saveSleep,migrateSleep,readCarry,saveCarry,planShape});
});

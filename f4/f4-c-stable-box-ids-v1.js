/* F4-C v99: pure, LOCAL-ONLY box identity ledger. No storage or I/O.
 * The caller supplies a cryptographic digest for canonical row content and
 * a freshly generated opaque ID. Never derive identity from array index alone.
 * Identical duplicate rows are ambiguous after non-append mutations.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CStableBoxIDs=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  writesSavedData:false,privateIndividualDataInResult:false});
 const hashOK=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 const idOK=s=>typeof s==='string'&&/^f4c_[a-f0-9-]{32,40}$/.test(s);
 const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
 function validate(ledger){
  if(!plain(ledger)||ledger.version!==1||!Array.isArray(ledger.entries)||
   ledger.entries.length>10000)return false;
  const ids=new Set();
  for(const row of ledger.entries){
   if(!plain(row)||!hashOK(row.digest)||!idOK(row.id)||ids.has(row.id))
    return false;
   ids.add(row.id);
  }
  return true;
 }
 function reconcile(digests,prior=null,issueId=null){
  if(!Array.isArray(digests)||digests.length>10000||
   digests.some(s=>!hashOK(s))||prior!==null&&!validate(prior))
   return fail('INVALID_IDENTITY_SNAPSHOT');
  if(typeof issueId!=='function')return fail('SECURE_ID_FACTORY_REQUIRED');
  const old=prior?.entries||[];
  const eq=(i)=>old[i]?.digest===digests[i];
  const appendOnly=old.length<=digests.length&&old.every((_,i)=>eq(i));
  const unchanged=old.length===digests.length&&appendOnly;
  let entries;
  if(unchanged){
   entries=old.map(x=>({...x}));
  }else if(appendOnly){
   entries=old.map(x=>({...x}));
   for(let i=old.length;i<digests.length;i++)
    entries.push({digest:digests[i],id:issueId()});
  }else{
   // A non-append mutation is accepted only for uniquely identifiable rows.
   // A duplicate fingerprint after delete/sort could refer to another
   // specimen with identical stats, so never select one by position.
   const count=(a)=>a.reduce((m,x)=>{
    const d=typeof x==='string'?x:x.digest;
    m.set(d,(m.get(d)||0)+1);return m;
   },new Map());
   const before=count(old),after=count(digests);
   if([...new Set([...before.keys(),...after.keys()])].some(d=>
    (before.get(d)||0)>1||(after.get(d)||0)>1))
    return fail('DUPLICATE_BOX_IDENTITY_AMBIGUOUS');
   const ids=new Map(old.map(x=>[x.digest,x.id]));
   entries=digests.map(d=>({digest:d,id:ids.get(d)||issueId()}));
  }
  if(entries.some(x=>!hashOK(x.digest)||!idOK(x.id))||
   new Set(entries.map(x=>x.id)).size!==entries.length)
   return fail('UNSAFE_OR_REUSED_ID');
  return Object.freeze({status:'IDENTITY_READY',ledger:{
   version:1,entries},identityChanged:!unchanged,
   safeForLocalPersistence:true,writesSavedData:false,
   privateIndividualDataInResult:false,
   caveat:'Store the ledger locally with an exact box revision and compare-and-swap; do not upload it.'});
 }
 function resolve(digests,ledger,indices){
  if(!validate(ledger)||!Array.isArray(digests)||
   digests.length!==ledger.entries.length||digests.some((d,i)=>
    d!==ledger.entries[i].digest)||!Array.isArray(indices)||
   indices.length!==5||new Set(indices).size!==5||
   indices.some(i=>!Number.isSafeInteger(i)||i<0||i>=digests.length))
   return fail('BOX_CHANGED_OR_SELECTION_INVALID');
  return Object.freeze({status:'IDENTITIES_VERIFIED',
   ids:indices.map(i=>ledger.entries[i].id),
   writesSavedData:false,privateIndividualDataInResult:false});
 }
 return Object.freeze({reconcile,resolve,validate});
});

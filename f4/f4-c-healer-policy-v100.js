/* F4-C v100: user-approved healer-first daytime party policy.
 * Morning 07:30-12:00: main + secondary healer; noon/evening: main only.
 * Sleep teams remain the explicit 7-night roster and 04:00 carry-over team.
 * Sleeping score 100 is a scenario assumption, not "energy always 100".
 * Only pinned TEAM_WIDE_HEALER profiles qualify; no inferred skill procs.
 * Pure function; no box rows, private metadata, storage or external I/O.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CHealerPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=reason=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false,
  privateIndividualDataInResult:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const integer=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
 const DAY=new Set(['morning','noon','evening']);
 function validate(options={}){
  if(!plain(options)||!Array.isArray(options.profiles)||
   options.profiles.length<6||options.profiles.length>100||
   !integer(options.sleepScore,100,100)||
   typeof options.primaryHealerId!=='string'||
   typeof options.secondaryHealerId!=='string'||
   options.primaryHealerId===options.secondaryHealerId)
   return blocked('HEALER_POLICY_INPUT_INVALID');
  const roster=options.profiles;
  const byId=new Map(roster.map(p=>[p?.id,p]));
  if(byId.size!==roster.length||
   [...byId].some(([id,p])=>typeof id!=='string'||!id||
    !plain(p)||p.source!=='F1_B_PINNED_66_SPECIES'||
    !['TEAM_WIDE_HEALER',null].includes(p.healerRole)))
   return blocked('HEALER_SOURCE_NOT_VERIFIED');
  const primary=byId.get(options.primaryHealerId),secondary=byId.get(options.secondaryHealerId);
  if(primary?.healerRole!=='TEAM_WIDE_HEALER'||
   secondary?.healerRole!=='TEAM_WIDE_HEALER')
   return blocked('EXPLICIT_TWO_HEALERS_REQUIRED');
  const fillers=roster.filter(p=>p.healerRole!== 'TEAM_WIDE_HEALER');
  if(fillers.length<4)return blocked('FOUR_NON_HEALERS_REQUIRED');
  return Object.freeze({status:'POLICY_READY',primaryHealerId:primary.id,
   secondaryHealerId:secondary.id,sleepScore:100,dayTimeAssumption:'HEALER_MAINTAINS_HIGH_ENERGY_PROXY',
   fillerIds:fillers.map(p=>p.id),
   morningHealers:2,noonHealers:1,eveningHealers:1,
   sleepPartyIsIndependent:true,weeklyEnergyCertified:false,
   writesSavedData:false,privateIndividualDataInResult:false});
 }
 function makeTeam(policy,slot,fillers){
  if(policy?.status!=='POLICY_READY'||!DAY.has(slot)||
   !Array.isArray(fillers)||fillers.length!==(slot==='morning'?3:4)||
   new Set(fillers).size!==fillers.length||
   fillers.some(id=>!policy.fillerIds.includes(id)))return blocked('FILLER_TEAM_INVALID');
  // Keep main healer on far right, secondary second from the right.
  return Object.freeze({status:'TEAM_READY',slot,
   team:[...fillers,...(slot==='morning'?[policy.secondaryHealerId]:[]),
    policy.primaryHealerId],
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 function candidateTeams(policy,slot,orderedFillers,maxCandidates=12){
  if(policy?.status!=='POLICY_READY'||!DAY.has(slot)||
   !Array.isArray(orderedFillers)||orderedFillers.length!==policy.fillerIds.length||
   new Set(orderedFillers).size!==orderedFillers.length||
   orderedFillers.some(id=>!policy.fillerIds.includes(id))||
   !integer(maxCandidates,1,24))return blocked('CANDIDATE_INPUT_INVALID');
  const count=slot==='morning'?3:4,pool=orderedFillers.slice(0,Math.min(12,orderedFillers.length));
  const results=[];
  function choose(start,items){
   if(items.length===count){
    const x=makeTeam(policy,slot,items);
    if(x.status!=='TEAM_READY')throw Error('INVALID_TEAM');
    results.push(x.team);return;
   }
   for(let i=start;i<=pool.length-(count-items.length);i++)
    choose(i+1,[...items,pool[i]]);
  }
  choose(0,[]);
  return Object.freeze({status:'CANDIDATES_READY',
   teams:results.slice(0,maxCandidates),count:Math.min(results.length,maxCandidates),
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 return Object.freeze({validate,makeTeam,candidateTeams});
});

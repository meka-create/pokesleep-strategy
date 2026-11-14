/* E7 v105: read-only display values; pinned F1-B source and model.
   Individual values assume zero energy, no camp, no teammate bonuses.
   Carry uses the current species/form baseline. The pinned upstream carries
   pre-v2.9.0 values, so their +5 per species evolution STAGE is a static
   source-version normalization, not a specimen's actual evolution history. */
(function(root){'use strict';
const FILES=['../f1/f1-b-target-source-v1.json','../f1/f1-b-help-traits-v1.json'];
let loading=null;
async function sources(){
 if(!loading)loading=Promise.all(FILES.map(async url=>{
  const response=await root.fetch(url);
  if(!response.ok)throw Error('F1_SOURCE_UNAVAILABLE');
  return response.json();
 })).then(([snapshot,traits])=>{
  root.PokeF1LegalBuild.validateSource(snapshot);
  root.PokeF1BaseRates.validateTraits(snapshot,traits);
  return {snapshot,traits};
 }).catch(error=>{loading=null;throw error;});
 return loading;
}
function duration(seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return '—';
 const n=Math.round(seconds),h=Math.floor(n/3600);
 return (h?h+'時間':'')+Math.floor(n%3600/60)+'分'+String(n%60).padStart(2,'0')+'秒';
}
async function calculate(item){
 try{
  const {snapshot,traits}=await sources();
  const name=String(item?.pokemon||'').normalize('NFKC').trim();
  const target=snapshot.targets.find(t=>t.name===name);
  if(!target)return {helpTime:'F1対象外',carry:'F1対象外',state:'OUT_OF_SCOPE'};
  const result=root.PokeF1BaseRates.evaluate(item,snapshot,traits,{
   goodCamp:false,teammateHelpingBonusCount:0
  });
  if(Number.isFinite(result.referenceHelpSeconds)&&result.referenceHelpSeconds>0&&
   Number.isSafeInteger(result.carryLimit)&&result.carryLimit>0)
   return {helpTime:duration(result.referenceHelpSeconds)+'（参考）',
    carry:String(result.carryLimit)+'（参考）',state:'F1_REFERENCE'};
  // Missing mint, ribbon, or other required CSV facts must never be guessed.
  // Show species-only primitives with an explicit distinct label instead.
  const p=target.sourceProfile;
  // Source data is pinned to the older per-form baseline: for example
  // Blastoise 17 -> current 27, Raichu 21 -> current 31 (Ver.2.9.0).
  // This is invariant across direct capture / evolution of the SAME form.
  const sourceTrait=traits.traits.find(t=>t.name===name);
  if(!sourceTrait||!Number.isSafeInteger(sourceTrait.evolutionCount)||
     !Number.isSafeInteger(p.carryLimit)||p.carryLimit<=0)
   return {helpTime:duration(p.frequency)+'（種族基礎）',
    carry:'原典未確認',state:'CARRY_SOURCE_UNAVAILABLE'};
  const speciesBaseCarry=p.carryLimit+5*Math.max(0,sourceTrait.evolutionCount);
  return {helpTime:duration(p.frequency)+'（種族基礎）',
   carry:String(speciesBaseCarry)+'（種族基礎）',state:'SPECIES_BASE_ONLY'};
 }catch(error){return {helpTime:'原典未確認',carry:'原典未確認',state:'SOURCE_UNAVAILABLE'};}
}
root.PokeE7BoxStats=Object.freeze({calculate,duration});
})(window);

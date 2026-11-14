/* F4-A v91: read-only local-box -> 0-energy F1-B help-rate profiles.
 * No nickname, individual build, or private CSV contents in returned profiles.
 * Does NOT model health, main skills, inventory changes or choose night teams.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4F1RosterAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const FOOD=new Set(['leek','mushroom','egg','potato','apple','herb','sausage','milk',
  'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado']);
 const FAV=new Set(['normal','fire','water','electric','grass','ice','fighting','poison','ground',
  'flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']);
 const blocked=(reason,message)=>Object.freeze({status:'BLOCKED',reason,message,
  stage:'F4_A_VERIFIED_ROSTER_ADAPTER',userRowsRetained:false});
 const valid=(o)=>o&&typeof o==='object'&&!Array.isArray(o);
 const roundUp=x=>Math.ceil(x-1e-9);
 function berryUnit(type,lv,favorites,fieldBonus,master){
  const b0=master.berry[type];
  if(!Number.isSafeInteger(b0)||b0<1||b0>100||
   !Number.isSafeInteger(lv)||lv<1||lv>100||
   !Number.isSafeInteger(fieldBonus)||fieldBonus<0||fieldBonus>100)throw Error('BERRY_REFERENCE');
  const raw=Math.max(b0+lv-1,Math.round(Math.pow(1.025,lv-1)*b0));
  return roundUp(roundUp(raw*(1+fieldBonus/100))*(favorites.includes(type)?2:1));
 }
 function adapt(input={},deps={}){
  try{
   if(!valid(input)||!Array.isArray(input.items)||input.items.length<5||
    input.items.length>10000||typeof input.camp!=='boolean'||
    !Number.isSafeInteger(input.fieldBonus)||input.fieldBonus<0||input.fieldBonus>100||
    !Array.isArray(input.favoriteTypes)||input.favoriteTypes.length>3||
    new Set(input.favoriteTypes).size!==input.favoriteTypes.length||
    input.favoriteTypes.some(x=>!FAV.has(x)))
    return blocked('ROSTER_OPTIONS','実個体・きのみ・キャンプ・フィールド設定を確認してください。');
   const {snapshot,traits,legal,rates,master}=deps;
   if(!valid(snapshot)||!valid(traits)||!valid(master?.berry)||
    typeof legal?.auditBuild!=='function'||typeof rates?.evaluate!=='function'||
    typeof rates?.validateTraits!=='function')
    return blocked('SOURCE_MISSING','F1-Bの検証済み計算原典がありません。');
   rates.validateTraits(snapshot,traits);
   if(snapshot?.upstream?.commit!==traits?.source?.commit||
    !/^[a-f0-9]{40}$/.test(snapshot?.upstream?.commit||''))
    throw Error('SOURCE_PROVENANCE');
   const names=new Map(snapshot.targets.map(t=>[t.name,t]));
   const bonusName=snapshot.dictionaries?.subskills?.['Helping Bonus'];
   if(typeof bonusName!=='string'||!bonusName)throw Error('HELPING_BONUS_NAME');
   const results=[];let unsupported=0,invalid=0;
   for(let idx=0;idx<input.items.length;idx++){
    const row=input.items[idx];
    const target=names.get(row?.pokemon);
    if(!target){unsupported++;continue;}
    if(!valid(row)||!Number.isSafeInteger(row.level)){
     invalid++;continue;
    }
    // Same documented treatment as F1-D for optional fields. Mark the
    // presence of assumptions without returning individual private details.
    const assumedMint=row.mint==null,assumedRibbon=row.ribbon==null;
    const normalized={...row,mint:assumedMint?false:row.mint,
     ribbon:assumedRibbon?0:row.ribbon};
    const ratesByTeammateBonus=[];
    let accepted=true;
    for(let bonus=0;bonus<=4;bonus++){
     try{
      const rate=rates.evaluate(normalized,snapshot,traits,{
       teammateHelpingBonusCount:bonus,goodCamp:input.camp});
      if(rate?.status!=='BASE_RATES_AVAILABLE'||
       !Number.isFinite(rate.referenceHelpSeconds)||rate.referenceHelpSeconds<=0||
       !Number.isFinite(rate.ingredientProbabilityPerHelp)||
       !Number.isFinite(rate.berryProbabilityPerHelp)||
       !Number.isFinite(rate.berryCountPerBerryHelp)||
       !valid(rate.ingredientCountsPerHelp)||
       Object.entries(rate.ingredientCountsPerHelp).some(([k,v])=>
        !FOOD.has(k)||!Number.isFinite(v)||v<0))throw Error('INCOMPLETE_RATE');
      const berry=rate.berryProbabilityPerHelp*
       rate.berryCountPerBerryHelp*berryUnit(target.type,row.level,
        input.favoriteTypes,input.fieldBonus,master);
      if(!Number.isSafeInteger(rate.carryLimit)||rate.carryLimit<1||rate.carryLimit>2000||
       !Number.isFinite(rate.berryProbabilityPerHelp*rate.berryCountPerBerryHelp)||
       rate.berryProbabilityPerHelp*rate.berryCountPerBerryHelp<0)
       throw Error('CARRY_OR_ITEM_RATE_UNVERIFIED');
      ratesByTeammateBonus.push({
       status:'BASE_RATES_AVAILABLE',helpSeconds:rate.referenceHelpSeconds,
       berryEnergyPerHelp:berry,ingredientCountsPerHelp:rate.ingredientCountsPerHelp,
       // F4-C uses anonymous item counts/individual capacity for a separate
       // state replay. F4-A/B normalizeProfiles ignores these extra fields.
       berryItemsPerHelp:rate.berryProbabilityPerHelp*rate.berryCountPerBerryHelp,
       carryLimit:rate.carryLimit,
       skillProbabilityPerEligibleHelp:rate.mainSkillProbabilityPerEligibleHelp,
       selectedMainSkillLevel:rate.selectedMainSkillLevel
      });
     }catch(_){accepted=false;break;}
    }
    if(!accepted){invalid++;continue;}
    const hasHelpingBonus=['lv10','lv25','lv50','lv70','lv80'].some((key,j)=>
     row.level>=[10,25,50,70,80][j]&&row[key]===bonusName);
    results.push({id:'p'+idx,source:'F1_B_PINNED_66_SPECIES',
     helpingBonus:hasHelpingBonus,ratesByTeammateBonus,
     carryLimit:ratesByTeammateBonus[0].carryLimit,
     // Skill probability is not a trigger or an automatically applied effect.
     skillProbabilityPerEligibleHelp:ratesByTeammateBonus[0].skillProbabilityPerEligibleHelp,
     selectedMainSkillLevel:ratesByTeammateBonus[0].selectedMainSkillLevel});
   }
   if(results.length<5)
    return blocked('INSUFFICIENT_VERIFIED_POKEMON',
     '合法個体が5匹未満のためF4参考編成を生成できません。');
   return {status:'READY',source:'F1_B_PINNED_66_SPECIES',
    stage:'F4_A_VERIFIED_ROSTER_ADAPTER',sourceCommit:snapshot.upstream.commit,
    profiles:results,eligibleCount:results.length,unsupportedCount:unsupported,
    excludedCount:invalid,userRowsRetained:false,
    caveat:'全個体構成・ニックネームはデバイス内だけで扱い、出力は匿名の参照IDです。'};
  }catch(_){
   return blocked('INVALID_SOURCE','個体別の計算出典が一致しません。');
  }
 }
 return Object.freeze({adapt,berryUnit});
});

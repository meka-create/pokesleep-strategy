/* F3-B v89 — validated real-box production scenario, not an assumed adopted team.
 * This is a pure opt-in INPUT for the F3 recipe planner. It NEVER writes E7
 * inventory/box/plan and NEVER returns personal CSV rows or nicknames.
 * At this milestone, the 7-day continuous reference-help scenario is NOT a
 * real-world production forecast: energy, shifts, bag overflow and skills
 * must be modeled jointly in F4 before planned stock is automatically lowered.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF3ProductionScenario=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CODES=['leek','mushroom','egg','potato','apple','herb','sausage','milk',
  'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado'];
 const CODE_SET=new Set(CODES);
 const LEVELS=[10,25,50,70,80],SLOTS=['lv10','lv25','lv50','lv70','lv80'];
 const blocked=(reason,message,extra={})=>Object.freeze({
  status:'BLOCKED',reason,message,source:'F1_B_PINNED_66_SPECIES',...extra,
  userRowsRetained:false});
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===null||Object.getPrototypeOf(Object.getPrototypeOf(x))===null);
 function validateNeed(need){
  if(!plain(need)||Object.keys(need).some(k=>!CODE_SET.has(k)))throw Error('TARGET_INGREDIENTS');
  const out=Object.fromEntries(CODES.map(c=>[c,0]));
  for(const [k,v] of Object.entries(need)){
   if(!Number.isSafeInteger(v)||v<0||v>10000)throw Error('TARGET_INGREDIENTS');
   out[k]=v;
  }
  if(!Object.values(out).some(Boolean))throw Error('NO_TARGET_INGREDIENTS');
  return out;
 }
 function normalization(row){
  // Missing OPTIONAL CSV fields are not secretly turned into known facts.
  // These assumptions are returned in AGGREGATE only, never in individual rows.
  if(!plain(row)||typeof row.pokemon!=='string'||!Number.isSafeInteger(row.level))
   return null;
  const assumesMint=row.mint===null||row.mint===undefined;
  const assumesRibbon=row.ribbon===null||row.ribbon===undefined;
  return {assumesMint,assumesRibbon,row:{...row,
   mint:assumesMint?false:row.mint,
   ribbon:assumesRibbon?0:row.ribbon}};
 }
 function availableHelpingBonus(row,jp){
  let active=false;
  for(let i=0;i<SLOTS.length;i++)
   if(row.level>=LEVELS[i]&&row[SLOTS[i]]===jp)active=true;
  return active;
 }
 function estimate(input,deps){
  try{
   if(!plain(input)||!deps?.rates?.evaluate||!deps?.rates?.validateTraits||
    !deps?.legal?.auditBuild||!deps?.snapshot||!deps?.traits)
    return blocked('DEPENDENCIES','個体計算の検証済み原典を読み込めません。');
   const {snapshot,traits,rates,legal}=deps;
   if(!Array.isArray(input.items)||input.items.length<1||input.items.length>10000||
     typeof input.camp!=='boolean')
    return blocked('BOX','ボックスの登録情報を確認してください。');
   const need=validateNeed(input.targetIngredients);
   // The reference window is fixed and disclosed, NOT adjustable by the
   // calculator to make a given stockpile goal look feasible.
   const referenceHours=168;
   rates.validateTraits(snapshot,traits);
   const identities=new Set(snapshot.targets.map(x=>x.name));
   const hb=snapshot.dictionaries?.subskills?.['Helping Bonus'];
   if(typeof hb!=='string'||!hb)throw Error('DICTIONARY_DRIFT');
   const sourceCommit=snapshot.upstream?.commit,traitCommit=traits.source?.commit;
   if(!sourceCommit||sourceCommit!==traitCommit)throw Error('SOURCE_REVISION_MISMATCH');
   let assumedMints=0,assumedRibbons=0,excluded=0,unsupported=0;
   const candidates=[];
   for(let i=0;i<input.items.length;i++){
    const row=input.items[i];
    if(!row||!identities.has(row.pokemon)){unsupported++;continue;}
    const adapted=normalization(row);
    if(!adapted){excluded++;continue;}
    let rate;
    try{
     rate=rates.evaluate(adapted.row,snapshot,traits,{
      teammateHelpingBonusCount:0,goodCamp:input.camp
     });
    }catch(_){excluded++;continue;}
    if(rate?.status!=='BASE_RATES_AVAILABLE'||!
      Number.isFinite(rate.referenceHelpSeconds)||rate.referenceHelpSeconds<=0||
      !plain(rate.ingredientCountsPerHelp)){excluded++;continue;}
    const perHelp=rate.ingredientCountsPerHelp;
    if(Object.keys(perHelp).some(k=>!CODE_SET.has(k)||!Number.isFinite(perHelp[k])||
      perHelp[k]<0||perHelp[k]>100)) {excluded++;continue;}
    const hours=referenceHours*3600/rate.referenceHelpSeconds;
    const perCode=Object.fromEntries(CODES.map(k=>[k,(perHelp[k]||0)*hours]));
    candidates.push({index:i,pokemon:row.pokemon,raw:adapted.row,
     assumesMint:adapted.assumesMint,assumesRibbon:adapted.assumesRibbon,
     helpsBonus:availableHelpingBonus(adapted.row,hb),perCode});
   }
   if(candidates.length<5)
    return blocked('INSUFFICIENT_VERIFIED_POKEMON',
     'F1対象の計算可能な個体が5匹未満です。', {eligibleCount:candidates.length,
      excludedCount:excluded,unsupportedCount:unsupported});
   // Select the hypothetical 5-person roster by marginal TARGET coverage.
   // Greedy with a deterministic index tie-break; never treat it as adopted.
   const picked=[],taken=new Set(),covered=Object.fromEntries(CODES.map(k=>[k,0]));
   for(let seat=0;seat<5;seat++){
    let chosen=null,gain=-Infinity;
    for(const c of candidates){
     if(taken.has(c.index))continue;
     let score=0;
     for(const k of CODES){
      const before=Math.min(need[k],covered[k]);
      const after=Math.min(need[k],covered[k]+c.perCode[k]);
      // Soft category balance: diminishing returns on already-covered foods.
      score+=after-before;
     }
     // When all gaps have been covered, still prefer productive candidates.
     score+=1e-5*CODES.reduce((a,k)=>a+c.perCode[k],0);
     if(score>gain+1e-10||
       (Math.abs(score-gain)<=1e-10&&c.index<(chosen?.index??Infinity))){
      gain=score;chosen=c;
     }
    }
    if(!chosen)throw Error('ROSTER_UNDERFLOW');
    picked.push(chosen);taken.add(chosen.index);
    for(const k of CODES)covered[k]+=chosen.perCode[k];
   }
   const bonusCount=picked.reduce((n,c)=>n+Number(c.helpsBonus),0);
   const exact=Object.fromEntries(CODES.map(k=>[k,0]));
   for(const c of picked){
    const teammates=bonusCount-Number(c.helpsBonus);
    const r=rates.evaluate(c.raw,snapshot,traits,{
     teammateHelpingBonusCount:teammates,goodCamp:input.camp});
    if(r?.status!=='BASE_RATES_AVAILABLE'||!Number.isFinite(r.referenceHelpSeconds)||
      r.referenceHelpSeconds<=0||!plain(r.ingredientCountsPerHelp))
     throw Error('TEAM_RATE_INVALID');
    const helps=referenceHours*3600/r.referenceHelpSeconds;
    for(const k of CODES){
     const amount=(r.ingredientCountsPerHelp[k]||0)*helps;
     if(!Number.isFinite(amount)||amount<0)throw Error('RATE_NONFINITE');
     exact[k]+=amount;
    }
    assumedMints+=Number(c.assumesMint);
    assumedRibbons+=Number(c.assumesRibbon);
   }
   // Keep the raw expected scenario internally; round DOWN only on final
   // presentation. It is NOT a guaranteed collectible amount.
   const scenarioProduction={};
   for(const k of CODES){
    const n=Math.floor(exact[k]+1e-9);
    if(!Number.isSafeInteger(n)||n<0||n>10000)throw Error('PRODUCTION_OUT_OF_RANGE');
    scenarioProduction[k]=n;
   }
   // No identifying CSV rows, nicknames, indices, or nature/builds in result.
   return Object.freeze({status:'PROVISIONAL',
    model:'ZERO_ENERGY_REFERENCE_HELP_168H_CONTINUOUS_FIVE',
    source:'F1_B_PINNED_66_SPECIES',sourceCommit,
    referenceHours,eligibleCount:candidates.length,
    excludedCount:excluded,unsupportedCount:unsupported,
    assumedMintCount:assumedMints,assumedRibbonCount:assumedRibbons,
    teamSpecies:picked.map(c=>c.pokemon),
    scenarioProduction:Object.freeze(scenarioProduction),
    candidateRosterIsAdopted:false,scenarioMayReduceConfirmedGoals:false,
    assumptions:Object.freeze([
     '同じ5匹を168時間連続で編成した場合の0げんき基準のおてつだい回数を使用',
     'げんき変動・回収間隔・所持数上限・食材ゲット系スキル・週内の生産時刻は未計上',
     'この5匹は食材需要との一致で自動抽出した仮編成で、実際のイベント編成ではありません',
     '確実に取得できる個数ではないため、準備目標から自動控除しません'
    ]),userRowsRetained:false});
  }catch(e){
   return blocked('INVALID_SOURCE_OR_INPUT',
    '個体の計算原典または食材条件を検証できません。');
  }
 }
 return Object.freeze({estimate,CODES});
});

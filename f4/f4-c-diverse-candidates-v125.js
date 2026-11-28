/* F4/F5 v125: strategy-diverse, read-only candidate generation.
 * This is a SCREEN, not a weekly-energy evaluator. It preserves high-berry,
 * high-food, direct-energy skill, cooking-support skill and each recipe's
 * ingredient-complementing teams before the existing 29-window simulation.
 * Scores are only selection heuristics; NEVER report them as weekly energy.
 * Private rows, nicknames and save data never leave the caller.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CStrategyDiversityV125=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DAY=new Set(['morning','noon','evening']);
 // Only skills with a verified level-dependent effect may reserve a skill lane.
 // Fixed-energy health recovery / context-unknown effects do not get a bonus.
 const SUPPORT_CAP=Object.freeze({
  'Cooking Power-Up S':7,'Tasty Chance S':6,
  'Ingredient Magnet S':7,'Ingredient Magnet S (Present)':7,
  'Ingredient Draw S':7,'Extra Helpful S':7,'Berry Burst':6
 });
 const SUPPORT_UNIT=Object.freeze({
  'Cooking Power-Up S':'POT_CAPACITY_DELTA',
  'Tasty Chance S':'EXTRA_TASTY_CHANCE_POINTS',
  'Ingredient Magnet S':'INGREDIENT_ITEMS',
  'Ingredient Magnet S (Present)':'INGREDIENT_ITEMS',
  'Ingredient Draw S':'INGREDIENT_ITEMS',
  'Extra Helpful S':'EXTRA_HELPS','Berry Burst':'BERRIES'
 });
 const DIRECT=new Set(['Charge Strength S','Charge Strength M','Charge Strength S (Random)']);
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false});
 const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 const unique=xs=>[...new Set(xs)];
 const sum=x=>Object.values(x).reduce((n,v)=>n+v,0);
 function selectTeams({policy,slot,profiles,rawProfiles,recipes,foods,
   inventory={},count=12,skillValues,potCapacity=5000,camp=false,
   preferredRecipes={},fieldBonus=0}={}){
  try{
   if(policy?.status!=='POLICY_READY'||!DAY.has(slot)||
    !Array.isArray(profiles)||!Array.isArray(rawProfiles)||!Array.isArray(recipes)||
    !Array.isArray(foods)||!foods.length||new Set(foods).size!==foods.length||
    !Number.isSafeInteger(count)||count<4||count>24||
    !Number.isSafeInteger(potCapacity)||potCapacity<7||
    !Array.isArray(policy.fillerIds)||policy.fillerIds.length<4)
    return fail('V125_DIVERSITY_SOURCE_MISSING');
   const levelWeightCache=new Map();
   function supportWeight(skill,level){
    if(!Object.hasOwn(SUPPORT_CAP,skill)||!Number.isSafeInteger(level))return 0;
    const key=skill+'|'+level;
    if(levelWeightCache.has(key))return levelWeightCache.get(key);
    const proc=skillValues?.skillValue?.(skill,level);
    const max=skillValues?.skillValue?.(skill,SUPPORT_CAP[skill]);
    const good=v=>['BASE_VALUE_ONLY','PARTIAL_SIDE_EFFECT_UNMODELED'].includes(v?.status)&&
     v.unit===SUPPORT_UNIT[skill]&&finite(v.value)&&v.value>0;
    const weight=good(proc)&&good(max)?Math.min(1,proc.value/max.value):0;
    levelWeightCache.set(key,weight);return weight;
   }
   const all=new Map(profiles.map(p=>[p.id,p]));
   const raw=new Map(rawProfiles.map(p=>[p.id,p]));
   const fill=policy.fillerIds,need=slot==='morning'?3:4;
   if(fill.some(id=>!all.has(id)||!raw.has(id))||
    !all.has(policy.primaryHealerId)||!all.has(policy.secondaryHealerId))
    return fail('V125_DIVERSITY_INDIVIDUAL_MISMATCH');
   const healers=slot==='morning'?
    [policy.secondaryHealerId,policy.primaryHealerId]:[policy.primaryHealerId];
   const rawRecipes=recipes.filter(r=>r&&
    typeof r.id==='string'&&finite(r.baseStrength)&&
    r.requirements&&Object.keys(r.requirements).length&&
    Object.entries(r.requirements).every(([k,v])=>foods.includes(k)&&finite(v))&&
    Object.values(r.requirements).some(v=>v>0)&&
    finite(r.size)&&r.size<=potCapacity*(camp?1.5:1))
    .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id))
    .map(r=>({...r,requirements:Object.fromEntries(
     Object.entries(r.requirements).filter(([,v])=>v>0))}));
   const preferred=new Set(Object.values(preferredRecipes||{}));
   const targets=[...rawRecipes.filter(r=>preferred.has(r.id)),...rawRecipes]
    .filter((r,i,all)=>all.findIndex(a=>a.id===r.id)===i).slice(0,6);
   // Single-member value is for CANDIDATE POOL only. It never limits later
   // team synergy by assigning an ingredient to a Pokemon "specialty".
   const directValues=new Map(rawProfiles.filter(p=>DIRECT.has(p.skillCode)).map(p=>{
    const effect=skillValues?.skillValue?.(p.skillCode,p.selectedMainSkillLevel,
     {fieldBonusPercent:fieldBonus});
    const verified=effect?.status==='BASE_VALUE_ONLY'&&finite(effect.value)&&
     ['ENERGY_PER_ACTIVATION','ENERGY_PER_ACTIVATION_EXPECTED'].includes(effect.unit);
    return [p.id,verified?effect.value:0];
   }));
   const single=id=>{
    const p=all.get(id),r=p.rates?.[0];
    if(!r||!finite(r.helpSeconds)||r.helpSeconds<=0)throw Error('INVALID_RATE');
    const hourly=3600/r.helpSeconds;
    const food=Object.fromEntries(foods.map(k=>[k,(r.ingredientCountsPerHelp[k]||0)*hourly]));
    const own=raw.get(id),chance=own?.ratesByTeammateBonus?.[0]?.skillProbabilityPerEligibleHelp;
    const skill=own?.skillCode;
    const direct=finite(chance)?hourly*chance*(directValues.get(id)||0):0;
    const support=finite(chance)?hourly*chance*supportWeight(skill,own?.selectedMainSkillLevel):0;
    return {id,berry:(r.berryEnergyPerHelp||0)*hourly,
     food,amount:sum(food),direct,support,tasty:skill==='Tasty Chance S'?support:0};
   };
   const singles=fill.map(single),byId=new Map(singles.map(x=>[x.id,x]));
   const order=(key)=>singles.slice().sort((a,b)=>key(b)-key(a)||
    a.id.localeCompare(b.id)).map(x=>x.id);
   const berry=order(x=>x.berry),ingredients=order(x=>x.amount),
    direct=order(x=>x.direct),support=order(x=>x.support);
   const byFood=new Map(foods.map(k=>[k,order(x=>x.food[k]||0)]));
   const pools=[];
   const addPool=(ids)=>{
    const p=unique(ids).filter(id=>byId.has(id)).slice(0,12);
    if(p.length>=need&& !pools.some(x=>x.join('|')===p.join('|')))pools.push(p);
   };
   const foundation=unique([...berry.slice(0,4),...ingredients.slice(0,4),
    ...direct.slice(0,2),...order(x=>x.tasty).filter(id=>byId.get(id).tasty>0).slice(0,1),...support.slice(0,2)]);
   addPool([...foundation,...fill]);
   for(const recipe of targets){
    const req=Object.keys(recipe.requirements).sort((a,b)=>
     recipe.requirements[b]-recipe.requirements[a]||a.localeCompare(b));
    const producers=req.flatMap(k=>byFood.get(k).slice(0,2));
    addPool([...producers,...berry.slice(0,3),...direct.slice(0,2),
     ...support.slice(0,2),...ingredients.slice(0,2),...fill]);
   }
   const seen=new Map();
   function metrics(team){
    let berry=0,direct=0,support=0,tasty=0,food=Object.fromEntries(foods.map(k=>[k,0]));
    for(const id of team){
     const p=all.get(id),own=raw.get(id);
     const bonus=team.reduce((n,other)=>n+Number(other!==id&&all.get(other).helpingBonus),0);
     const rate=p.rates?.[bonus];
     if(!rate||!finite(rate.helpSeconds)||rate.helpSeconds<=0)
      throw Error('MISSING_TEAM_RATE');
     const hourly=3600/rate.helpSeconds;
     berry+=hourly*rate.berryEnergyPerHelp;
     for(const k of foods)food[k]+=hourly*(rate.ingredientCountsPerHelp[k]||0);
     const chance=own?.ratesByTeammateBonus?.[bonus]?.skillProbabilityPerEligibleHelp;
     if(finite(chance)){
      const skill=own.skillCode;
      direct+=hourly*chance*(directValues.get(id)||0);
      const weight=hourly*chance*supportWeight(skill,own.selectedMainSkillLevel);
      support+=weight;
      if(skill==='Tasty Chance S')tasty+=weight;
     }
    }
    // Six hours is a screening horizon, NOT a predicted cooking time. The
    // minimum bottleneck ratio avoids treating unrelated surplus as useful
    // for a high-energy recipe that lacks one mandatory ingredient.
    const recipe=targets.map(r=>{
     const cover=Math.min(1,...Object.entries(r.requirements).map(([k,n])=>
      ((inventory[k]||0)+food[k]*6)/n));
     return cover*r.baseStrength;
    });
    const cooking=recipe.length?Math.max(...recipe):0;
    const throughput=sum(food);
    return {berry,direct,support,tasty,throughput,cooking,recipe,
     hybrid:berry*6+direct*6+cooking};
   }
   function makeTeams(ids){
    const rec=(index,chosen)=>{
     if(chosen.length===need){
      const key=chosen.slice().sort().join('|');
      if(seen.has(key))return;
      const team=[...chosen,...healers];
      const measure=metrics(team);
      if(Object.values(measure).some(x=>typeof x==='number'&&!Number.isFinite(x)))
       throw Error('INVALID_TEAM_SCORE');
      seen.set(key,{team,measure,key});
      return;
     }
     for(let i=index;i<=ids.length-(need-chosen.length);i++)
      rec(i+1,[...chosen,ids[i]]);
    };
    rec(0,[]);
   }
   for(const p of pools)makeTeams(p);
   const entries=[...seen.values()];
   if(!entries.length)return fail('V125_NO_FEASIBLE_TEAMS');
   const picked=[],pickedKeys=new Set(),lanes={};
   const take=(name,key,amount,positiveOnly=false)=>{
    const order=entries.slice().filter(x=>!positiveOnly||key(x.measure)>0)
     .sort((a,b)=>key(b.measure)-key(a.measure)||
     b.measure.hybrid-a.measure.hybrid||a.key.localeCompare(b.key));
    let n=0;
    for(const p of order){
     if(picked.length>=count||n>=amount)break;
     if(!pickedKeys.has(p.key)){
      picked.push(p);pickedKeys.add(p.key);n++;
     }
    }
    lanes[name]=n;
   };
   // Reserve a place for every modeled avenue BEFORE blending energy.
   take('berry',m=>m.berry,2);
   take('ingredients',m=>m.throughput,1);
   take('direct',m=>m.direct,1,true);
   take('tasty',m=>m.tasty,1,true);
   take('support_skill',m=>m.support,1,true);
   take('mixed',m=>m.hybrid,1);
   for(let i=0;i<targets.length;i++)
    take('recipe_'+i,m=>m.recipe[i]||0,1,true);
   take('hybrid',m=>m.hybrid,count);
   return Object.freeze({status:'CANDIDATES_READY',
    teams:picked.map(x=>x.team),
    screenedCombinations:entries.length,selected: picked.length,
    recipeLanes:targets.length,lanes:Object.freeze(lanes),
    stage:'V125_DIVERSE_STRATEGY_SCREEN',
    scoreIsWeeklyEnergy:false,indirectSkillEnergyPriced:false,
    weeklyEnergyCertified:false,writesSavedData:false});
  }catch(_){return fail('V125_DIVERSITY_CALCULATION_INVALID');}
 }
 // Preserve recipe-completion trajectories through a beam, not just during
 // its initial team screening. Each chosen state is still scored by the
 // existing stateful week simulation; these lanes are NOT energy estimates.
 function selectStates({states,count=12,recipes,stockKey='inventory',
   rankEnergy,preferredCount,preferredRecipes={}}={}){
  try{
   if(!Array.isArray(states)||!states.length||states.length>50000||
    !Number.isSafeInteger(count)||count<2||count>60||
    !Array.isArray(recipes)||typeof rankEnergy!=='function'||
    !['stock','inventory'].includes(stockKey))
    return fail('V125_STATE_FRONTIER_INPUT_INVALID');
   const available=recipes.filter(r=>r?.requirements&&finite(r.baseStrength)&&
    Object.values(r.requirements).some(v=>finite(v)&&v>0))
    .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id));
   const pinned=new Set(Object.values(preferredRecipes||{}));
   const viable=[...available.filter(r=>pinned.has(r.id)),...available]
    .filter((r,i,all)=>all.findIndex(x=>x.id===r.id)===i)
    .slice(0,6).map(r=>({energy:r.baseStrength,
     req:Object.entries(r.requirements).filter(([,v])=>v>0)}));
   const pref=typeof preferredCount==='function'?preferredCount:()=>0;
   // Cache all metrics ONCE. A 29-window run invokes this at every slot;
   // sorting each lane repeatedly is unnecessarily slow on Android.
   const rows=states.map((state,i)=>{
    const stock=state[stockKey]||{},values=Object.values(stock);
    const ingredientTotal=values.reduce((a,b)=>a+b,0);
    const recipe=viable.map(r=>{
     const frac=r.req.map(([k,n])=>Math.min(4,(stock[k]||0)/n));
     const bottleneck=Math.min(...frac);
     return r.energy*(0.8*bottleneck+0.2*
      frac.reduce((a,b)=>a+b,0)/frac.length);
    });
    const energy=rankEnergy(state),preference=pref(state);
    if(!finite(energy)||!finite(ingredientTotal)||!finite(preference)||
     recipe.some(x=>!finite(x)))throw Error('INVALID_FRONTIER_SCORE');
    return {state,key:state.signature||String(i),energy,
     preference,ingredientTotal,recipe,used:false};
   });
   const picked=[],lanes={};
   function pick(name,metric,max,positiveOnly=false){
    let selected=0;
    for(let k=0;k<max&&picked.length<count;k++){
     let best=null,score=-Infinity;
     for(const row of rows){
      if(row.used)continue;
      const value=metric(row);
      if(positiveOnly&&value<=0)continue;
      if(value>score||value===score&&(row.energy>(best?.energy??-Infinity)||
       row.energy===(best?.energy??-Infinity)&&row.key<(best?.key??''))){
       best=row;score=value;
      }
     }
     if(!best)break;
     best.used=true;picked.push(best.state);selected++;
    }
    lanes[name]=selected;
   }
   pick('energy',x=>x.energy,Math.min(2,count));
   pick('preferred',x=>x.preference,1,true);
   pick('ingredients',x=>x.ingredientTotal,1,true);
   for(let i=0;i<viable.length;i++)
    pick('recipe_'+i,x=>x.recipe[i],1,true);
   pick('energy_fill',x=>x.energy,count);
   return Object.freeze({status:'FRONTIER_READY',states:picked,
    lanes,screenedStates:states.length,recipeLanes:viable.length,
    scoreIsWeeklyEnergy:false,weeklyEnergyCertified:false,writesSavedData:false});
  }catch(_){return fail('V125_STATE_FRONTIER_CALCULATION_INVALID');}
 }
 return Object.freeze({selectTeams,selectStates});
});

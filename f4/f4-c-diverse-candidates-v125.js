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
 const SUPPORT=new Set(['Cooking Power-Up S','Tasty Chance S','Ingredient Magnet S']);
 const DIRECT=new Set(['Charge Strength S','Charge Strength M']);
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false});
 const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 const unique=xs=>[...new Set(xs)];
 const sum=x=>Object.values(x).reduce((n,v)=>n+v,0);
 function selectTeams({policy,slot,profiles,rawProfiles,recipes,foods,
   inventory={},count=12,skillValues,potCapacity=5000,camp=false,
   preferredRecipes={}}={}){
  try{
   if(policy?.status!=='POLICY_READY'||!DAY.has(slot)||
    !Array.isArray(profiles)||!Array.isArray(rawProfiles)||!Array.isArray(recipes)||
    !Array.isArray(foods)||!foods.length||new Set(foods).size!==foods.length||
    !Number.isSafeInteger(count)||count<4||count>24||
    !Number.isSafeInteger(potCapacity)||potCapacity<7||
    !Array.isArray(policy.fillerIds)||policy.fillerIds.length<4)
    return fail('V125_DIVERSITY_SOURCE_MISSING');
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
   const single=id=>{
    const p=all.get(id),r=p.rates?.[0];
    if(!r||!finite(r.helpSeconds)||r.helpSeconds<=0)throw Error('INVALID_RATE');
    const hourly=3600/r.helpSeconds;
    const food=Object.fromEntries(foods.map(k=>[k,(r.ingredientCountsPerHelp[k]||0)*hourly]));
    const own=raw.get(id),chance=own?.ratesByTeammateBonus?.[0]?.skillProbabilityPerEligibleHelp;
    const skill=own?.skillCode,verified=DIRECT.has(skill)?
     skillValues?.skillValue?.(skill,own?.selectedMainSkillLevel):null;
    const direct=DIRECT.has(skill)&&verified?.status==='BASE_VALUE_ONLY'&&
      verified?.unit==='ENERGY_PER_ACTIVATION'&&finite(verified.value)&&finite(chance)?
      hourly*chance*verified.value:0;
    const support=SUPPORT.has(skill)&&finite(chance)?hourly*chance:0;
    return {id,berry:(r.berryEnergyPerHelp||0)*hourly,
     food,amount:sum(food),direct,support};
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
    ...direct.slice(0,2),...support.slice(0,2)]);
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
    let berry=0,direct=0,support=0,food=Object.fromEntries(foods.map(k=>[k,0]));
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
      const val=DIRECT.has(skill)?
       skillValues?.skillValue?.(skill,own.selectedMainSkillLevel):null;
      if(val?.status==='BASE_VALUE_ONLY'&&val.unit==='ENERGY_PER_ACTIVATION'&&finite(val.value))
       direct+=hourly*chance*val.value;
      if(SUPPORT.has(skill))support+=hourly*chance;
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
    return {berry,direct,support,throughput,cooking,recipe,
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
     a.key.localeCompare(b.key));
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
   take('cooking_support',m=>m.support,1,true);
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
   rankEnergy,preferredCount}={}){
  try{
   if(!Array.isArray(states)||!states.length||states.length>50000||
    !Number.isSafeInteger(count)||count<2||count>60||
    !Array.isArray(recipes)||typeof rankEnergy!=='function'||
    !['stock','inventory'].includes(stockKey))
    return fail('V125_STATE_FRONTIER_INPUT_INVALID');
   const viable=recipes.filter(r=>r?.requirements&&finite(r.baseStrength)&&
    Object.values(r.requirements).some(v=>finite(v)&&v>0))
    .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id))
    .slice(0,6);
   const byStock=x=>x?.[stockKey]||{};
   const amount=x=>sum(byStock(x));
   const preference=typeof preferredCount==='function'?preferredCount:()=>0;
   const recipesPotential=(x,r)=>{
    const values=Object.entries(r.requirements).filter(([,n])=>n>0)
     .map(([k,n])=>Math.min(1,(byStock(x)[k]||0)/n));
    if(!values.length)return 0;
    const bottleneck=Math.min(...values);
    return r.baseStrength*(0.8*bottleneck+0.2*
     values.reduce((n,v)=>n+v,0)/values.length);
   };
   const safeMetric=(f,x)=>{
    const v=f(x);
    return Number.isFinite(v)?v:-Infinity;
   };
   const picked=[],used=new Set(),lanes={};
   function pick(label,measure,max,positiveOnly=false){
    const order=states.slice().filter(s=>
     !positiveOnly||safeMetric(measure,s)>0).sort((a,b)=>
     safeMetric(measure,b)-safeMetric(measure,a)||
     (a.signature||'').localeCompare(b.signature||''));
    let n=0;
    for(const item of order){
     if(picked.length>=count||n>=max)break;
     const key=item.signature||JSON.stringify(item.slots||item);
     if(used.has(key))continue;
     used.add(key);picked.push(item);n++;
    }
    lanes[label]=n;
   }
   pick('energy',rankEnergy,Math.min(2,count));
   pick('preferred',preference,1,true);
   pick('ingredients',amount,1,true);
   for(let i=0;i<viable.length;i++)
    pick('recipe_'+i,x=>recipesPotential(x,viable[i]),1,true);
   pick('energy_fill',rankEnergy,count);
   return Object.freeze({status:'FRONTIER_READY',states:picked,
    lanes,screenedStates:states.length,recipeLanes:viable.length,
    scoreIsWeeklyEnergy:false,weeklyEnergyCertified:false,writesSavedData:false});
  }catch(_){return fail('V125_STATE_FRONTIER_CALCULATION_INVALID');}
 }
 return Object.freeze({selectTeams,selectStates});
});

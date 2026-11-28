/* M1 v128: shared, bounded event-aware energy model.
 * Energy is a comparison estimate, not a game-exact stochastic simulator.
 * Immutable public provenance only; no box writes or user-identifying data.
 * Tasty chance reuses the v102 71-state cooking probability kernel.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeM1LiteEnergyV128=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const fail=reason=>Object.freeze({status:'BLOCKED',reason});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const valid=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 const known=new Set(['dish','skillTrigger','ingredient','berry','skillLevel',
  'carryLimitAdd','globalCarryLimitAdd','carryLimitMul','dreamShard','energyFromDish','potSize']);
 const neutral=Object.freeze({status:'EVENT_READY',official:false,dish:1,
  skillTrigger:1,ingredient:0,berry:0,skillLevel:0,potSize:1,
  carryLimitAdd:0,globalCarryLimitAdd:0,carryLimitMul:1,
  target:Object.freeze({}),sourceId:null,unmodeled:[],
  referenceOnly:true});
 function event(ctx){
  if(typeof ctx?.weekStart!=='string'||typeof ctx?.eventId!=='string')
   return fail('M1_EVENT_OWNER_MISSING');
  const source=ctx.fields?.source;
  if(source==null){
   const prefix='manual:'+ctx.weekStart;
   const suffix=ctx.eventId.slice(prefix.length);
   // Multiple distinct user-created events can share the same week.
   // Only same-week numeric suffixes are neutral manual events; never
   // reinterpret an official/mismatched ID as a manual event.
   if(ctx.eventId!==prefix&&
    !(ctx.eventId.startsWith(prefix)&&/^-[1-9][0-9]*$/.test(suffix)))
    return fail('M1_EVENT_SOURCE_REQUIRED');
   return neutral;
  }
  if(!plain(source)||source.id!==ctx.eventId||source.start!==ctx.weekStart||
   !/^pokesleep-tool:[\w \-]+:\d{4}-\d\d-\d\d$/.test(source.id)||
   typeof source.upstreamRevision!=='string'||!source.upstreamRevision||
   !plain(source.verifiedEffects)||!plain(source.verifiedTarget))
   return fail('M1_EVENT_PROVENANCE_MISMATCH');
  const fx=source.verifiedEffects,unmodeled=Object.keys(fx).filter(k=>!known.has(k));
  if(unmodeled.length)return Object.freeze({status:'BLOCKED',
   reason:'M1_EVENT_EFFECT_UNMODELED',unmodeled});
  const target=source.verifiedTarget;
  if(Object.keys(target).some(k=>!['specialty','type'].includes(k))||
   target.specialty!=null&&!['Berries','Ingredients','Skills'].includes(target.specialty)||
   target.type!=null&&(!Array.isArray(target.type)||!target.type.length||
    target.type.some(t=>typeof t!=='string')))
   return fail('M1_EVENT_TARGET_UNVERIFIED');
  const multipliers=['dish','skillTrigger','carryLimitMul','potSize'];
  const integers=['ingredient','berry','skillLevel','carryLimitAdd','globalCarryLimitAdd'];
  if(multipliers.some(k=>fx[k]!=null&&!valid(fx[k],.05,20))||
   integers.some(k=>fx[k]!=null&&(!Number.isSafeInteger(fx[k])||fx[k]<0||fx[k]>1000)))
   return fail('M1_EVENT_EFFECT_INVALID');
  const fields={dish:fx.dish??1,skillTrigger:fx.skillTrigger??1,
   ingredient:fx.ingredient??0,berry:fx.berry??0,
   skillLevel:fx.skillLevel??0,carryLimitAdd:fx.carryLimitAdd??0,
   globalCarryLimitAdd:fx.globalCarryLimitAdd??0,
   carryLimitMul:fx.carryLimitMul??1,potSize:fx.potSize??1};
  if(source.unknownEffects===true)return fail('M1_EVENT_SOURCE_UNVERIFIED');
  return Object.freeze({status:'EVENT_READY',official:true,
   sourceId:source.id,target:Object.freeze({...target}),
   ...fields,unmodeled:[],referenceOnly:true});
 }
 const applies=(p,event)=>{
  if(!event.official)return false;
  const target=event.target;
  return (target.specialty==null||p.skillSpecialty===target.specialty)&&
   (target.type==null||Array.isArray(target.type)&&
    typeof p.pokemonType==='string'&&target.type.includes(p.pokemonType));
 };
 function withEvent(profiles,event,skillValues){
  if(event?.status!=='EVENT_READY'||!Array.isArray(profiles))
   return fail('M1_EVENT_ROSTER_MISSING');
  if(!event.official)return {status:'ROSTER_READY',profiles};
  const list=[];
  for(const p of profiles){
   if(!plain(p)||!Array.isArray(p.ratesByTeammateBonus))return fail('M1_ROSTER_INVALID');
   const affected=applies(p,event);
   const level=p.selectedMainSkillLevel;
   let nextLevel=level;
   if(affected&&event.skillLevel>0&&p.skillCode){
    if(!Number.isSafeInteger(level)||!skillValues?.skillValue)
     return fail('M1_EVENT_SKILL_LEVEL_SOURCE_MISSING');
    // Skill level ceilings are independently pinned by F1-C even for
    // contextual skills (Metronome, Skill Copy, Versatile, Stockpile).
    // A missing numeric *effect* table must not make the legal level
    // increment invalid or block the entire real Box roster.
    // This does NOT price contextual effects into weekly energy.
    let max=skillValues.maxLevel?.(p.skillCode);
    if(!Number.isSafeInteger(max)||max<1||max>8){
     // Backward-compatible oracle dependency: numeric effect tables alone
     // may still establish a cap for supported direct-value skills.
     max=0;
     for(let n=1;n<=8;n++){
      const x=skillValues.skillValue(p.skillCode,n);
      if(['BASE_VALUE_ONLY','PARTIAL_SIDE_EFFECT_UNMODELED'].includes(x?.status))
       max=n;
     }
    }
    if(!max)return fail('M1_EVENT_SKILL_LEVEL_UNVERIFIED');
    if(level<1||level>max)return fail('M1_EVENT_SKILL_LEVEL_SOURCE_MISSING');
    nextLevel=Math.min(max,level+event.skillLevel);
   }
   const rates=[];
   for(const r of p.ratesByTeammateBonus){
    if(!plain(r))return fail('M1_RATE_INVALID');
    const next={...r};
    if(affected){
     if(event.skillTrigger!==1){
      const base=r.skillProbabilityPerEligibleHelp;
      if(base!==null&&base!==undefined){
       if(!valid(base,0,1))return fail('M1_SKILL_PROBABILITY_UNVERIFIED');
       next.skillProbabilityPerEligibleHelp=Math.min(1,base*event.skillTrigger);
      }
     }
     if(event.ingredient>0){
      const prob=r.ingredientProbabilityPerHelp;
      const food=r.ingredientCountsPerHelp;
      const all=plain(food)?Object.values(food).reduce((a,b)=>a+b,0):NaN;
      if(!valid(prob,0,1)||!valid(all,0,100))
       return fail('M1_INGREDIENT_HELP_PROBABILITY_UNVERIFIED');
      const factor=all>0?1+event.ingredient*prob/all:1;
      next.ingredientCountsPerHelp=Object.fromEntries(Object.entries(food)
       .map(([k,v])=>[k,v*factor]));
     }
     if(event.berry>0){
      const qty=r.berryCountPerBerryHelp,old=r.berryItemsPerHelp;
      if(!valid(qty,1,20)||!valid(old,0,20)||
       !valid(r.berryEnergyPerHelp,0,100000))
       return fail('M1_BERRY_SOURCE_UNVERIFIED');
      const ratio=(qty+event.berry)/qty;
      next.berryItemsPerHelp=old*ratio;
      next.berryCountPerBerryHelp=qty+event.berry;
      next.berryEnergyPerHelp=r.berryEnergyPerHelp*ratio;
     }
    }
    rates.push(next);
   }
   let carry=p.carryLimit;
   if(Number.isSafeInteger(carry)){
    const add=event.globalCarryLimitAdd+(affected?event.carryLimitAdd:0);
    carry=Math.min(2000,Math.ceil((carry+add)*(affected?event.carryLimitMul:1)));
   }
   list.push({...p,selectedMainSkillLevel:nextLevel,
    carryLimit:carry,ratesByTeammateBonus:rates});
  }
  return {status:'ROSTER_READY',profiles:list};
 }
 function recipeEnergy(recipe,fieldBonus,dishMultiplier=1){
  if(!Number.isSafeInteger(recipe?.strength70)||recipe.strength70<=0||
   !valid(fieldBonus,0,100)||!valid(dishMultiplier,.05,20))
   return fail('M1_LV70_RECIPE_VALUE_MISSING');
  const base=Math.floor(recipe.strength70*(1+fieldBonus/100)*
   dishMultiplier+1e-9);
  return {status:'ENERGY_READY',base,
   weekdaySuccess:base*2,sundaySuccess:base*3};
 }
 // Bounded expected skill stocks: 1-stock = Bernoulli(mean), 2-stock =
 // Binomial(2,mean/2). This is a stated approximation, NOT exact proc timing.
 function expectedTastyCast(state,level,mean,countCap,skillValues,kernel){
  if(!kernel?.initial||!kernel?.cook||!plain(state)||
   state.status!=='STATE_READY'||!Number.isSafeInteger(countCap)||
   ![1,2].includes(countCap)||!valid(mean,0,countCap)||
   !Number.isSafeInteger(level))
   return fail('M1_TASTY_EXPECTATION_INVALID');
  const lookup=skillValues?.skillValue?.('Tasty Chance S',level);
  if(lookup?.status!=='BASE_VALUE_ONLY'||
   lookup.unit!=='EXTRA_TASTY_CHANCE_POINTS'||
   !Number.isSafeInteger(lookup.value)||lookup.value<1||lookup.value>70)
   return fail('M1_TASTY_SKILL_VALUE_MISSING');
  const a=mean/countCap,powers=[];
  if(countCap===1)powers.push(1-a,a);
  else powers.push((1-a)**2,2*a*(1-a),a*a);
  const next=Array(71).fill(0);
  for(let b=0;b<=70;b++){
   const mass=state.tastyDistribution[b];
   if(!mass)continue;
   for(let k=0;k<powers.length;k++)
    next[Math.min(70,b+k*lookup.value)]+=mass*powers[k];
  }
  // Delegate state validity and the critical reset transition to v102.
  const probe=kernel.initial({potExtra:0,tastyExtra:0});
  if(probe.status!=='STATE_READY'||next.some(v=>!valid(v,0,1)))return fail('M1_TASTY_PROBABILITY_INVALID');
  return {status:'STATE_READY',potExtra:state.potExtra,
   tastyDistribution:next,weeklyEnergyCertified:false,writesSavedData:false};
 }
 // Frontier heuristic only. Value the next affordable meal up to a total
 // 40% chance; the actual cook still uses the full distribution and cap.
 function nextMealCredit(recipes,pot,camp,windows){
  const dishes=[...recipes].sort((a,b)=>b.baseStrength-a.baseStrength)
   .map(r=>({base:r.baseStrength,size:r.size,needs:Object.entries(r.requirements).filter(([,n])=>n>0)}));
  const byDay=[false,true].map(sunday=>dishes.filter(r=>
   r.size<=Math.round(pot*(camp?1.5:1)*(sunday?2:1))));
  return windows.map((_,i)=>{
   const next=windows.slice(i+1).find(w=>w.slot!=='sleep');
   if(!next)return ()=>0;
   const sunday=next.day===6,limit=sunday?10:30;
   return (stock,tasty)=>{
    if(!tasty)return 0;
    const points=typeof tasty==='number'?Math.min(limit,tasty):
     tasty.tastyDistribution.reduce((sum,mass,b)=>sum+mass*Math.min(limit,b),0);
    if(!points)return 0;
    const dish=byDay[Number(sunday)].find(r=>r.needs.every(([k,n])=>(stock[k]||0)+1e-8>=n));
    return dish?dish.base*points/100*(sunday?2:1):0;
   };
  });
 }
 function cook(state,recipe,fieldBonus,dishMultiplier,day,kernel){
  const level=recipeEnergy(recipe,fieldBonus,dishMultiplier);
  if(level.status!=='ENERGY_READY')return level;
  return kernel.cook(state,{baseEnergy:level.base,
   successEnergy:day===6?level.sundaySuccess:level.weekdaySuccess,
   day,useCritical:true});
 }
 return Object.freeze({event,applies,withEvent,recipeEnergy,expectedTastyCast,nextMealCredit,cook});
});

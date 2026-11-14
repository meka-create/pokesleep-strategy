/* F4-C v99: read-only stateful 29-window REPLAY of an F4-B selected path.
 * Does not assert a re-optimized weekly plan, real RNG, unobserved taps,
 * sleep behavior, main skill triggers, or a verified event simulation.
 * Item provenance at 04:00 keeps pre-week berries out of this week's proxy.
 * No I/O, storage, logs, or personal row fields. Fail closed.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CWindowReplay=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const fail=(reason)=>Object.freeze({status:'BLOCKED',reason,
  stage:'F4_C_V99_STATEFUL_REPLAY',weeklyEnergyCertified:false,
  writesSavedData:false,privateIndividualDataInResult:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const int=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
 const tiny=1e-7;
 const round=n=>Math.round(n*1000)/1000;
 const tickTime=ms=>new Date(ms).toISOString();
 const sum=o=>Object.values(o).reduce((n,v)=>n+v,0);
 function replay(input={},deps={}){
  try{
   if(!plain(input)||input.eventSource!==null||
    input.scenarioConsent!=='EXPLICIT_OBSERVATIONS_AND_SLEEP_PROXY')
    return fail('UNVERIFIED_EVENT_OR_SCENARIO');
   const kernel=deps.stateKernel,core=deps.baseCore,week=deps.gameWeek;
   if(typeof kernel?.tier!=='function'||typeof kernel?.observedRecovery!=='function'||
    typeof core?.normalizeProfiles!=='function'||typeof core?.normalizeRecipes!=='function'||
    typeof week?.build!=='function')return fail('DEPENDENCIES_MISSING');
   const ref=input.reference,clock=week.build(ref?.weekStart,ref?.startsAt);
   if(ref?.status!=='PROVISIONAL'||ref?.model!=='ORDERED_29_WINDOW_NEUTRAL_REFERENCE'||
    ref.weeklyEnergyCertified!==false||ref.writesSavedData!==false||
    clock.status!=='TIMELINE_READY'||ref.slotCount!==29||
    ref.startsAt!==clock.startsAt||ref.endsAt!==clock.endsAt||
    !Array.isArray(ref.slots)||ref.slots.length!==29)
    return fail('UNVERIFIED_29_WINDOW_PATH');
   if(!int(input.bagCapacity,1,5000)||!int(input.potCapacity,7,5000)||
    !int(input.fieldBonus,0,100)||typeof input.camp!=='boolean'||
    !plain(input.initialInventory)||!plain(input.initialEnergy)||
    !plain(input.initialHeld)||!Array.isArray(input.collections)||
    !Array.isArray(input.recoveries)||input.collections.length>3000||
    input.recoveries.length>3000)return fail('STATE_INPUT_MISSING');
   const original=input.profiles,profiles=core.normalizeProfiles(original);
   const food=core.FOOD,codes=new Set(food),recipes=core.normalizeRecipes(input.recipes);
   const byId=new Map(profiles.map(p=>[p.id,p]));
   const rawById=new Map(original.map(p=>[p.id,p]));
   const recipeById=new Map(recipes.map(r=>[r.id,r]));
   const inventory=Object.fromEntries(food.map(k=>[k,0]));
   if(Object.keys(input.initialInventory).some(k=>!codes.has(k)))return fail('INVENTORY_CODES');
   for(const [k,v] of Object.entries(input.initialInventory)){
    if(!finite(v,0,10000))return fail('INVENTORY_QUANTITY');
    inventory[k]=v;
   }
   if(sum(inventory)>input.bagCapacity+tiny)return fail('BAG_OVER_CAPACITY');
   const usedIds=new Set();
   for(let j=0;j<29;j++){
    const w=clock.windows[j],s=ref.slots[j];
    if(!plain(s)||s.day!==w.day||s.slot!==w.slot||s.source!==w.source||
     s.startsAt!==w.startsAt||s.endsAt!==w.endsAt||
     !Array.isArray(s.team)||s.team.length!==5||new Set(s.team).size!==5||
     s.team.some(id=>!byId.has(id))||
     (w.slot==='sleep'&&s.recipeId!==null))
     return fail('PATH_WINDOW_OR_ROSTER_MISMATCH');
    for(const id of s.team)usedIds.add(id);
    if(s.recipeId!==null&&!recipeById.has(s.recipeId))
     return fail('RECIPE_NOT_IN_PINNED_CATALOG');
   }
   const energy=new Map(),held=new Map(),richRates=new Map();
   for(const id of usedIds){
    const p=rawById.get(id);
    if(!int(input.initialEnergy[id],0,150)||!int(p?.carryLimit,1,2000)||
     !Array.isArray(p.ratesByTeammateBonus)||p.ratesByTeammateBonus.length!==5)
     return fail('HEALTH_OR_INDIVIDUAL_CARRY_MISSING');
    const starting=input.initialHeld[id];
    if(!plain(starting)||!plain(starting.ingredients)||
     !finite(starting.berryCount,0,2000)||!finite(starting.berryEnergy,0,1000000)||
     Object.keys(starting.ingredients).some(k=>!codes.has(k)))
     return fail('HELD_SNAPSHOT_REQUIRED');
    const ing=Object.fromEntries(food.map(k=>[k,0]));
    for(const [k,v] of Object.entries(starting.ingredients)){
     if(!finite(v,0,2000))return fail('HELD_QUANTITY');
     ing[k]=v;
    }
    if(sum(ing)+starting.berryCount>p.carryLimit+tiny)
     return fail('INITIAL_HELD_EXCEEDS_CAPACITY');
    // Initial berry provenance before 04:00 cannot be assigned to this week.
    if(starting.berryEnergy>0||starting.berryCount>0)
     return fail('PREWEEK_HELD_BERRY_PROVENANCE_UNKNOWN');
    const perBonus=p.ratesByTeammateBonus.map(r=>{
     if(!finite(r.berryItemsPerHelp,0,100)||
      !finite(r.berryEnergyPerHelp,0,100000)||
      !finite(r.helpSeconds,120,25000)||!plain(r.ingredientCountsPerHelp))
      return null;
     return r;
    });
    if(perBonus.includes(null))return fail('ITEM_RATE_NOT_PINNED');
    energy.set(id,input.initialEnergy[id]);
    held.set(id,{ingredients:ing,berryCount:0,berryEnergy:0,
     carryBerryEnergy:0,count:sum(ing),capacity:p.carryLimit});
    richRates.set(id,perBonus);
   }
   if(Object.keys(input.initialEnergy).some(k=>!usedIds.has(k))||
    Object.keys(input.initialHeld).some(k=>!usedIds.has(k)))
    return fail('STALE_OR_MIXED_ROSTER_SNAPSHOT');
   const start=Date.parse(clock.startsAt),end=Date.parse(clock.endsAt);
   const offsetTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
   const validTime=t=>typeof t==='string'&&offsetTime.test(t)&&Number.isFinite(Date.parse(t))&&
    Date.parse(t)>=start&&Date.parse(t)<=end&&
    (Date.parse(t)-start)%600000===0;
   const actions=new Map();
   function append(at,action){
    if(!validTime(at))return false;
    const time=tickTime(Date.parse(at));
    if(!actions.has(time))actions.set(time,[]);
    actions.get(time).push(action);
    return true;
   }
   for(const c of input.collections){
    if(!plain(c)||!Array.isArray(c.ids)||c.ids.length<1||
     new Set(c.ids).size!==c.ids.length||c.ids.some(id=>!usedIds.has(id))||
     !append(c.at,{kind:'COLLECT',ids:c.ids}))return fail('COLLECTION_SCHEDULE_INVALID');
   }
   for(const r of input.recoveries){
    if(!plain(r)||!usedIds.has(r.id)||!finite(r.points,0,150)||
     !['OBSERVED_SLEEP','OBSERVED_SKILL','OBSERVED_MEAL'].includes(r.origin)||
     !append(r.at,{kind:'RECOVER',id:r.id,points:r.points,origin:r.origin}))
     return fail('RECOVERY_SCHEDULE_INVALID');
   }
   // Duplicate collection at one instant is ambiguous and rejected.
   for(const changes of actions.values()){
    const collectionIds=changes.filter(x=>x.kind==='COLLECT').flatMap(x=>x.ids);
    if(new Set(collectionIds).size!==collectionIds.length)
     return fail('DUPLICATE_COLLECTION_AT_INSTANT');
   }
   let berryEnergy=0,mealEnergy=0,carryBerry=0,helps=0,
    collected=0,meals=0;
   const eventTimes=[...actions.keys()].sort();
   const visited=new Set();
   function at(ms){
    const at=tickTime(ms);
    if(!actions.has(at))return null;
    visited.add(at);
    // First collect only what already exists; recovery is next.
    for(const action of actions.get(at).filter(x=>x.kind==='COLLECT')){
     for(const id of action.ids){
      const h=held.get(id);
      if(sum(inventory)+sum(h.ingredients)>input.bagCapacity+tiny)
       return 'BAG_TRANSFER_OVER_CAPACITY';
      for(const k of food)inventory[k]+=h.ingredients[k];
      collected+=h.count;
      berryEnergy+=h.berryEnergy;
      carryBerry+=h.carryBerryEnergy;
      h.ingredients=Object.fromEntries(food.map(k=>[k,0]));
      h.berryCount=0;h.berryEnergy=0;h.carryBerryEnergy=0;h.count=0;
     }
    }
    for(const action of actions.get(at).filter(x=>x.kind==='RECOVER')){
     const r=kernel.observedRecovery(energy.get(action.id),action.points,action.origin);
     if(r.status!=='OBSERVED_RECOVERY_APPLIED')return 'OBSERVED_RECOVERY_INVALID';
     energy.set(action.id,r.energy);
    }
    return null;
   }
   const slotReports=[];
   for(let j=0;j<29;j++){
    const w=clock.windows[j],s=ref.slots[j],from=Date.parse(w.startsAt),to=Date.parse(w.endsAt);
    if((to-from)%600000!==0)return fail('TICK_BOUNDARY');
    const firstErr=at(from);
    if(firstErr)return fail(firstErr);
    let dish=null,meal=0;
    if(s.recipeId!==null){
     dish=recipeById.get(s.recipeId);
     if(w.slot==='sleep'||dish.size>Math.round(input.potCapacity*
       (w.day===6?2:1)*(input.camp?1.5:1)))
      return fail('RECIPE_POT_CONSTRAINT');
     if(food.some(k=>inventory[k]+tiny<dish.requirements[k]))
      return fail('RECIPE_UNAVAILABLE_AT_SLOT');
     for(const k of food)inventory[k]-=dish.requirements[k];
     meal=Math.floor(dish.baseStrength*(1+input.fieldBonus/100)+1e-9);
     mealEnergy+=meal;meals++;
    }
    const bonusCount=new Map();
    for(const id of s.team){
     const bonus=s.team.reduce((n,other)=>
      n+Number(other!==id&&byId.get(other).helpingBonus),0);
     bonusCount.set(id,bonus);
    }
    let slotHelps=0;
    for(let ms=from;ms<to;ms+=600000){
     if(ms!==from){const err=at(ms);if(err)return fail(err);}
     for(const id of s.team){
      const tier=kernel.tier(energy.get(id));
      if(tier.status!=='TIER_READY')return fail(tier.reason||'HEALTH_TIER_UNVERIFIED');
      const r=richRates.get(id)[bonusCount.get(id)];
      const n=600/(r.helpSeconds*tier.helpSecondsFactor);
      const h=held.get(id),carry=w.source==='PREVIOUS_WEEK_SLEEP';
      let ingredientCount=0;
      for(const k of food){
       const amount=(r.ingredientCountsPerHelp[k]||0)*n;
       if(!finite(amount,0,500))return fail('EXPECTED_INGREDIENT_RATE_INVALID');
       h.ingredients[k]+=amount;ingredientCount+=amount;
      }
      const newBerry=r.berryItemsPerHelp*n;
      h.berryCount+=newBerry;
      if(carry)h.carryBerryEnergy+=r.berryEnergyPerHelp*n;
      else h.berryEnergy+=r.berryEnergyPerHelp*n;
      h.count+=ingredientCount+newBerry;
      if(h.count>h.capacity+tiny)return fail('COLLECTION_SCHEDULE_REQUIRED');
      slotHelps+=n;
      // Sleep is a separate, explicitly PROVISIONAL frozen-tier scenario;
      // no implicit 8.5h recovery, awake depletion or skill healing.
      if(w.slot!=='sleep')energy.set(id,Math.max(0,energy.get(id)-1));
     }
    }
    helps+=slotHelps;
    slotReports.push({day:w.day,slot:w.slot,source:w.source,
     startsAt:w.startsAt,endsAt:w.endsAt,
     recipeId:s.recipeId,mealEnergyProxy:meal,
     helpsExpectedProxy:round(slotHelps),bagAfter:round(sum(inventory))});
   }
   const endErr=at(end);if(endErr)return fail(endErr);
   if(visited.size!==eventTimes.length)return fail('ACTION_TIME_NOT_VISITED');
   return Object.freeze({status:'PROVISIONAL',stage:'F4_C_V99_STATEFUL_REPLAY',
    model:'FIXED_29_WINDOW_OBSERVED_STATE_SCENARIO',slotCount:29,
    weekStart:ref.weekStart,totalHours:168,mealOpportunities:21,
    energyProxy:Math.round(mealEnergy+berryEnergy),
    berryEnergyProxy:Math.round(berryEnergy),
    mealEnergyProxy:Math.round(mealEnergy),
    carryBerryExcludedProxy:Math.round(carryBerry),
    expectedHelpOpportunities:round(helps),mealsCooked:meals,
    explicitCollections:input.collections.length,
    explicitRecoveries:input.recoveries.length,
    itemCountCollectedExpected:round(collected),
    endingBagExpected:round(sum(inventory)),
    slots:slotReports,
    weeklyEnergyCertified:false,writesSavedData:false,
    privateIndividualDataInResult:false,
    observedSkillTriggersNotInferred:true,
    optimizedForHealth:false,recipeLevelModeled:false,
    sleepDynamicsCertified:false,timerCarryModeled:false,
    assumptions:[
     '既存F4-Bの選択経路を再評価する。げんき込みで再最適化した編成ではない',
     '起床中10分刻みのげんき低下と5段階速度のみを反映する',
     '睡眠中のげんき・速度は仮の固定段階。実際の睡眠回復は観測入力のみ',
     '回収は入力された時刻と対象個体のみ。所持上限超過は試算停止',
     'レシピレベル、スキル抽選とストック、追加食材、実抽選揺らぎは未反映',
     '期待食材は連続量であり、実際の取得個数ではない'
    ]});
  }catch(_){return fail('INVALID_STATEFUL_SCENARIO');}
 }
 return Object.freeze({replay});
});

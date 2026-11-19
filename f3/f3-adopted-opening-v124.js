/* F3 v124: read-only opening stock for ONE event-owned, adopted F4 29-window plan.
 * Reference ONLY: help rates, health factors and assumed taps are not observed drops.
 * Recipes must match saved category/meal goals; otherwise fail closed to v120 goals.
 * No private individual rows, storage, I/O or automatic adoption.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF3AdoptedOpeningV124=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const FOODS=['leek','mushroom','egg','potato','apple','herb','sausage','milk',
  'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado','nuts'];
 const SLOTS=new Set(['morning','noon','evening']),EPS=1e-7;
 const fail=(reason)=>({status:'BLOCKED',reason,readOnly:true,productionCertified:false});
 const zero=()=>Object.fromEntries(FOODS.map(k=>[k,0]));
 const sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000;
 const integer=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000;
 function calculate(input){
  try{
   const {ctx,plan,identity,roster,recipes,base,bagCapacity,currentStock}=input||{};
   if(ctx?.status!=='CONTEXT_READY'||ctx.clock?.phase!=='BEFORE'||
    plan?.kind!=='REAL_BOX_PLAN_V112'||plan.weekStart!==ctx.weekStart||
    plan.eventId!==ctx.eventId||plan.sourceCommit!==roster?.sourceCommit||
    identity?.status!=='IDENTITIES_READY'||!Array.isArray(roster?.profiles)||
    roster.profiles.length<5||!Array.isArray(recipes)||recipes.length<1||
    !Array.isArray(plan.slots)||plan.slots.length!==29||
    ctx.clock.windows?.length!==29||base?.status!=='PROVISIONAL'||
    !Number.isSafeInteger(bagCapacity)||bagCapacity<1||bagCapacity>5000||
    !currentStock||FOODS.some(k=>!integer(currentStock[k])))
    return fail('VERIFIED_ADOPTED_WEEK_REQUIRED');
   const preferred=Object.fromEntries(base.categories.map(c=>[c.id,c.count]));
   const actual=Object.fromEntries(Object.keys(preferred).map(id=>[id,0]));
   const recipeMap=new Map(recipes.map(r=>[r.id,r]));
   const participants=new Map(roster.profiles.map(p=>[p.id,p]));
   const windows=[];
   for(let i=0;i<29;i++){
    const slot=plan.slots[i],clock=ctx.clock.windows[i];
    if(slot.day!==clock.day||slot.slot!==clock.slot||slot.source!==clock.source||
     slot.startsAt!==clock.startsAt||slot.endsAt!==clock.endsAt||
     !Array.isArray(slot.teamIds)||!(slot.teamIds.length===5||
       i===0&&plan.previousWeekCarryUnknown===true&&slot.teamIds.length===0)||
     new Set(slot.teamIds).size!==slot.teamIds.length||
     slot.teamIds.some(stable=>!identity.byId.has(stable))||
     (slot.slot==='sleep'&&slot.recipeId!==null))
     return fail('TIMELINE_OR_IDENTITY_MISMATCH');
    const team=slot.teamIds.map(id=>'p'+identity.byId.get(id));
    if(team.some(id=>!participants.has(id)))return fail('UNSUPPORTED_ADOPTED_MEMBER');
    if(SLOTS.has(slot.slot)&&slot.recipeId!==null){
     if(!Object.hasOwn(actual,slot.recipeId))return fail('PLANNED_RECIPE_DIFFERS');
     actual[slot.recipeId]++;
    }
    windows.push({team,slot:slot.slot,hours:clock.hours,recipeId:slot.recipeId});
   }
   if(Object.keys(preferred).some(k=>actual[k]!==preferred[k]))
    return fail('PLANNED_MEAL_COUNT_DIFFERS');
   if(!Object.keys(preferred).length||sum(actual)<1)
    return fail('NO_MATCHED_PLANNED_MEALS');
   const expectedCounts=zero();
   for(const w of windows){
    if(!SLOTS.has(w.slot)||w.recipeId===null)continue;
    const recipe=recipeMap.get(w.recipeId);
    if(!recipe||!recipe.requirements)return fail('PLANNED_RECIPE_MISSING');
    for(const [food,n] of Object.entries(recipe.requirements)){
     if(!FOODS.includes(food)||!integer(n))return fail('INVALID_MEAL_INGREDIENT');
     expectedCounts[food]+=n;
    }
   }
   if(FOODS.some(k=>expectedCounts[k]!==base.goals[k]))
    return fail('PLANNED_TOTAL_MISMATCH');
   const run=(target)=>{
    const bag={...target},held=new Map([...participants.keys()].map(id=>[
     id,{foods:zero(),count:0}]));
    let prior=[],overflow=0,lost=0;
    const deficits=zero();
    for(let index=0;index<windows.length;index++){
     const w=windows[index],tap=SLOTS.has(w.slot);
     if(tap){
      // F4-C's assumed collection takes place BEFORE changing the team.
      for(const id of prior){
       const h=held.get(id),amount=sum(h.foods);
       const free=Math.max(0,bagCapacity-sum(bag));
       const fraction=amount>EPS?Math.min(1,free/amount):0;
       for(const k of FOODS)bag[k]+=h.foods[k]*fraction;
       overflow+=amount*(1-fraction);
       h.foods=zero();h.count=0;
      }
     }
     for(const id of prior)if(!w.team.includes(id)){
      const h=held.get(id);lost+=sum(h.foods);h.foods=zero();h.count=0;
     }
     if(tap&&w.recipeId!==null){
      const req=recipeMap.get(w.recipeId).requirements;
      for(const k of FOODS){
       const need=req[k]||0;
       if(need>bag[k]+EPS){
        const missing=Math.ceil(need-bag[k]-EPS);
        deficits[k]+=missing;
        bag[k]+=missing; // temporary supply; rerun from opening with this deficit
       }
       bag[k]=Math.max(0,bag[k]-need);
      }
     }
     for(const id of w.team){
      const p=participants.get(id);
      const bonus=w.team.reduce((n,other)=>n+Number(other!==id&&participants.get(other).helpingBonus),0);
      const rate=p.ratesByTeammateBonus?.[bonus];
      if(!rate||!Number.isFinite(rate.helpSeconds)||rate.helpSeconds<120||rate.helpSeconds>25000||
       !valid(rate.carryLimit)||rate.carryLimit<1||
       !valid(rate.berryItemsPerHelp)||
       !rate.ingredientCountsPerHelp)return null;
      const helps=w.hours*3600/(rate.helpSeconds*(w.slot==='sleep'?1:0.45));
      const items=zero();
      for(const k of FOODS){
       const v=rate.ingredientCountsPerHelp[k]??0;
       if(!valid(v))return null;
       items[k]=helps*v;
      }
      const h=held.get(id),total=helps*rate.berryItemsPerHelp+sum(items);
      const remain=Math.max(0,rate.carryLimit-h.count);
      const fraction=total>EPS?Math.min(1,remain/total):0;
      for(const k of FOODS)h.foods[k]+=items[k]*fraction;
      h.count+=total*fraction;
     }
     prior=w.team;
    }
    return {deficits,overflow,lost};
   };
   let opening=zero(),simulation=null,settled=false;
   // Iteratively add the minimum missing food at the beginning of the week.
   // A rerun is required: added opening food changes shared bag overflow.
   for(let pass=0;pass<75;pass++){
    simulation=run(opening);
    if(!simulation)return fail('PRODUCTION_RATE_UNVERIFIED');
    if(!sum(simulation.deficits)){settled=true;break;}
    for(const k of FOODS)opening[k]+=simulation.deficits[k];
    if(FOODS.some(k=>!integer(opening[k]))||sum(opening)>bagCapacity)
     return fail('OPENING_TARGET_EXCEEDS_BAG');
   }
   if(!settled)return fail('OPENING_TARGET_DID_NOT_CONVERGE');
   // Current unrelated stock must not secretly fund the selected recipes.
   // If extra stock changes capacity/collection, reject the discounted goal.
   const actualOpening=Object.fromEntries(FOODS.map(k=>[k,Math.max(currentStock[k],opening[k])]));
   if(sum(actualOpening)>bagCapacity)return fail('CURRENT_STOCK_LEAVES_NO_ROOM');
   const check=run(actualOpening);
   if(!check||sum(check.deficits))return fail('CURRENT_STOCK_CHANGES_COLLECTION');
   if(FOODS.some(k=>opening[k]>base.goals[k]))
    return fail('PROJECTION_EXCEEDS_BASELINE');
   const topups=Object.fromEntries(FOODS.map(k=>[k,Math.max(0,opening[k]-currentStock[k])]));
   const saved=Object.fromEntries(FOODS.map(k=>[k,base.goals[k]-opening[k]]));
   return {status:'PROVISIONAL',stage:'F3_ADOPTED_OPENING_V124',
    goals:opening,baselineGoals:{...base.goals},deductedExpected:saved,topups,
    matchedPlannedMeals:sum(actual),bagCapacity,starting:sum(currentStock),
    expectedBagOverflow:Math.round(check.overflow*100)/100,
    expectedSwappedItemsLost:Math.round(check.lost*100)/100,
    productionCertified:false,weeklyPlanCertified:false,readOnly:true,
    model:'F4_ITEM_AWARE_ASSUMED_COLLECTION_NO_SKILL_REFERENCE',
    note:'採用済みの29窓・実個体おてつだい期待値に基づく参考必要初期在庫。回収・抽選・げんき・スキル・イベント独自効果は確定しておらず、確実に集まる数ではありません。'};
  }catch(_){return fail('INVALID_ADOPTED_OPENING_INPUT');}
 }
 return Object.freeze({FOODS,calculate});
});

/* M3 v132: pure read-only consistency report for F3 preference vs F4/F5 29 windows.
 * Not an observed meal log, guaranteed stockpile, or a 21-meal optimizer.
 * No personal Box rows, storage, timer, I/O, or implicit plan mutation.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeM3PlanAlignmentV132=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const FOOD=Object.freeze(['leek','mushroom','egg','potato','apple','herb',
  'sausage','milk','honey','oil','ginger','tomato','cacao','tail','soy',
  'corn','coffee','pumpkin','avocado','nuts']);
 const TYPES=Object.freeze(['curry','salad','dessert']);
 const SLOT=Object.freeze(['morning','noon','evening','sleep']);
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,writesSavedData:false});
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 const zero=()=>Object.fromEntries(FOOD.map(k=>[k,0]));
 const sum=o=>Object.values(o).reduce((s,v)=>s+v,0);
 function report(input={}){
  try{
   const {weekStart,eventId,slots,recipes,preference,bagCapacity,
    effectivePot,camp,phase,currentStock,planOwner}=input;
   if(planOwner!=null&&(!plain(planOwner)||
    planOwner.weekStart!==weekStart||planOwner.eventId!==eventId))
    return fail('M3_FOREIGN_EVENT_PLAN');
   if(typeof weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||
    typeof eventId!=='string'||!eventId||!Array.isArray(slots)||slots.length!==29||
    !Array.isArray(recipes)||recipes.length!==81||!int(bagCapacity,1,5000)||
    !int(effectivePot,7,5000)||typeof camp!=='boolean'||
    !['BEFORE','DURING','ENDED'].includes(phase))
    return fail('M3_OWNER_PLAN_OR_CAPACITY_INVALID');
   const recipeMap=new Map();
   for(const r of recipes){
    if(!plain(r)||typeof r.id!=='string'||!r.id||recipeMap.has(r.id)||
     !TYPES.includes(r.type)||!plain(r.requirements)||
     !Object.keys(r.requirements).length||
     Object.entries(r.requirements).some(([k,v])=>!FOOD.includes(k)||!int(v,1,500)))
     return fail('M3_RECIPE_CATALOG_INVALID');
    recipeMap.set(r.id,r);
   }
   const demand=zero(),counts={},history={past:0,active:0,future:0};
   let scheduled=0;
   for(let i=0;i<29;i++){
    const w=slots[i],expected=i===0?'sleep':SLOT[(i-1)%4];
    if(!plain(w)||w.slot!==expected||
     w.day!==(i===0?-1:Math.floor((i-1)/4))||
     w.recipeId!==null&&w.recipeId!==undefined&&
      (expected==='sleep'||!recipeMap.has(w.recipeId))||
     w.windowPhase!==undefined&&!['PAST_FORECAST_ONLY','ACTIVE_REMAINDER','FUTURE_FORECAST'].includes(w.windowPhase))
     return fail('M3_PLAN_SEQUENCE_OR_RECIPE_INVALID');
    if(w.windowPhase==='PAST_FORECAST_ONLY')history.past++;
    else if(w.windowPhase==='ACTIVE_REMAINDER')history.active++;
    else if(w.windowPhase==='FUTURE_FORECAST')history.future++;
    if(w.recipeId==null)continue;
    const recipe=recipeMap.get(w.recipeId);
    const limit=Math.round(effectivePot*(w.day===6?2:1)*(camp?1.5:1));
    const size=sum(recipe.requirements);
    if(size>limit)return fail('M3_PLAN_POT_CAPACITY_CONFLICT');
    counts[w.recipeId]=(counts[w.recipeId]||0)+1;
    scheduled++;
    for(const [code,n] of Object.entries(recipe.requirements)){
     demand[code]+=n;
     if(demand[code]>10500)return fail('M3_PLANNED_DEMAND_OVERFLOW');
    }
   }
   if(scheduled>21||history.past+history.active+history.future>29)
    return fail('M3_PLAN_MEALS_INVALID');
   const preferenceStatus=preference==null?'NONE':preference.status;
   if(preferenceStatus!=='NONE'&&preferenceStatus!=='READY')
    return fail('M3_PREP_PREFERENCE_UNVERIFIED');
   let matched=0,missing=0,outside=0,target=0,targetDemand=zero(),bagOccupied=null,
    bagCompatible=true;
   const targets=[];
   if(preferenceStatus==='READY'){
    const selected=preference.selectedRecipes,limit=preference.targetCounts;
    if(!plain(selected)||!plain(limit)||!Object.keys(selected).length||
     Object.keys(selected).length>3||
     Object.keys(selected).some(cat=>!TYPES.includes(cat)||!recipeMap.has(selected[cat])||
      recipeMap.get(selected[cat]).type!==cat||!int(limit[cat],1,21))||
     Object.keys(limit).some(cat=>!Object.hasOwn(selected,cat)))
     return fail('M3_PREP_RECIPE_OR_TARGET_INVALID');
    for(const cat of TYPES){
     if(!Object.hasOwn(selected,cat))continue;
     const id=selected[cat],expected=limit[cat],actual=counts[id]||0;
     const met=Math.min(expected,actual),shortfall=Math.max(0,expected-actual);
     targets.push(Object.freeze({category:cat,recipeId:id,target:expected,
      planned:actual,matched:met,shortfall}));
     target+=expected;matched+=met;missing+=shortfall;
     for(const [food,n] of Object.entries(recipeMap.get(id).requirements))
      targetDemand[food]+=n*expected;
    }
    if(target>21)return fail('M3_PREP_TOTAL_TOO_MANY');
    outside=scheduled-matched;
    // Future weekly demand may exceed a single bag due to future harvest;
    // ONLY the simultaneously reserved F3 target is bag-constrained.
    if(sum(targetDemand)>bagCapacity)bagCompatible=false;
    if(phase==='BEFORE'&&currentStock!==undefined&&currentStock!==null){
     if(!plain(currentStock)||Object.keys(currentStock).some(k=>!FOOD.includes(k))||
      Object.values(currentStock).some(n=>!int(n,0,10000)))
      return fail('M3_OPENING_STOCK_INVALID');
     bagOccupied=FOOD.reduce((n,k)=>n+Math.max(targetDemand[k],currentStock[k]||0),0);
     if(bagOccupied>bagCapacity)bagCompatible=false;
    }
   }
   const exact=preferenceStatus==='READY'&&missing===0&&outside===0;
   return Object.freeze({status:'ALIGNMENT_READY',weekStart,eventId,
    preferenceStatus,recipeCounts:Object.freeze({...counts}),
    targets:Object.freeze(targets),target,matched,missing,outside,
    scheduledMeals:scheduled,emptyMeals:21-scheduled,
    targetDemand:Object.freeze(targetDemand),plannedDemand:Object.freeze(demand),
    bagCapacity,bagOccupied,bagCompatible,
    match:preferenceStatus==='NONE'?'NO_PREP_REFERENCE':exact?'EXACT':'DIFFERENT',
    // F5's past/active entries are saved FORECASTS, not observed meals.
    pastForecastWindows:history.past,activeForecastWindows:history.active,
    futureForecastWindows:history.future,
    readOnly:true,writesSavedData:false,observedMeals:0,
    weeklyEnergyCertified:false,
    note:'備蓄の料理・食数と採用予定21枠を照合する参考表示。予定は食事実績ではなく、未来生産やバッグ内の時系列在庫を保証しません。'});
  }catch(_){return fail('M3_ALIGNMENT_INVALID');}
 }
 return Object.freeze({FOOD,report});
});

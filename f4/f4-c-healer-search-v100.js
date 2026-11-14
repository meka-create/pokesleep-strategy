/* F4-C v100: bounded, read-only 29-window healer-constrained optimizer.
 * Daytime: main healer always, morning secondary healer as user specified.
 * Seven sleep parties and previous-Sunday rollover remain independent.
 * High-energy helping speed (80+ tier) is a scenario proxy, NOT a
 * claim that skills proc, sleep restores exactly 100 energy or taps occur.
 * Reuses the F4-B chronology and pinned F1-B neutral rates.
 * The 19-food/78-recipe unbonused model remains NEUTRAL ONLY.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CHealerSearch=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=reason=>Object.freeze({status:'BLOCKED',reason,
  stage:'F4_C_V100_HEALER_FIRST_REFERENCE',
  weeklyEnergyCertified:false,writesSavedData:false,
  privateIndividualDataInResult:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
 const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
 const round3=n=>Math.round(n*1000)/1000;
 function plan(input={},deps={}){
  try{
   if(!plain(input)||input.eventMode!=='NEUTRAL_REFERENCE_ONLY'||
    input.eventSource!==null)return blocked('OFFICIAL_EVENT_NOT_MODELED');
   if(input.healthScenario!=='HEALER_MAINTAINS_80_PLUS_REFERENCE'||
    input.sleepScore!==100)
    return blocked('USER_HEALER_SLEEP_SCENARIO_REQUIRED');
   if(typeof deps.policy?.validate!=='function'||
    typeof deps.policy?.candidateTeams!=='function'||
    typeof deps.base?.normalizeProfiles!=='function'||
    typeof deps.base?.normalizeRecipes!=='function'||
    typeof deps.clock?.build!=='function')return blocked('DEPENDENCIES_MISSING');
   const clock=deps.clock.build(input.weekStart,input.asOf);
   if(clock.status!=='TIMELINE_READY'||clock.windowCount!==29||
    clock.totalHours!==168)return blocked('GAME_WEEK_INVALID');
   if(!integer(input.potCapacity,7,5000)||!integer(input.bagCapacity,1,5000)||
    !integer(input.fieldBonus,0,100)||typeof input.camp!=='boolean'||
    typeof input.autoSleep!=='boolean'||input.autoSleep!==false||
    !['curry','salad','dessert','all'].includes(input.foodMode))
    return blocked('SETTINGS_OR_SLEEP_MODE_INVALID');
   // Sleeping parties are explicitly selected real anonymous individuals.
   // No POOL IDs, automatic overnight changes or inferred prior-week team.
   const profiles=deps.base.normalizeProfiles(input.profiles);
   const recipes=deps.base.normalizeRecipes(input.recipes);
   const foods=deps.base.FOOD,byId=new Map(profiles.map(p=>[p.id,p]));
   const verified=ids=>Array.isArray(ids)&&ids.length===5&&
    new Set(ids).size===5&&ids.every(id=>byId.has(id));
   if(!verified(input.previousWeekSleepTeam)||
    !Array.isArray(input.nightTeams)||input.nightTeams.length!==7||
    input.nightTeams.some(t=>!verified(t)))
    return blocked('REAL_MANUAL_SLEEP_TEAMS_REQUIRED');
   const policy=deps.policy.validate({profiles:input.profiles,
    primaryHealerId:input.primaryHealerId,
    secondaryHealerId:input.secondaryHealerId,sleepScore:100});
   if(policy.status!=='POLICY_READY')return blocked(policy.reason);
   const allowed=recipes.filter(r=>input.foodMode==='all'||r.type===input.foodMode);
   if(!allowed.length)return blocked('NO_RECIPES');
   const inventory=Object.fromEntries(foods.map(k=>[k,0]));
   if(!plain(input.initialInventory)||
    Object.keys(input.initialInventory).some(k=>!foods.includes(k)))
    return blocked('INVENTORY_CODES_INVALID');
   for(const [k,v] of Object.entries(input.initialInventory)){
    if(!finite(v,0,10000))return blocked('INVENTORY_INVALID');
    inventory[k]=v;
   }
   if(Object.values(inventory).reduce((a,b)=>a+b,0)>input.bagCapacity)
    return blocked('BAG_OVER_CAPACITY');
   const beamWidth=input.beamWidth??12,candidateCount=input.dayCandidateCount??8;
   if(!integer(beamWidth,2,60)||!integer(candidateCount,1,24))
    return blocked('SEARCH_LIMIT');
   const demand=Object.create(null);
   for(const r of [...allowed].sort((a,b)=>b.baseStrength-a.baseStrength).slice(0,7)){
    for(const [k,v] of Object.entries(r.requirements))
     if(v>0)demand[k]=(demand[k]||0)+v;
   }
   const totalDemand=Math.max(1,Object.values(demand).reduce((a,b)=>a+b,0));
   function rate(id,team){
    const bonus=team.reduce((n,other)=>n+Number(other!==id&&byId.get(other).helpingBonus),0);
    return byId.get(id).rates[bonus];
   }
   const favorites=new Map();
   function score(team,weight){
    let berries=0,ingredients=0;
    for(const id of team){
     const r=rate(id,team),help=3600/r.helpSeconds;
     berries+=r.berryEnergyPerHelp*help;
     for(const k of foods)ingredients+=help*r.ingredientCountsPerHelp[k]*
      (demand[k]||0)/totalDemand;
    }
    return berries+weight*ingredients;
   }
   for(const slot of ['morning','noon','evening']){
    const candidates=new Map();
    for(const weight of [0,300,1200,4000,9000]){
     const sorted=[...policy.fillerIds].sort((a,b)=>
      score([b],weight)-score([a],weight)||a.localeCompare(b));
     const generated=deps.policy.candidateTeams(policy,slot,sorted,24);
     if(generated.status!=='CANDIDATES_READY')return blocked(generated.reason);
     for(const party of generated.teams)
      candidates.set(party.join('|'),party);
    }
    const top=[...candidates.values()]
     .sort((a,b)=>score(b,600)-score(a,600)||a.join(',').localeCompare(b.join(',')))
     .slice(0,candidateCount);
    if(!top.length)return blocked('NO_HEALER_CONSTRAINED_TEAM');
    favorites.set(slot,top);
   }
   // Only the daytime helping-speed proxy uses a constant high-energy tier.
   // Night and prior Sunday's carry use the older 0-energy reference rate.
   // No implicit heal occurrence, tap schedule, box recovery or skill energy.
   function produce(bag,team,w){
    const next={...bag},expected=Object.fromEntries(foods.map(k=>[k,0]));
    let berries=0;
    const factor=w.slot==='sleep'?1:0.45;
    for(const id of team){
     const r=rate(id,team),helps=w.hours*3600/(r.helpSeconds*factor);
     berries+=helps*r.berryEnergyPerHelp;
     for(const k of foods)expected[k]+=helps*r.ingredientCountsPerHelp[k];
    }
    const incoming=Object.values(expected).reduce((a,b)=>a+b,0);
    const available=Math.max(0,input.bagCapacity-
     Object.values(next).reduce((a,b)=>a+b,0));
    const scale=incoming?Math.min(1,available/incoming):0;
    for(const k of foods)next[k]+=expected[k]*scale;
    return {inventory:next,berry:berries,discarded:incoming*(1-scale)};
   }
   let beam=[{inventory,energy:0,meals:0,berry:0,meal:0,carry:0,discarded:0,
    lastTeam:[],slots:[],signature:''}];
   function rank(s){
    const stock=foods.reduce((n,k)=>n+s.inventory[k]*8,0);
    return s.energy+stock;
   }
   function take(states){
    states.sort((a,b)=>rank(b)-rank(a)||b.meal-a.meal||
     a.signature.localeCompare(b.signature));
    const picked=[],seen=new Set();
    for(const s of states){
     const key=s.lastTeam.join('|')+'|'+s.meals+'|'+foods.filter(k=>
      s.inventory[k]>0).map(k=>k+Math.floor(s.inventory[k]/5)).join(';');
     if(seen.has(key))continue;
     seen.add(key);picked.push(s);
     if(picked.length>=beamWidth)break;
    }
    return picked;
   }
   for(const w of clock.windows){
    const sleep=w.slot==='sleep';
    const fixed=w.source==='PREVIOUS_WEEK_SLEEP'?
     [input.previousWeekSleepTeam]:sleep?
     [input.nightTeams[w.day]]:favorites.get(w.slot);
    const pot=Math.round(input.potCapacity*(w.day===6?2:1)*
     (input.camp?1.5:1));
    const expanded=[];
    for(const s of beam){
     const feasible=sleep?[]:allowed.filter(r=>r.size<=pot&&foods.every(k=>
      s.inventory[k]+1e-8>=r.requirements[k]))
      .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id))
      .slice(0,3);
     for(const dish of [null,...feasible]){
      const after={...s.inventory};
      if(dish)for(const k of foods)after[k]-=dish.requirements[k];
      const meal=dish?Math.floor(dish.baseStrength*(1+input.fieldBonus/100)+1e-9):0;
      for(const team of fixed){
       const got=produce(after,team,w),carry=w.source==='PREVIOUS_WEEK_SLEEP';
       const countedBerry=carry?0:got.berry;
       expanded.push({inventory:got.inventory,
        energy:s.energy+countedBerry+meal,berry:s.berry+countedBerry,
        meal:s.meal+meal,carry:s.carry+(carry?got.berry:0),
        discarded:s.discarded+got.discarded,meals:s.meals+Number(Boolean(dish)),
        lastTeam:team,signature:s.signature+(dish?.id||'-')+':'+team.join(',')+';',
        slots:[...s.slots,{day:w.day,slot:w.slot,source:w.source,
         startsAt:w.startsAt,endsAt:w.endsAt,hours:w.hours,team:[...team],
         recipeId:dish?.id||null,recipeCategory:dish?.type||null,
         mealEnergyProxy:meal,berryEnergyProxy:round3(countedBerry),
         carryBerryExcludedProxy:round3(carry?got.berry:0),
         inventoryAfter:Object.fromEntries(foods.map(k=>[k,round3(got.inventory[k])]))}]});
      }
     }
    }
    beam=take(expanded);
    if(!beam.length)return blocked('EMPTY_BEAM');
   }
   const best=[...beam].sort((a,b)=>b.energy-a.energy||
    a.signature.localeCompare(b.signature))[0];
   if(!best||best.slots.length!==29||
    best.slots[0].source!=='PREVIOUS_WEEK_SLEEP'||
    best.slots[28].source!=='FINAL_NIGHT_TRUNCATED'||
    best.slots.filter(x=>x.slot!=='sleep').length!==21)
    return blocked('INCOMPLETE_WEEK');
   return Object.freeze({status:'PROVISIONAL',stage:'F4_C_V100_HEALER_FIRST_REFERENCE',
    model:'BOUNDED_HEALER_CONSTRAINED_29_WINDOW_PROXY',
    startsAt:clock.startsAt,endsAt:clock.endsAt,weekStart:input.weekStart,
    slotCount:29,totalHours:168,mealOpportunities:21,sleepSlots:7,
    sleepScoreAssumed:100,daytimeHealerPolicy:'DOUBLE_MORNING_SINGLE_LATER',
    primaryHealerId:policy.primaryHealerId,secondaryHealerId:policy.secondaryHealerId,
    healthScenario:'HEALER_MAINTAINS_80_PLUS_REFERENCE',
    overnights:'EXPLICIT_MANUAL_ONLY',autoSleep:false,
    berryEnergyProxy:Math.round(best.berry),mealEnergyProxy:Math.round(best.meal),
    energyProxy:Math.round(best.energy),
    carryBerryExcludedProxy:Math.round(best.carry),
    mealsCooked:best.meals,discardedIngredientExpectation:round3(best.discarded),
    finalExpectedInventory:Object.fromEntries(foods.map(k=>
     [k,round3(best.inventory[k])])),
    slots:best.slots,
    healthRecoveredActual:false,skillTriggersModeled:false,
    itemCollectionScheduleModeled:false,
    weeklyEnergyCertified:false,writesSavedData:false,
    privateIndividualDataInResult:false,
    assumptions:[
     '朝は主・副のヒーラー2匹、昼夜は主1匹を必須とし他のヒーラーを自由枠に入れない',
     '睡眠スコア100を前提とするが、起床時の全個体げんき100を保証しない',
     '朝昼夜はげんき80超の固定速度シナリオ。スキル発動数・回復量は計算しない',
     '夜間・前週持越しは旧F4-Bの基礎速度参考値。睡眠回復とボックス5%回復は計算しない',
     '個体所持・回収・実料理レベル・大成功・公式イベント効果は週間探索に未接続',
     '食材は連続期待値で、確定入手数ではない。既存F4-B同様、バッグ飽和は比例近似'
    ]});
  }catch(_){return blocked('INVALID_HEALER_SEARCH_INPUT');}
 }
 return Object.freeze({plan});
});

/* F4-B v93: 04:00 JST exact-window, bounded neutral engineering reference.
 * 29 actual game-week windows: previous Sunday's sleep tail (3.5h),
 * 21 daytime/meal windows, seven night windows (last night 4h).
 * No real-event energy claims, storage, fetch, private names, or saved plans.
 * F1-B 0-energy rates still omit health, skill, tapping, meals levels.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4BChronologicalCore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=(reason)=>Object.freeze({status:'BLOCKED',reason,
  stage:'F4_B_EXACT_04_CLOCK_PROXY',weeklyEnergyCertified:false,
  writesSavedData:false,privateIndividualDataInResult:false});
 const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const round3=n=>Math.round((n+Number.EPSILON)*1000)/1000;
 function plan(input={},deps={}){
  try{
   if(!plain(input)||input.eventMode!=='NEUTRAL_REFERENCE_ONLY'||
    input.eventSource!==null)
    return blocked('EVENT_MODEL_NOT_CONNECTED');
   const base=deps.base,clock=deps.gameWeek?.build?.(input.weekStart,input.asOf);
   if(!base?.FOOD||typeof base.normalizeProfiles!=='function'||
    typeof base.normalizeRecipes!=='function'||clock?.status!=='TIMELINE_READY'||
    clock.windows.length!==29||clock.totalHours!==168)
    return blocked('SOURCE_OR_WEEK_INVALID');
   if(!['curry','salad','dessert','all'].includes(input.foodMode)||
    !integer(input.bagCapacity,1,5000)||
    !integer(input.potCapacity,7,5000)||
    !integer(input.fieldBonus,0,100)||
    typeof input.camp!=='boolean'||typeof input.autoSleep!=='boolean')
    return blocked('SETTINGS_INVALID');
   const profiles=base.normalizeProfiles(input.profiles),recipes=base.normalizeRecipes(input.recipes);
   const food=base.FOOD,codes=new Set(food);
   const items=Object.fromEntries(food.map(k=>[k,0]));
   if(!plain(input.initialInventory)||Object.keys(input.initialInventory).some(k=>!codes.has(k)))
    return blocked('INVENTORY_INVALID');
   for(const [k,v] of Object.entries(input.initialInventory)){
    if(!Number.isFinite(v)||v<0||v>10000)return blocked('INVENTORY_INVALID');
    items[k]=v;
   }
   if(Object.values(items).reduce((a,b)=>a+b,0)>input.bagCapacity)
    return blocked('BAG_OVER_CAPACITY');
   const byId=new Map(profiles.map(p=>[p.id,p]));
   const verifiedTeam=team=>Array.isArray(team)&&team.length===5&&
    new Set(team).size===5&&team.every(id=>typeof id==='string'&&byId.has(id));
   if(!verifiedTeam(input.previousWeekSleepTeam))
    return blocked('PREVIOUS_WEEK_SLEEP_TEAM_REQUIRED');
   let nights=null;
   if(!input.autoSleep){
    if(!Array.isArray(input.nightTeams)||input.nightTeams.length!==7||
     input.nightTeams.some(x=>!verifiedTeam(x)))
     return blocked('VERIFIED_MANUAL_NIGHTS_REQUIRED');
    nights=input.nightTeams;
   }
   const candidateCount=input.dayCandidateCount??8,width=input.beamWidth??18;
   if(!integer(candidateCount,1,24)||!integer(width,4,80))
    return blocked('SEARCH_LIMIT');
   const allowed=recipes.filter(r=>input.foodMode==='all'||r.type===input.foodMode);
   if(!allowed.length)return blocked('NO_RECIPES');
   const demand=Object.create(null);
   for(const recipe of [...allowed].sort((a,b)=>b.baseStrength-a.baseStrength).slice(0,7))
    for(const [k,n] of Object.entries(recipe.requirements))
     if(n>0)demand[k]=(demand[k]||0)+n;
   const totalDemand=Math.max(1,Object.values(demand).reduce((s,n)=>s+n,0));
   function rateFor(id,team){
    const pokemon=byId.get(id),bonus=team.reduce((n,other)=>
     n+Number(other!==id&&byId.get(other).helpingBonus),0);
    return pokemon.rates[bonus];
   }
   const candidates=new Map();
   for(const weight of [0,350,1100,3000,8500]){
    const value=p=>{
     const r=p.rates[0],help=3600/r.helpSeconds;
     const ingredient=food.reduce((sum,k)=>sum+
      r.ingredientCountsPerHelp[k]*(demand[k]||0)/totalDemand,0);
     return help*(r.berryEnergyPerHelp+weight*ingredient);
    };
    const pool=[...profiles].sort((a,b)=>value(b)-value(a)||a.id.localeCompare(b.id))
     .slice(0,Math.min(10,profiles.length));
    function walk(start,ids){
     if(ids.length===5){
      const list=[...ids].sort(),key=list.join('|');
      if(!candidates.has(key)){
       let berry=0,ingredient=0;
       for(const id of list){
        const r=rateFor(id,list),help=3600/r.helpSeconds;
        berry+=r.berryEnergyPerHelp*help;
        ingredient+=food.reduce((s,k)=>
         s+help*r.ingredientCountsPerHelp[k]*(demand[k]||0)/totalDemand,0);
       }
       candidates.set(key,{ids:list,score:berry+500*ingredient});
      }
      return;
     }
     for(let i=start;i<=pool.length-(5-ids.length);i++)
      walk(i+1,[...ids,pool[i].id]);
    }
    walk(0,[]);
   }
   const teams=[...candidates.values()].sort((a,b)=>b.score-a.score||
    a.ids.join(',').localeCompare(b.ids.join(','))).slice(0,candidateCount).map(x=>x.ids);
   if(!teams.length)return blocked('NO_CANDIDATE_TEAMS');
   function produce(inventory,team,hours){
    const expected=Object.fromEntries(food.map(k=>[k,0]));
    let berries=0;
    for(const id of team){
     const r=rateFor(id,team),help=hours*3600/r.helpSeconds;
     berries+=help*r.berryEnergyPerHelp;
     for(const k of food)expected[k]+=help*r.ingredientCountsPerHelp[k];
    }
    const generated=food.reduce((s,k)=>s+expected[k],0);
    const used=food.reduce((s,k)=>s+inventory[k],0);
    const free=Math.max(0,input.bagCapacity-used);
    const retained=Math.min(generated,free),scale=generated?retained/generated:0;
    const next={...inventory};
    for(const k of food)next[k]+=expected[k]*scale;
    return {inventory:next,berries,discarded:Math.max(0,generated-retained)};
   }
   function rank(state){
    return state.energy+food.reduce((n,k)=>n+state.inventory[k]*8,0);
   }
   function limit(states){
    const out=[],seen=new Set();
    states.sort((a,b)=>rank(b)-rank(a)||
     b.mealEnergy-a.mealEnergy||a.signature.localeCompare(b.signature));
    for(const s of states){
     const stock=food.filter(k=>s.inventory[k]>=1).map(k=>k+Math.floor(s.inventory[k]/5)).join(';');
     const key=s.lastTeam.join('|')+'|'+stock+'|'+s.meals;
     if(seen.has(key))continue;
     seen.add(key);out.push(s);
     if(out.length>=width)break;
    }
    return out;
   }
   const factor=1+input.fieldBonus/100;
   const initial={inventory:items,energy:0,mealEnergy:0,berryEnergy:0,
    carryBerry:0,meals:0,discarded:0,lastTeam:[],slots:[],signature:''};
   let beam=[initial];
   for(const window of clock.windows){
    const sleep=window.slot==='sleep';
    const carry=window.source==='PREVIOUS_WEEK_SLEEP';
    const fixed=carry?[input.previousWeekSleepTeam]:sleep?
     (input.autoSleep?teams:[nights[window.day]]):teams;
    const pot=window.day===6?Math.round(input.potCapacity*2*(input.camp?1.5:1)):
     Math.round(input.potCapacity*(input.camp?1.5:1));
    const states=[];
    for(const s of beam){
     let dishes=[null];
     if(!sleep){
      const fits=allowed.filter(r=>r.size<=pot&&food.every(k=>s.inventory[k]+1e-8>=r.requirements[k]))
       .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id));
      dishes=[null,...fits.slice(0,3)];
     }
     for(const dish of dishes){
      const afterMeal={...s.inventory};
      if(dish)for(const k of food)afterMeal[k]-=dish.requirements[k];
      const mealEnergy=dish?Math.floor(dish.baseStrength*factor+1e-9):0;
      for(const team of fixed){
       const got=produce(afterMeal,team,window.hours);
       // Previous-week sleeping berry attribution after the 04:00 rollover
       // is unknown. Exclude it from the "current week" energy proxy.
       const countedBerry=carry?0:got.berries;
       const row={day:window.day,slot:window.slot,source:window.source,
        startsAt:window.startsAt,endsAt:window.endsAt,hours:window.hours,
        team:[...team],recipeId:dish?.id||null,
        recipeCategory:dish?.type||null,mealEnergy,berryEnergyProxy:round3(countedBerry),
        carryBerryExcludedProxy:round3(carry?got.berries:0),
        inventoryAtStart:Object.fromEntries(food.map(k=>[k,round3(s.inventory[k])])),
        inventoryAfter:Object.fromEntries(food.map(k=>[k,round3(got.inventory[k])]))};
       states.push({inventory:got.inventory,energy:s.energy+mealEnergy+countedBerry,
        mealEnergy:s.mealEnergy+mealEnergy,berryEnergy:s.berryEnergy+countedBerry,
        carryBerry:s.carryBerry+(carry?got.berries:0),
        meals:s.meals+Number(Boolean(dish)),discarded:s.discarded+got.discarded,
        lastTeam:team,slots:[...s.slots,row],
        signature:s.signature+(dish?.id||'-')+':'+team.join(',')+';'});
      }
     }
    }
    beam=limit(states);
    if(!beam.length)return blocked('EMPTY_SEARCH');
   }
   const winner=[...beam].sort((a,b)=>b.energy-a.energy||
    a.signature.localeCompare(b.signature))[0];
   if(!winner||winner.slots.length!==29)return blocked('INCOMPLETE_WINDOWS');
   const totalHours=winner.slots.reduce((a,x)=>a+x.hours,0);
   const mealOpportunities=winner.slots.filter(x=>x.slot!=='sleep').length;
   const last=winner.slots[28],first=winner.slots[0];
   if(Math.abs(totalHours-168)>1e-9||mealOpportunities!==21||
    first.source!=='PREVIOUS_WEEK_SLEEP'||first.hours!==3.5||
    last.source!=='FINAL_NIGHT_TRUNCATED'||last.hours!==4)
    return blocked('CLOCK_INVARIANT');
   return {status:'PROVISIONAL',stage:'F4_B_EXACT_04_CLOCK_PROXY',
    model:'ORDERED_29_WINDOW_NEUTRAL_REFERENCE',weekStart:input.weekStart,
    startsAt:clock.startsAt,endsAt:clock.endsAt,slotCount:29,totalHours:168,
    daytimeSlots:21,mealOpportunities:21,sleepSlots:7,carrySleepSlots:1,
    previousWeekCarryHours:3.5,finalSleepHours:4,mealsCooked:winner.meals,
    autoSleep:input.autoSleep,energyProxy:Math.round(winner.energy),
    mealEnergyProxy:Math.round(winner.mealEnergy),
    berryEnergyProxy:Math.round(winner.berryEnergy),
    carryBerryExcludedProxy:Math.round(winner.carryBerry),
    finalExpectedInventory:Object.fromEntries(food.map(k=>[k,round3(winner.inventory[k])])),
    discardedIngredientExpectation:round3(winner.discarded),slots:winner.slots,
    eventMode:'NEUTRAL_REFERENCE_ONLY',weeklyEnergyCertified:false,
    writesSavedData:false,privateIndividualDataInResult:false,
    assumptions:[
     '04:00以降の前週日曜睡眠3.5時間を別枠とし、きのみエナジーは当週へ帰属させず参考値から除外',
     '睡眠/日中の食材発生は0げんき基礎速度の連続期待値。実際の所持・回収・確率揺らぎは未反映',
     'げんき、メインスキル、料理レベル、料理チャンス、追加食材、イベント効果は未実装',
     '厳密な全組合せ最適化ではなく、日中と料理の有界ビーム探索による工学的参考値',
     'イベント開始前に保存された在庫を04:00の初期値とみなす仮定。前週睡眠中の獲得・週切替挙動は未検証'
    ]};
  }catch(_){return blocked('INVALID_REFERENCE_INPUT');}
 }
 return Object.freeze({plan});
});

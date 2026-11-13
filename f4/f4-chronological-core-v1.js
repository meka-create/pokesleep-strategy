/* F4-A v91: time-ordered, read-only 21 daytime + 21 meal + 7 night
 * REFERENCE optimizer. All dynamic gameplay effects absent in F1-B are
 * deliberately NOT called accurate weekly energy: no skill/energy/queues.
 * Never reads or writes localStorage. F4-B must replace proxy transitions.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4ChronologicalCore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const FOOD=['leek','mushroom','egg','potato','apple','herb','sausage','milk','honey',
  'oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado'];
 const CODE=new Set(FOOD),CATS=new Set(['curry','salad','dessert','all']);
 const DAY_SLOTS=Object.freeze([
  Object.freeze({key:'morning',label:'朝',hours:4.5,range:'07:30–12:00'}),
  Object.freeze({key:'noon',label:'昼',hours:6,range:'12:00–18:00'}),
  Object.freeze({key:'evening',label:'夜',hours:6,range:'18:00–00:00'})
 ]);
 const NIGHT=Object.freeze({key:'sleep',label:'睡眠枠',hours:7.5,range:'00:00–07:30'});
 const blocked=(reason,message,extra={})=>Object.freeze({
  status:'BLOCKED',reason,message,stage:'F4_A_CHRONOLOGICAL_PROXY',
  weeklyEnergyCertified:false,writesSavedData:false,...extra});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===null||Object.getPrototypeOf(Object.getPrototypeOf(x))===null);
 const integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
 const week=w=>{
  if(typeof w!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(w))return false;
  const t=Date.parse(w+'T12:00:00Z');return Number.isFinite(t)&&
   new Date(t).toISOString().slice(0,10)===w&&new Date(t).getUTCDay()===1;
 };
 const quantity=(obj,limit=10000)=>{
  if(obj==null)return Object.fromEntries(FOOD.map(x=>[x,0]));
  if(!plain(obj)||Object.keys(obj).some(k=>!CODE.has(k)))throw Error('FOOD_CODES');
  return Object.fromEntries(FOOD.map(k=>{
   const v=obj[k]??0;
   if(!Number.isFinite(v)||v<0||v>limit)throw Error('FOOD_QUANTITY');
   return [k,v];
  }));
 };
 function normalizeProfiles(items){
  if(!Array.isArray(items)||items.length<5||items.length>100)throw Error('ROSTER_SIZE');
  const seen=new Set();
  return items.map(item=>{
   if(!plain(item)||typeof item.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,80}$/.test(item.id)||
    seen.has(item.id)||item.source!=='F1_B_PINNED_66_SPECIES'||
    typeof item.helpingBonus!=='boolean'||!Array.isArray(item.ratesByTeammateBonus)||
    item.ratesByTeammateBonus.length!==5)throw Error('UNVERIFIED_PROFILE');
   seen.add(item.id);
   const rates=item.ratesByTeammateBonus.map(rate=>{
    if(!plain(rate)||rate.status!=='BASE_RATES_AVAILABLE'||
     !Number.isFinite(rate.helpSeconds)||rate.helpSeconds<120||rate.helpSeconds>25000||
     !Number.isFinite(rate.berryEnergyPerHelp)||rate.berryEnergyPerHelp<0||
     rate.berryEnergyPerHelp>100000)throw Error('RATE_INVALID');
    return {helpSeconds:rate.helpSeconds,berryEnergyPerHelp:rate.berryEnergyPerHelp,
     ingredientCountsPerHelp:quantity(rate.ingredientCountsPerHelp,100)};
   });
   return {id:item.id,helpingBonus:item.helpingBonus,rates};
  });
 }
 function normalizeRecipes(rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>200)throw Error('RECIPES');
  const seen=new Set();
  return rows.map(r=>{
   if(!plain(r)||typeof r.id!=='string'||r.id.length<1||r.id.length>120||
    seen.has(r.id)||!CATS.has(r.type)||r.type==='all'||
    !integer(r.baseStrength,1,1000000)||!plain(r.requirements)||
    !Object.keys(r.requirements).length)throw Error('RECIPE_SCHEMA');
   seen.add(r.id);
   for(const v of Object.values(r.requirements))
    if(!integer(v,1,500))throw Error('RECIPE_INGREDIENTS');
   const req=quantity(r.requirements,500);
   return {id:r.id,type:r.type,baseStrength:r.baseStrength,requirements:req,
    size:Object.values(req).reduce((a,b)=>a+b,0)};
  });
 }
 function rateFor(p,team,byId){
  const bonus=team.reduce((n,id)=>n+Number(id!==p.id&&byId.get(id).helpingBonus),0);
  return p.rates[bonus];
 }
 function produce(inventory,team,hours,byId,bag){
  const expected=Object.fromEntries(FOOD.map(k=>[k,0]));
  let berries=0;
  for(const id of team){
   const profile=byId.get(id),r=rateFor(profile,team,byId);
   const helps=hours*3600/r.helpSeconds;
   berries+=helps*r.berryEnergyPerHelp;
   for(const key of FOOD)expected[key]+=helps*r.ingredientCountsPerHelp[key];
  }
  const total=Object.values(expected).reduce((a,b)=>a+b,0);
  const used=Object.values(inventory).reduce((a,b)=>a+b,0);
  const space=Math.max(0,bag-used),kept=Math.min(space,total);
  const proportion=total>0?kept/total:0;
  const next={...inventory};
  for(const key of FOOD)next[key]=Math.max(0,Math.min(bag,next[key]+expected[key]*proportion));
  return {inventory:next,berryEnergy:berries,kept,discarded:Math.max(0,total-kept)};
 }
 function generateTeams(profiles,needed,maxCandidates){
  const byId=new Map(profiles.map(p=>[p.id,p]));
  const val=(p,w)=>{const r=p.rates[0],helps=3600/r.helpSeconds;
   return helps*(r.berryEnergyPerHelp+
    Object.keys(needed).reduce((s,k)=>s+(needed[k]>0?(w*needed[k]/Math.max(1,Object.values(needed).reduce((a,b)=>a+b,0)))*r.ingredientCountsPerHelp[k]:0),0));};
  const combos=new Map();
  for(const weight of [0,350,1000,2500,8000]){
   const sorted=[...profiles].sort((a,b)=>val(b,weight)-val(a,weight)||a.id.localeCompare(b.id));
   const pool=sorted.slice(0,Math.min(10,sorted.length));
   const picks=[];
   const walk=(start,selected)=>{
    if(selected.length===5){
     const sortedIds=[...selected].sort(),key=sortedIds.join('|');
     if(!combos.has(key)){
      let berry=0,food=0;
      for(const id of sortedIds){
       const p=byId.get(id),r=rateFor(p,sortedIds,byId),helps=3600/r.helpSeconds;
       berry+=helps*r.berryEnergyPerHelp;
       for(const k of FOOD)food+=Math.min(1,needed[k]/Math.max(1,30))*
        helps*r.ingredientCountsPerHelp[k]*80;
      }
      combos.set(key,{ids:sortedIds,score:berry+food*.5});
     }
     return;
    }
    for(let j=start;j<=pool.length-(5-selected.length);j++)
     walk(j+1,[...selected,pool[j].id]);
   };
   walk(0,[]);
  }
  return [...combos.values()].sort((a,b)=>b.score-a.score||
   a.ids.join('|').localeCompare(b.ids.join('|')))
   .slice(0,maxCandidates).map(x=>x.ids);
 }
 function plan(input={}){
  try{
   if(!plain(input)||!week(input.weekStart))return blocked('WEEK','月曜開始のゲーム週を指定してください。');
   // No event bonuses are numerically connected in F4-A. Even if a separate
   // F4 gate declares coverage, this engine MUST NOT silently accept effects.
   if(input.eventSource!==null&&input.eventSource!==undefined)
    return blocked('EVENT_MODEL_NOT_CONNECTED',
     'イベント補正はF4-A試算に未接続です。条件付き週エナジーを確定しません。');
   if(input.eventMode!=='NEUTRAL_REFERENCE_ONLY')
    return blocked('UNVERIFIED_EVENT','イベントなし参考条件を明示してください。');
   if(!CATS.has(input.foodMode)||!integer(input.bagCapacity,1,5000)||
    !integer(input.potCapacity,7,5000)||typeof input.camp!=='boolean'||
    !integer(input.fieldBonus,0,100))
    return blocked('SETTINGS','バッグ・鍋・料理・ボーナスを確認してください。');
   if(input.autoSleep!==true&&input.autoSleep!==false)
    return blocked('SLEEP_MODE','睡眠自動設定を確定してください。');
   const candidates=normalizeProfiles(input.profiles);
   const recipes=normalizeRecipes(input.recipes);
   const inventory=quantity(input.initialInventory);
   if(Object.values(inventory).reduce((a,b)=>a+b,0)>input.bagCapacity)
    return blocked('BAG_CAPACITY','初期食材数がバッグ容量を超えています。');
   const byId=new Map(candidates.map(p=>[p.id,p]));
   let nights=null;
   if(input.autoSleep===false){
    if(!Array.isArray(input.nightTeams)||input.nightTeams.length!==7)
     return blocked('MANUAL_NIGHTS','7晩の実個体睡眠編成を指定してください。');
    for(const team of input.nightTeams){
     if(!Array.isArray(team)||team.length!==5||new Set(team).size!==5||
      team.some(id=>!byId.has(id)))return blocked('MANUAL_NIGHTS','睡眠編成の5匹が不正です。');
    }
    nights=input.nightTeams.map(a=>[...a]);
   }
   const width=input.beamWidth??18,candidateCount=input.dayCandidateCount??8;
   if(!integer(width,4,80)||!integer(candidateCount,1,24))
    return blocked('SEARCH_LIMIT','限定探索の上限を確認してください。');
   // Cooking occurs BEFORE the help of its named slot (breakfast cannot use
   // ingredients produced later in that same morning).
   const allowed=recipes.filter(r=>input.foodMode==='all'||r.type===input.foodMode);
   if(!allowed.length)return blocked('NO_RECIPE','選択カテゴリに計算可能なレシピがありません。');
   const demand={};
   for(const r of [...allowed].sort((a,b)=>b.baseStrength-a.baseStrength).slice(0,6))
    for(const [k,n] of Object.entries(r.requirements))if(n>0)demand[k]=(demand[k]||0)+n;
   const teams=generateTeams(candidates,demand,candidateCount);
   if(!teams.length)return blocked('NO_TEAMS','候補の5匹を構成できません。');
   const score=state=>{
    let foodValue=0;
    for(const k of FOOD)foodValue+=state.inventory[k]*90;
    return state.totalEnergy+.09*foodValue;
   };
   const select=states=>{
    const sorted=states.sort((a,b)=>score(b)-score(a)||b.mealEnergy-a.mealEnergy||
     a.signature.localeCompare(b.signature));
    const out=[],seen=new Set();
    for(const s of sorted){
     // Coarse diversity: retain distinct candidate roster / stock states.
     const stockKey=FOOD.filter(k=>s.inventory[k]>=1).map(k=>k+Math.floor(s.inventory[k]/5)).join(';');
     const key=s.lastTeam.join(',')+'|'+stockKey+'|'+s.meals;
     if(seen.has(key))continue;seen.add(key);out.push(s);
     if(out.length>=width)break;
    }
    return out;
   };
   const potForDay=day=>Math.round((input.potCapacity*(day===6?2:1))*(input.camp?1.5:1));
   let beam=[{inventory,mealEnergy:0,berryEnergy:0,totalEnergy:0,meals:0,
    discardedIngredients:0,lastTeam:[],slots:[],signature:''}];
   const fieldFactor=1+input.fieldBonus/100;
   for(let day=0;day<7;day++){
    for(const frame of DAY_SLOTS){
     const next=[],pot=potForDay(day);
     for(const s of beam){
      const fits=allowed.filter(r=>r.size<=pot&&FOOD.every(k=>
       s.inventory[k]+1e-8>=r.requirements[k]));
      fits.sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id));
      // Include "no meal" to permit conserving ingredients for a later,
      // higher-energy recipe instead of assuming three feasible meals.
      const dishes=[null,...fits.slice(0,3)];
      for(const dish of dishes){
       const taken={...s.inventory};
       if(dish)for(const k of FOOD)taken[k]-=dish.requirements[k];
       const mealEnergy=dish?Math.floor(dish.baseStrength*fieldFactor+1e-9):0;
       for(const team of teams){
        const got=produce(taken,team,frame.hours,byId,input.bagCapacity);
        const newEnergy=s.totalEnergy+mealEnergy+got.berryEnergy;
        next.push({inventory:got.inventory,mealEnergy:s.mealEnergy+mealEnergy,
         berryEnergy:s.berryEnergy+got.berryEnergy,totalEnergy:newEnergy,
         meals:s.meals+Number(Boolean(dish)),
         discardedIngredients:s.discardedIngredients+got.discarded,
         lastTeam:team,slots:[...s.slots,{
          day,slot:frame.key,range:frame.range,team:[...team],
          recipeId:dish?.id||null,recipeCategory:dish?.type||null,
          mealEnergy,berryEnergy:got.berryEnergy,keptIngredients:got.kept,
          stockAtSlotStart:{...s.inventory},stockAfterSlot:{...got.inventory}
         }],signature:s.signature+(dish?.id||'-')+':'+team.join(',')+';'});
       }
      }
     }
     beam=select(next);if(!beam.length)throw Error('NO_DAY_STATES');
    }
    const nextNight=[];
    for(const s of beam){
     const sleepTeams=input.autoSleep?teams:[nights[day]];
     for(const team of sleepTeams){
      const result=produce(s.inventory,team,NIGHT.hours,byId,input.bagCapacity);
      nextNight.push({inventory:result.inventory,mealEnergy:s.mealEnergy,
       berryEnergy:s.berryEnergy+result.berryEnergy,
       totalEnergy:s.totalEnergy+result.berryEnergy,meals:s.meals,
       discardedIngredients:s.discardedIngredients+result.discarded,
       lastTeam:team,
       slots:[...s.slots,{day,slot:'sleep',range:NIGHT.range,team:[...team],
        recipeId:null,mealEnergy:0,berryEnergy:result.berryEnergy,
        keptIngredients:result.kept,
        stockAtSlotStart:{...s.inventory},stockAfterSlot:{...result.inventory}}],
       signature:s.signature+'sleep:'+team.join(',')+';'});
     }
    }
    beam=select(nextNight);if(!beam.length)throw Error('NO_NIGHT_STATES');
   }
   const winner=[...beam].sort((a,b)=>b.totalEnergy-a.totalEnergy||
    a.signature.localeCompare(b.signature))[0];
   if(!winner||winner.slots.length!==28)throw Error('TIMELINE_INCOMPLETE');
   const slots=winner.slots.map(e=>({
    day:e.day,slot:e.slot,range:e.range,team:e.team,
    recipeId:e.recipeId,mealEnergy:e.mealEnergy,
    berryEnergyProxy:Math.round(e.berryEnergy),
    // Read-only expected stocks; fractional values do NOT promise in-game
    // recipe executability and are never written as actual inventory.
    inventoryAfter:Object.fromEntries(FOOD.map(k=>[k,Math.round(e.stockAfterSlot[k]*1000)/1000]))
   }));
   return {status:'PROVISIONAL',stage:'F4_A_CHRONOLOGICAL_PROXY',
    model:'ORDERED_REFERENCE_BEAM_V1',weeklyEnergyCertified:false,
    eventMode:'NEUTRAL_REFERENCE_ONLY',writesSavedData:false,
    weekStart:input.weekStart,source:'F1_B_PINNED_66_SPECIES',
    slotCount:28,daySlots:21,mealOpportunities:21,sleepSlots:7,
    mealsCooked:winner.meals,autoSleep:input.autoSleep,
    energyProxy:Math.round(winner.totalEnergy),
    mealEnergyProxy:Math.round(winner.mealEnergy),
    berryEnergyProxy:Math.round(winner.berryEnergy),
    discardedIngredientExpectation:Math.round(winner.discardedIngredients*100)/100,
    finalExpectedInventory:Object.fromEntries(FOOD.map(k=>
     [k,Math.round(winner.inventory[k]*1000)/1000])),
    slots,assumptions:[
     'F4-Aは月曜07:30から翌月曜07:30までの28枠参考モデルです。ゲーム週04:00境界との差はF4-Bで扱います',
     '21食は各日・各枠の開始時点で調理します。同一枠の食材はその枠の料理に使えません',
     '0げんきの個体別F1-B基礎速度と食材・きのみ期待数のみ適用。げんき/メインスキル/所持枠/回収間隔/睡眠交代ロスは未モデル化',
     'バッグ内の食材数は連続期待値で、確実に作れる料理や実ゲームの獲得個数ではありません',
     '基礎レシピエナジーと入力済みフィールド補正のみ。レシピレベル・追加食材・料理大成功・イベント効果は未加算',
     '決定的な限定ビーム探索であり、全編成・レシピ組み合わせの厳密最適解ではありません'
    ]};
  }catch(_){
   return blocked('INVALID_SOURCE_OR_CALCULATION',
    '個体速度・食材構成・料理または計算条件を検証できません。');
  }
 }
 return Object.freeze({FOOD,DAY_SLOTS,NIGHT,plan,normalizeProfiles,normalizeRecipes});
});

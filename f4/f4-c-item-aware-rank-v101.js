/* F4-C v101: re-rank bounded v100 29-window candidates using individual
 * held items, explicit assumed collection windows and supported skill/cooking
 * expectations. PROVISIONAL, never a certified live-event weekly energy.
 * A scenario tap is NEVER reported as an observed user action.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CItemAwareRank=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  stage:'F4_C_V101_ITEM_AWARE_RERANK',
  weeklyEnergyCertified:false,writesSavedData:false,privateIndividualDataInResult:false});
 const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const valid=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 const sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
 const R=n=>Math.round(n*1000)/1000;
 const empty=keys=>Object.fromEntries(keys.map(k=>[k,0]));
 const SLOTS=['morning','noon','evening'];
 function rank(input={},deps={}){
  try{
   if(input.collectionScenario!=='ASSUMED_AT_0730_1200_1800'||
    input.initialHeldScenario!=='EMPTY_AT_0400_ASSUMED'||
    input.eventSource!==null||input.eventMode!=='NEUTRAL_REFERENCE_ONLY'||
    input.skillScenario!=='CAPPED_EXPECTED_DIRECT_ONLY'||
    !['NO_CRITICAL','BASE_10_30_EXPECTATION'].includes(input.criticalScenario))
    return fail('EXPLICIT_UNVERIFIED_SCENARIO_REQUIRED');
   const {search,base,clock,policy,skillValues}=deps;
   if(typeof search?.plan!=='function'||typeof base?.normalizeProfiles!=='function'||
    typeof base?.normalizeRecipes!=='function'||typeof clock?.build!=='function'||
    typeof policy?.validate!=='function'||typeof skillValues?.skillValue!=='function')
    return fail('PINNED_DEPENDENCIES_MISSING');
   const cookingMode=input.cookingSkillScenario==='EXPLICIT_TAP_EVENTS_V1';
   if(input.cookingSkillScenario!=null&&!cookingMode)
    return fail('COOKING_SKILL_SCENARIO_INVALID');
   if(cookingMode&&(!deps.cookingSkills?.initial||
    !deps.cookingSkills?.cast||!deps.cookingSkills?.capacity||
    !deps.cookingSkills?.cook))return fail('COOKING_SKILL_KERNEL_MISSING');
   const width=input.beamWidth??12,n=Math.min(12,Math.max(2,Math.floor(width)));
   const candidate=search.plan({...input,maxFinalists:n},{base,clock,policy});
   if(candidate.status!=='PROVISIONAL'||candidate.slotCount!==29||
    !Array.isArray(candidate.finalists)||candidate.finalists.length<1||
    candidate.weeklyEnergyCertified!==false||candidate.writesSavedData!==false)
    return fail(candidate.reason||'CANDIDATE_SOURCE_INVALID');
   const timeline=clock.build(input.weekStart,input.asOf);
   if(timeline.status!=='TIMELINE_READY'||timeline.windowCount!==29)
    return fail('CLOCK_INVALID');
   const rows=input.profiles,normal=base.normalizeProfiles(rows);
   const recipes=base.normalizeRecipes(input.recipes),recipeMap=new Map(recipes.map(r=>[r.id,r]));
   const idMap=new Map(rows.map(r=>[r.id,r])),rateMap=new Map(normal.map(r=>[r.id,r]));
   const foods=base.FOOD;
   const overrides=input.displayedRecipeEnergies||{};
   if(!plain(overrides)||Object.keys(overrides).some(id=>
    !recipeMap.has(id)||!Number.isSafeInteger(overrides[id])||
    overrides[id]<1||overrides[id]>5000000))return fail('RECIPE_LEVEL_INPUT_INVALID');
   const critical=input.criticalScenario==='BASE_10_30_EXPECTATION';
   const events=new Map();
   if(cookingMode){
    if(!plain(input.initialCookingBuffs)||
     !['KEEP_CANDIDATE','GREEDY_AWARE'].includes(input.recipeChoicePolicy)||
     !Array.isArray(input.cookingSkillEvents)||
     input.cookingSkillEvents.length>63)
     return fail('COOKING_SKILL_EVENTS_INVALID');
    const start=deps.cookingSkills.initial(input.initialCookingBuffs);
    if(start.status!=='STATE_READY')
     return fail(start.reason||'INITIAL_COOKING_BUFF_INVALID');
    for(const ev of input.cookingSkillEvents){
     if(!plain(ev)||!Number.isSafeInteger(ev.atWindowIndex)||
      ev.atWindowIndex<1||ev.atWindowIndex>=29||
      !SLOTS.includes(timeline.windows[ev.atWindowIndex]?.slot)||
      typeof ev.actorId!=='string'||!Number.isSafeInteger(ev.count)||
      ev.count<1||ev.count>2)
      return fail('COOKING_SKILL_EVENTS_INVALID');
     const key=ev.atWindowIndex+':'+ev.actorId;
     if(events.has(key))return fail('DUPLICATE_COOKING_SKILL_EVENT');
     events.set(key,ev);
    }
   }
   const source=new Map();
   for(const p of rows){
    if(!Number.isSafeInteger(p.carryLimit)||p.carryLimit<1||p.carryLimit>2000||
     !Array.isArray(p.ratesByTeammateBonus)||p.ratesByTeammateBonus.length!==5||
     !['Skills','All','Berries','Ingredients',null].includes(p.skillSpecialty??null))
     return fail('INDIVIDUAL_CAPACITY_OR_SKILL_SOURCE_MISSING');
    if(p.skillCode!=null&&
     (typeof p.skillCode!=='string'||!Number.isSafeInteger(p.selectedMainSkillLevel)||
      p.selectedMainSkillLevel<1||p.selectedMainSkillLevel>8))
     return fail('SKILL_LEVEL_MISSING');
    const rates=[];
    for(const v of p.ratesByTeammateBonus){
     if(!valid(v.berryItemsPerHelp,0,100)||!valid(v.berryCountPerBerryHelp,1,20)||
      !valid(v.berryEnergyPerHelp,0,100000)||
      v.skillProbabilityPerEligibleHelp!==null&&
      !valid(v.skillProbabilityPerEligibleHelp,0,1))
      return fail('ITEM_OR_SKILL_PROBABILITY_MISSING');
     if(!v.berryItemsPerHelp&&v.berryEnergyPerHelp)
      return fail('BERRY_UNIT_MISSING');
     rates.push(v);
    }
    source.set(p.id,{carry:p.carryLimit,skill:p.skillCode,
     level:p.selectedMainSkillLevel,skillCap:['Skills','All'].includes(p.skillSpecialty)?2:1,
     rates});
   }
   function simulate(path,recipeMode='KEEP_CANDIDATE'){
    if(!Array.isArray(path?.slots)||path.slots.length!==29)
     return fail('PATH_MISMATCH');
    const bag=empty(foods);
    for(const [k,v] of Object.entries(input.initialInventory||{})){
     if(!foods.includes(k)||!valid(v,0,10000))return fail('BAG_INITIAL_INVALID');
     bag[k]=v;
    }
    if(sum(bag)>input.bagCapacity+1e-8)return fail('BAG_INITIAL_OVERFLOW');
    const held=new Map(rows.map(p=>[p.id,{foods:empty(foods),berries:0,
     berryEnergy:0,carryEnergy:0,count:0,skillStock:0,
     skillBeforeWeek:0}]));
    let prior=[],berries=0,carry=0,skills=0,meals=0,criticalGain=0,
     extraTastyUnpriced=0,sneaky=0,forfeited=0,foodOverflow=0,
     blockedCooking=0,skillUnpriced=0,skillExpected=0,fullWindows=0;
    const windows=[];
    let cooking=cookingMode?deps.cookingSkills.initial(input.initialCookingBuffs):null;
    let casts=0,ingredientAdded=0,potUsed=0,ingredientMissed=0;
    function collect(){
     // A tap at 07:30/12:00/18:00 collects only the CURRENT on-field
     // party BEFORE any new team is selected.
     for(const id of prior){
      const h=held.get(id),info=source.get(id);
      if(!h||!info)return 'UNKNOWN_COLLECTED_INDIVIDUAL';
      const free=Math.max(0,input.bagCapacity-sum(bag));
      const incoming=sum(h.foods);
      const factor=incoming>0?Math.min(1,free/incoming):0;
      for(const k of foods)bag[k]+=h.foods[k]*factor;
      foodOverflow+=incoming*(1-factor);
      berries+=h.berryEnergy;
      carry+=h.carryEnergy;
      const active=Math.min(info.skillCap,h.skillStock);
      skillExpected+=active;
      if(active>0){
       if(info.skill){
        const effect=skillValues.skillValue(info.skill,info.level,
         {fieldBonusPercent:input.fieldBonus});
        // Only skills with a PINNED direct Snorlax energy effect can
        // enter this total. Heal, ingredient, pot, tasty chance, random
        // targets and side effects stay visible but UNPRICED.
        if(effect.status==='BASE_VALUE_ONLY'&&
         effect.unit==='ENERGY_PER_ACTIVATION'&&
         (info.skill==='Charge Strength S'||info.skill==='Charge Strength M')){
         skills+=active*effect.value;
        }else skillUnpriced+=active;
       }else skillUnpriced+=active;
      }
      h.foods=empty(foods);h.berries=0;h.berryEnergy=0;
      h.carryEnergy=0;h.count=0;h.skillStock=0;
     }
     return null;
    }
    function switchTo(ids){
     for(const id of prior){
      if(ids.includes(id))continue;
      const h=held.get(id);
      forfeited+=h.count;h.foods=empty(foods);h.berries=0;
      h.berryEnergy=0;h.carryEnergy=0;h.count=0;h.skillStock=0;
     }
    }
    for(let i=0;i<timeline.windows.length;i++){
     const w=timeline.windows[i],s=path.slots[i];
     if(w.day!==s?.day||w.slot!==s?.slot||w.source!==s?.source||
      w.startsAt!==s?.startsAt||w.endsAt!==s?.endsAt||
      !Array.isArray(s.team)||(input.previousWeekCarryUnknown===true&&w.source==='PREVIOUS_WEEK_SLEEP'&&s.team.length===0?false:s.team.length!==5)||
      (input.previousWeekCarryUnknown===true&&w.source==='PREVIOUS_WEEK_SLEEP'&&s.team.length===0?false:new Set(s.team).size!==5)||s.team.some(id=>!source.has(id))||
      (w.slot==='sleep'&&s.recipeId!==null))
      return fail('PATH_MISMATCH');
     const tap=SLOTS.includes(w.slot);
     if(tap){
      const error=collect();
      if(error)return fail(error);
     }
     if(cookingMode&&tap){
      for(const ev of events.values()){
       if(ev.atWindowIndex!==i)continue;
       if(!prior.includes(ev.actorId))return fail('SKILL_ACTOR_NOT_PREVIOUS_PARTY');
       const actor=source.get(ev.actorId);
       if(!actor||!['Cooking Power-Up S','Tasty Chance S',
        'Ingredient Magnet S'].includes(actor.skill)||
        ev.count>actor.skillCap)
        return fail('SKILL_ACTOR_OR_STOCK_NOT_VERIFIED');
       const applied=deps.cookingSkills.cast(cooking,{
        skill:actor.skill,level:actor.level,count:ev.count,
        unlockedIngredientCodes:input.unlockedIngredientCodes,
        bagCapacity:input.bagCapacity
       },{skillValues,foodCodes:foods},bag);
       if(applied.status!=='APPLIED')return fail(applied.reason);
       cooking=applied.state;casts+=ev.count;
       if(applied.kind==='INGREDIENT_MEAN'){
        for(const k of foods)bag[k]=applied.bag[k];
        ingredientAdded+=applied.ingredientExpectedAdded;
        ingredientMissed+=applied.ingredientUncollectedExpected;
       }
      }
     }
     switchTo(s.team);
     let cooked=null,meal=0,missed=false;
     const potState=cookingMode?deps.cookingSkills.capacity(cooking,{
      basePot:input.potCapacity,sunday:w.day===6,camp:input.camp
     }):null;
     if(cookingMode&&potState.status!=='CAPACITY_READY')
      return fail(potState.reason);
     const pot=cookingMode?potState.capacity:
      Math.round(input.potCapacity*(w.day===6?2:1)*(input.camp?1.5:1));
     let dish=s.recipeId!==null?recipeMap.get(s.recipeId):null;
     if(cookingMode&&recipeMode==='GREEDY_AWARE'&&tap){
      const possible=recipes.filter(r=>
       (input.foodMode==='all'||r.type===input.foodMode)&&r.size<=pot&&
       foods.every(k=>bag[k]+1e-8>=r.requirements[k]));
      possible.sort((a,b)=>(overrides[b.id]??b.baseStrength)-
       (overrides[a.id]??a.baseStrength)||a.id.localeCompare(b.id));
      dish=possible[0]||null;
     }
     if(dish){
      if(!recipeMap.has(dish.id))return fail('UNKNOWN_RECIPE');
      if(dish.size>pot)return fail('RECIPE_POT_LIMIT');
      if(foods.every(k=>bag[k]+1e-8>=dish.requirements[k])){
       for(const k of foods)bag[k]=Math.max(0,bag[k]-dish.requirements[k]);
       const levelEnergy=Object.hasOwn(overrides,dish.id)?
        overrides[dish.id]:dish.baseStrength;
       const baseEnergy=Math.floor(levelEnergy*(1+input.fieldBonus/100)+1e-9);
       const successEnergy=Math.floor(levelEnergy*(1+input.fieldBonus/100)*
        (w.day===6?3:2)+1e-9);
       let extra;
       if(cookingMode){
        const outcome=deps.cookingSkills.cook(cooking,{
         baseEnergy,successEnergy,day:w.day,useCritical:critical
        });
        if(outcome.status!=='COOKED')return fail(outcome.reason);
        meal=outcome.energyExpected;extra=outcome.criticalIncrementExpected;
        cooking=outcome.state;potUsed+=outcome.consumedPotBonus;
       }else{
        extra=critical?(successEnergy-baseEnergy)*(w.day===6?.30:.10):0;
        meal=baseEnergy+extra;
       }
       criticalGain+=extra;cooked=dish.id;
      }else{blockedCooking++;missed=true;}
     }
     meals+=meal;
     let helps=0,overflowInWindow=0,windowSneaky=0;
     for(const id of s.team){
      const normalProfile=rateMap.get(id),info=source.get(id);
      const helping= s.team.reduce((n,other)=>n+
       Number(other!==id&&rateMap.get(other).helpingBonus),0);
      const a=normalProfile.rates[helping],r=info.rates[helping];
      const factor=w.slot==='sleep'?1:0.45;
      const n=w.hours*3600/(a.helpSeconds*factor);
      helps+=n;
      const berryItems=n*r.berryItemsPerHelp;
      const itemCounts=empty(foods);
      for(const k of foods)itemCounts[k]=n*a.ingredientCountsPerHelp[k];
      const total=berryItems+sum(itemCounts),h=held.get(id);
      const room=Math.max(0,info.carry-h.count);
      const accepted=total?Math.min(1,room/total):0;
      const newItems=total*accepted;
      for(const k of foods)h.foods[k]+=itemCounts[k]*accepted;
      h.berries+=berryItems*accepted;
      const berryValue=n*r.berryEnergyPerHelp*accepted;
      if(w.source==='PREVIOUS_WEEK_SLEEP')h.carryEnergy+=berryValue;
      else h.berryEnergy+=berryValue;
      h.count+=newItems;
      overflowInWindow+=total-newItems;
      // The full-capacity tail is modeled as sneaky berry helping,
      // not as collectable ingredients or eligible skill procs.
      const berryUnit=r.berryItemsPerHelp?
       r.berryEnergyPerHelp/r.berryItemsPerHelp:0;
      const sneakyEnergy=(1-accepted)*n*r.berryCountPerBerryHelp*berryUnit;
      if(w.source==='PREVIOUS_WEEK_SLEEP')carry+=sneakyEnergy;
      else {sneaky+=sneakyEnergy;windowSneaky+=sneakyEnergy;}
      // Expected draws are a conservative capped STOCK proxy. Actual
      // stochastic two-stock distribution and pity counter are not known.
      if(r.skillProbabilityPerEligibleHelp!==null)
       h.skillStock=Math.min(info.skillCap,h.skillStock+
        n*accepted*r.skillProbabilityPerEligibleHelp);
     }
     if(overflowInWindow>1e-7)fullWindows++;
     windows.push({day:w.day,slot:w.slot,source:w.source,
      startsAt:w.startsAt,endsAt:w.endsAt,
      team:[...s.team],recipeId:s.recipeId,
      cookedRecipeId:cooked,recipeSkippedForStock:missed,
      ...(cookingMode?{recommendedRecipeId:cooked,
       potCapacityAtMeal:pot,unconsumedPotBonus:cooking.potExtra}:{}),
      mealEnergyExpected:R(meal),sneakyBerryEnergy:R(windowSneaky),
      helpsExpected:R(helps),bagAfter:R(sum(bag)),
      overflowItemExpectation:R(overflowInWindow)});
     prior=[...s.team];
    }
    return {status:'PROVISIONAL',weekStart:input.weekStart,
     startsAt:timeline.startsAt,endsAt:timeline.endsAt,
     slotCount:29,slots:windows,mealsExpected:R(meals),
     berryEnergyExpected:R(berries+sneaky),
     directSkillEnergyExpected:R(skills),
     criticalEnergyExpected:R(criticalGain),
     energyExpected:R(meals+berries+sneaky+skills),
     carryBerryExcludedExpected:R(carry),
     sneakyBerryEnergyExpected:R(sneaky),
     skillActivationsExpected:R(skillExpected),
     otherSkillsNotPricedExpected:R(skillUnpriced),
     skippedRecipesDueToStock:blockedCooking,
     individualCarryOverflowWindows:fullWindows,
     forfeitedHeldItemsExpected:R(forfeited),
     ingredientBagOverflowExpected:R(foodOverflow),
     endingBagExpected:R(sum(bag)),
      ...(cookingMode?{
       explicitCookingSkillCasts:casts,
       addedIngredientMeanExpected:R(ingredientAdded),
       ingredientSkillCapacityLossExpected:R(ingredientMissed),
       potBonusesConsumedTotal:potUsed,
       endingPotBonus:cooking.potExtra,
       endingTastyChanceExpected:R(cooking.tastyDistribution.reduce(
        (a,b,i)=>a+b*i,0)),
       recipeChoicePolicy:recipeMode
      }:{}),
     weeklyEnergyCertified:false,writesSavedData:false,
     privateIndividualDataInResult:false};
   }
   const evaluated=[],reasons=[];
   for(let i=0;i<candidate.finalists.length;i++){
    const modes=cookingMode&&input.recipeChoicePolicy==='GREEDY_AWARE'?
     ['KEEP_CANDIDATE','GREEDY_AWARE']:['KEEP_CANDIDATE'];
    for(const mode of modes){
     const result=simulate(candidate.finalists[i],mode);
     if(result.status==='PROVISIONAL')
      evaluated.push({candidateIndex:i,...result});
     else reasons.push(result.reason);
    }
   }
   if(!evaluated.length)return fail(reasons[0]||'NO_FEASIBLE_CANDIDATE');
   evaluated.sort((a,b)=>b.energyExpected-a.energyExpected||
    a.skippedRecipesDueToStock-b.skippedRecipesDueToStock||
    a.candidateIndex-b.candidateIndex);
   const winner=evaluated[0];
   return Object.freeze({...winner,
    status:'PROVISIONAL',
    stage:cookingMode?'F4_C_V102_COOKING_STATE_REFERENCE':
     'F4_C_V101_ITEM_AWARE_RERANK',
    model:cookingMode?'EXPLICIT_COOKING_SKILL_29_WINDOW_REFERENCE':
     'BOUNDED_ASSUMED_COLLECTION_STATE_REFERENCE',
    evaluatedCandidates:evaluated.length,chosenCandidateIndex:winner.candidateIndex,
    collectionScenario:input.collectionScenario,
    sleepScoreAssumed:100,
    daytimeHealerPolicy:'DOUBLE_MORNING_SINGLE_LATER',
    sourceWeekCertified:false,
    directSkillExpectationPriced:true,
    unsupportedSkillEffectsPriced:false,
    ...(cookingMode?{cookingSkillScenario:input.cookingSkillScenario,
     explicitCookingSkillCastsAreObserved:false,
     greedyRecipeChoiceIsGlobalOptimum:false,
     stochasticFoodDrawsExact:false}:{}),
    previousWeekCarryUnknown:input.previousWeekCarryUnknown===true,
    healthRecoveredActual:false,
    exactDiscreteProbabilityModeled:false,
    cookingBaseCriticalChanceUnverified:true,
    recipeEnergyMode:Object.keys(overrides).length?'MIXED_EXPLICIT_DISPLAY_ENERGY':'BASE_LEVEL_ONLY',
    assumptions:[
     '料理前07:30/12:00/18:00の回収は比較用シナリオ。ユーザーの観測済み行動ではない',
     '00:00の睡眠編成切替では回収せず、外れた個体の所持品とストックは失う',
     '所持上限到達以降をきのみのおてつだいにし、食材生成・スキル抽選は行わない',
     '食材・きのみ・スキル抽選は連続期待値の比例近似で、個数の離散性は未検証',
     'スキルストックは1または2回上限の保守的期待値。発動保証ではない',
     cookingMode?
      '明示した発動の鍋・料理チャンス・食材ゲットのみ参照計算。実発動は保証しない':
      '全体回復・料理チャンス・鍋拡張・食材ゲットなどの効果量はエナジーへ換算しない',
     'レシピ表示エナジーを未指定の場合は基礎エナジー。大成功率は検証Wikiの仮説値',
     '公式イベントやEX補正・20/81新食材カタログは未接続。週間エナジーは未認証'
    ]});
  }catch(_){return fail('INVALID_ITEM_AWARE_INPUT');}
 }
 return Object.freeze({rank});
});

/* F4-C v102: deterministic cooking-skill effects within an EXPLICIT
 * scenario, and exact distribution transitions for tasty-chance persistence.
 *
 * Cooking Power-Up S: stacked +200 cap; Sunday doubles BASE pot only, camp
 * multiplies (base + skill) and rounds UP. Reset after a cooked meal.
 * Tasty Chance S: +70 cap, persists until great success; mass is split on
 * each cooked meal into success (reset bonus 0) and miss (preserve bonus).
 * Ingredient Magnet S: only a labeled, unlocked-food expected-value scenario,
 * never an inferred real item draw; rejects full bag and unknown food pool.
 * Other/variant/random skills are not extrapolated from unrelated tables.
 *
 * Sources: wikiwiki.jp/poke_sleep/メインスキル/料理パワーアップ
 *          wikiwiki.jp/poke_sleep/メインスキル/料理チャンス
 *          wikiwiki.jp/poke_sleep/メインスキル/食材ゲット
 *
 * No I/O, persistence, personal rows, private field or mutation.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CCookingSkillState=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false,
  privateIndividualDataInResult:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const whole=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
 const round=n=>Math.round(n*1e6)/1e6;
 const capDist=d=>Array.isArray(d)&&d.length===71&&
  d.every(x=>finite(x,0,1))&&
  Math.abs(d.reduce((a,b)=>a+b,0)-1)<1e-8;
 const stateOK=s=>plain(s)&&s.status==='STATE_READY'&&
  whole(s.potExtra,0,200)&&capDist(s.tastyDistribution);
 const pack=(potExtra,distribution)=>Object.freeze({
  status:'STATE_READY',potExtra,
  tastyDistribution:Object.freeze(distribution),
  weeklyEnergyCertified:false,writesSavedData:false,
  privateIndividualDataInResult:false
 });
 function initial(options={}){
  if(!plain(options)||!whole(options.potExtra,0,200)||
   !whole(options.tastyExtra,0,70))return fail('EXPLICIT_INITIAL_BUFFS_REQUIRED');
  const p=Array(71).fill(0);p[options.tastyExtra]=1;
  return pack(options.potExtra,p);
 }
 function capacity(state,input={}){
  if(!stateOK(state)||!plain(input)||
   !whole(input.basePot,7,5000)||
   typeof input.sunday!=='boolean'||typeof input.camp!=='boolean')
   return fail('COOKING_CAPACITY_INPUT_INVALID');
  // Sunday boosts base only. Camp applies to (base Sunday bonus + skill).
  // Round UP: (33+10)*1.5 => 65, (33*2+10)*1.5 => 114.
  const value=Math.ceil((input.basePot*(input.sunday?2:1)+
   state.potExtra)*(input.camp?1.5:1)-1e-9);
  return Object.freeze({status:'CAPACITY_READY',capacity:value,
   skillBonusBeforeCamp:state.potExtra,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 function cast(state,event={},deps={},bag=null){
  if(!stateOK(state)||!plain(event)||!plain(deps)||
   typeof deps.skillValues?.skillValue!=='function'||
   !whole(event.level,1,8)||!whole(event.count,1,2)||
   !['Cooking Power-Up S','Tasty Chance S','Ingredient Magnet S'].includes(event.skill))
   return fail('SUPPORTED_SKILL_EVENT_REQUIRED');
  const lookup=deps.skillValues.skillValue(event.skill,event.level);
  const unit=event.skill==='Cooking Power-Up S'?'POT_CAPACITY_DELTA':
   event.skill==='Tasty Chance S'?'EXTRA_TASTY_CHANCE_POINTS':'INGREDIENT_ITEMS';
  if(lookup.status!=='BASE_VALUE_ONLY'||lookup.unit!==unit||
   !whole(lookup.value,1,200))
   return fail('SKILL_VALUE_NOT_PINNED');
  if(event.skill==='Cooking Power-Up S'){
   const after=Math.min(200,state.potExtra+lookup.value*event.count);
   if(state.potExtra===200)return fail('POT_ALREADY_MAX');
   return Object.freeze({status:'APPLIED',kind:'POT',
    state:pack(after,[...state.tastyDistribution]),
    appliedUnits:after-state.potExtra,unappliedUnits:Math.max(0,
     state.potExtra+lookup.value*event.count-200),
    ingredientExpectedAdded:0,bag,
    weeklyEnergyCertified:false,writesSavedData:false});
  }
  if(event.skill==='Tasty Chance S'){
   // In some stochastic branches the buff is already capped, so a
   // deterministic cast cannot be asserted across all branches.
   if(state.tastyDistribution[70]>1e-8)
    return fail('TASTY_CAP_PATH_UNRESOLVED');
   const dist=Array(71).fill(0);
   for(let b=0;b<=70;b++)if(state.tastyDistribution[b])
    dist[Math.min(70,b+lookup.value*event.count)]+=
     state.tastyDistribution[b];
   return Object.freeze({status:'APPLIED',kind:'TASTY',
    state:pack(state.potExtra,dist),appliedUnits:lookup.value*event.count,
    ingredientExpectedAdded:0,bag,
    weeklyEnergyCertified:false,writesSavedData:false});
  }
  // A real magnet selects three types at random. Only its UNIFORM MEAN is
  // represented here, never a guaranteed mix for a particular recipe.
  const pool=event.unlockedIngredientCodes,food=deps.foodCodes;
  if(!Array.isArray(pool)||!Array.isArray(food)||pool.length<3||
   pool.length>food.length||new Set(pool).size!==pool.length||
   pool.some(k=>typeof k!=='string'||!food.includes(k))||
   !plain(bag)||Object.keys(bag).some(k=>!food.includes(k))||
   food.some(k=>!finite(bag[k]??0,0,10000))||
   !whole(event.bagCapacity,1,5000))
   return fail('UNLOCKED_FOOD_AND_BAG_REQUIRED');
  const before=food.reduce((n,k)=>n+(bag[k]||0),0);
  const free=event.bagCapacity-before;
  if(free<=1e-8)return fail('INGREDIENT_SKILL_BAG_FULL');
  const requested=lookup.value*event.count;
  const delivered=Math.min(free,requested);
  const next={...bag};
  for(const k of food)next[k]=bag[k]||0;
  for(const k of pool)next[k]+=delivered/pool.length;
  return Object.freeze({status:'APPLIED',kind:'INGREDIENT_MEAN',
   state:pack(state.potExtra,[...state.tastyDistribution]),
   appliedUnits:delivered,ingredientExpectedAdded:delivered,
   ingredientUncollectedExpected:requested-delivered,
   bag:Object.freeze(next),weeklyEnergyCertified:false,
   writesSavedData:false});
 }
 function cook(state,input={}){
  if(!stateOK(state)||!plain(input)||!whole(input.baseEnergy,1,5000000)||
   !whole(input.successEnergy,1,15000000)||
   input.successEnergy<input.baseEnergy||
   !whole(input.day,0,6)||typeof input.useCritical!=='boolean')
   return fail('COOKING_ENERGY_INPUT_INVALID');
  const baseChance=input.useCritical?(input.day===6?0.30:0.10):0;
  const next=Array(71).fill(0);
  let expected=0,critExpected=0,probability=0;
  for(let b=0;b<=70;b++){
   const mass=state.tastyDistribution[b];
   if(!mass)continue;
   const chance=Math.min(1,baseChance+b/100);
   probability+=mass*chance;
   expected+=mass*(input.baseEnergy+
    chance*(input.successEnergy-input.baseEnergy));
   critExpected+=mass*chance*(input.successEnergy-input.baseEnergy);
   next[0]+=mass*chance;
   next[b]+=mass*(1-chance);
  }
  return Object.freeze({status:'COOKED',
   energyExpected:round(expected),
   criticalIncrementExpected:round(critExpected),
   criticalProbability:round(probability),
   state:pack(0,next),
   consumedPotBonus:state.potExtra,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 return Object.freeze({initial,capacity,cast,cook});
});

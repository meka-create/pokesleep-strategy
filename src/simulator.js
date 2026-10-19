/* STEP2 expected-value simulation. Species and stat constants: nitoyon/pokesleep-tool (MIT).
 * This is a bounded prototype, NOT a game-exact weekly strength calculator.
 * Unsupported skills/events are explicitly reported. No invented game formula.
 */
(function(root){
'use strict';
const Master=root.PokeMaster;
const BERRY=Master.berry, ING=Master.strength;
const FAVORITES={'シアンの砂浜':['water','fairy','flying'],'トープ洞窟':['ground','fire','rock'],'ウノハナ雪原':['ice','normal','dark'],'ラピスラズリ湖畔':['grass','psychic','fighting'],'ゴールド旧発電所':['electric','ghost','steel'],'アンバー渓谷':['poison','bug','dragon']};
const SKILL_STRENGTH={'Charge Strength S':[400,569,785,1083,1496,2066,3212],'Charge Strength M':[880,1251,1726,2383,3290,4546,6858],'Charge Strength M (Bad Dreams)':[2640,3753,5178,7149,9870,13638,18515],'Charge Strength S (Random)':[500,711.5,981.5,1354,1870,2582.5,4015]};
const HEAL_ALL=[5,7,9,11,15,18],HEAL_SELF=[12,16,21,27,34,43];
// Spit Up rewards for 0..10 stockpiles, source: wiki.pokesleep.com stockpilechargestrengths.
const STOCKPILE_REWARDS=[
 [600,1020,1500,2040,2640,3300,4020,4920,6480,8880,12120],
 [853,1450,2132,2900,3753,4691,5715,6995,9213,12625,17231],
 [1177,2001,2943,4002,5179,6474,7886,9652,12712,17420,23776],
 [1625,2763,4063,5526,7151,8939,10889,13327,17552,24052,32827],
 [2243,3813,5607,7626,9869,12336,15028,18393,24225,33197,45309],
 [3099,5268,7747,10536,13635,17044,20763,25412,33469,45865,62600],
 [4502,7653,11255,15307,19809,24761,30163,36916,46370,59876,82386]
];
// Finite probability distribution: E[min(rolls,cap)] != min(E[rolls],cap).
// Legacy stock-only helper retained for earlier regression tests; simulation now uses the joint pity-state model.
function advanceSkillStock(state,expectedHelps,rate,cap){
 if(!Number.isFinite(expectedHelps)||expectedHelps<0||
    !Number.isFinite(rate)||rate<0||rate>1||![1,2].includes(cap)||
    !Array.isArray(state)||state.length<cap+1)
  throw Error('スキルストック遷移の入力が不正です。');
 let probs=state.slice(0,cap+1);
 const apply=(chance)=>{
  const next=new Array(cap+1).fill(0);
  for(let i=0;i<=cap;i++){
   next[i]+=probs[i]*(1-chance);
   next[Math.min(cap,i+1)]+=probs[i]*chance;
  }
  probs=next;
 };
 const whole=Math.floor(expectedHelps),fraction=expectedHelps-whole;
 for(let i=0;i<whole;i++)apply(rate);
 if(fraction>1e-12)apply(fraction*rate);
 return probs;
}
function expectedSkillStock(state){return state.reduce((total,p,i)=>total+p*i,0);}
/* Exact one-tap cap expectation for a FIXED starting Energy and finite stock.
 * The weekly engine retains mean-only Energy and cross-member correlations
 * are not resolved. This is a local diagnostic, never a weekly error bound.
 */
function cappedHealFromStock(startEnergy,healAmount,stockProbabilities){
 if(!Number.isFinite(startEnergy)||startEnergy<0||startEnergy>150||
    !Number.isFinite(healAmount)||healAmount<0||
    !Array.isArray(stockProbabilities)||stockProbabilities.length<1||
    stockProbabilities.length>3||stockProbabilities.some(p=>!Number.isFinite(p)||p<0)||
    Math.abs(stockProbabilities.reduce((a,b)=>a+b,0)-1)>1e-8)
  throw Error('げんき期待値とスキルストック確率の入力が不正です。');
 const expectedAfter=stockProbabilities.reduce((acc,p,n)=>
  acc+p*Math.min(150,startEnergy+n*healAmount),0);
 const modeledAfter=Math.min(150,startEnergy+
   healAmount*expectedSkillStock(stockProbabilities));
 const localGap=Math.max(0,modeledAfter-expectedAfter);
 return {expectedAfter,modeledAfter,localGap};
}

// Fractional help progress is carried to the next 15-minute interval.
// Only completed periodic helps can trigger a skill roll.
function completeHelpProgress(phase,helps){
 if(!Number.isFinite(phase)||phase<0||phase>=1||
    !Number.isFinite(helps)||helps<0)
  throw Error('おてつだい進捗の入力が不正です。');
 const total=phase+helps,completed=Math.floor(total+1e-10);
 return {completed,phase:Math.max(0,Math.min(1-Number.EPSILON,total-completed))};
}
function clearDepartingHelpProgress(oldTeam,newTeam,progress){
 const retained=new Set(newTeam);
 for(const id of oldTeam)if(!retained.has(id))progress.delete(id);
}
// Finite-horizon joint probability model for main-skill stock and consecutive failed
// help rolls. A full stock does not consume further main-skill rolls; picking up
// the ready skill clears stock but preserves the number of previous failures.
// This explicitly replaces applying the stationary pity-corrected average at every help.
function emptySkillProcState(threshold,cap){
 if(!Number.isInteger(threshold)||threshold<1||threshold>10000||![1,2].includes(cap))
  throw Error('スキル天井・ストック上限の入力が不正です。');
 const dist=new Array((cap+1)*threshold).fill(0);
 dist[0]=1;
 return {threshold,cap,dist};
}
function validateSkillProcState(state){
 if(!state||!Number.isInteger(state.threshold)||state.threshold<1||
  ![1,2].includes(state.cap)||!Array.isArray(state.dist)||
  state.dist.length!==(state.cap+1)*state.threshold||
  state.dist.some(p=>!Number.isFinite(p)||p<0))
  throw Error('スキル発動確率状態の入力が不正です。');
}
function advanceSkillProcState(state,expectedHelps,rate){
 validateSkillProcState(state);
 if(!Number.isFinite(expectedHelps)||expectedHelps<0||
  !Number.isFinite(rate)||rate<0||rate>1)
  throw Error('スキル発動回数・抽選率が不正です。');
 const {threshold,cap}=state;
 let dist=state.dist.slice();
 const oneHelp=(helpChance)=>{
  const next=new Array(dist.length).fill(0);
  for(let stock=0;stock<=cap;stock++)for(let misses=0;misses<threshold;misses++){
   const idx=stock*threshold+misses,prob=dist[idx];if(prob===0)continue;
   // Do not roll while full, and do not create a skill from a truly 0% raw rate.
   if(stock===cap||rate===0){next[idx]+=prob;continue;}
   next[idx]+=prob*(1-helpChance);
   const roll=prob*helpChance,success=misses===threshold-1?1:rate;
   next[Math.min(cap,stock+1)*threshold]+=roll*success;
   if(misses<threshold-1)next[idx+1]+=roll*(1-success);
  }
  dist=next;
 };
 const whole=Math.floor(expectedHelps),frac=expectedHelps-whole;
 for(let i=0;i<whole;i++)oneHelp(1);
 if(frac>1e-12)oneHelp(frac);
 return {threshold,cap,dist};
}
// Apply the nonlinear pity/stock transition per possible integer help count.
// Pocket and pity histories across different 15-minute batches remain marginal.
function advanceSkillProcStateByHelpCounts(state,helpCounts,rate){
 validateSkillProcState(state);
 if(Object.prototype.toString.call(helpCounts)!=='[object Map]'||
    !Number.isFinite(rate)||rate<0||rate>1)
  throw Error('抽選可能回数の分布が不正です。');
 let mass=0;
 for(const [count,p] of helpCounts){
  if(!Number.isInteger(count)||count<0||!Number.isFinite(p)||p<0)
   throw Error('抽選可能回数の分布が不正です。');
  mass+=p;
 }
 if(Math.abs(mass-1)>1e-8)throw Error('抽選可能回数の確率質量が不正です。');
 const dist=new Array(state.dist.length).fill(0);
 for(const [count,p] of helpCounts){
  if(p===0)continue;
  const branch=advanceSkillProcState(state,count,rate);
  for(let k=0;k<dist.length;k++)dist[k]+=p*branch.dist[k];
 }
 return {threshold:state.threshold,cap:state.cap,dist};
}
function skillProcMarginal(state){
 validateSkillProcState(state);
 return Array.from({length:state.cap+1},(_,stock)=>
  state.dist.slice(stock*state.threshold,(stock+1)*state.threshold).reduce((a,b)=>a+b,0));
}
function clearSkillProcStock(state){
 validateSkillProcState(state);
 const {threshold,cap}=state,dist=new Array((cap+1)*threshold).fill(0);
 for(let misses=0;misses<threshold;misses++)
  for(let stock=0;stock<=cap;stock++)dist[misses]+=state.dist[stock*threshold+misses];
 return {threshold,cap,dist};
}
function clearPartySkillStocks(oldTeam,newTeam,skillProcStates,pocket){
 const retained=new Set(newTeam);
 const changed=oldTeam.length>0&&(oldTeam.length!==newTeam.length||
  oldTeam.some(id=>!retained.has(id)));
 if(!changed)return false;
 // Swapping one helper invalidates queued skills for the whole roster.
 for(const id of new Set([...oldTeam,...newTeam])){
  const state=skillProcStates.get(id);
  if(state)skillProcStates.set(id,clearSkillProcStock(state));
  if(pocket.has(id))pocket.get(id).skillState=[1,0,0];
 }
 return true;
}
function queueSneakyEnergy(bag,energy){
 if(!Number.isFinite(energy)||energy<0)throw Error('いつのまに育成の保留値が不正です。');
 bag.pendingSneaky=(bag.pendingSneaky||0)+energy;
}
function releaseSneakyEnergy(bag){
 const energy=bag.pendingSneaky||0;
 bag.pendingSneaky=0;
 return energy;
}
// Finite probability distribution over INTEGER combined carry (Berries + ingredients).
// Conditional on the occupied slots, every completed normal help has ONE
// berry outcome or ONE of the unlocked ingredient-slot outcomes. A full
// inventory generates sneaky berries and does not create skill opportunities.
function integerPocketTransitions(occupation,completed,capacity,berryCount,ingredientRate,slots){
 if(Object.prototype.toString.call(occupation)!=='[object Map]'||!Number.isInteger(completed)||completed<0||
  !Number.isInteger(capacity)||capacity<1||
  !Number.isInteger(berryCount)||berryCount<1||
  !Number.isFinite(ingredientRate)||ingredientRate<0||ingredientRate>1||
  !Array.isArray(slots)||slots.some(s=>!Number.isInteger(s.count)||s.count<1||
     typeof s.key!=='string'||!s.key))
  throw Error('整数所持数の遷移入力が不正です。');
 // Keep occupied slots and the integer eligible-roll COUNT jointly during
 // this batch; taking the mean before applying a stock cap is not equivalent.
 const width=completed+1;
 let joint=new Map(),mass=0;
 for(const [count,p] of occupation){
  if(!Number.isInteger(count)||count<0||count>capacity||
     !Number.isFinite(p)||p<0)throw Error('整数所持数の確率状態が不正です。');
  mass+=p;
  if(p>0)joint.set(count*width,p);
 }
 if(Math.abs(mass-1)>1e-8)throw Error('整数所持数の確率質量が不正です。');
 let berry=0,sneaky=0,eligible=0;
 const foods={},choices=slots.length?slots:[{key:null,count:0}];
 for(let help=0;help<completed;help++){
  const next=new Map();
  const add=(count,rolls,prob)=>{
   if(prob<=0)return;
   const key=count*width+rolls;
   next.set(key,(next.get(key)||0)+prob);
  };
  for(const [key,p] of joint){
   const count=Math.floor(key/width),rolls=key%width;
   if(count===capacity){
    add(capacity,rolls,p);
    sneaky+=p*berryCount;
    continue;
   }
   eligible+=p;
   const free=capacity-count;
   const bChance=p*(1-ingredientRate),keptB=Math.min(berryCount,free);
   add(count+keptB,rolls+1,bChance);
   berry+=bChance*keptB;
   sneaky+=bChance*(berryCount-keptB);
   for(const slot of choices){
    const q=p*ingredientRate/choices.length,retained=Math.min(slot.count,free);
    add(count+retained,rolls+1,q);
    if(slot.key&&retained>0)foods[slot.key]=(foods[slot.key]||0)+q*retained;
   }
  }
  joint=next;
 }
 const dist=new Map(),eligibleDistribution=new Map();
 for(const [key,p] of joint){
  const count=Math.floor(key/width),rolls=key%width;
  dist.set(count,(dist.get(count)||0)+p);
  eligibleDistribution.set(rolls,(eligibleDistribution.get(rolls)||0)+p);
 }
 const used=Array.from(dist,([n,p])=>n*p).reduce((a,b)=>a+b,0);
 return {occupation:dist,used,berries:berry,sneaky,ingredients:foods,eligible,eligibleDistribution};
}
// Sparse conditional distribution for a *single Pokemon*: (occupied slots,
// number of FOOD items in those slots). Enabled from an empty pocket when the
// shared ingredient bag is full. This does not model food species, or the
// cross-Pokemon correlation of the shared bag.
function integerFoodPocketTransitions(joint,completed,capacity,berryCount,ingredientRate,slots){
 if(Object.prototype.toString.call(joint)!=='[object Map]'||
  !Number.isInteger(completed)||completed<0||!Number.isInteger(capacity)||capacity<1||
  !Number.isInteger(berryCount)||berryCount<1||
  !Number.isFinite(ingredientRate)||ingredientRate<0||ingredientRate>1||
  !Array.isArray(slots)||slots.some(s=>!Number.isInteger(s.count)||s.count<1||
     typeof s.key!=='string'||!s.key))
  throw Error('食材所持数の結合分布入力が不正です。');
 const width=capacity+1,choices=slots.length?slots:[{key:null,count:0}];
 let mass=0,distribution=new Map(joint),berry=0,sneaky=0,eligible=0;
 const initialOccupied=new Map();
 const foods={};
 for(const [k,p] of distribution){
  const occupied=Math.floor(k/width),food=k%width;
  if(!Number.isInteger(k)||occupied<0||occupied>capacity||food>occupied||
    !Number.isFinite(p)||p<0)
   throw Error('食材所持数の結合確率状態が不正です。');
  mass+=p;
  initialOccupied.set(occupied,(initialOccupied.get(occupied)||0)+p);
 }
 if(Math.abs(mass-1)>1e-8)throw Error('食材所持数の結合確率質量が不正です。');
 for(let i=0;i<completed;i++){
  const next=new Map();
  const add=(occupied,food,p)=>{
   if(p<=0)return;
   const k=occupied*width+food;
   next.set(k,(next.get(k)||0)+p);
  };
  for(const [k,p] of distribution){
   if(p===0)continue;
   const occupied=Math.floor(k/width),food=k%width;
   if(occupied===capacity){
    add(occupied,food,p);sneaky+=p*berryCount;continue;
   }
   eligible+=p;
   const space=capacity-occupied,keptBerry=Math.min(berryCount,space);
   const bChance=p*(1-ingredientRate);
   add(occupied+keptBerry,food,bChance);
   berry+=bChance*keptBerry;
   sneaky+=bChance*(berryCount-keptBerry);
   for(const slot of choices){
    const chance=p*ingredientRate/choices.length;
    const kept=Math.min(slot.count,space);
    add(occupied+kept,food+kept,chance);
    if(slot.key&&kept>0)foods[slot.key]=(foods[slot.key]||0)+chance*kept;
   }
  }
  distribution=next;
 }
 const occupation=new Map();
 for(const [k,p] of distribution){
  const count=Math.floor(k/width);
  occupation.set(count,(occupation.get(count)||0)+p);
 }
 const used=Array.from(occupation,([n,p])=>n*p).reduce((a,b)=>a+b,0);
 // Skill stock needs the within-batch distribution of eligible roll counts;
 // its probabilities depend on occupied slots, not the food/berry split.
 const marginal=integerPocketTransitions(initialOccupied,completed,capacity,berryCount,ingredientRate,slots);
 return {occupation,foodJoint:distribution,used,berries:berry,
   sneaky,ingredients:foods,eligible,eligibleDistribution:marginal.eligibleDistribution};
}
// Conditional on an *integer* number of free shared-bag slots, remove up to
// that many food items after all berries have been picked up. The retained
// food-count marginal remains exact for the current Pokemon's tracked joint
// state; which food species are retained is still allocated by expectation.
function collectIntegerFoodPocket(joint,capacity,free){
 if(Object.prototype.toString.call(joint)!=='[object Map]'||
  !Number.isInteger(capacity)||capacity<1||
  !Number.isInteger(free)||free<0)throw Error('食材バッグ回収分布の入力が不正です。');
 const width=capacity+1,retained=new Map();
 let mass=0,accepted=0,remaining=0;
 for(const [key,p] of joint){
  const occupied=Math.floor(key/width),food=key%width;
  if(!Number.isInteger(key)||occupied<0||occupied>capacity||food>occupied||
     !Number.isFinite(p)||p<0)
   throw Error('食材バッグ回収分布の確率状態が不正です。');
  mass+=p;
  if(p===0)continue;
  const received=Math.min(food,free),left=food-received;
  accepted+=p*received;remaining+=p*left;
  const encoded=left*width+left;
  retained.set(encoded,(retained.get(encoded)||0)+p);
 }
 if(Math.abs(mass-1)>1e-8)throw Error('食材バッグ回収分布の確率質量が不正です。');
 const occupation=new Map();
 for(const [key,p] of retained){
  const n=Math.floor(key/width);
  occupation.set(n,(occupation.get(n)||0)+p);
 }
 return {accepted,remaining,foodJoint:retained,occupation};
}
// When the GLOBAL ingredient bag prevents collecting all foods, joint
// item-composition probabilities are not available. Reconstruct only the
// occupied-count marginal with the same expectation. This is marked approximate.
function expectedPocketOccupation(expectedCount,capacity){
 if(!Number.isFinite(expectedCount)||expectedCount<0||
  !Number.isInteger(capacity)||capacity<1)throw Error('所持数期待値の再構成が不正です。');
 const x=Math.min(capacity,expectedCount),lo=Math.floor(x),hi=Math.ceil(x);
 if(lo===hi)return new Map([[lo,1]]);
 return new Map([[lo,hi-x],[hi,x-lo]]);
}
function emptyPocket(){return {used:0,berries:0,ingredients:{},skillState:[1,0,0],pendingSneaky:0,occupation:new Map([[0,1]])};}
// Count the model's EXTRA help carry removed by a lineup change. This is
// explicitly an uncollected-model-queue diagnostic, not a claim that items
// vanish in the real game. We must not silently pretend the two policies are
// calibrated when comparing fixed vs rotating teams.
function uncollectedExtraHelpOnSwap(oldTeam,newTeam,extraPocket,berryStrengthFor){
 const retained=new Set(newTeam);
 let items=0,berries=0,ingredients=0,berryEnergy=0,affectedMembers=0;
 for(const id of oldTeam){
  if(retained.has(id))continue;
  const bag=extraPocket.get(id);
  if(!bag||!(bag.used>1e-9))continue;
  items+=bag.used;
  berries+=bag.berries||0;
  ingredients+=Object.values(bag.ingredients||{}).reduce((sum,n)=>sum+n,0);
  if(berryStrengthFor)berryEnergy+=(bag.berries||0)*berryStrengthFor(id);
  affectedMembers++;
 }
 return {items,berries,ingredients,berryEnergy,affectedMembers};
}
function clearDepartingPockets(oldTeam,newTeam,pocket,extraPocket){
 const retained=new Set(newTeam);
 for(const id of oldTeam)if(!retained.has(id)){
  pocket.set(id,emptyPocket());
  extraPocket.set(id,emptyPocket());
 }
}
function emptyStockpile(){return [1,0,0,0,0,0,0,0,0,0,0];}
function stockpileStep(state,level){
 const next=new Array(11).fill(0),rewards=STOCKPILE_REWARDS[clamp(level-1,0,6)];
 let earned=0;
 for(let k=0;k<=10;k++){
  const p=state[k],spit=k===10?1:.25;
  earned+=p*spit*rewards[k];
  next[0]+=p*spit;
  if(k<10)next[k+1]+=p*(1-spit);
 }
 return {state:next,earned};
}
// A fractional expected activation is interpolated as a Bernoulli activation.
// This tracks undistributed stack probabilities, not just steady-state averages.
function advanceStockpile(state,expectedTriggers,level){
 if(!Number.isFinite(expectedTriggers)||expectedTriggers<0)throw Error('たくわえる発動回数が不正です。');
 let current=state.slice(),earned=0;
 let whole=Math.floor(expectedTriggers),fraction=expectedTriggers-whole;
 for(let n=0;n<whole;n++){const v=stockpileStep(current,level);current=v.state;earned+=v.earned;}
 if(fraction>1e-12){
  const v=stockpileStep(current,level);
  earned+=fraction*v.earned;
  current=current.map((x,i)=>(1-fraction)*x+fraction*v.state[i]);
 }
 return {state:current,earned};
}
const LUNAR_HEAL=[3,4,5,7,9,11];
const LUNAR_BERRIES=[
 [[5,1],[7,1],[9,1],[12,1],[14,2]],
 [[9,1],[12,1],[15,1],[16,2],[19,3]],
 [[13,1],[17,1],[18,2],[20,3],[24,4]],
 [[17,1],[19,2],[25,2],[28,3],[29,5]],
 [[21,1],[24,2],[27,3],[28,5],[30,7]],
 [[25,1],[29,2],[30,4],[31,6],[32,9]]
];
const DRACO_BERRIES=[
 [[12,1],[14,1],[18,1],[18,2],[20,2]],
 [[21,1],[24,1],[29,1],[30,2],[33,2]],
 [[29,1],[29,2],[35,2],[37,3],[41,3]],
 [[38,1],[39,2],[42,3],[45,4],[49,4]],
 [[43,2],[44,3],[48,4],[49,5],[53,5]],
 [[48,3],[50,4],[55,4],[55,5],[58,5]]
];
const PSYSTRIKE_STRENGTH=[1408,2002,2762,3813,5264,7274];
const EXTRA_HELP=[6,7,8,9,10,11,12];
const HELPER_BOOST=[
 [2,2,3,4,6], [3,3,4,5,7], [3,3,5,6,8],
 [4,4,6,7,9], [4,5,7,8,10], [5,6,8,9,11]
];
const HEAL_PULSE_HELP=[1,2,2,3,4,4];
const TASTY_CHANCE=[4,5,6,7,8,10];
const DRAW_AMOUNTS=[5,6,8,11,13,16,18];
const DRAW_POOLS={
 27:['potato','corn','pumpkin'],28:['potato','corn','pumpkin'],
 198:['mushroom','sausage','soy','coffee'],430:['mushroom','sausage','soy','coffee'],
 303:['potato','oil','tomato','corn'],
 557:['potato','oil','avocado'],558:['potato','oil','avocado'],
 701:['herb','ginger','sausage'],
 742:['honey','oil','corn'],743:['honey','oil','corn']
};
const CHEER_HEAL={
 'Energizing Cheer S':[12,15,20,25,33,44],
 'Energizing Cheer S (Nuzzle)':[9,12,16,20,27,35],
 'Energizing Cheer S (Heal Pulse)':[6,8,10,13,17,22]
};
const INGREDIENT_MAGNET={
 'Ingredient Magnet S':[6,8,11,14,17,21,24],
 'Ingredient Magnet S (Plus)':[5,7,9,11,13,16,18],
 'Ingredient Magnet S (Present)':[4,6,8,10,12,15,17],
 'Cooking Assist S (Bulk Up)':[6,8,11,14,17,21,24]
};
const POT_BOOST={
 'Cooking Power-Up S':[7,10,12,17,22,27,31],
 'Cooking Power-Up S (Minus)':[5,7,9,12,16,20,24]
};
// Ingredient-producing skills cannot activate when the GLOBAL ingredient bag
// is full. Their ready stock stays queued until an actual successful tap.
// Special non-ingredient skills and regular berry pickups are not blocked.
const DRAW_FOOD_SKILLS=new Set([
 'Ingredient Draw S','Ingredient Draw S (Super Luck)','Ingredient Draw S (Hyper Cutter)'
]);
function blockedIngredientSkill(skill,capacity,used){
 if(!Number.isFinite(capacity)||capacity<0||
    !Number.isFinite(used)||used<0)throw Error('食材バッグ満杯判定の入力が不正です。');
 return capacity>0&&used>=capacity-1e-9&&
   (Object.prototype.hasOwnProperty.call(INGREDIENT_MAGNET,skill)||DRAW_FOOD_SKILLS.has(skill));
}
// Plus/Minus activate their secondary effects only when ANOTHER party member
// has Plus or Minus. Official in-game skill description (2026-10).
const PLUS_MINUS_SKILLS=new Set(['Ingredient Magnet S (Plus)','Cooking Power-Up S (Minus)']);
const PLUS_EXTRA_FIRST_ING={
 coffee:[6,7,8,9,10,11,12],
 milk:[6,7,9,10,12,13,14]
};
const MINUS_EXTRA_HEAL=[8,10,13,17,23,30,35];
function hasPlusMinusPartner(ids,members,self){
 return ids.some(id=>id!==self&&PLUS_MINUS_SKILLS.has(members.get(id)?.sp?.skill));
}
function plusExtraIngredient(sp,level){
 const first=sp.ings?.find(s=>s.c1>0)?.name;
 const table=PLUS_EXTRA_FIRST_ING[first];
 return table?{key:first,count:table[clamp(level-1,0,6)]}:null;
}
function uniformExpectedHeal(current,amount,triggers,teamSize){
 // One random recipient per activation, uniformly across the current five.
 // Bound the energy of the selected recipient *before* taking its expectation.
 if(![current,amount,triggers,teamSize].every(Number.isFinite)||teamSize<1||
  current<0||current>150||amount<0||triggers<0)throw Error('ランダム回復期待値の入力が不正です。');
 return clamp(current+Math.min(amount,150-current)*triggers/teamSize,0,150);
}
// Exact cap-aware recovery expectation over ready-stock 0/1/2 probability.
// Each Minus activation independently chooses one of the five party members.
// Compute the capped energy of each binomial recipient count BEFORE averaging.
function uniformExpectedHealFromStock(current,amount,stockProbabilities,teamSize){
 if(![current,amount,teamSize].every(Number.isFinite)||current<0||current>150||
  amount<0||!Number.isInteger(teamSize)||teamSize<1||
  !Array.isArray(stockProbabilities)||!([2,3].includes(stockProbabilities.length))||
  stockProbabilities.some(p=>!Number.isFinite(p)||p<0)||
  Math.abs(stockProbabilities.reduce((a,b)=>a+b,0)-1)>1e-8)
  throw Error('確率ストック回復期待値の入力が不正です。');
 const chance=1/teamSize,remaining=150-current;
 let gain=0;
 for(let count=0;count<stockProbabilities.length;count++){
  const mass=stockProbabilities[count];if(mass===0)continue;
  for(let hit=0;hit<=count;hit++){
   const choose=count===2&&hit===1?2:1;
   const p=choose*Math.pow(chance,hit)*Math.pow(1-chance,count-hit);
   gain+=mass*p*Math.min(remaining,hit*amount);
  }
 }
 return clamp(current+gain,0,150);
}
const RECOVERY_UP=['Bold','Impish','Lax','Relaxed'],RECOVERY_DOWN=['Hasty','Lonely','Gentle','Mild'];
const RECIPES=root.PokeRecipes||[];
const BERRY_BURST={
 'Berry Burst':{self:[11,14,21,24,27,30],others:[1,2,2,3,4,5],critical:0},
 'Berry Burst (Disguise)':{self:[8,10,15,17,19,21],others:[1,2,2,3,4,5],critical:.185}
};
// User-directed exclusions: these seven main skills do not contribute to
// energy, ingredients, healing, extra help, or skill-trigger totals.
const EXCLUDED_MAIN_SKILLS=new Set([
 'Metronome',
 'Skill Copy (Mimic)',
 'Skill Copy (Transform)',
 'Versatile',
 'Dream Shard Magnet S',
 'Dream Shard Magnet S (Random)',
 'Dream Shard Magnet S (Aura Sphere)'
]);
function clamp(x,l,h){return Math.max(l,Math.min(h,x));}
function roundup(x){return Math.ceil(x-1e-9);}
function natureFactor(jp,up,down){const en=Object.keys(Master.natures).find(k=>Master.natures[k]===jp)||'';
 return up.includes(en)?1.2:down.includes(en)?.8:1;
}
// Energy-recovery-down natures use 0.88, not the 0.80 chance modifier.
// Source: nitoyon/pokesleep-tool src/util/Nature.ts#energyRecoveryFactor.
function recoveryNatureFactor(jp){
 const en=Object.keys(Master.natures).find(k=>Master.natures[k]===jp)||'';
 return RECOVERY_UP.includes(en)?1.2:RECOVERY_DOWN.includes(en)?.88:1;
}
function activeSkills(p){return p.subskills.filter((_,i)=>p.level>=[10,25,50,70,80][i]).map(s=>s||'');}
// Upstream evolutionCount=-1 means "no stage metadata", NOT minus one evolution.
// Normal Pikachu is a legacy exception (Pichu -> Pikachu): carryLimit 17 -> 22.
// Costumed Pikachu forms do not inherit that extra five.
function baseCarryCapacity(sp){
 const stages=Number.isInteger(sp.evolutionCount)?Math.max(0,sp.evolutionCount):0;
 const pikachuBonus=sp.name==='ピカチュウ'&&sp.english==='Pikachu'?5:0;
 return (sp.carryLimit||10)+5*stages+pikachuBonus;
}
function signature(p,sp,team,camp,warnings){
 const sub=activeSkills(p),count=s=>sub.includes(s)?1:0;
 const speedNature=(function(){const f=natureFactor(p.nature,['Lonely','Adamant','Naughty','Brave'],['Bold','Timid','Calm','Modest']);return f===1.2?.9:f===.8?1.075:1;})();
 let helpingBonus=team.reduce((n,q)=>n+Number(activeSkills(q).includes('おてつだいボーナス')),0);
 const speed=.01*clamp(7*count('おてつだいスピードS')+14*count('おてつだいスピードM')+5*helpingBonus,0,35);
 const ribbonTier=p.sleepHours>=2000?4:p.sleepHours>=1000?3:p.sleepHours>=500?2:p.sleepHours>=200?1:0;
 const ribbonSpeed=sp.evolutionLeft===2?(ribbonTier>=4?.75:ribbonTier>=2?.89:1):sp.evolutionLeft===1?(ribbonTier>=4?.88:ribbonTier>=2?.95:1):1;
 const speedProduct=((501-p.level)/500)*speedNature*ribbonSpeed*(1-speed);
 const base=sp.frequency*(Math.trunc(speedProduct*10000)/10000);
 const ingFactor=natureFactor(p.nature,['Modest','Mild','Rash','Quiet'],['Impish','Jolly','Adamant','Careful']);
 const skillFactor=natureFactor(p.nature,['Calm','Gentle','Careful','Sassy'],['Lax','Naive','Naughty','Rash']);
 const ingRate=clamp(sp.ingRate/100*ingFactor*(1+.18*count('食材確率アップS')+.36*count('食材確率アップM')),0,1);
 const rawSkillRate=clamp(sp.skillRate/100*skillFactor*(1+.18*count('スキル確率アップS')+.36*count('スキル確率アップM')),0,1);
 // Source: nitoyon/pokesleep-tool PokemonIv.pityProcHelpCount; the exact
 // threshold can differ slightly in other community estimates.
 const pity=(sp.specialty==='Skills'||sp.specialty==='All')&&sp.frequency>0?Math.ceil(142000/sp.frequency):78;
 const skillRate=rawSkillRate;
 const berryPerHelp=(sp.specialty==='Berries'||sp.specialty==='All'?2:1)+count('きのみの数S');
 const ribbon=(p.sleepHours>=2000?8:p.sleepHours>=1000?6:p.sleepHours>=500?3:p.sleepHours>=200?1:0);
 const cap=baseCarryCapacity(sp)+ribbon+count('最大所持数アップS')*6+count('最大所持数アップM')*12+count('最大所持数アップL')*18;
 const slots=p.level>=60?3:p.level>=30?2:1;
 const ingSlots=[];
 for(let j=0;j<slots;j++){
   const key=Object.keys(Master.ingredients).find(k=>Master.ingredients[k]===p.ingredients[j]);
   const def=(sp.mythIng||sp.ings).filter(Boolean).find(i=>i.name===key&&i['c'+(j+1)]>0);
   if(!def){warnings.add('食材設定を種族マスターと照合できない個体があります。該当食材の生産は未計上です。');continue;}
   ingSlots.push({key,count:def['c'+(j+1)]});
 }
 const skill=sp.skill;
 return {p,sp,interval:Math.max(150,base/(camp?1.2:1)),ingRate,skillRate,berryPerHelp,carry:camp?Math.ceil(cap*1.2):cap,ingSlots,skill,pity,stockMax:(sp.specialty==='Skills'||sp.specialty==='All')?2:1};
}
function energySpeed(e){return e>80?.45:e>60?.52:e>40?.58:e>1?.66:1;}
// Integrate energy-speed boundaries within each fifteen-minute tick.
// The linear energy decrease (1 per ten minutes) remains a documented proxy.
function weightedHelpMinutes(startEnergy,minutes){
 if(!Number.isFinite(startEnergy)||startEnergy<0||startEnergy>150||
    !Number.isFinite(minutes)||minutes<0)throw Error('げんき速度積分の入力が不正です。');
 if(minutes===0)return 0;
 const points=[0,minutes];
 for(const boundary of [80,60,40,1,0]){
  const t=(startEnergy-boundary)*10;
  if(t>0&&t<minutes)points.push(t);
 }
 points.sort((a,b)=>a-b);
 let result=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],mid=(a+b)/2;
  result+=(b-a)/energySpeed(Math.max(0,startEnergy-mid/10));
 }
 return result;
}
// Ten-minute Energy decrements with a carried countdown. The former
// continuous-decrease integrator remains available for regression comparison.
function advanceEnergyTimer(startEnergy,phase,minutes){
 if(![startEnergy,phase,minutes].every(Number.isFinite)||
  startEnergy<0||startEnergy>150||phase<0||phase>=10||minutes<0)
  throw Error('げんき減少タイマーの入力が不正です。');
 let energy=startEnergy,timer=phase,left=minutes,workMinutes=0;
 while(left>1e-9){
  const slice=Math.min(left,10-timer);
  workMinutes+=slice/energySpeed(energy);
  left-=slice;timer+=slice;
  if(timer>=10-1e-9){energy=Math.max(0,energy-1);timer=0;}
 }
 return {energy,phase:timer,workMinutes};
}
function applyEnergyRecovery(energies,decayTimers,id,nextEnergy){
 if(!Number.isFinite(nextEnergy)||nextEnergy<0||nextEnergy>150||
   !energies.has(id))throw Error('げんき回復イベントの入力が不正です。');
 if(nextEnergy>energies.get(id)+1e-10)decayTimers.set(id,0);
 energies.set(id,nextEnergy);
}
function effectivePotCapacity(base,skillBonus,day,camp){
 const weekend=day===6?2:1;
 return Math.round((base*weekend+clamp(skillBonus,0,200))*(camp?1.5:1));
}
/* The game rounds the final Strength of each dish down separately for
   normal and Extra Tasty outcomes. Do not multiply an unrounded meal
   by an averaged success multiplier. Event modifiers are not modeled. */
function calculateMealEnergy(recipeStrength,extraStrength,fieldBonus,probability,day){
 if(![recipeStrength,extraStrength,fieldBonus,probability,day].every(Number.isFinite)||
   recipeStrength<0||extraStrength<0||fieldBonus<0||fieldBonus>100||
   probability<0||probability>1||!Number.isInteger(day)||day<0||day>6)
  throw Error('料理エナジー計算の入力が不正です。');
 const beforeRounding=(recipeStrength+extraStrength)*(1+fieldBonus/100);
 const normal=Math.floor(beforeRounding+1e-9);
 const extraTasty=Math.floor(beforeRounding*(day===6?3:2)+1e-9);
 return {normal,extraTasty,expected:normal*(1-probability)+extraTasty*probability};
}
// Greedy per-meal planner, not a global weekly optimizer and not in-game random auto-cook.
function chooseRecipe({mode='fixed',preferredId='',foodMode,inventory,potCapacity}){
 if(!['fixed','fallback','best'].includes(mode))throw Error('料理選択モードが不正です。');
 if(foodMode==='random'||!['curry','salad','dessert'].includes(foodMode))return null;
 const fits=r=>r.type===foodMode&&Object.values(r.requirements).reduce((a,b)=>a+b,0)<=potCapacity
   &&Object.entries(r.requirements).every(([key,count])=>(inventory[key]||0)+1e-6>=count);
 const preferred=RECIPES.find(r=>r.id===preferredId);
 if(mode==='fixed')return preferred&&fits(preferred)?preferred:null;
 if(mode==='fallback'){
  if(!preferred)throw Error('代替料理モードでは優先するレシピを選んでください。');
  if(preferred.type!==foodMode)return null;
  if(fits(preferred))return preferred;
 }
 // Stable tie break: higher energy first, then fewer mandatory ingredients, then ID.
 return RECIPES.filter(fits).sort((a,b)=>b.strength70-a.strength70
  ||Object.values(a.requirements).reduce((n,v)=>n+v,0)-Object.values(b.requirements).reduce((n,v)=>n+v,0)
  ||a.id.localeCompare(b.id))[0]||null;
}
// Target-weight proxy aligned with nitoyon/pokesleep-tool
// src/util/Team/Skill/EnergizingCheer.ts: 65% minimum-Energy branch,
// 35% uniform among all active members. This is a reference-model rule,
// NOT an independently measured real-game target probability.
function cheerWeights(teamIds,energy){
 const minimum=Math.min(...teamIds.map(id=>energy.get(id)??0));
 const lowest=teamIds.filter(id=>(energy.get(id)??0)===minimum);
 return new Map(teamIds.map(id=>[id,.35/teamIds.length+((energy.get(id)??0)===minimum?.65/lowest.length:0)]));
}
function recoverFromSleep(current,score,natureRecovery,teamRecoveryBonus,selfHasRecoveryBonus){
 const limit=selfHasRecoveryBonus?105:100;
 // Reference: pokesleep-tool Energy.calculateEnergyForEvents (wake).
 // First multiply the rounded sleep score by recovery modifiers; only then
 // ceil the resulting energy. Do not pre-round the recovery *amount*.
 const amount=Math.max(0,Math.round(score)*natureRecovery*(1+.14*teamRecoveryBonus));
 // Preserve user-specified invariant: sleep must not lower already-high Energy.
 if(amount===0)return clamp(current,0,150);
 return clamp(Math.max(current,Math.ceil(Math.min(limit,current+amount))),0,150);
}
function mealRecovery(energy){
 // Same strict > boundary as pokesleep-tool Energy.getEnergyRecoveryForCook.
 // Expected-value Energy can be fractional, so >=81 is NOT equivalent to >80.
 if(energy>=150)return 0;
 if(energy>80)return 1;
 if(energy>70)return 2;
 if(energy>60)return 3;
 if(energy>50)return 4;
 if(energy>40)return 5;
 if(energy>30)return 6;
 if(energy>20)return 7;
 if(energy>10)return 8;
 return 9;
}
function helperBoostCount(level,species){return HELPER_BOOST[clamp(level-1,0,5)][clamp(species-1,0,4)];}
function teamSpeciesCount(ids,members,triggerId){
 const triggerType=members.get(triggerId)?.sp?.type;
 return new Set(ids.map(id=>members.get(id)?.sp).filter(sp=>sp&&sp.type===triggerType).map(sp=>sp.id)).size;
}
function teamHasLatiTwins(ids,members){
 const a=ids.map(id=>members.get(id)?.sp?.english);
 return a.includes('Latios')&&a.includes('Latias');
}
function lunarBerryCounts(level,species){return LUNAR_BERRIES[clamp(level-1,0,5)][clamp(species-1,0,4)];}
function dracoBerryCounts(level,species,twins){
 const [self,others]=DRACO_BERRIES[clamp(level-1,0,5)][clamp(species-1,0,4)];
 const bonus=twins?(level<5?level*2:level===5?9:10):0;
 return [self+bonus,others];
}
function berryUnit(type,lv,favorites,fieldBonus){const b0=BERRY[type];const raw=Math.max(b0+lv-1,Math.round(Math.pow(1.025,lv-1)*b0));return roundup(roundup(raw*(1+fieldBonus/100))*(favorites.includes(type)?2:1));}
function simulate(input){
 if(!input||!Array.isArray(input.box))throw Error('ボックスがありません。');
 const byId=new Map(input.box.map(p=>[p.id,p]));
 const teams=input.teams||{};
 const periods=['morning','noon','evening','sleep'];
 for(const key of periods){
  const ids=teams[key];
  if(!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5||ids.some(id=>!byId.has(id)))throw Error('朝・昼・夜・睡眠の各パーティに別々の5匹を指定してください。');
 }
 const opts=input.options||{};
 // The UI already rejects invalid integers. Enforce the same contract in
 // the simulator so imported/saved or direct API inputs cannot turn 0-minute
 // taps, a 0-capacity pot, NaN or a blank field into plausible default values.
 const numericOption=(name,fallback)=>{
  const raw=opts[name]??fallback;
  const n=Number(raw);
  // Fractional initial Energy (e.g. 80.5) is intentionally supported by
  // controlled Energy/timer benchmarks. Tap intervals and pot slots are
  // discrete counts; they must be integers.
  if((typeof raw!=='number'&&typeof raw!=='string')||
     String(raw).trim()===''||!Number.isFinite(n)||
     ((name==='tapMinutes'||name==='potSize')&&!Number.isSafeInteger(n)))
   throw Error('フィールド補正・回収間隔・鍋容量・睡眠スコアなどの入力値を確認してください。');
  return Number(raw);
 };
 const bonus=numericOption('fieldBonus',0),tapMinutes=numericOption('tapMinutes',150),
  pot=numericOption('potSize',57),score=numericOption('sleepScore',100),
  initialEnergy=numericOption('initialEnergy',100);
 if(bonus<0||bonus>100||tapMinutes<120||tapMinutes>180||pot<7||pot>300||score<0||score>100||initialEnergy<0||initialEnergy>150)throw Error('フィールド補正・回収間隔・鍋容量・睡眠スコアなどの入力値を確認してください。');
 const favorite=FAVORITES[opts.map]||[];
 const warnings=new Set();
 if(!favorite.length)warnings.add('このフィールドの好みのきのみは未確定です。好みボーナスを計上していません。');
 const species=new Map(Master.species.map(s=>[s.name,s]));
 const members=new Map(), energy=new Map(),pocket=new Map(),extraPocket=new Map(),status={berries:0,skills:0,cooking:0,sneaky:0,ingredients:{},skillIngredients:{},unassignedMagnet:0,days:[],skillCount:0,extraHelps:0,stockpileResets:0,stockpileExpectedLost:0,conditionalPlusIngredients:0,conditionalMinusRecovery:0,skillHelpCompletions:0,skillEligibleHelps:0,exactFoodCarryCollections:0,uncollectedExtraHelpItemsAtSwap:0,uncollectedExtraHelpBerryEnergyAtSwap:0,uncollectedExtraHelpSwaps:0,meals:[],estimatedMeals:0,initialCoveredMeals:0,expectedSourceMeals:0,expectedSourceMealEnergy:0,initialSourceMealEnergy:0,consumedIngredients:{}};
 for(const p of input.box){
  energy.set(p.id,initialEnergy);
  pocket.set(p.id,emptyPocket());
  extraPocket.set(p.id,emptyPocket());
 }
 for(const key of periods)for(const id of teams[key]){
  if(!members.has(id)){
   const p=byId.get(id),sp=species.get(p.pokemon);
   if(!sp){warnings.add('未登録の種族は計算対象外です：'+p.pokemon);members.set(id,null);}
   else members.set(id,{p,sp});
  }
 }
 if([...members.values()].every(x=>!x))throw Error('マスターに一致するポケモンがいません。');
 // R02 demonstrated that the prototype's one-vs-two E4 healer ordering can
 // invert under an artificial skill-rate sensitivity test. Never present
 // the numeric weekly estimate as an independently verified optimal ranking.
 const simultaneousAllHealers=['morning','noon','evening'].some(period=>
  teams[period].filter(id=>members.get(id)?.sp?.skill==='Energy for Everyone S').length>=2);
 if(simultaneousAllHealers)
  warnings.add('げんきオールSを2匹以上同時編成した場合、回復スキルの発動時刻・複数個体のげんき相関は未検証です。試算エナジーだけでヒーラー1匹と2匹の優劣を確定しないでください。');
 // Input files may reach the simulator without going through the browser UI.
 // Never turn invalid food counts into 0 via a forgiving numeric coercion.
 const rawIngredients=opts.initialIngredients??{};
 if(Object.prototype.toString.call(rawIngredients)!=='[object Object]')
  throw Error('初期食材数が不正です。');
 const inventory={...rawIngredients};
 for(const k of Object.keys(inventory)){
  const raw=inventory[k],v=Number(raw);
  if((typeof raw!=='number'&&typeof raw!=='string')||
    String(raw).trim()===''||!Number.isSafeInteger(v)||
    v<0||v>10000||!Object.prototype.hasOwnProperty.call(Master.ingredients,k))
   throw Error('初期食材数が不正です。');
  inventory[k]=v;
 }
 // Track only deterministic ingredients entered by the user. Stochastic food
 // production is NEVER credited here. This is a conservative provenance
 // audit of the chosen meal sequence, not a recipe-success probability.
 const initialOnlyStock={...inventory};
 const rawBagCapacity=opts.bagCapacity??0,bagCapacity=Number(rawBagCapacity);
 // 0 is the user's explicit "capacity not configured" setting. A malformed
 // value (NaN, "", false, etc.) MUST NOT silently become 0/unlimited.
 if((typeof rawBagCapacity!=='number'&&typeof rawBagCapacity!=='string')||
   String(rawBagCapacity).trim()===''||!Number.isSafeInteger(bagCapacity)||
   bagCapacity<0||bagCapacity>10000)
  throw Error('食材バッグ容量が不正です。');
 const bagUsed=()=>Object.values(inventory).reduce((sum,n)=>sum+n,0);
 if(bagCapacity&&bagUsed()>bagCapacity)throw Error('初期食材の合計が食材バッグ容量を超えています。');
 if(!bagCapacity)warnings.add('食材バッグ容量が未設定です。満杯時の食材回収制限は考慮していません。');
 const recipeMode=opts.recipeMode??'fixed';
 if(!['fixed','fallback','best'].includes(recipeMode))throw Error('料理選択モードが不正です。');
 const recipe=RECIPES.find(r=>r.id===opts.recipeId);
 if(recipeMode==='fixed'&&!recipe)warnings.add('レシピ未選択：料理エナジーを計上していません。');
 if(recipeMode==='fallback'&&!recipe)throw Error('代替料理モードでは優先するレシピを選んでください。');
 if(recipeMode!=='best'&&recipe&&opts.foodMode!=='random'&&opts.foodMode!==recipe.type)warnings.add('レシピと料理カテゴリが一致しません。料理エナジーを計上していません。');
 if(opts.foodMode==='random')warnings.add('ランダム料理カテゴリは未確定です。料理カテゴリを確定するまで料理エナジーは計上しません。');
 if(recipeMode!=='fixed')warnings.add('料理の自動選択は各食事時点のLv70レシピエナジー最大を選ぶ近似です。翌日の食材確保や週間総エナジーを見越した最適化ではありません。');
 warnings.add('食材の期待個数は端数を含む近似です。実際に揃った食材数や料理回数とは異なります。');
 if(opts.map==='シアンの砂浜EX'||opts.map==='ワカクサ本島EX')warnings.add('EXフィールド固有の補正には未対応です。');
 if(opts.eventEffects)warnings.add('イベント補正メモはSTEP5まで計算に反映しません。');
 const warningsSkills=new Set(),warningsSkillsExcluded=new Set();
 // Tracks skill roll history across collection and team swaps, unlike the
 // ready-to-fire skill stock which is removed when team composition changes.
 const skillProcStates=new Map(),helpProgress=new Map(),energyDecayTimers=new Map();
 // Every stockpile user starts at zero on Monday; team substitutions reset it.
 const stockpileStates=new Map();
 function resetStockpileLeaving(oldTeam,newTeam){
  // A tap may generate EXTRA-help items after its ordinary rewards are
  // collected. The present model drops this queue on lineup departure; record
  // the amount explicitly so team-comparison users can spot the uncertainty.
  const dropped=uncollectedExtraHelpOnSwap(oldTeam,newTeam,extraPocket,id=>{
   const pair=members.get(id);
   return pair?berryUnit(pair.sp.type,pair.p.level,favorite,bonus):0;
  });
  if(dropped.items>1e-9){
   status.uncollectedExtraHelpItemsAtSwap+=dropped.items;
   status.uncollectedExtraHelpBerryEnergyAtSwap+=dropped.berryEnergy;
   status.uncollectedExtraHelpSwaps++;
  }
  // Outgoing team is collected before switching; any blocked carry is lost.
  clearDepartingPockets(oldTeam,newTeam,pocket,extraPocket);
  clearDepartingHelpProgress(oldTeam,newTeam,helpProgress);
  clearDepartingHelpProgress(oldTeam,newTeam,energyDecayTimers);
  clearPartySkillStocks(oldTeam,newTeam,skillProcStates,pocket);
  const retained=new Set(newTeam);
  for(const id of oldTeam){
   if(!retained.has(id)&&stockpileStates.has(id)){
    const probs=stockpileStates.get(id);
    status.stockpileExpectedLost+=probs.reduce((sum,p,k)=>sum+p*k,0);
    status.stockpileResets++;
    stockpileStates.delete(id);
   }
  }
 }
 const magnetPool=opts.magnetIngredients??[];
 if(!Array.isArray(magnetPool)||new Set(magnetPool).size!==magnetPool.length||
    magnetPool.some(k=>!Object.prototype.hasOwnProperty.call(Master.ingredients,k)))throw Error('食材ゲットSの抽選対象が不正です。');
 let potBonus=0,successBonus=0;
 const extraMode=opts.extraMode??'none',successMode=opts.successMode??'none';
 if(!['none','fill'].includes(extraMode)||!['none','expected'].includes(successMode))throw Error('追加食材・大成功の設定が不正です。');
 function addInventory(key,count,fromSkill){
  const available=bagCapacity?Math.max(0,bagCapacity-bagUsed()):count;
  const accepted=Math.max(0,Math.min(count,available));
  if(accepted>0){
   inventory[key]=(inventory[key]||0)+accepted;
   status.ingredients[key]=(status.ingredients[key]||0)+accepted;
   if(fromSkill)status.skillIngredients[key]=(status.skillIngredients[key]||0)+accepted;
  }
  return accepted;
 }
 function collect(teamIds){
  const granted=new Map();
  const giveHelps=(who,count)=>{
   if(!members.get(who)||count<=0)return;
   granted.set(who,(granted.get(who)||0)+count);
   status.extraHelps+=count;
  };
  for(const id of teamIds){
   const pair=members.get(id);if(!pair)continue;
   const bag=pocket.get(id),extraBag=extraPocket.get(id);
   const strength=berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
   // Sneaky berries are awarded only on the next real interaction.
   const readySneaky=releaseSneakyEnergy(bag);
   status.berries+=(bag.berries+extraBag.berries)*strength+readySneaky;
   status.sneaky+=readySneaky;
   const receiveFood=(src)=>{
    const retained={};let retainedCount=0;
    for(const [key,v] of Object.entries(src.ingredients)){
     const capacity=bagCapacity?Math.max(0,bagCapacity-bagUsed()):v;
     const accepted=Math.max(0,Math.min(v,capacity));
     if(accepted){inventory[key]=(inventory[key]||0)+accepted;status.ingredients[key]=(status.ingredients[key]||0)+accepted;}
     if(v-accepted>1e-9){retained[key]=v-accepted;retainedCount+=v-accepted;}
    }
    return {retained,retainedCount};
   };
   // Exact total retained-food count where the shared bag has an integer
   // number of free slots and this Pokemon was tracked from empty.
   const available=bagCapacity?Math.max(0,bagCapacity-bagUsed()):0;
   const carry=bag.foodJoint?signature(pair.p,pair.sp,teamIds.map(i=>members.get(i)).filter(Boolean).map(x=>x.p),!!opts.camp,warnings).carry:0;
   let exactFood=null,standardFood;
   if(bag.foodJoint&&bagCapacity&&Number.isInteger(available)){
    exactFood=collectIntegerFoodPocket(bag.foodJoint,carry,available);
    const total=Object.values(bag.ingredients).reduce((a,n)=>a+n,0);
    const retained={};
    for(const [key,v] of Object.entries(bag.ingredients)){
     // Retained FOOD SPECIES remain an expectation; no per-type joint state.
     const picked=total>0?exactFood.accepted*v/total:0;
     if(picked>0){inventory[key]=(inventory[key]||0)+picked;status.ingredients[key]=(status.ingredients[key]||0)+picked;}
     if(v-picked>1e-9)retained[key]=v-picked;
    }
    standardFood={retained,retainedCount:exactFood.remaining};
    status.exactFoodCarryCollections++;
   }else standardFood=receiveFood(bag);
   const extraFood=receiveFood(extraBag);
   const remainingInPocket=standardFood.retained,uncollected=standardFood.retainedCount;
   const actual=pair.sp.skill;
   const excluded=EXCLUDED_MAIN_SKILLS.has(actual);
   const blockedByFoodBag=blockedIngredientSkill(actual,bagCapacity,bagUsed());
   const triggerState=skillProcStates.get(id);
   // A full global bag rejects food-producing skills without consuming the
   // ready stock or resetting pity/skill history.
   const triggers=excluded||blockedByFoodBag?0:triggerState?expectedSkillStock(skillProcMarginal(triggerState)):0;
   if(blockedByFoodBag&&triggerState&&expectedSkillStock(skillProcMarginal(triggerState))>0)
    warnings.add('食材バッグ満杯時の食材獲得スキルは発動できません。待機スキルは回収しても保持し、空きができた後の次回操作まで保留します。');
   if(excluded)warningsSkillsExcluded.add(actual);
   else if(actual==='Charge Strength S (Stockpile)'){
    const current=stockpileStates.get(id)||emptyStockpile();
    const update=advanceStockpile(current,triggers,pair.p.skillLevel);
    stockpileStates.set(id,update.state);
    status.skills+=update.earned*(1+bonus/100);
    warnings.add('たくわえるは蓄積0回から開始し、交代時リセット・週末未放出を反映した状態確率モデルです。25%放出は実測推定、発動回数と抽選は期待値近似です。');
   }
   else if(actual==='Berry Zone (Psystrike)'){
    status.skills+=triggers*PSYSTRIKE_STRENGTH[clamp(pair.p.skillLevel-1,0,5)]*(1+bonus/100);
    warnings.add('サイコブレイクのマゴのみゾーン強化（発動ごと+0.6～2.0%）は未計上です。直接エナジーのみ反映しました。');
   }
   else if(SKILL_STRENGTH[actual]){
    const levels=SKILL_STRENGTH[actual];
    status.skills+=triggers*levels[clamp(pair.p.skillLevel-1,0,levels.length-1)]*(1+bonus/100);
    if(actual==='Charge Strength M (Bad Dreams)'){
     for(const who of teamIds){
      const target=members.get(who);
      if(target?.sp.type!=='dark'&&target)energy.set(who,clamp(energy.get(who)-12*triggers,0,150));
     }
     warnings.add('ナイトメアはあくタイプ以外のチームメンバーのげんき-12／発動を期待値で反映しています。');
    }
   }
   else if(actual==='Extra Helpful S'){
    const helps=triggers*EXTRA_HELP[clamp(pair.p.skillLevel-1,0,6)];
    for(const who of teamIds)giveHelps(who,helps/teamIds.length);
    warnings.add('おてつだいサポートSは対象1匹のランダム抽選を5匹への均等期待値で近似します。');
   }
   else if(actual==='Helper Boost'){
    const speciesCount=teamSpeciesCount(teamIds,members,id);
    const n=helperBoostCount(pair.p.skillLevel,speciesCount);
    for(const who of teamIds)giveHelps(who,triggers*n);
    warnings.add('おてつだいブーストは同タイプの異なる種族数と全員の追加おてつだいを反映した期待値です。');
   }
   else if(actual==='Energizing Cheer S (Heal Pulse)'){
    const lvl=clamp(pair.p.skillLevel-1,0,5),heal=CHEER_HEAL[actual][lvl];
    const bonusHelp=teamHasLatiTwins(teamIds,members)?(lvl<2?1:lvl<5?2:3):0;
    const helps=triggers*(HEAL_PULSE_HELP[lvl]+bonusHelp);
    for(const who of teamIds){
     const recipient=byId.get(who),factor=recoveryNatureFactor(recipient.nature);
     applyEnergyRecovery(energy,energyDecayTimers,who,clamp(energy.get(who)+triggers*heal*2/teamIds.length*factor,0,150));
     giveHelps(who,helps*2/teamIds.length);
    }
    warnings.add('いやしのはどうは回復・追加おてつだいを対象2匹への均等期待値で近似しています。');
   }
   else if(actual==='Energy for Everyone S (Lunar Blessing)'){
    const level=clamp(pair.p.skillLevel-1,0,5),r=LUNAR_HEAL[level];
    const speciesCount=teamSpeciesCount(teamIds,members,id),counts=lunarBerryCounts(level+1,speciesCount);
    let berryEnergy=counts[0]*berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    for(const who of teamIds){
     const target=members.get(who);if(!target||who===id)continue;
     berryEnergy+=counts[1]*berryUnit(target.sp.type,target.p.level,favorite,bonus);
    }
    status.berries+=triggers*berryEnergy;
    for(const who of teamIds){
     const recipient=byId.get(who),f=recoveryNatureFactor(recipient.nature);
     applyEnergyRecovery(energy,energyDecayTimers,who,clamp(energy.get(who)+r*triggers*f,0,150));
    }
    warnings.add('みかづきのいのりの回復ときのみは種族数を基に期待値計算しています。発動タイミング・丸めは簡易モデルです。');
   }
   else if(actual==='Energy for Everyone S'||actual==='Energy for Everyone S (Berry Juice)'){const r=HEAL_ALL[clamp(pair.p.skillLevel-1,0,HEAL_ALL.length-1)];
     const marginal=triggerState?skillProcMarginal(triggerState):[1,0];
     for(const who of teamIds){
      const recipient=byId.get(who),f=recoveryNatureFactor(recipient.nature),before=energy.get(who);
      const diagnostic=cappedHealFromStock(before,r*f,marginal);
      // Mean-field recovery resets an entire ten-minute decay countdown
      // even when the skill-stock branch still includes "no activation".
      // Detect, but do not invent an unverified weekly joint-state fix.
      const pNone=marginal[0],decayPhase=energyDecayTimers.get(who)||0;
      if(decayPhase>1e-9&&pNone>1e-9&&pNone<1-1e-9&&triggers>0&&
         Math.min(150,before+r*triggers*f)>before+1e-10)
       status.healingTimerCorrelationEvents=(status.healingTimerCorrelationEvents||0)+1;
      if(diagnostic.localGap>1e-7){
       status.healingCapNonlinearEvents=(status.healingCapNonlinearEvents||0)+1;
       status.healingCapLocalGapSum=(status.healingCapLocalGapSum||0)+diagnostic.localGap;
      }
      // Preserve historical expected-stock energy arithmetic until a joint
      // Energy/stock model passes its own independent week-long benchmark.
      applyEnergyRecovery(energy,energyDecayTimers,who,clamp(before+r*triggers*f,0,150));
     }
     if(actual==='Energy for Everyone S (Berry Juice)')warnings.add('きのみジュースの追加獲得はアイテム不使用方針によりエナジーに換算しません。');}
   else if(actual==='Charge Energy S'||actual==='Charge Energy S (Moonlight)'){const f=recoveryNatureFactor(pair.p.nature);applyEnergyRecovery(energy,energyDecayTimers,id,clamp(energy.get(id)+HEAL_SELF[clamp(pair.p.skillLevel-1,0,HEAL_SELF.length-1)]*triggers*f,0,150));
    if(actual==='Charge Energy S (Moonlight)')warnings.add('つきのひかりの追加でチーム1匹を回復する効果は未計上です。');}
   else if(CHEER_HEAL[actual]){
    const heal=CHEER_HEAL[actual][clamp(pair.p.skillLevel-1,0,5)];
    const weights=cheerWeights(teamIds,energy);
    for(const who of teamIds){
     const recipient=byId.get(who),rate=recoveryNatureFactor(recipient.nature);
     applyEnergyRecovery(energy,energyDecayTimers,who,clamp(energy.get(who)+heal*triggers*(weights.get(who)||0)*rate,0,150));
    }
    warnings.add('げんきエールの回復対象は参照計算器に合わせた最低げんき優先65%／全員均等35%の近似です。実際の抽選確率は独立実測されていません。');
    if(actual==='Energizing Cheer S (Nuzzle)')warnings.add('ほっぺすりすりのスキル発動可能ボーナスは未計上です。');
    if(actual==='Energizing Cheer S (Heal Pulse)')warnings.add('いやしのはどうの追加おてつだい・ラティアスとラティオスの同時編成ボーナスは未計上です。');
   }
   else if(actual==='Berry Burst (Draco Meteor)'){
    const speciesCount=teamSpeciesCount(teamIds,members,id);
    const [own,others]=dracoBerryCounts(pair.p.skillLevel,speciesCount,teamHasLatiTwins(teamIds,members));
    let energyGain=own*berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    for(const who of teamIds){
     const target=members.get(who);if(!target||who===id)continue;
     energyGain+=others*berryUnit(target.sp.type,target.p.level,favorite,bonus);
    }
    status.berries+=triggers*energyGain;
    warnings.add('りゅうせいぐんは編成種族数とラティアス／ラティオス同時編成のボーナスを簡易期待値で計算しています。');
   }
   else if(BERRY_BURST[actual]){
    const burst=BERRY_BURST[actual],level=clamp(pair.p.skillLevel-1,0,burst.self.length-1);
    const own=burst.self[level]*(1+2*burst.critical);
    let energyGain=own*berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    for(const teammate of teamIds){
     if(teammate===id)continue;
     const target=members.get(teammate);if(!target)continue;
     energyGain+=burst.others[level]*berryUnit(target.sp.type,target.p.level,favorite,bonus);
    }
    status.berries+=triggers*energyGain;
    if(burst.critical)warnings.add('ばけのかわの大成功率18.5%は期待値で計算しています。抽選結果の上下振れは未再現です。');
   }
   else if(actual==='Tasty Chance S'){
    if(successMode==='expected')successBonus=clamp(successBonus+triggers*TASTY_CHANCE[clamp(pair.p.skillLevel-1,0,5)]/100,0,.7);
    else warnings.add('料理チャンスSは大成功期待値OFFのため計上していません。');
   }
   else if(actual==='Ingredient Draw S'||actual==='Ingredient Draw S (Super Luck)'||actual==='Ingredient Draw S (Hyper Cutter)'){
    const pool=DRAW_POOLS[pair.sp.id],chance=actual==='Ingredient Draw S (Super Luck)'?.86:1;
    if(!pool)warnings.add('食材セレクトの種族別抽選候補がマスターにありません：'+pair.p.pokemon);
    else{
     const produced=triggers*DRAW_AMOUNTS[clamp(pair.p.skillLevel-1,0,6)]*chance;
     const available=bagCapacity?Math.min(produced,Math.max(0,bagCapacity-bagUsed())):produced;
     for(const key of pool)addInventory(key,available/pool.length,true);
    }
    if(actual==='Ingredient Draw S (Super Luck)')warnings.add('きょううんは食材当選率86%の期待値を使用。ゆめのかけら報酬は対象外です。');
    if(actual==='Ingredient Draw S (Hyper Cutter)')warnings.add('かいりきバサミの条件付き追加食材は未計上です。');
    warnings.add('食材セレクトの抽選は種族ごとの候補へ均等配分した期待値近似で、実際の1種類抽選・所持数を再現しません。');
   }
   else if(INGREDIENT_MAGNET[actual]){
    const produced=triggers*INGREDIENT_MAGNET[actual][clamp(pair.p.skillLevel-1,0,6)];
    if(!magnetPool.length)status.unassignedMagnet+=produced;
    else {const available=bagCapacity?Math.min(produced,Math.max(0,bagCapacity-bagUsed())):produced;
      for(const key of magnetPool)addInventory(key,available/magnetPool.length,true);}
    if(actual==='Ingredient Magnet S (Plus)'&&hasPlusMinusPartner(teamIds,members,id)){
     const extra=plusExtraIngredient(pair.sp,pair.p.skillLevel);
     if(extra){
      const accepted=addInventory(extra.key,extra.count*triggers,true);
      status.conditionalPlusIngredients+=accepted;
      warnings.add('プラスの追加食材は他のプラス／マイナスとの同時編成時に第1枠を加算します。食材バッグ容量・スキル抽選は期待値近似です。');
     }else warnings.add('プラスの第1枠追加食材をマスターから特定できず、追加分を計上していません：'+pair.sp.name);
    }
    if(actual==='Ingredient Magnet S (Present)')warnings.add('プレゼントのアメ効果はエナジーに換算しません。');
    if(actual==='Cooking Assist S (Bulk Up)'){
     if(successMode==='expected'){
      const chanceAmounts=[1,2,2,3,3,4,5];
      successBonus=clamp(successBonus+triggers*chanceAmounts[clamp(pair.p.skillLevel-1,0,6)]/100,0,.7);
     }else warnings.add('ビルドアップの大成功確率アップは大成功期待値OFFのため未計上です。');
     warnings.add('ビルドアップの食材は発見済み食材への均等配分・大成功率は期待値近似です。');
    }
   }
   else if(POT_BOOST[actual]){
    potBonus=Math.min(200,potBonus+triggers*POT_BOOST[actual][clamp(pair.p.skillLevel-1,0,6)]);
    if(actual==='Cooking Power-Up S (Minus)'&&hasPlusMinusPartner(teamIds,members,id)){
     const heal=MINUS_EXTRA_HEAL[clamp(pair.p.skillLevel-1,0,6)];
     for(const who of teamIds){
      const receiver=byId.get(who),prior=energy.get(who);
      const amount=heal*recoveryNatureFactor(receiver.nature);
      const next=uniformExpectedHealFromStock(prior,amount,
        triggerState?skillProcMarginal(triggerState):[1,0],teamIds.length);
      applyEnergyRecovery(energy,energyDecayTimers,who,next);
      status.conditionalMinusRecovery+=next-prior;
     }
     warnings.add('マイナスの追加げんき回復は他のプラス／マイナス同時編成時、ストック0/1/2回とランダム対象の重複、げんき150上限を考慮した期待値として反映しています。');
    }
   }
   else if(actual)warningsSkills.add(actual);
   status.skillCount+=triggers;
   if(triggerState&&!blockedByFoodBag)skillProcStates.set(id,clearSkillProcStock(triggerState));
   pocket.set(id,{used:uncollected,berries:0,ingredients:remainingInPocket,
     skillState:blockedByFoodBag&&triggerState?skillProcMarginal(triggerState):[1,0,0],pendingSneaky:0,
     occupation:exactFood?exactFood.occupation:expectedPocketOccupation(uncollected,signature(pair.p,pair.sp,teamIds.map(i=>members.get(i)).filter(Boolean).map(x=>x.p),!!opts.camp,warnings).carry),
     foodJoint:exactFood?exactFood.foodJoint:undefined});
   extraPocket.set(id,{used:extraFood.retainedCount,berries:0,ingredients:extraFood.retained,skillState:[1,0,0]});
  }
  if(granted.size)help(teamIds,0,!!opts.camp,undefined,granted);
 }
 function help(teamIds,hours,camp,estimatedEnergy,forcedHelps){
  const group=teamIds.map(id=>members.get(id)).filter(Boolean).map(x=>x.p);
  for(const id of teamIds){
   const pair=members.get(id);if(!pair)continue;
   const x=signature(pair.p,pair.sp,group,camp,warnings),bag=forcedHelps?extraPocket.get(id):pocket.get(id);
   const workFactor=estimatedEnergy?.get(id)??(1/energySpeed(energy.get(id)));
   const helps=forcedHelps?(forcedHelps.get(id)||0):(hours*3600/x.interval)*workFactor;
   // Berries, ingredients, sneaky snacking and skill checks all require
   // completed normal helps. Carry partial progress across ticks & collection.
   let remaining=helps;
   if(!forcedHelps){
    const phase=completeHelpProgress(helpProgress.get(id)||0,helps);
    helpProgress.set(id,phase.phase);
    remaining=phase.completed;
    status.skillHelpCompletions+=remaining;
   }
   if(!forcedHelps){
    // Begin exact food-total tracking only when the shared bag is already
    // full and this Pokemon starts with an empty pocket. Other situations
    // retain the v0.2.23 marginal model rather than reconstruct correlations.
    if(!bag.foodJoint&&bagCapacity&&bagUsed()>=bagCapacity-1e-9&&
      bag.occupation.size===1&&bag.occupation.get(0)===1&&
      x.ingRate>0&&x.ingSlots.length>0)
     bag.foodJoint=new Map([[0,1]]);
    const outcome=bag.foodJoint?
      integerFoodPocketTransitions(bag.foodJoint,remaining,x.carry,x.berryPerHelp,x.ingRate,x.ingSlots):
      integerPocketTransitions(bag.occupation,remaining,x.carry,x.berryPerHelp,x.ingRate,x.ingSlots);
    if(bag.foodJoint)bag.foodJoint=outcome.foodJoint;
    bag.occupation=outcome.occupation;
    bag.used=outcome.used;
    bag.berries+=outcome.berries;
    for(const [key,value] of Object.entries(outcome.ingredients))
     bag.ingredients[key]=(bag.ingredients[key]||0)+value;
    queueSneakyEnergy(bag,outcome.sneaky*berryUnit(pair.sp.type,pair.p.level,favorite,bonus));
    if(!EXCLUDED_MAIN_SKILLS.has(pair.sp.skill)){
     status.skillEligibleHelps+=outcome.eligible;
     if(outcome.eligible>0){
      const previous=skillProcStates.get(id)||emptySkillProcState(x.pity,x.stockMax);
      skillProcStates.set(id,advanceSkillProcStateByHelpCounts(previous,outcome.eligibleDistribution,x.skillRate));
     }
     const updated=skillProcStates.get(id)||emptySkillProcState(x.pity,x.stockMax);
     bag.skillState=skillProcMarginal(updated);
    }
   }else{
    // Extra helps retain their special 999-item queue and expectation rule.
    const space=Math.max(0,999-bag.used);
    const avg=x.ingSlots.length?x.ingSlots.reduce((a,b)=>a+b.count,0)/x.ingSlots.length:0;
    const items=(1-x.ingRate)*x.berryPerHelp+x.ingRate*avg;
    const fits=Math.min(remaining,items>0?space/items:0);
    bag.berries+=fits*(1-x.ingRate)*x.berryPerHelp;
    for(const slot of x.ingSlots)
     bag.ingredients[slot.key]=(bag.ingredients[slot.key]||0)+fits*x.ingRate*slot.count/x.ingSlots.length;
    bag.used+=fits*items;
    if(remaining-fits>0)warnings.add('追加おてつだいの別所持上限999に達し、あふれた追加分は計上していません。');
   }
  }
 }
 function tickActive(ids,minutes,camp,awake){
  const workFactors=new Map(),nextStates=new Map();
  for(const id of ids){
   const prior=energy.get(id),phase=energyDecayTimers.get(id)||0;
   const next=awake?advanceEnergyTimer(prior,phase,minutes):
    {energy:prior,phase,workMinutes:minutes/energySpeed(prior)};
   nextStates.set(id,next);
   workFactors.set(id,next.workMinutes/minutes);
  }
  help(ids,minutes/60,camp,workFactors);
  for(const id of ids){
   energy.set(id,nextStates.get(id).energy);
   energyDecayTimers.set(id,nextStates.get(id).phase);
  }
 }
 function cook(day,meal,teamIds){
   const capacity=effectivePotCapacity(pot,potBonus,day,!!opts.camp);
   const chosen=chooseRecipe({mode:recipeMode,preferredId:opts.recipeId||'',foodMode:opts.foodMode,inventory,potCapacity:capacity});
   if(!chosen)return 0;
   const needed=Object.entries(chosen.requirements);
   // An expected inventory of 7.5 does not prove that an integer recipe
   // requiring 7 items is feasible on every sample path. Quantify the
   // part not covered by remaining user-entered (certain) initial stock.
   let expectedMandatoryUnits=0;
   for(const [k,v] of needed){
    const certain=Math.min(v,Math.max(0,initialOnlyStock[k]||0));
    expectedMandatoryUnits+=v-certain;
    initialOnlyStock[k]=Math.max(0,(initialOnlyStock[k]||0)-v);
    inventory[k]-=v;
    status.consumedIngredients[k]=(status.consumedIngredients[k]||0)+v;
   }
   const initialCovered=expectedMandatoryUnits<1e-9;
   if(initialCovered)status.initialCoveredMeals++;
   else status.estimatedMeals++;
   const mandatoryCount=needed.reduce((n,[,v])=>n+v,0);
   const extraIngredients={};let extraEnergy=0,extraCount=0,expectedExtraUnits=0;
   if(extraMode==='fill'){
    const candidates=Object.keys(ING).filter(k=>ING[k]>0)
      .sort((a,b)=>ING[b]-ING[a]||a.localeCompare(b));
    for(const key of candidates){
     const count=Math.min(Math.floor(Math.max(0,inventory[key]||0)),capacity-mandatoryCount-extraCount);
     if(count<=0)continue;
     expectedExtraUnits+=Math.max(0,count-Math.max(0,initialOnlyStock[key]||0));
     initialOnlyStock[key]=Math.max(0,(initialOnlyStock[key]||0)-count);
     inventory[key]-=count;status.consumedIngredients[key]=(status.consumedIngredients[key]||0)+count;
     extraIngredients[key]=count;extraCount+=count;extraEnergy+=count*ING[key];
    }
   }
   const greatChance=successMode==='expected'?clamp((day===6?.3:.1)+successBonus,0,1):0;
   const mealEnergy=calculateMealEnergy(chosen.strength70,extraEnergy,bonus,greatChance,day);
   const value=mealEnergy.expected;
   status.cooking+=value;
   // This is SOURCE-DEPENDENCY attribution, not a probability of success.
   // Optional pot fillers also make the energy rely on uncertain production.
   const expectedSource=expectedMandatoryUnits>1e-9||expectedExtraUnits>1e-9;
   if(expectedSource){status.expectedSourceMeals++;status.expectedSourceMealEnergy+=value;}
   else status.initialSourceMealEnergy+=value;
   status.meals.push({day:day+1,meal,recipeId:chosen.id,name:chosen.name,energy:value,
     normalEnergy:mealEnergy.normal,extraTastyEnergy:mealEnergy.extraTasty,
     count:mandatoryCount+extraCount,mandatoryCount,extraIngredients,extraEnergy,successProbability:greatChance,
     initialCovered,expectedMandatoryUnits,expectedExtraUnits,expectedSource,
     potCapacity:capacity,usedPotBonus:potBonus});
   if(successMode==='expected')successBonus*=1-greatChance;
   // Cooking restores a small amount of energy to the current on-field party.
   for(const id of teamIds)applyEnergyRecovery(energy,energyDecayTimers,id,clamp(energy.get(id)+mealRecovery(energy.get(id)),0,150));
   potBonus=0;
   return value;
 }
 const daySummaries=[],nightEnergy=[];
 
 for(let d=0;d<7;d++){
  const before={berries:status.berries,cooking:status.cooking,skills:status.skills,sneaky:status.sneaky};
  let current=null;
  for(let t=7.5;t<24-1e-9;t+=.25){
    const key=t<12?'morning':t<18?'noon':'evening',ids=teams[key];
    if(current!==key){
      if(current)collect(teams[current]);
      resetStockpileLeaving(current?teams[current]:d===0?[]:teams.sleep,ids);
      current=key;collect(ids);
      if([7.5,12,18].includes(t))cook(d,t===7.5?'朝':t===12?'昼':'夜',ids);
    }
    const sinceWake=(t-7.5)*60;
    if(Math.abs(sinceWake/tapMinutes-Math.round(sinceWake/tapMinutes))<1e-6 &&t>7.5)collect(ids);
    tickActive(ids,15,!!opts.camp,true);
  }
  collect(teams.evening);
  resetStockpileLeaving(teams.evening,teams.sleep);
  // No interaction from 00:00 until 07:30. Sunday -> Monday only 00:00-04:00 counts for this week.
  // Helpers DO lose Energy while asleep: -1 Energy per 10 minutes, as when awake.
  const sleepHours=d===6?4:7.5;
  const beforeSleep=Object.fromEntries(teams.sleep.map(id=>[id,energy.get(id)]));
  for(let h=0;h<sleepHours-1e-9;h+=.25)tickActive(teams.sleep,15,!!opts.camp,true);
  const beforeRecovery=Object.fromEntries(teams.sleep.map(id=>[id,energy.get(id)]));
  // Recovery happens at the next 07:30 research/collection, not while asleep.
  // Only the fixed sleeping five recover. The user's box 5% recovery is intentionally excluded.
  if(d<6){
   const recoverBonuses=teams.sleep.filter(id=>activeSkills(byId.get(id)).includes('げんき回復ボーナス')).length;
   for(const id of teams.sleep){
    const p=byId.get(id),f=recoveryNatureFactor(p.nature);
    const selfHasBonus=activeSkills(p).includes('げんき回復ボーナス');
    applyEnergyRecovery(energy,energyDecayTimers,id,recoverFromSleep(energy.get(id),score,f,recoverBonuses,selfHasBonus));
   }
   collect(teams.sleep);
  }
  nightEnergy.push({day:d+1,hours:sleepHours,beforeSleep,beforeRecovery,afterRecovery:Object.fromEntries(teams.sleep.map(id=>[id,energy.get(id)]))});
  // The next Monday 04:00 is a field reset, NOT an interaction.
  // Do not credit the still-carried berries/ingredients or skill stock to the old week.
  daySummaries.push({day:d+1,berries:status.berries-before.berries,cooking:status.cooking-before.cooking,skills:status.skills-before.skills});
 }
 // Sunday 00:00-04:00 has no collection: do not add its pending
 // sneaky energy to the old week. The next real tap will earn it.
 const pendingSneaky=Array.from(pocket.values()).reduce((n,bag)=>n+(bag.pendingSneaky||0),0);
 const pendingExtraHelpItems=Array.from(extraPocket.values()).reduce((n,bag)=>n+(bag.used||0),0);
 const pendingExtraHelpBerryEnergy=Array.from(extraPocket,([id,bag])=>{
  const pair=members.get(id);
  return pair?(bag.berries||0)*berryUnit(pair.sp.type,pair.p.level,favorite,bonus):0;
 }).reduce((sum,n)=>sum+n,0);
 const stockpilePending={};
 for(const [id,probabilities] of stockpileStates){
  const pending=probabilities.reduce((sum,p,k)=>sum+p*k,0);
  if(pending>1e-9)stockpilePending[id]=pending;
 }
 if(status.uncollectedExtraHelpItemsAtSwap>1e-9)
  warnings.add('追加おてつだいの未回収所持品が編成交代時にモデルから除外されました（期待'+status.uncollectedExtraHelpItemsAtSwap.toFixed(2)+'個、うち未回収きのみの換算値'+Math.round(status.uncollectedExtraHelpBerryEnergyAtSwap)+'エナジー、'+status.uncollectedExtraHelpSwaps+'回の交代）。交代前の追加分を実ゲームで回収できるか未検証です。固定編成と交代編成の優劣をこの差だけで確定しないでください。');
 if(pendingExtraHelpItems>1e-9)
  warnings.add('週末04:00時点の追加おてつだい未回収所持品（期待'+pendingExtraHelpItems.toFixed(2)+'個）は前週の獲得に加算していません。次の実操作による回収は別週扱いです。');
 if(status.stockpileResets)warnings.add('たくわえるは編成から外れた際、期待蓄積を計'+status.stockpileExpectedLost.toFixed(2)+'回分リセットしました（'+status.stockpileResets+'回の交代）。');
 if(Object.keys(stockpilePending).length)warnings.add('週末時点で放出されていないたくわえる蓄積はエナジーへ加算しません。');
 for(const s of warningsSkills)warnings.add('未対応のメインスキル（エナジー寄与未計上）：'+s);
 if(warningsSkillsExcluded.size)warnings.add('指定により計算対象外のメインスキルがあります：'+[...warningsSkillsExcluded].map(s=>({
  'Metronome':'ゆびをふる','Skill Copy (Mimic)':'ものまね','Skill Copy (Transform)':'へんしん',
  'Versatile':'オールマイティー','Dream Shard Magnet S':'ゆめのかけらゲットS',
  'Dream Shard Magnet S (Random)':'ゆめのかけらゲットS（ランダム）',
  'Dream Shard Magnet S (Aura Sphere)':'はどうだん'
 })[s]).join('、')+'。これらのスキル効果は評価せず、通常のおてつだい・きのみ・食材は計算します。');
 if(status.healingTimerCorrelationEvents>0)
  warnings.add('げんきオールSの発動が確率的なとき、回復期待値で10分げんき減少タイマーを必ずリセットする近似に差異がありました（局所'+status.healingTimerCorrelationEvents+'件）。未発動分岐との相関が未検証のため、週間エナジーと編成順位の誤差率は不明です。');
 if(status.healingCapNonlinearEvents>0)
  warnings.add('げんきオールSで、期待発動回数から先に回復上限150を適用する近似と、発動分岐ごとに150を適用する計算に差を検出しました（局所'+status.healingCapNonlinearEvents+'件）。週間エナジー・編成順位の誤差率は未測定です。');
 if(status.unassignedMagnet>0)warnings.add('食材ゲット系スキルで抽選候補が未設定のため、ランダム食材の期待'+status.unassignedMagnet.toFixed(1)+'個は料理材料に計上していません。発見済み食材を選択してください。');
 if(Object.keys(status.skillIngredients).length)warnings.add('食材ゲット系の抽選は選択した発見済み食材に均等配分した期待値近似です。実際の抽選単位・食材の偏りは未再現です。');
 warnings.add('暫定期待値モデルです。通常のおてつだいは15分ごとの進捗を合算し、整数回完了した時だけきのみ・食材・スキル抽選を計上します。いつのまに育成は次の回収操作時に計上し、翌月曜04:00の未回収分は前週へ加算しません。げんきは10分ごとに1減るタイマーを持ち越し、回復時に減少タイマーをリセットします。速度は各10分区間のげんきに基づきます。ただし回復スキルの実発動秒・ランダム対象・食材バッグ満杯時の所持品構成・スキルと所持数の同時相関・編成時のキュー生成は近似です。旧5回クールタイム説は固定適用しません。前週からの所持品持ち越しは未対応です。');
 if(extraMode==='none')warnings.add('追加食材はOFFです。鍋の余剰容量による食材エナジーは未計上です。');
 else warnings.add('追加食材は高エナジー食材から鍋を埋める短期近似です。翌食・翌週の食材温存やレシピの自動切替は考慮しません。');
 if(successMode==='none')warnings.add('料理の大成功はOFFです。料理チャンスSの寄与も未計上です。');
 else warnings.add('大成功は平日10%・日曜30%の推定確率と料理チャンスSの期待値近似です。大成功時のスキル蓄積リセットや結果のばらつきは簡略化しています。');
 if(bagCapacity)warnings.add('食材獲得系メインスキルはバッグが満杯の間は不発動として待機ストックを保持し、次の空きがある回収時に発動します。料理チャンス上限など食材以外の発動停止条件は未再現です。');
 if(status.expectedSourceMeals>0)warnings.add('週間料理エナジーの一部は不確実な食材生産への依存を含みます（'+status.expectedSourceMeals+'食・'+Math.round(status.expectedSourceMealEnergy)+'エナジー相当）。これは食材由来の分類であり、料理成立確率・誤差率を表すものではありません。');
 if(status.estimatedMeals>0)warnings.add('料理'+status.estimatedMeals+'食は、必要食材の一部または全部を不確実な生産期待値に依存して計上しています。実際のレシピ成立確率と未成立時の食材・げんき・エナジー分岐は未計算です。');
 if(bagCapacity)warnings.add('食材バッグ満杯で所持品0から始まる場合は食材合計数と所持枠を区間内で結合計算します。共有バッグの空きが整数の場合に限り残留食材総数を確率分布で回収しますが、食材の種類別内訳・他の個体との相関・条件外は期待値近似です。');
 return {berries:status.berries,cooking:status.cooking,skills:status.skills,total:status.berries+status.cooking+status.skills,sneaky:status.sneaky,pendingSneaky,pendingExtraHelpItems,pendingExtraHelpBerryEnergy,uncollectedExtraHelpItemsAtSwap:status.uncollectedExtraHelpItemsAtSwap,uncollectedExtraHelpBerryEnergyAtSwap:status.uncollectedExtraHelpBerryEnergyAtSwap,uncollectedExtraHelpSwaps:status.uncollectedExtraHelpSwaps,healingTimerCorrelationEvents:status.healingTimerCorrelationEvents||0,healingCapNonlinearEvents:status.healingCapNonlinearEvents||0,healingCapLocalGapSum:status.healingCapLocalGapSum||0,skillTriggers:status.skillCount,skillHelpCompletions:status.skillHelpCompletions,skillEligibleHelps:status.skillEligibleHelps,exactFoodCarryCollections:status.exactFoodCarryCollections,estimatedMeals:status.estimatedMeals,initialCoveredMeals:status.initialCoveredMeals,expectedSourceMeals:status.expectedSourceMeals,expectedSourceMealEnergy:status.expectedSourceMealEnergy,initialSourceMealEnergy:status.initialSourceMealEnergy,extraHelps:status.extraHelps,stockpileResets:status.stockpileResets,stockpileExpectedLost:status.stockpileExpectedLost,stockpilePending,ingredients:status.ingredients,skillIngredients:status.skillIngredients,conditionalPlusIngredients:status.conditionalPlusIngredients,conditionalMinusRecovery:status.conditionalMinusRecovery,unassignedMagnet:status.unassignedMagnet,potBonus,successBonus,inventory,meals:status.meals,consumedIngredients:status.consumedIngredients,nightEnergy,days:daySummaries,warnings:[...warnings],models:members.size};
}
const api={cappedHealFromStock,simulate,RECIPES,FAVORITES,berryUnit,energySpeed,baseCarryCapacity,effectivePotCapacity,calculateMealEnergy,chooseRecipe,mealRecovery,cheerWeights,recoveryNatureFactor,recoverFromSleep,lunarBerryCounts,dracoBerryCounts,teamSpeciesCount,helperBoostCount,STOCKPILE_REWARDS,emptyStockpile,advanceStockpile,advanceSkillStock,expectedSkillStock,integerPocketTransitions,integerFoodPocketTransitions,collectIntegerFoodPocket,blockedIngredientSkill,advanceSkillProcStateByHelpCounts,expectedPocketOccupation,queueSneakyEnergy,releaseSneakyEnergy,weightedHelpMinutes,advanceEnergyTimer,applyEnergyRecovery,completeHelpProgress,clearDepartingHelpProgress,emptySkillProcState,advanceSkillProcState,skillProcMarginal,clearSkillProcStock,clearPartySkillStocks,clearDepartingPockets,uncollectedExtraHelpOnSwap,hasPlusMinusPartner,plusExtraIngredient,uniformExpectedHeal,uniformExpectedHealFromStock,EXCLUDED_MAIN_SKILLS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeSimulator=api;
})(typeof globalThis!=='undefined'?globalThis:this);

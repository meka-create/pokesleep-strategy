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
// Independent upstream: ChargeStrengthS.apply rounds the field-adjusted
// strength per activation; Random samples 151 uniformly spaced results,
// each individually rounded up before expected-value aggregation.
const CHARGE_RANDOM_RANGES=[[200,800],[285,1138],[393,1570],[542,2166],[748,2992],[1033,4132],[1606,6424]];
function roundedDirectStrength(raw,bonus){
 if(!Number.isFinite(raw)||raw<0||!Number.isFinite(bonus)||bonus<0||bonus>100)
  throw Error('直接エナジースキルの数値が不正です。');
 return Math.ceil(raw*(1+bonus/100));
}
function expectedRandomChargeStrength(level,bonus){
 if(!Number.isInteger(level)||level<1||level>7)throw Error('ランダムエナジースキルのレベルが不正です。');
 const [min,max]=CHARGE_RANDOM_RANGES[level-1];
 let total=0;
 for(let index=0;index<=150;index++)
  total+=roundedDirectStrength(min+(max-min)*index/150,bonus);
 return total/151;
}
function directStrengthPerActivation(skill,level,bonus){
 if(!Number.isInteger(level)||level<1||level>7||
    !Object.prototype.hasOwnProperty.call(SKILL_STRENGTH,skill))
  throw Error('直接エナジースキルの種類・レベルが不正です。');
 return skill==='Charge Strength S (Random)'?
  expectedRandomChargeStrength(level,bonus):
  roundedDirectStrength(SKILL_STRENGTH[skill][level-1],bonus);
}
// Count every implemented E4 variant that heals the ENTIRE active party,
// including the Lunar Blessing branch (which also grants berry Strength).
// Keep the R02
// comparison warning and skill calculation on the same classification.
const E4_SKILLS=new Set(['Energy for Everyone S','Energy for Everyone S (Berry Juice)','Energy for Everyone S (Lunar Blessing)']);
function isAllHealerSkill(skill){return E4_SKILLS.has(skill);}
// These skills have a non-shard, potentially strength-affecting component
// explicitly omitted by the current weekly engine. Keep the M1 evidence gate
// aligned with the omission notices in collect(), without pretending to
// calculate the missing effect or its size.
const PARTIAL_STRENGTH_SKILL_EFFECTS=Object.freeze({
 'Berry Zone (Psystrike)':'サイコブレイクのマゴのみゾーン強化',
 'Charge Energy S (Moonlight)':'つきのひかりの追加チーム回復',
 'Energizing Cheer S (Nuzzle)':'ほっぺすりすりのスキル発動可能ボーナス',
 'Ingredient Draw S (Hyper Cutter)':'かいりきバサミの条件付き追加食材'
});
function unmodeledStrengthSkillEffect(skill){
 return Object.prototype.hasOwnProperty.call(PARTIAL_STRENGTH_SKILL_EFFECTS,skill)?
  PARTIAL_STRENGTH_SKILL_EFFECTS[skill]:null;
}
// Spit Up rewards for 0..10 stockpiles, source: wiki.pokesleep.com stockpilechargestrengths.
const STOCKPILE_REWARDS=[
 [600,1020,1500,2040,2640,3300,4020,4920,6480,8880,12120],
 [853,1450,2132,2900,3753,4691,5715,6995,9213,12625,17231],
 [1177,2001,2943,4002,5179,6474,7886,9652,12712,17420,23776],
 [1625,2763,4063,5526,7151,8939,10889,13327,17552,24052,32827],
 [2243,3813,5607,7626,9869,12336,15028,18393,24225,33197,45309],
 [3099,5268,7747,10536,13635,17044,20763,25412,33469,45865,62600],
 [4502,7653,11255,15307,19809,24761,30163,36916,48621,66629,90940]
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
 // Every transition is a probability-preserving stochastic matrix.
 // Floating-point sums can drift just below 1 when the same pocket is
 // updated thousands of times. Normalize ONLY near-one mass; reject an
 // actual probability leak, which this rescale must never conceal.
 const total=dist.reduce((sum,p)=>sum+p,0);
 if(!Number.isFinite(total)||Math.abs(total-1)>1e-8)
  throw Error('スキル抽選状態の確率質量が不正です。');
 return {threshold:state.threshold,cap:state.cap,
  dist:dist.map(p=>p/total)};
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
// Game-observed short transition queue: after the ordinary pocket fills,
// up to FOUR further completed helps can still roll a Main Skill. These
// sneaky-snacking helps yield berries (not held ingredients); no later helps
// may roll until the pocket is opened. Community mechanic, not a cooldown.
// The joint key is occupiedSlots * 5 + postFullRollsUsed (0..4).
// Keep this skill eligibility distribution separate from food-kind
// expectations, whose cross-collection correlations are not resolved.
function queuedFullPocketTransitions(joint,completed,capacity,berryCount,ingredientRate,slots){
 if(Object.prototype.toString.call(joint)!=='[object Map]'||
  !Number.isInteger(completed)||completed<0||
  !Number.isInteger(capacity)||capacity<1||
  !Number.isInteger(berryCount)||berryCount<1||
  !Number.isFinite(ingredientRate)||ingredientRate<0||ingredientRate>1||
  !Array.isArray(slots)||slots.some(s=>!Number.isInteger(s.count)||s.count<1||
   typeof s.key!=='string'||!s.key))
  throw Error('満杯後スキル抽選キューの入力が不正です。');
 let mass=0;
 for(const [key,p] of joint){
  const occupied=Math.floor(key/5),used=key%5;
  if(!Number.isInteger(key)||key<0||occupied>capacity||
   !Number.isFinite(p)||p<0||used<0||used>4||
   (occupied<capacity&&used!==0))
   throw Error('満杯後スキル抽選キューの状態が不正です。');
  mass+=p;
 }
 if(Math.abs(mass-1)>1e-8)throw Error('満杯後スキル抽選キューの確率質量が不正です。');
 const width=completed+1,choices=slots.length?slots:[{key:null,count:0}];
 let current=new Map();
 for(const [key,p] of joint)if(p>0)current.set(key*width,p);
 let eligible=0;
 for(let i=0;i<completed;i++){
  const next=new Map();
  const add=(key,rolls,p)=>{
   if(p<=0)return;
   const code=key*width+rolls;
   next.set(code,(next.get(code)||0)+p);
  };
  for(const [code,p] of current){
   const key=Math.floor(code/width),rolls=code%width;
   const occupied=Math.floor(key/5),used=key%5;
   if(occupied===capacity){
    const mayRoll=used<4;
    if(mayRoll)eligible+=p;
    add(capacity*5+Math.min(4,used+1),rolls+(mayRoll?1:0),p);
    continue;
   }
   eligible+=p;
   const free=capacity-occupied;
   add((occupied+Math.min(berryCount,free))*5,rolls+1,p*(1-ingredientRate));
   for(const slot of choices)
    add((occupied+Math.min(slot.count,free))*5,rolls+1,p*ingredientRate/choices.length);
  }
  current=next;
 }
 const nextJoint=new Map(),occupation=new Map(),eligibleDistribution=new Map();
 for(const [code,p] of current){
  const key=Math.floor(code/width),rolls=code%width,occupied=Math.floor(key/5);
  nextJoint.set(key,(nextJoint.get(key)||0)+p);
  occupation.set(occupied,(occupation.get(occupied)||0)+p);
  eligibleDistribution.set(rolls,(eligibleDistribution.get(rolls)||0)+p);
 }
 return {joint:nextJoint,occupation,eligible,eligibleDistribution};
}
// Food collection is exact only in the dedicated full-bag joint branch.
// For ordinary collection with an expected retained-food count, a partially
// emptied full pocket cannot retain its hidden post-full queue covariance.
// Be conservative: do not mint four new full-state rolls on that unknown
// history. Empty pockets recover a fresh queue, and no-change collections
// preserve the exact preceding queue.
function queuedFullPocketAfterCollection(joint,oldOccupation,newOccupation,oldBerries,acceptedFood,capacity){
 if(Object.prototype.toString.call(newOccupation)!=='[object Map]')
  throw Error('満杯後キューの回収状態が不正です。');
 const oldKeys=Array.from(oldOccupation.entries()).sort((a,b)=>a[0]-b[0]);
 const newKeys=Array.from(newOccupation.entries()).sort((a,b)=>a[0]-b[0]);
 const unchanged=oldBerries<=1e-9&&acceptedFood<=1e-9&&
  JSON.stringify(oldKeys)===JSON.stringify(newKeys);
 if(unchanged)return {joint:new Map(joint),approximate:false};
 const rebuilt=new Map();
 for(const [n,p] of newOccupation){
  const key=n*5+(n===capacity?4:0);
  rebuilt.set(key,(rebuilt.get(key)||0)+p);
 }
 const hasFullMass=newKeys.some(([n,p])=>n===capacity&&p>1e-9);
 return {joint:rebuilt,approximate:hasFullMass};
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
// Exact SINGLE-POKEMON joint state for the narrow full-global-food-bag
// scenario. Correlate ordinary occupied items, retained FOOD item count,
// and the 0..4 post-full skill-roll queue. Unlike two separate marginals,
// collecting a branch with only food must not accidentally exhaust/reset a
// queue merely because some OTHER branches contained collected berries.
// Encoding ((occupied*(capacity+1)+food)*5+queueUsed).
function integerFoodSkillQueueTransitions(joint,completed,capacity,berryCount,ingredientRate,slots){
 if(Object.prototype.toString.call(joint)!=='[object Map]'||
  !Number.isInteger(completed)||completed<0||!Number.isInteger(capacity)||capacity<1||
  !Number.isInteger(berryCount)||berryCount<1||
  !Number.isFinite(ingredientRate)||ingredientRate<0||ingredientRate>1||
  !Array.isArray(slots)||slots.some(s=>!Number.isInteger(s.count)||s.count<1||
   typeof s.key!=='string'||!s.key))
  throw Error('食材・満杯後抽選の結合遷移入力が不正です。');
 const base=capacity+1,choices=slots.length?slots:[{key:null,count:0}];
 const decode=key=>{
  const used=key%5,unscaled=Math.floor(key/5);
  return {occupied:Math.floor(unscaled/base),food:unscaled%base,used};
 };
 const encode=(occupied,food,used)=>(occupied*base+food)*5+used;
 let mass=0,distribution=new Map(joint);
 for(const [key,p] of distribution){
  if(!Number.isSafeInteger(key)||key<0||!Number.isFinite(p)||p<0)
   throw Error('食材・満杯後抽選の結合確率状態が不正です。');
  const {occupied,food,used}=decode(key);
  if(occupied>capacity||food>occupied||(occupied<capacity&&used!==0))
   throw Error('食材・満杯後抽選の結合確率状態が不正です。');
  mass+=p;
 }
 if(Math.abs(mass-1)>1e-8)throw Error('食材・満杯後抽選の確率質量が不正です。');
 const width=completed+1;
 let current=new Map();
 for(const [key,p] of distribution)if(p>0)current.set(key*width,p);
 let eligible=0,berry=0,sneaky=0;
 const foods={};
 for(let i=0;i<completed;i++){
  const next=new Map();
  const add=(key,rolls,p)=>{
   if(p<=0)return;
   const code=key*width+rolls;
   next.set(code,(next.get(code)||0)+p);
  };
  for(const [code,p] of current){
   const key=Math.floor(code/width),rolls=code%width;
   const {occupied,food,used}=decode(key);
   if(occupied===capacity){
    const canRoll=used<4;
    if(canRoll)eligible+=p;
    add(encode(capacity,food,Math.min(4,used+1)),rolls+(canRoll?1:0),p);
    sneaky+=p*berryCount;
    continue;
   }
   eligible+=p;
   const free=capacity-occupied,keptBerry=Math.min(berryCount,free);
   const bChance=p*(1-ingredientRate);
   add(encode(occupied+keptBerry,food,0),rolls+1,bChance);
   berry+=bChance*keptBerry;
   sneaky+=bChance*(berryCount-keptBerry);
   for(const slot of choices){
    const chance=p*ingredientRate/choices.length;
    const kept=Math.min(slot.count,free);
    add(encode(occupied+kept,food+kept,0),rolls+1,chance);
    if(slot.key&&kept>0)foods[slot.key]=(foods[slot.key]||0)+chance*kept;
   }
  }
  current=next;
 }
 const nextJoint=new Map(),foodJoint=new Map(),fullSkillQueue=new Map(),
  occupation=new Map(),eligibleDistribution=new Map();
 for(const [code,p] of current){
  const key=Math.floor(code/width),rolls=code%width;
  const {occupied,food,used}=decode(key);
  nextJoint.set(key,(nextJoint.get(key)||0)+p);
  const foodKey=occupied*base+food,queueKey=occupied*5+used;
  foodJoint.set(foodKey,(foodJoint.get(foodKey)||0)+p);
  fullSkillQueue.set(queueKey,(fullSkillQueue.get(queueKey)||0)+p);
  occupation.set(occupied,(occupation.get(occupied)||0)+p);
  eligibleDistribution.set(rolls,(eligibleDistribution.get(rolls)||0)+p);
 }
 const used=Array.from(occupation,([n,p])=>n*p).reduce((a,b)=>a+b,0);
 return {queueFoodJoint:nextJoint,foodJoint,fullSkillQueue,occupation,used,
  berries:berry,sneaky,ingredients:foods,eligible,eligibleDistribution};
}
function collectIntegerFoodSkillQueue(joint,capacity,free){
 if(Object.prototype.toString.call(joint)!=='[object Map]'||
  !Number.isInteger(capacity)||capacity<1||
  !Number.isInteger(free)||free<0)
  throw Error('食材・満杯後キューの同時回収入力が不正です。');
 const base=capacity+1,retained=new Map();
 let mass=0,accepted=0,remaining=0;
 for(const [key,p] of joint){
  if(!Number.isSafeInteger(key)||key<0||!Number.isFinite(p)||p<0)
   throw Error('食材・満杯後キューの同時回収状態が不正です。');
  const used=key%5,x=Math.floor(key/5);
  const occupied=Math.floor(x/base),food=x%base;
  if(occupied>capacity||food>occupied||(occupied<capacity&&used!==0))
   throw Error('食材・満杯後キューの同時回収状態が不正です。');
  mass+=p;
  if(p===0)continue;
  const received=Math.min(food,free),left=food-received;
  accepted+=p*received;remaining+=p*left;
  // The tap collects every berry. Only food items that could not enter
  // the shared bag remain, and a not-full pocket resets the skill queue.
  const next=(left*base+left)*5+(left===capacity?used:0);
  retained.set(next,(retained.get(next)||0)+p);
 }
 if(Math.abs(mass-1)>1e-8)
  throw Error('食材・満杯後キューの回収確率質量が不正です。');
 const foodJoint=new Map(),fullSkillQueue=new Map(),occupation=new Map();
 for(const [key,p] of retained){
  const used=key%5,x=Math.floor(key/5);
  const occupied=Math.floor(x/base),food=x%base;
  const fk=occupied*base+food,qk=occupied*5+used;
  foodJoint.set(fk,(foodJoint.get(fk)||0)+p);
  fullSkillQueue.set(qk,(fullSkillQueue.get(qk)||0)+p);
  occupation.set(occupied,(occupation.get(occupied)||0)+p);
 }
 return {accepted,remaining,queueFoodJoint:retained,foodJoint,fullSkillQueue,occupation};
}
// Bounded shared-bag PICKUP oracle for multiple independently tracked
// Pokemon pockets. Every world has the SAME finite integer bag capacity;
// sequentially replacing the free space by its MEAN can invent food slots.
// For each pocket preserve its marginal (held food, occupied slots, queue
// usage) after pickup. This is exact for a single tap conditional on
// independent INPUT pockets and integer free slots, not for whole-week
// correlations or ingredient species.
function collectSharedBagFoodQueues(pockets,free){
 if(!Array.isArray(pockets)||pockets.length<1||pockets.length>5||
    !Number.isSafeInteger(free)||free<0)
  throw Error('複数個体の共有バッグ回収入力が不正です。');
 const seen=new Set();
 let remainingFree=new Map([[free,1]]);
 const results=[];
 for(const entry of pockets){
  if(!entry||typeof entry.id!=='string'||!entry.id||seen.has(entry.id)||
     !Number.isInteger(entry.capacity)||entry.capacity<1||
     Object.prototype.toString.call(entry.joint)!=='[object Map]')
   throw Error('複数個体の共有バッグ回収入力が不正です。');
  seen.add(entry.id);
  // Validate the joint probability on every path (also when free = 0).
  collectIntegerFoodSkillQueue(entry.joint,entry.capacity,0);
  const base=entry.capacity+1,nextFree=new Map(),retained=new Map();
  let accepted=0,remaining=0;
  for(const [space,spaceP] of remainingFree){
   for(const [key,p] of entry.joint){
    if(p===0||spaceP===0)continue;
    const prob=spaceP*p;
    const used=key%5,unscaled=Math.floor(key/5);
    const heldFood=unscaled%base;
    const got=Math.min(heldFood,space),left=heldFood-got;
    accepted+=prob*got;
    remaining+=prob*left;
    nextFree.set(space-got,(nextFree.get(space-got)||0)+prob);
    const newKey=(left*base+left)*5+(left===entry.capacity?used:0);
    retained.set(newKey,(retained.get(newKey)||0)+prob);
   }
  }
  const foodJoint=new Map(),fullSkillQueue=new Map(),occupation=new Map();
  for(const [key,p] of retained){
   const used=key%5,unscaled=Math.floor(key/5);
   const count=Math.floor(unscaled/base),food=unscaled%base;
   const fk=count*base+food,qk=count*5+used;
   foodJoint.set(fk,(foodJoint.get(fk)||0)+p);
   fullSkillQueue.set(qk,(fullSkillQueue.get(qk)||0)+p);
   occupation.set(count,(occupation.get(count)||0)+p);
  }
  const sum=m=>Array.from(m.values()).reduce((a,b)=>a+b,0);
  if(Math.abs(sum(retained)-1)>1e-8||Math.abs(sum(nextFree)-1)>1e-8)
   throw Error('複数個体の共有バッグ回収の確率質量が不正です。');
  remainingFree=nextFree;
  results.push({id:entry.id,accepted,remaining,queueFoodJoint:retained,
   foodJoint,fullSkillQueue,occupation,freeBefore:new Map(remainingFree)});
 }
 const expectedFree=Array.from(remainingFree,([n,p])=>n*p).reduce((a,b)=>a+b,0);
 const accepted=results.reduce((a,b)=>a+b.accepted,0);
 if(Math.abs(accepted+expectedFree-free)>1e-7)
  throw Error('複数個体の共有バッグ回収の保存則が不正です。');
 return {results,freeDistribution:remainingFree,accepted,expectedFree};
}
// One completed help from an empty pocket has mutually exclusive ingredient
// outcomes. Proportional redistribution of expected HELD units across kinds
// is wrong when those outcomes have different counts and pickup is capacity-
// limited: choosing 3 apples OR 1 milk at 50/50, free=1, means .5/.5,
// not proportional .75/.25. This is exact for one ordinary help conditional
// on a supplied integer free-slot distribution; it does NOT pretend that
// species choices or bag space are independent across an entire week.
function collectOneHelpIngredientKinds(ingredientRate,slots,carry,freeDistribution){
 if(!Number.isFinite(ingredientRate)||ingredientRate<0||ingredientRate>1||
  !Array.isArray(slots)||!slots.length||slots.some(x=>!x||
   typeof x.key!=='string'||!x.key||!Number.isSafeInteger(x.count)||x.count<1)||
  !Number.isSafeInteger(carry)||carry<1||
  Object.prototype.toString.call(freeDistribution)!=='[object Map]'||
  freeDistribution.size===0)
  throw Error('単一おてつだい食材種類の分岐入力が不正です。');
 let mass=0;
 for(const [free,p] of freeDistribution){
  if(!Number.isSafeInteger(free)||free<0||!Number.isFinite(p)||p<0)
   throw Error('単一おてつだい食材種類の空き枠確率が不正です。');
  mass+=p;
 }
 if(Math.abs(mass-1)>1e-8)
  throw Error('単一おてつだい食材種類の確率質量が不正です。');
 const accepted={},retained={};
 let totalAccepted=0,totalRetained=0;
 for(const slot of slots){
  const held=Math.min(slot.count,carry),chance=ingredientRate/slots.length;
  const received=Array.from(freeDistribution,([free,p])=>
   chance*p*Math.min(held,free)).reduce((a,b)=>a+b,0);
  const leftover=chance*held-received;
  accepted[slot.key]=(accepted[slot.key]||0)+received;
  retained[slot.key]=(retained[slot.key]||0)+leftover;
  totalAccepted+=received;totalRetained+=leftover;
 }
 return {accepted,retained,totalAccepted,totalRetained};
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
function emptyPocket(){return {used:0,berries:0,ingredients:{},skillState:[1,0,0],pendingSneaky:0,occupation:new Map([[0,1]]),fullSkillQueue:new Map([[0,1]])};}
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
// A collected skill stock is a discrete 0/1/2 activation distribution.
// Stockpile rewards and the next stack state depend on activation order, so
// advancing by E[activations] is not equivalent to averaging complete paths.
// This is exact CONDITIONAL on the existing marginal stock distribution and
// independent current stockpile state; cross-tap correlations remain modeled
// approximately by the weekly simulator.
function advanceStockpileByReadyStock(state,readyStock,level){
 if(!Array.isArray(state)||state.length!==11||
   state.some(p=>!Number.isFinite(p)||p<0)||
   Math.abs(state.reduce((a,b)=>a+b,0)-1)>1e-8||
   !Array.isArray(readyStock)||![2,3].includes(readyStock.length)||
   readyStock.some(p=>!Number.isFinite(p)||p<0)||
   Math.abs(readyStock.reduce((a,b)=>a+b,0)-1)>1e-8)
  throw Error('たくわえるの待機ストック分布が不正です。蓄積質量='+state.reduce((a,b)=>a+b,0)+'、待機質量='+readyStock.reduce((a,b)=>a+b,0)+'、蓄積最小値='+Math.min(...state)+'、待機最小値='+Math.min(...readyStock));
 const result=new Array(11).fill(0);
 let earned=0;
 for(let count=0;count<readyStock.length;count++){
  const probability=readyStock[count];
  if(probability===0)continue;
  let branch=state.slice(),reward=0;
  for(let i=0;i<count;i++){
   const step=stockpileStep(branch,level);
   branch=step.state;reward+=step.earned;
  }
  earned+=probability*reward;
  for(let i=0;i<result.length;i++)result[i]+=probability*branch[i];
 }
 // Prevent a per-tap floating-point loss of ~1e-10 from accumulating into
 // a false stockpile state after hundreds of collections. The inputs above
 // are still subject to the strict 1e-8 distribution-mass validation.
 const total=result.reduce((sum,p)=>sum+p,0);
 if(!Number.isFinite(total)||Math.abs(total-1)>1e-8)
  throw Error('たくわえるの遷移後の確率質量が不正です。');
 return {state:result.map(p=>p/total),earned};
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
// Share the exact food-reward skills requiring a discovered ingredient pool
// with the M1 evidence gate, so skill lists cannot drift independently.
function needsMagnetIngredientPool(skill){return Object.prototype.hasOwnProperty.call(INGREDIENT_MAGNET,skill);}
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
// Preserve the last successful meal's reset history instead of replacing it
// with a mean bonus. Skill increments remain the weekly model's expected
// increments, NOT a distribution of actual skill activations. At most one
// new state per cooked meal (22 in a 21-meal week); grants do not branch.
function readTastyChanceState(state){
 if(Object.prototype.toString.call(state)!=='[object Map]'||!state.size)
  throw Error('料理チャンスの確率状態が不正です。');
 let mass=0;
 for(const [bonus,p] of state){
  if(!Number.isFinite(bonus)||bonus<0||bonus>.7||!Number.isFinite(p)||p<0||p>1+1e-8)
   throw Error('料理チャンスの確率状態が不正です。');
  mass+=p;
 }
 if(Math.abs(mass-1)>1e-8)throw Error('料理チャンスの確率質量が不正です。');
}
function addTastyChanceBonus(state,increment){
 readTastyChanceState(state);
 if(!Number.isFinite(increment)||increment<0)throw Error('料理チャンスの追加量が不正です。');
 const next=new Map();
 for(const [bonus,p] of state){
  if(!p)continue;
  const value=Math.min(.7,bonus+increment);
  next.set(value,(next.get(value)||0)+p);
 }
 return next;
}
function resolveTastyChanceMeal(state,baseProbability){
 readTastyChanceState(state);
 if(!Number.isFinite(baseProbability)||baseProbability<0||baseProbability>1)
  throw Error('料理大成功の基礎確率が不正です。');
 const next=new Map();let successProbability=0;
 for(const [bonus,p] of state){
  const chance=Math.min(1,baseProbability+bonus),failed=p*(1-chance);
  successProbability+=p*chance;
  if(failed>0)next.set(bonus,(next.get(bonus)||0)+failed);
 }
 if(successProbability>0)next.set(0,(next.get(0)||0)+successProbability);
 return {distribution:next,successProbability:clamp(successProbability,0,1)};
}
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
// Reference: pokesleep-tool EnergizingCheerHealPulse.ts calls
// addEnergizingCheer twice, removing the FIRST target for the second roll.
// Each roll uses 65% lowest-Energy/35% uniform selection on its current pool.
// Enumerate all 5x4 ORDERED branches for one activation, including the first
// heal before choosing the second. Weekly proc counts still use expectations;
// this is not a week-long joint Energy/stock/extra-help distribution.
function healPulseRecipientExpectation(teamIds,energy,heal,natureFactors){
 if(!Array.isArray(teamIds)||teamIds.length!==5||new Set(teamIds).size!==5||
    Object.prototype.toString.call(energy)!=='[object Map]'||
    Object.prototype.toString.call(natureFactors)!=='[object Map]'||
    !Number.isFinite(heal)||heal<0||
    teamIds.some(id=>!Number.isFinite(energy.get(id))||energy.get(id)<0||
     energy.get(id)>150||!Number.isFinite(natureFactors.get(id))||
     natureFactors.get(id)<=0||natureFactors.get(id)>2))
  throw Error('いやしのはどうの回復対象分布が不正です。');
 const recipientCounts=new Map(teamIds.map(id=>[id,0]));
 const expectedAfter=new Map(teamIds.map(id=>[id,0]));
 const firstWeights=cheerWeights(teamIds,energy);
 let mass=0;
 for(const first of teamIds){
  const afterFirst=new Map(energy);
  afterFirst.set(first,Math.min(150,energy.get(first)+heal*natureFactors.get(first)));
  const remaining=teamIds.filter(id=>id!==first);
  const secondWeights=cheerWeights(remaining,afterFirst);
  for(const second of remaining){
   const p=firstWeights.get(first)*secondWeights.get(second);
   mass+=p;
   const secondRecovery=Math.min(150,afterFirst.get(second)+heal*natureFactors.get(second));
   for(const id of teamIds){
    expectedAfter.set(id,expectedAfter.get(id)+p*(id===second?secondRecovery:afterFirst.get(id)));
    if(id===first||id===second)
     recipientCounts.set(id,recipientCounts.get(id)+p);
   }
  }
 }
 if(Math.abs(mass-1)>1e-10)throw Error('いやしのはどうの対象確率質量が一致しません。');
 return {recipientCounts,expectedAfter,probabilityMass:mass};
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
// Keep the existing 15-minute integration grid, splitting it at every
// requested tap. Checking only grid coincidences silently loses e.g. 121m taps.
function daytimeSchedule(tapMinutes){
 if(!Number.isSafeInteger(tapMinutes)||tapMinutes<120||tapMinutes>180)
  throw Error('回収間隔は120〜180分の整数で指定してください。');
 const boundaries=new Set(),taps=new Set();
 for(let minute=450;minute<=1440;minute+=15)boundaries.add(minute);
 for(let minute=450+tapMinutes;minute<1440;minute+=tapMinutes){
  boundaries.add(minute);taps.add(minute);
 }
 const times=[...boundaries].sort((a,b)=>a-b);
 return times.slice(0,-1).map((minute,i)=>({minute,duration:times[i+1]-minute,tap:taps.has(minute)}));
}
// W1: explicitly normalize all 21 daytime and 7 night slots before computing.
// Omitting both weekly arrays is the precise legacy 3-day-slot + fixed-sleep
// model. A weekly input is all-or-nothing; malformed days must never fall
// back silently to another team's five IDs.
function normalizeWeeklyTeams(input){
 if(!input||!Array.isArray(input.box))throw Error('ボックスがありません。');
 const ids=new Set(input.box.map(p=>p.id));
 const base=input.teams||{},dayKeys=['morning','noon','evening'];
 const hasDay=input.teamsByDay!==undefined,hasSleep=input.sleepTeamsByDay!==undefined;
 const valid=(team,label)=>{
  if(!Array.isArray(team)||team.length!==5||new Set(team).size!==5||
   team.some(id=>typeof id!=='string'||!ids.has(id)))
   throw Error(label+'の5匹パーティが不正です。');
  return [...team];
 };
 if(hasDay&&(!Array.isArray(input.teamsByDay)||input.teamsByDay.length!==7))
  throw Error('曜日別の日中パーティは月曜～日曜の7日分を指定してください。');
 if(hasSleep&&(!Array.isArray(input.sleepTeamsByDay)||input.sleepTeamsByDay.length!==7))
  throw Error('曜日別の睡眠パーティは月曜夜～日曜夜の7回分を指定してください。');
 const fixedDay=hasDay?null:Object.fromEntries(dayKeys.map(key=>
  [key,valid(base[key],'日中'+key)]));
 const fixedSleep=hasSleep?null:valid(base.sleep,'睡眠');
 const days=Array.from({length:7},(_,d)=>{
  const raw=hasDay?input.teamsByDay[d]:fixedDay;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
   throw Error((d+1)+'日目の曜日別パーティが不正です。');
  const row={};
  for(const key of dayKeys)row[key]=hasDay?valid(raw[key],(d+1)+'日目'+key):[...raw[key]];
  row.sleep=hasSleep?valid(input.sleepTeamsByDay[d],(d+1)+'日目の睡眠'):[...fixedSleep];
  return row;
 });
 return {days,hasDay,hasSleep};
}
function simulate(input){
 const weekly=normalizeWeeklyTeams(input);
 const byId=new Map(input.box.map(p=>[p.id,p]));
 const teams=input.teams||{};
 const periods=['morning','noon','evening','sleep'];
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
 const members=new Map(), energy=new Map(),pocket=new Map(),extraPocket=new Map(),status={berries:0,skills:0,cooking:0,sneaky:0,directStrengthRoundingCorrection:0,ingredients:{},skillIngredients:{},unassignedMagnet:0,days:[],skillCount:0,extraHelps:0,stockpileResets:0,stockpileExpectedLost:0,conditionalPlusIngredients:0,conditionalMinusRecovery:0,skillHelpCompletions:0,skillEligibleHelps:0,exactFoodCarryCollections:0,exactSharedBagCollections:0,exactOneHelpKindCollections:0,uncollectedExtraHelpItemsAtSwap:0,uncollectedExtraHelpBerryEnergyAtSwap:0,uncollectedExtraHelpSwaps:0,meals:[],potDependentMeals:0,estimatedMeals:0,initialCoveredMeals:0,expectedSourceMeals:0,expectedSourceMealEnergy:0,initialSourceMealEnergy:0,consumedIngredients:{}};
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
  teams[period].filter(id=>isAllHealerSkill(members.get(id)?.sp?.skill)).length>=2);
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
 let potBonus=0,tastyChanceState=new Map([[0,1]]);
 const grantTastyChance=increment=>{
  tastyChanceState=addTastyChanceBonus(tastyChanceState,increment);
  if(increment>0)warnings.add('料理チャンスの大成功後リセットは分岐ごとに計算します。スキルの加算量は発動期待値のままで、実際の抽選・上限時の待機ストックとの相関は未検証です。');
 };
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
  // Enable the exact single-tap shared-bag allocation only when all five
  // ordinary pockets have a tracked joint state, initial free space is an
  // INTEGER, no EXTRA food is pending, and no member's skill can insert
  // ingredients before another member is collected. Other taps retain the
  // existing explicitly approximate sequential model.
  const initialFree=bagCapacity?bagCapacity-bagUsed():NaN;
  const safeGroup=bagCapacity>0&&Number.isSafeInteger(initialFree)&&
   initialFree>=0&&teamIds.every(id=>{
    const pair=members.get(id),bag=pocket.get(id),extra=extraPocket.get(id);
    if(!pair||!bag?.queueFoodJoint||!extra)return false;
    const skill=pair.sp.skill;
    if(INGREDIENT_MAGNET[skill]||['Ingredient Draw S',
      'Ingredient Draw S (Super Luck)','Ingredient Draw S (Hyper Cutter)'].includes(skill))
     return false;
    return Object.values(extra.ingredients||{}).every(n=>Math.abs(n)<1e-9);
   });
  const sharedPlan=safeGroup?new Map(collectSharedBagFoodQueues(
   teamIds.map(id=>{
    const pair=members.get(id);
    return {id,joint:pocket.get(id).queueFoodJoint,
      capacity:signature(pair.p,pair.sp,teamIds.map(who=>members.get(who).p),
       !!opts.camp,warnings).carry};
   }),initialFree).results.map(x=>[x.id,x])):null;
  if(sharedPlan){
   status.exactSharedBagCollections++;
   warnings.add('複数個体の食材バッグ回収は今回の操作内で整数空きを分岐計算しました。個体間の過去の相関・食材種類の分布は未検証です。');
  }
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
   let exactFood=sharedPlan?.get(id)||null,standardFood;
   const oneHelpKinds=bag.oneHelpFood&&bagCapacity&&
     (exactFood?.freeBefore||Number.isSafeInteger(available))?
      collectOneHelpIngredientKinds(bag.oneHelpFood.rate,bag.oneHelpFood.slots,
       bag.oneHelpFood.carry,exactFood?.freeBefore||new Map([[available,1]])):null;
   if(oneHelpKinds)status.exactOneHelpKindCollections++;
   if(exactFood||(bag.foodJoint&&bagCapacity&&Number.isInteger(available))){
    if(!exactFood)exactFood=bag.queueFoodJoint?
      collectIntegerFoodSkillQueue(bag.queueFoodJoint,carry,available):
      collectIntegerFoodPocket(bag.foodJoint,carry,available);
    const total=Object.values(bag.ingredients).reduce((a,n)=>a+n,0);
    if(oneHelpKinds&&Math.abs(oneHelpKinds.totalAccepted-exactFood.accepted)>1e-7)
     throw Error('単一おてつだい食材種類と所持数分岐の回収量が一致しません。');
    const retained={};
    for(const [key,v] of Object.entries(bag.ingredients)){
     // Only the exactly-one-help case has a justified type-by-type pickup.
     // For multiple helps the conditional type state is NOT retained yet.
     const picked=oneHelpKinds?(oneHelpKinds.accepted[key]||0):
      total>0?exactFood.accepted*v/total:0;
     if(picked>0){inventory[key]=(inventory[key]||0)+picked;status.ingredients[key]=(status.ingredients[key]||0)+picked;}
     if(v-picked>1e-9)retained[key]=v-picked;
    }
    standardFood={retained,retainedCount:exactFood.remaining};
    status.exactFoodCarryCollections++;
   }else if(oneHelpKinds){
    const retained={};
    for(const [key,v] of Object.entries(bag.ingredients)){
     const picked=oneHelpKinds.accepted[key]||0;
     if(picked>0){inventory[key]=(inventory[key]||0)+picked;status.ingredients[key]=(status.ingredients[key]||0)+picked;}
     if(v-picked>1e-9)retained[key]=v-picked;
    }
    standardFood={retained,retainedCount:oneHelpKinds.totalRetained};
   }else standardFood=receiveFood(bag);
   const extraFood=receiveFood(extraBag);
   const remainingInPocket=standardFood.retained,uncollected=standardFood.retainedCount;
   const ownSkillQueue=exactFood?.fullSkillQueue?
    {joint:exactFood.fullSkillQueue,approximate:false}:
    queuedFullPocketAfterCollection(
    bag.fullSkillQueue||new Map([[0,1]]),bag.occupation,
    exactFood?exactFood.occupation:expectedPocketOccupation(uncollected,
      signature(pair.p,pair.sp,teamIds.map(i=>members.get(i)).filter(Boolean).map(x=>x.p),!!opts.camp,warnings).carry),
    bag.berries,bag.used-uncollected,signature(pair.p,pair.sp,
      teamIds.map(i=>members.get(i)).filter(Boolean).map(x=>x.p),!!opts.camp,warnings).carry);
   if(ownSkillQueue.approximate)
    warnings.add('所持枠が満杯のまま一部回収されると、最大4回の追加スキル抽選キューと食材の相関を再構成できません。以後の満杯状態は保守的に抽選済みとして扱います。');
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
    const update=advanceStockpileByReadyStock(current,triggerState?skillProcMarginal(triggerState):[1,0],pair.p.skillLevel);
    stockpileStates.set(id,update.state);
    status.skills+=update.earned*(1+bonus/100);
    warnings.add('たくわえるは蓄積0回から開始し、交代時リセット・週末未放出を反映した状態確率モデルです。25%放出は実測推定、発動回数と抽選は期待値近似です。');
   }
   else if(actual==='Berry Zone (Psystrike)'){
    const raw=PSYSTRIKE_STRENGTH[clamp(pair.p.skillLevel-1,0,5)];
    const legacy=raw*(1+bonus/100),current=roundedDirectStrength(raw,bonus);
    status.skills+=triggers*current;
    status.directStrengthRoundingCorrection+=triggers*(current-legacy);
    warnings.add('サイコブレイクのマゴのみゾーン強化（発動ごと+0.6～2.0%）は未計上です。直接エナジーのみ反映しました。');
   }
   else if(SKILL_STRENGTH[actual]){
    const levels=SKILL_STRENGTH[actual];
    const level=clamp(pair.p.skillLevel,1,levels.length);
    const legacy=levels[level-1]*(1+bonus/100),current=directStrengthPerActivation(actual,level,bonus);
    status.skills+=triggers*current;
    status.directStrengthRoundingCorrection+=triggers*(current-legacy);
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
    const factors=new Map(teamIds.map(who=>
     [who,recoveryNatureFactor(byId.get(who).nature)]));
    const targets=healPulseRecipientExpectation(teamIds,energy,heal,factors);
    for(const who of teamIds){
     const before=energy.get(who);
     const delta=Math.max(0,targets.expectedAfter.get(who)-before);
     applyEnergyRecovery(energy,energyDecayTimers,who,clamp(before+triggers*delta,0,150));
     giveHelps(who,helps*targets.recipientCounts.get(who));
    }
    warnings.add('いやしのはどうは最低げんき優先65%／全員均等35%で1匹目を選び、その個体を除いた残り4匹から2匹目を選ぶ1回発動分の期待値です。週間での発動時刻・げんき・追加おてつだいの相関は未検証です。');
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
   else if(isAllHealerSkill(actual)){const r=HEAL_ALL[clamp(pair.p.skillLevel-1,0,HEAL_ALL.length-1)];
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
    if(successMode==='expected')grantTastyChance(triggers*TASTY_CHANCE[clamp(pair.p.skillLevel-1,0,5)]/100);
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
      grantTastyChance(triggers*chanceAmounts[clamp(pair.p.skillLevel-1,0,6)]/100);
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
     foodJoint:exactFood?exactFood.foodJoint:undefined,
     queueFoodJoint:exactFood?exactFood.queueFoodJoint:undefined,
     fullSkillQueue:ownSkillQueue.joint});
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
    // Keep the ORIGINAL mutually exclusive ingredient-kind outcome for
    // exactly one help from an empty pocket, even in the normal (not-full)
    // shared bag path. A second help invalidates this one-event shortcut.
    if(remaining>0){
     const empty=bag.occupation.size===1&&bag.occupation.get(0)===1;
     bag.oneHelpFood=remaining===1&&empty&&x.ingSlots.length?
      {rate:x.ingRate,slots:x.ingSlots.map(slot=>({...slot})),carry:x.carry}:undefined;
    }
    // Begin exact food-total tracking only when the shared bag is already
    // full and this Pokemon starts with an empty pocket. Other situations
    // retain the v0.2.23 marginal model rather than reconstruct correlations.
    if(!bag.foodJoint&&bagCapacity&&bagUsed()>=bagCapacity-1e-9&&
      bag.occupation.size===1&&bag.occupation.get(0)===1&&
      x.ingRate>0&&x.ingSlots.length>0){
     bag.foodJoint=new Map([[0,1]]);
     if(bag.fullSkillQueue?.size===1&&bag.fullSkillQueue.get(0)===1)
      bag.queueFoodJoint=new Map([[0,1]]);
    }
    const outcome=bag.queueFoodJoint?
      integerFoodSkillQueueTransitions(bag.queueFoodJoint,remaining,x.carry,x.berryPerHelp,x.ingRate,x.ingSlots):
      bag.foodJoint?
       integerFoodPocketTransitions(bag.foodJoint,remaining,x.carry,x.berryPerHelp,x.ingRate,x.ingSlots):
       integerPocketTransitions(bag.occupation,remaining,x.carry,x.berryPerHelp,x.ingRate,x.ingSlots);
    const queued=bag.queueFoodJoint?
      {joint:outcome.fullSkillQueue,occupation:outcome.occupation,
       eligible:outcome.eligible,eligibleDistribution:outcome.eligibleDistribution}:
      queuedFullPocketTransitions(bag.fullSkillQueue||new Map([[0,1]]),
       remaining,x.carry,x.berryPerHelp,x.ingRate,x.ingSlots);
    bag.fullSkillQueue=queued.joint;
    if(Array.from(queued.occupation).some(([count,p])=>
      Math.abs(p-(outcome.occupation.get(count)||0))>1e-7))
     throw Error('満杯後キューと所持数確率の計算が一致しません。');
    if(bag.foodJoint)bag.foodJoint=outcome.foodJoint;
    if(bag.queueFoodJoint)bag.queueFoodJoint=outcome.queueFoodJoint;
    bag.occupation=outcome.occupation;
    bag.used=outcome.used;
    bag.berries+=outcome.berries;
    for(const [key,value] of Object.entries(outcome.ingredients))
     bag.ingredients[key]=(bag.ingredients[key]||0)+value;
    queueSneakyEnergy(bag,outcome.sneaky*berryUnit(pair.sp.type,pair.p.level,favorite,bonus));
    if(!EXCLUDED_MAIN_SKILLS.has(pair.sp.skill)){
     status.skillEligibleHelps+=queued.eligible;
     if(queued.eligible>0){
      const previous=skillProcStates.get(id)||emptySkillProcState(x.pity,x.stockMax);
      skillProcStates.set(id,advanceSkillProcStateByHelpCounts(previous,queued.eligibleDistribution,x.skillRate));
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
   // Compare the selected plan with the pot available WITHOUT random skill
   // expansion. This is dependency attribution, never a success probability.
   const basePotCapacity=effectivePotCapacity(pot,0,day,!!opts.camp);
   const withoutPotSkill=chooseRecipe({mode:recipeMode,preferredId:opts.recipeId||'',foodMode:opts.foodMode,inventory,potCapacity:basePotCapacity});
   const recipeDependsOnPotSkill=withoutPotSkill?.id!==chosen.id;
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
   const potDependent=recipeDependsOnPotSkill||mandatoryCount+extraCount>basePotCapacity;
   if(potDependent)status.potDependentMeals++;
   const tastyMeal=successMode==='expected'?resolveTastyChanceMeal(tastyChanceState,day===6?.3:.1):null;
   const greatChance=tastyMeal?tastyMeal.successProbability:0;
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
     potDependent,recipeDependsOnPotSkill,basePotCapacity,potCapacity:capacity,usedPotBonus:potBonus});
   if(tastyMeal)tastyChanceState=tastyMeal.distribution;
   // Cooking restores a small amount of energy to the current on-field party.
   for(const id of teamIds)applyEnergyRecovery(energy,energyDecayTimers,id,clamp(energy.get(id)+mealRecovery(energy.get(id)),0,150));
   potBonus=0;
   return value;
 }
 const daySummaries=[],nightEnergy=[],daySchedule=daytimeSchedule(tapMinutes);
 
 for(let d=0;d<7;d++){
  const before={berries:status.berries,cooking:status.cooking,skills:status.skills,sneaky:status.sneaky};
  let current=null;
  for(const step of daySchedule){
    const t=step.minute/60;
    const key=t<12?'morning':t<18?'noon':'evening',ids=teams[key];
    if(current!==key){
      if(current)collect(teams[current]);
      resetStockpileLeaving(current?teams[current]:d===0?[]:teams.sleep,ids);
      current=key;collect(ids);
      if([7.5,12,18].includes(t))cook(d,t===7.5?'朝':t===12?'昼':'夜',ids);
    }
    if(step.tap)collect(ids);
    tickActive(ids,step.duration,!!opts.camp,true);
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
 const successBonus=Array.from(tastyChanceState,([bonus,p])=>bonus*p).reduce((a,b)=>a+b,0);
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
 if(status.potDependentMeals>0)warnings.add('料理'+status.potDependentMeals+'食のレシピ選択または追加食材量がスキル期待値による鍋拡張に依存します。初期食材が十分でも、実際の発動・料理成立・げんき回復の分岐は未検証です。');
 if(status.estimatedMeals>0)warnings.add('料理'+status.estimatedMeals+'食は、必要食材の一部または全部を不確実な生産期待値に依存して計上しています。実際のレシピ成立確率と未成立時の食材・げんき・エナジー分岐は未計算です。');
 if(bagCapacity)warnings.add('食材バッグ満杯で所持品0から始まる場合は食材合計数と所持枠を区間内で結合計算します。共有バッグの空きが整数の場合に限り残留食材総数を確率分布で回収しますが、食材の種類別内訳・他個体との過去の相関・条件外は期待値近似です。限定条件では単一回収内の共有バッグ空きと最大5匹の食材総数を整数分岐します。');
 return {berries:status.berries,cooking:status.cooking,skills:status.skills,directStrengthRoundingCorrection:status.directStrengthRoundingCorrection,total:status.berries+status.cooking+status.skills,sneaky:status.sneaky,pendingSneaky,pendingExtraHelpItems,pendingExtraHelpBerryEnergy,uncollectedExtraHelpItemsAtSwap:status.uncollectedExtraHelpItemsAtSwap,uncollectedExtraHelpBerryEnergyAtSwap:status.uncollectedExtraHelpBerryEnergyAtSwap,uncollectedExtraHelpSwaps:status.uncollectedExtraHelpSwaps,healingTimerCorrelationEvents:status.healingTimerCorrelationEvents||0,healingCapNonlinearEvents:status.healingCapNonlinearEvents||0,healingCapLocalGapSum:status.healingCapLocalGapSum||0,skillTriggers:status.skillCount,skillHelpCompletions:status.skillHelpCompletions,skillEligibleHelps:status.skillEligibleHelps,exactFoodCarryCollections:status.exactFoodCarryCollections,exactSharedBagCollections:status.exactSharedBagCollections,exactOneHelpKindCollections:status.exactOneHelpKindCollections,potDependentMeals:status.potDependentMeals,estimatedMeals:status.estimatedMeals,initialCoveredMeals:status.initialCoveredMeals,expectedSourceMeals:status.expectedSourceMeals,expectedSourceMealEnergy:status.expectedSourceMealEnergy,initialSourceMealEnergy:status.initialSourceMealEnergy,extraHelps:status.extraHelps,stockpileResets:status.stockpileResets,stockpileExpectedLost:status.stockpileExpectedLost,stockpilePending,ingredients:status.ingredients,skillIngredients:status.skillIngredients,conditionalPlusIngredients:status.conditionalPlusIngredients,conditionalMinusRecovery:status.conditionalMinusRecovery,unassignedMagnet:status.unassignedMagnet,potBonus,successBonus,inventory,meals:status.meals,consumedIngredients:status.consumedIngredients,nightEnergy,days:daySummaries,warnings:[...warnings],models:members.size};
}
const api={addTastyChanceBonus,resolveTastyChanceMeal,daytimeSchedule,isAllHealerSkill,unmodeledStrengthSkillEffect,needsMagnetIngredientPool,roundedDirectStrength,expectedRandomChargeStrength,directStrengthPerActivation,cappedHealFromStock,simulate,RECIPES,FAVORITES,berryUnit,energySpeed,baseCarryCapacity,effectivePotCapacity,calculateMealEnergy,chooseRecipe,mealRecovery,cheerWeights,healPulseRecipientExpectation,recoveryNatureFactor,recoverFromSleep,lunarBerryCounts,dracoBerryCounts,teamSpeciesCount,helperBoostCount,STOCKPILE_REWARDS,emptyStockpile,advanceStockpile,advanceStockpileByReadyStock,advanceSkillStock,expectedSkillStock,integerPocketTransitions,queuedFullPocketTransitions,queuedFullPocketAfterCollection,integerFoodPocketTransitions,integerFoodSkillQueueTransitions,collectIntegerFoodSkillQueue,collectSharedBagFoodQueues,collectOneHelpIngredientKinds,collectIntegerFoodPocket,blockedIngredientSkill,advanceSkillProcStateByHelpCounts,expectedPocketOccupation,queueSneakyEnergy,releaseSneakyEnergy,weightedHelpMinutes,advanceEnergyTimer,applyEnergyRecovery,completeHelpProgress,clearDepartingHelpProgress,emptySkillProcState,advanceSkillProcState,skillProcMarginal,clearSkillProcStock,clearPartySkillStocks,clearDepartingPockets,uncollectedExtraHelpOnSwap,hasPlusMinusPartner,plusExtraIngredient,uniformExpectedHeal,uniformExpectedHealFromStock,EXCLUDED_MAIN_SKILLS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeSimulator=api;
})(typeof globalThis!=='undefined'?globalThis:this);

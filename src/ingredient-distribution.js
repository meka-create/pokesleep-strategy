/* STEP 2: exact bounded integer ingredient bag kernel.
 * This module operates on explicitly supplied finite joint distributions.
 * It does NOT infer a distribution from fractional expected quantities.
 * Weekly simulation remains approximate until upstream help/pocket/skill
 * correlations are available without assumptions.
 */
(function(root){
'use strict';
const names=new Set(Object.keys(root.PokeMaster.ingredients));
const LIMIT=4096,MAX=10000;
function objectStock(stock){
 if(!stock||typeof stock!=='object'||Array.isArray(stock)||
   Object.prototype.toString.call(stock)!=='[object Object]')
  throw Error('整数食材在庫の形式が不正です。');
 const out={};
 for(const [key,n] of Object.entries(stock)){
  if(!names.has(key)||!Number.isSafeInteger(n)||n<0||n>MAX)
   throw Error('整数食材在庫の種類・個数が不正です。');
  if(n>0)out[key]=n;
 }
 return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
}
function bagKey(stock){return JSON.stringify(objectStock(stock));}
function validateBound(capacity,maxStates){
 if(!Number.isSafeInteger(capacity)||capacity<0||capacity>MAX||
   !Number.isSafeInteger(maxStates)||maxStates<1||maxStates>LIMIT)
  throw Error('整数食材バッグの容量・分岐上限が不正です。');
}
function readBag(dist,capacity,maxStates=LIMIT){
 validateBound(capacity,maxStates);
 if(Object.prototype.toString.call(dist)!=='[object Map]'||
   dist.size===0||dist.size>maxStates)
  throw Error('整数食材バッグの確率状態が不正です。');
 let mass=0;
 const items=[];
 for(const [key,p] of dist){
  if(typeof key!=='string'||!Number.isFinite(p)||p<0||p>1)
   throw Error('整数食材バッグの分岐が不正です。');
  let parsed;
  try{parsed=JSON.parse(key);}catch{throw Error('整数食材バッグの状態キーが不正です。');}
  const stock=objectStock(parsed);
  if(bagKey(stock)!==key)throw Error('整数食材バッグの状態キーが正規化されていません。');
  const total=Object.values(stock).reduce((a,b)=>a+b,0);
  if(capacity>0&&total>capacity)throw Error('整数食材バッグが容量を超過しています。');
  mass+=p;
  if(p>0)items.push({stock,p,total});
 }
 if(Math.abs(mass-1)>1e-8)throw Error('整数食材バッグの確率質量が不正です。');
 return items;
}
function add(next,stock,p,maxStates){
 if(p===0)return;
 const key=bagKey(stock);
 next.set(key,(next.get(key)||0)+p);
 if(next.size>maxStates)
  throw Error('整数食材バッグの分岐が上限を超えました。近似に切り替えず停止します。');
}
function certainIngredientBag(stock,capacity=0){
 validateBound(capacity,LIMIT);
 const normalized=objectStock(stock);
 if(capacity&&Object.values(normalized).reduce((a,b)=>a+b,0)>capacity)
  throw Error('初期食材がバッグ容量を超えています。');
 return new Map([[bagKey(normalized),1]]);
}
/* A stochastic outcome is one integer ingredient species and count, or no
 * ingredient at all. Outcomes are EXPLICIT and mutually exclusive; they
 * must not be constructed from independent per-type expected counts.
 * e.g. [{ingredient:'apple',count:3,probability:.5},
 *       {ingredient:null,count:0,probability:.5}].
 */
function addIngredientOutcomes(dist,outcomes,capacity=0,maxStates=LIMIT){
 const items=readBag(dist,capacity,maxStates);
 if(!Array.isArray(outcomes)||outcomes.length===0)
  throw Error('食材抽選分岐が指定されていません。');
 let mass=0;
 for(const o of outcomes){
  if(!o||typeof o!=='object'||!Number.isFinite(o.probability)||
     o.probability<0||o.probability>1||!Number.isSafeInteger(o.count)||
     o.count<0||o.count>MAX||
     !(o.ingredient==null&&o.count===0||names.has(o.ingredient)&&o.count>0))
   throw Error('食材抽選分岐の形式が不正です。');
  mass+=o.probability;
 }
 if(Math.abs(mass-1)>1e-8)throw Error('食材抽選分岐の確率質量が不正です。');
 const next=new Map();let expectedAdded=0,expectedRejected=0;
 for(const {stock,p,total} of items){
  for(const o of outcomes){
   if(o.probability===0)continue;
   const free=capacity?capacity-total:o.count;
   const received=Math.min(o.count,free),rejected=o.count-received;
   const result={...stock};
   if(received>0)result[o.ingredient]=(result[o.ingredient]||0)+received;
   add(next,result,p*o.probability,maxStates);
   expectedAdded+=p*o.probability*received;
   expectedRejected+=p*o.probability*rejected;
  }
 }
 return {distribution:next,expectedAdded,expectedRejected};
}
/* Given a finite JOINT inventory distribution, consume a specified
 * recipe only on worlds where ALL ingredient requirements are present.
 * On failure preserve the world's entire inventory (no phantom costs).
 * Cooking Energy on success may be computed by callers as P * energy.
 */
function evaluateRecipeOutcomes(dist,requirements,capacity=0,maxStates=LIMIT){
 const items=readBag(dist,capacity,maxStates),needed=objectStock(requirements);
 let successProbability=0;const next=new Map(),expectedConsumed={};
 for(const {stock,p} of items){
  const canCook=Object.entries(needed).every(([key,n])=>(stock[key]||0)>=n);
  if(!canCook){add(next,stock,p,maxStates);continue;}
  successProbability+=p;
  const left={...stock};
  for(const [key,n] of Object.entries(needed)){
   left[key]-=n;
   expectedConsumed[key]=(expectedConsumed[key]||0)+p*n;
  }
  add(next,left,p,maxStates);
 }
 return {successProbability,expectedConsumed,distribution:next};
}
/* Exact finite meal sequence, GIVEN an explicitly specified distribution.
 * An optional draws array holds independent stochastic EVENTS between meals;
 * each event's outcomes are mutually exclusive. No correlations with other
 * game systems are guessed. energyIfCooked must be supplied by the caller
 * and can already include that meal's known great-success expectation.
 * A failed recipe consumes no food and earns no meal Energy.
 */
function evaluateRecipeSequence(initial,steps,capacity=0,maxStates=LIMIT){
 readBag(initial,capacity,maxStates);
 if(!Array.isArray(steps)||steps.length>42)
  throw Error('連続料理試算の食事数が不正です。');
 let current=new Map(initial),expectedCooking=0,expectedMealCount=0;
 const meals=[],expectedConsumed={};
 for(const step of steps){
  if(!step||typeof step!=='object'||Array.isArray(step)||
     !Number.isFinite(step.energyIfCooked)||step.energyIfCooked<0||
     step.energyIfCooked>1e12||
     (step.draws!=null&&!Array.isArray(step.draws)))
   throw Error('連続料理試算の食事入力が不正です。');
  const draws=step.draws||[];
  for(const outcomes of draws)
   current=addIngredientOutcomes(current,outcomes,capacity,maxStates).distribution;
  const result=evaluateRecipeOutcomes(current,step.requirements,capacity,maxStates);
  current=result.distribution;
  const expectedEnergy=result.successProbability*step.energyIfCooked;
  expectedCooking+=expectedEnergy;
  expectedMealCount+=result.successProbability;
  for(const [key,value] of Object.entries(result.expectedConsumed))
   expectedConsumed[key]=(expectedConsumed[key]||0)+value;
  meals.push({successProbability:result.successProbability,
    expectedEnergy,expectedConsumed:result.expectedConsumed});
 }
 return {meals,expectedCooking,expectedMealCount,expectedConsumed,distribution:current};
}
root.PokeIngredientDistribution=Object.freeze({
 certainIngredientBag,addIngredientOutcomes,evaluateRecipeOutcomes,evaluateRecipeSequence
});
})(typeof globalThis!=='undefined'?globalThis:this);

/* Event preparation: targets before the event; actual Sunday snapshot afterward.
 * Never derive a whole week's guaranteed ingredient supply from a Sunday stock.
 * Keep this independent of the legacy STEP4 team-forecast model.
 */
(function(root){
'use strict';
const Master=root.PokeMaster,Recipes=root.PokeRecipes||[];
const KEYS=Object.keys(Master.ingredients);
const validInteger=(x,min,max,label)=>{
 if(!Number.isSafeInteger(x)||x<min||x>max)throw Error(label+'を確認してください。');
 return x;
};
const countIngredients=x=>KEYS.reduce((sum,key)=>sum+(x[key]||0),0);
function validateInventory(inventory,capacity){
 if(!inventory||typeof inventory!=='object'||Array.isArray(inventory)||
    Object.keys(inventory).some(k=>!KEYS.includes(k)))
  throw Error('食材の種類を確認してください。');
 const clean={};
 for(const [key,n] of Object.entries(inventory)){
  validInteger(n,0,10000,Master.ingredients[key]+'の数量');
  if(n)clean[key]=n;
 }
 if(countIngredients(clean)>capacity)throw Error('食材の合計がバッグ容量を超えています。');
 return clean;
}
function targets({recipeTargets,bagCapacity,potSize}){
 const capacity=validInteger(bagCapacity,1,10000,'バッグ容量');
 const pot=validInteger(potSize,7,300,'通常鍋容量');
 if(!Array.isArray(recipeTargets)||recipeTargets.length===0||recipeTargets.length>21)
  throw Error('料理を1品以上選択してください。');
 const seen=new Set(),items=[],allNeed={},earlyNeed={};
 let total=0,firstMeal=null;
 for(const row of recipeTargets){
  const r=Recipes.find(x=>x.id===row?.recipeId);
  if(!r||seen.has(r.id))throw Error('料理の選択に重複または未登録があります。');
  const quantity=validInteger(row.meals,1,21,'料理の予定食数');
  seen.add(r.id);total+=quantity;
  if(total>21)throw Error('料理は21食以内にしてください。');
  const mealUnits=Object.values(r.requirements).reduce((n,v)=>n+v,0);
  if(!firstMeal)firstMeal={recipeId:r.id,name:r.name,need:mealUnits};
  const early=Math.min(quantity,Math.max(0,3-items.reduce((n,x)=>n+x.early,0)));
  for(const [k,required] of Object.entries(r.requirements)){
   if(!KEYS.includes(k))throw Error('レシピの食材が未登録です。');
   allNeed[k]=(allNeed[k]||0)+required*quantity;
   earlyNeed[k]=(earlyNeed[k]||0)+required*early;
  }
  items.push({recipeId:r.id,name:r.name,type:r.type,meals:quantity,early,requirements:r.requirements,mealUnits});
 }
 // Only the first three planned meals are an actionable pre-event target.
 // Never misrepresent all 21 meals as fitting in an ingredient bag.
 const preferredTotal=countIngredients(earlyNeed);
 const allocated={},remaining=capacity;
 let space=remaining;
 // Priority is the order of selected dishes. If the bag cannot cover all
 // three meals, never report that it can.
 for(const r of items){
  for(let n=0;n<r.early;n++)for(const [k,num] of Object.entries(r.requirements)){
   const take=Math.min(num,space);allocated[k]=(allocated[k]||0)+take;space-=take;
  }
 }
 return {items,allNeed,earlyNeed,target:allocated,capacity,pot,firstMeal,
  earlyCount:Math.min(total,3),totalMeals:total,preferredTotal,
  targetTotal:capacity-space,firstPotShortfall:Math.max(0,firstMeal.need-pot),
  covered:preferredTotal<=capacity};
}
function validateHandoff(handoff,capacity,knownIds){
 if(!handoff||typeof handoff!=='object'||Array.isArray(handoff))throw Error('日曜の実績が不正です。');
 const inventory=validateInventory(handoff.inventory||{},capacity);
 const potBonus=validInteger(handoff.potBonus??0,0,200,'鍋拡張');
 const stocks=handoff.skillStocks??{};
 if(!stocks||typeof stocks!=='object'||Array.isArray(stocks))throw Error('スキルストック記録が不正です。');
 const skillStocks={};
 for(const [id,item] of Object.entries(stocks)){
  if(!knownIds.has(id)||!item||typeof item!=='object'||Array.isArray(item)||
     !Number.isInteger(item.count)||item.count<1||item.count>2||
     typeof item.confirmed!=='boolean')throw Error('スキルストックの個体・回数・確認状況が不正です。');
  skillStocks[id]={count:item.count,confirmed:item.confirmed};
 }
 const eventStart=handoff.eventStart??'';
 if(typeof eventStart!=='string'||eventStart.length>10||
    (eventStart&&!/^\d{4}-\d{2}-\d{2}$/.test(eventStart)))throw Error('イベント開始日が不正です。');
 return {inventory,potBonus,skillStocks,eventStart};
}
function evaluate(plan,handoff,knownIds){
 const actual=validateHandoff(handoff,plan.capacity,knownIds);
 const remaining={...actual.inventory},meals=[];
 let first=true;
 // No projected drops are assumed. Only concrete on-hand ingredients are consumed.
 for(const item of plan.items)for(let i=0;i<item.early;i++){
  const availablePot=plan.pot+(first?actual.potBonus:0);
  const missing=Object.fromEntries(Object.entries(item.requirements)
   .filter(([k,n])=>(remaining[k]||0)<n).map(([k,n])=>[k,n-(remaining[k]||0)]));
  const potOk=item.mealUnits<=availablePot,foodOk=Object.keys(missing).length===0;
  const canCook=potOk&&foodOk;
  meals.push({name:item.name,recipeId:item.recipeId,canCook,potOk,foodOk,missing,
   required:item.mealUnits,pot:availablePot});
  if(canCook)for(const [k,n] of Object.entries(item.requirements))remaining[k]-=n;
  // A meal *attempt* is scheduled. If it cannot be cooked, the pot boost
  // stays pending until a successful cooking; we do not silently consume it.
  if(canCook)first=false;
 }
 const shortages=Object.fromEntries(KEYS.filter(k=>(plan.target[k]||0)>(actual.inventory[k]||0))
  .map(k=>[k,plan.target[k]-(actual.inventory[k]||0)]));
 return {actual,meals,remaining,shortages,ready:meals.filter(x=>x.canCook).length,
  targetCoverage:countIngredients(shortages)===0,
  stockConfirmed:Object.values(actual.skillStocks).filter(x=>x.confirmed).length,
  stockUnconfirmed:Object.values(actual.skillStocks).filter(x=>!x.confirmed).length};
}
root.PokePrepHandoff={targets,validateInventory,validateHandoff,evaluate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.PokePrepHandoff;
})(typeof globalThis!=='undefined'?globalThis:this);

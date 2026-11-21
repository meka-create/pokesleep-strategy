/* M2 v129: advisory minimum stock left AFTER each scheduled meal.
 * Pure suffix of future adopted/planned recipe requirements, not current bag
 * inventory, future production, probabilistic ingredient drops or a safe
 * "may add N" suggestion. No persistence, private Pokemon, network or DOM.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeM2MealReservesV129=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const FOOD=Object.freeze(['leek','mushroom','egg','potato','apple','herb',
  'sausage','milk','honey','oil','ginger','tomato','cacao','tail','soy',
  'corn','coffee','pumpkin','avocado','nuts']);
 const SLOTS=['morning','noon','evening','sleep'];
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,
  currentBagUsed:false,futureProductionUsed:false,writesSavedData:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 function build(slots,recipes){
  try{
   if(!Array.isArray(slots)||slots.length!==29||
    !Array.isArray(recipes)||!recipes.length||recipes.length>200)
    return fail('M2_PLAN_OR_CATALOG_REQUIRED');
   const recipeMap=new Map();
   for(const r of recipes){
    if(!plain(r)||typeof r.id!=='string'||!r.id||
     recipeMap.has(r.id)||!plain(r.requirements)||
     Object.keys(r.requirements).some(k=>!FOOD.includes(k))||
     !Object.keys(r.requirements).length||
     Object.values(r.requirements).some(n=>!Number.isSafeInteger(n)||
      n<1||n>500))
     return fail('M2_RECIPE_CATALOG_INVALID');
    recipeMap.set(r.id,r);
   }
   for(let i=0;i<29;i++){
    const w=slots[i],expected=i===0?'sleep':SLOTS[(i-1)%4];
    if(!plain(w)||w.slot!==expected||
     (i>0&&w.day!==Math.floor((i-1)/4))||
     (i===0&&w.day!==-1)||
     (w.recipeId!==null&&w.recipeId!==undefined&&
      (expected==='sleep'||!recipeMap.has(w.recipeId))))
     return fail('M2_PLAN_RECIPE_SEQUENCE_INVALID');
   }
   const future=Object.fromEntries(FOOD.map(k=>[k,0]));
   const after=Array(29);
   for(let i=28;i>=0;i--){
    // Snapshot BEFORE adding this meal, so this meal's own ingredients
    // never count as a requirement to keep AFTER cooking it.
    after[i]=Object.freeze(FOOD.filter(k=>future[k]>0)
     .map(k=>Object.freeze({foodCode:k,count:future[k]})));
    const id=slots[i].recipeId;
    if(id===null||id===undefined)continue;
    for(const [k,v] of Object.entries(recipeMap.get(id).requirements)){
     future[k]+=v;
     if(future[k]>10500)return fail('M2_FUTURE_REQUIREMENTS_OVERFLOW');
    }
   }
   return Object.freeze({status:'RESERVES_READY',
    afterByWindow:Object.freeze(after),
    plannedMealCount:slots.filter(s=>s.recipeId!=null).length,
    currentBagUsed:false,futureProductionUsed:false,
    isStockIndependent:true,writesSavedData:false,
    note:'この料理の調理後、同週の未来の作成予定レシピに必要な食材の累計。ゲーム内の現在庫や今後の生産は参照しません。'});
  }catch(_){return fail('M2_RECIPE_RESERVATION_INVALID');}
 }
 return Object.freeze({FOOD,build});
});

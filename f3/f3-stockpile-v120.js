/* F3 v120 — one chosen top-tier recipe per category, capacity-safe meal counts.
 * Preparation is never an observed F4/F5 week or a guaranteed production claim.
 * Pure functions: no storage, no private box rows and no DOM.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF3StockpileV120=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CATS=['curry','salad','dessert'];
 const FOODS=['leek','mushroom','egg','potato','apple','herb','sausage','milk',
  'honey','oil','ginger','tomato','cacao','tail','soy','corn','coffee','pumpkin','avocado','nuts'];
 const err=(reason,message)=>({status:'BLOCKED',reason,message});
 const validInt=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const total=o=>Object.values(o).reduce((s,n)=>s+n,0);
 function catalog(recipes,type,pot,camp){
  if(!CATS.includes(type)||!Array.isArray(recipes)||!validInt(pot,7,5000)||
    typeof camp!=='boolean')return [];
  const cap=Math.round(pot*(camp?1.5:1));
  return recipes.filter(r=>plain(r)&&r.type===type&&typeof r.id==='string'&&
   validInt(r.baseStrength,1,1000000)&&plain(r.requirements)&&
   Object.keys(r.requirements).every(k=>FOODS.includes(k)&&validInt(r.requirements[k],0,500))&&
   total(r.requirements)>0&&total(r.requirements)<=cap)
   .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id)).slice(0,5)
   .map(r=>({id:r.id,name:r.name,baseStrength:r.baseStrength,size:total(r.requirements),
    requirements:{...r.requirements}}));
 }
 function validStock(s){
  if(s===undefined||s===null)return Object.fromEntries(FOODS.map(k=>[k,0]));
  if(!plain(s)||Object.keys(s).some(k=>!FOODS.includes(k)))return null;
  const a={};
  for(const k of FOODS){const v=s[k]??0;if(!validInt(v,0,10000))return null;a[k]=v;}
  return a;
 }
 function make(input){
  if(!plain(input)||!Array.isArray(input.categories)||input.categories.length<1||
    input.categories.length>3||new Set(input.categories).size!==input.categories.length||
    input.categories.some(c=>!CATS.includes(c))||!validInt(input.bagCapacity,1,5000))
   return err('INPUT','カテゴリと食材バッグ容量を確認してください。');
  // Normal weekly cuisine is one fixed category; F3 may store alternative
  // candidates before it is known. The player needs enough of each shared
  // ingredient for ANY ONE candidate, not all mutually exclusive dishes.
  // An event explicitly allowing all dishes preserves simultaneous demand.
  const mode=input.preparationMode??'ALL_MEALS';
  if(!['ALL_MEALS','ALTERNATIVE_WEEKLY_FOOD'].includes(mode))
   return err('PREPARATION_MODE','備蓄する料理カテゴリの扱いを確認してください。');
  const exclusive=mode==='ALTERNATIVE_WEEKLY_FOOD';
  const stock=validStock(input.currentStock);
  if(!stock||total(stock)>input.bagCapacity)
   return err('STOCK','現在庫と食材バッグ容量を確認してください。');
  const selected={};
  for(const type of input.categories){
   const top=catalog(input.recipes,type,input.potCapacity,input.camp);
   if(!top.length)return err('NO_COOKABLE_RECIPES',type+'の調理可能な料理がありません。');
   const id=input.selectedRecipes?.[type]??top[0].id;
   const chosen=top.find(r=>r.id===id);
   if(!chosen)return err('RECIPE_SELECTION_STALE',type+'の選択レシピを確認してください。');
   selected[type]=chosen;
  }
  const wanted={};
  for(const type of input.categories){
   const v=input.targetMeals?.[type]??'auto';
   if(v!=='auto'&&!validInt(v,1,21))return err('MEALS','食数を確認してください。');
   wanted[type]=v;
  }
  function demand(counts){
   const amounts=Object.fromEntries(FOODS.map(k=>[k,0]));
   for(const type of input.categories)
    for(const [f,n] of Object.entries(selected[type].requirements))
     amounts[f]=exclusive?
      Math.max(amounts[f],n*(counts[type]||0)):
      amounts[f]+n*(counts[type]||0);
   return amounts;
  }
  function fit(counts){
   const values=Object.values(counts),d=demand(counts);
   return values.every(n=>validInt(n,0,21))&&
    (exclusive||total(counts)<=21)&&
    FOODS.reduce((n,k)=>n+Math.max(stock[k],d[k]),0)<=input.bagCapacity;
  }
  const count={};
  for(const type of input.categories)count[type]=wanted[type]==='auto'?1:wanted[type];
  if(!fit(count))return err('NO_ROOM','選択したレシピを各カテゴリ1食以上準備できません。食数またはレシピを変更してください。');
  // Equal-priority automatic distribution: one meal minimum per chosen
  // category. In an exclusive-food week the count is PER POSSIBLE category:
  // each case may use 21 meals, not 21 across mutually exclusive cases.
  // Never silently reduce a manually selected count.
  let advance=true;
  while(advance&&(exclusive||total(count)<21)){
   advance=false;
   for(const type of input.categories){
    if(wanted[type]!=='auto')continue;
    const candidate={...count,[type]:count[type]+1};
    if(fit(candidate)){count[type]++;advance=true;}
   }
  }
  const limits={};
  for(const type of input.categories){
   let cap=0;
   const other={...count};
   for(let n=1;n<=21;n++){
    if(fit({...other,[type]:n}))cap=n;
    else break;
   }
   limits[type]=cap;
  }
  const goals=demand(count);
  const topups=Object.fromEntries(FOODS.map(k=>[k,Math.max(0,goals[k]-stock[k])]));
  const occupied=FOODS.reduce((s,k)=>s+Math.max(stock[k],goals[k]),0);
  const meals=exclusive?Math.max(...Object.values(count)):total(count);
  const production=Object.fromEntries(FOODS.map(k=>[k,0]));
  return {status:'PROVISIONAL',stage:'F3_STOCKPILE_V120',
   method:exclusive?'ALTERNATIVE_WEEKLY_FOOD_MAX':'ONE_TOP_RECIPE_PER_CATEGORY_CAPACITY_FIRST',
   preparationMode:mode,alternativeCategories:exclusive?input.categories.length:0,
   alternativeMealCounts:exclusive?{...count}:null,
   categories:input.categories.map(type=>({...selected[type],type,count:count[type],
    requestedMeals:wanted[type],maximumMeals:limits[type]})),
   selectedRecipes:Object.fromEntries(input.categories.map(c=>[c,selected[c].id])),
   targetMeals:{...wanted},counts:{...count},limits,goals,topups,demand:goals,
   production,recipesUsed:meals,mealSlots:21,
   capacity:{bag:input.bagCapacity,starting:total(stock),used:occupied,
    additional:total(topups),free:input.bagCapacity-occupied},
   notes:[exclusive?
    '3カテゴリは週の料理タイプ別の代替候補です。食材ごとに必要数の最大値を備蓄します。':
    '各カテゴリ1レシピのみ。バッグ容量内で最大21食を配分。',
    '実編成・回収時刻を保証できない間は生産予測を自動控除しません。'],
   productionCertified:false,weeklyPlanCertified:false};
 }
 function mealOptions(input,type){
  if(!CATS.includes(type)||!input?.categories?.includes(type))return [];
  const target={...(input.targetMeals||{})};
  const options=[];
  for(let n=1;n<=21;n++){
   const r=make({...input,targetMeals:{...target,[type]:n}});
   if(r.status==='PROVISIONAL')options.push(n);
  }
  return options;
 }
 // Time-aware shortfall on a supplied fixed, validated day plan: a future
 // yield may only fund a meal at or after its availability, never earlier.
 function requiredOpeningStock(input){
  if(!plain(input)||!Array.isArray(input.meals)||input.meals.length>21||
    !Array.isArray(input.yields)||input.yields.length!==input.meals.length)
   return err('SCHEDULE','時刻順の食事・生産データが必要です。');
  const short=Object.fromEntries(FOODS.map(k=>[k,0]));
  const gained=Object.fromEntries(FOODS.map(k=>[k,0]));
  const consumed=Object.fromEntries(FOODS.map(k=>[k,0]));
  for(let i=0;i<input.meals.length;i++){
   const used=validStock(input.meals[i]),produced=validStock(input.yields[i]);
   if(!used||!produced)return err('SCHEDULE','食材の時刻別数値が不正です。');
   // Production from the prior window is available before this meal only.
   for(const k of FOODS) {
    consumed[k]+=used[k];
    short[k]=Math.max(short[k],consumed[k]-gained[k]);
    gained[k]+=produced[k];
   }
  }
  return {status:'PROVISIONAL',goals:Object.fromEntries(FOODS.map(k=>[k,Math.ceil(short[k])])),
   productionCertified:false,source:'USER_SUPPLIED_VALIDATED_TIME_SERIES'};
 }
 return Object.freeze({FOODS,CATS,catalog,make,mealOptions,requiredOpeningStock});
});

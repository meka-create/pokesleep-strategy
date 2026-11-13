/* F3 v88: deterministic, bounded stockpile planner. No E7 storage writes.
 * 21 meal slots are a planning proxy, NOT a F4 event-week simulation.
 * Energy ranking uses the verified recipe baseline. No unsourced production,
 * recipe level, extra-tasty bonus or field strength is invented.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PokeF3PrepOptimizer=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CATEGORIES=Object.freeze(['curry','salad','dessert']);
 const INGREDIENT_CODES=Object.freeze(['leek','mushroom','egg','potato','apple',
  'herb','sausage','milk','honey','oil','ginger','tomato','cacao','tail','soy',
  'corn','coffee','pumpkin','avocado']);
 const CODE_SET=new Set(INGREDIENT_CODES);
 const failure=(reason,message)=>Object.freeze({status:'BLOCKED',reason,message});
 const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function plain(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return false;
  const p=Object.getPrototypeOf(o);
  return p===null||Object.getPrototypeOf(p)===null;
 }
 function quantities(input,label){
  if(input==null)return Array(19).fill(0);
  if(!plain(input)||Object.keys(input).some(k=>!CODE_SET.has(k)))
   throw Error(label+'の食材キーが不正です。');
  return INGREDIENT_CODES.map(k=>{
   const x=has(input,k)?input[k]:0;
   if(!Number.isSafeInteger(x)||x<0||x>10000)throw Error(label+'の数値が不正です。');
   return x;
  });
 }
 function normalizeRecipes(recipes){
  if(!Array.isArray(recipes)||recipes.length<1||recipes.length>200)
   throw Error('料理データが不正です。');
  const ids=new Set(),out=[];
  for(const r of recipes){
   if(!plain(r)||typeof r.id!=='string'||!r.id||r.id.length>120||
    ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||
    !CATEGORIES.includes(r.type)||!Number.isSafeInteger(r.baseStrength)||
    r.baseStrength<=0||r.baseStrength>1000000||!plain(r.requirements)||
    !Object.keys(r.requirements).length||
    Object.keys(r.requirements).some(k=>!CODE_SET.has(k)))throw Error('料理原典を確認できません。');
   ids.add(r.id);
   const req=INGREDIENT_CODES.map(k=>{
    const n=r.requirements[k]??0;
    if(!Number.isSafeInteger(n)||n<0||n>500)throw Error('料理の必要食材数が不正です。');
    return n;
   });
   out.push({id:r.id,name:r.name,type:r.type,baseStrength:r.baseStrength,
    req,size:req.reduce((a,b)=>a+b,0)});
  }
  return out;
 }
 function score(s,slots,bestByCat,weights){
  let rate=1,ceiling=0;
  for(let i=0;i<slots.length;i++){
   if(slots[i]===0)continue;
   ceiling+=bestByCat[i]*slots[i];
   rate=Math.min(rate,(s.catEnergy[i]||0)/Math.max(1,bestByCat[i]*slots[i]));
  }
  // A: balance all selected categories while still rewarding high-energy meals.
  return .67*s.energy/Math.max(1,ceiling)+.33*rate+(weights||0)*1e-12;
 }
 function chooseCandidates(rows,capacity,stock){
  const feasible=rows.filter(r=>r.size<=capacity);
  const high=[...feasible].sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id)).slice(0,9);
  const efficient=[...feasible].sort((a,b)=>
   b.baseStrength/Math.max(1,b.size)-a.baseStrength/Math.max(1,a.size)||a.id.localeCompare(b.id)).slice(0,7);
  const assisted=[...feasible].sort((a,b)=>{
   const cost=r=>r.req.reduce((sum,n,i)=>sum+Math.max(0,n-stock[i]),0);
   return b.baseStrength/Math.max(1,cost(b))-a.baseStrength/Math.max(1,cost(a))||a.id.localeCompare(b.id);
  }).slice(0,5);
  const byId=new Map([...high,...efficient,...assisted].map(r=>[r.id,r]));
  return [...byId.values()].sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id));
 }
 function plan(input={}){
  try{
   if(!plain(input))return failure('INVALID_INPUT','計算条件を確認してください。');
   const cats=input.categories;
   if(!Array.isArray(cats)||cats.length<1||cats.length>3||
    new Set(cats).size!==cats.length||cats.some(x=>!CATEGORIES.includes(x)))
    return failure('CATEGORIES','備蓄する料理カテゴリを確定してください。');
   const bag=input.bagCapacity,pot=input.potCapacity;
   if(!Number.isSafeInteger(bag)||bag<1||bag>5000||
    !Number.isSafeInteger(pot)||pot<7||pot>5000)
    return failure('PLAYER','プレイヤー設定で鍋容量と食材バッグ容量を入力してください。');
   if(typeof input.camp!=='boolean')return failure('CAMP','いいキャンプチケットの設定を確認してください。');
   const extraPot=input.extraPot??0,extraTasty=input.tastyChance??0;
   const dishMultiplier=input.dishMultiplier??1,mealSlots=input.mealSlots??21;
   if(!Number.isSafeInteger(extraPot)||extraPot<0||extraPot>200||
    !Number.isFinite(extraTasty)||extraTasty<0||extraTasty>.7||
    !Number.isFinite(dishMultiplier)||dishMultiplier<.1||dishMultiplier>5||
    !Number.isSafeInteger(mealSlots)||mealSlots<1||mealSlots>21)
    return failure('PARAMS','鍋拡張・料理チャンスなどの入力を確認してください。');
   const current=quantities(input.currentStock,'現在庫');
   const future=quantities(input.forecastProduction,'食材生産予測');
   const onHand=current.reduce((a,b)=>a+b,0);
   if(onHand>bag)return failure('BAG_OVER_CAPACITY','現在庫が食材バッグ容量を超えています。');
   const recipes=normalizeRecipes(input.recipes),catRecipes=cats.map(c=>recipes.filter(r=>r.type===c));
   if(catRecipes.some(rows=>!rows.length))return failure('NO_RECIPES','選択した料理カテゴリに原典データがありません。');
   const cap=day=>Math.round((pot*(day===6?2:1)+extraPot)*(input.camp?1.5:1));
   const slots=cats.map((_,c)=>Array.from({length:mealSlots},(_,i)=>i%cats.length===c).filter(Boolean).length);
   const candidates=cats.map((cat,i)=>chooseCandidates(catRecipes[i],cap(6),current));
   if(candidates.some(rows=>!rows.length))return failure('NO_POT_RECIPE','鍋容量で作れる料理がありません。');
   const best=cats.map((_,i)=>Math.max(...candidates[i].map(r=>r.baseStrength)));
   const width=input.beamWidth??120;
   if(!Number.isSafeInteger(width)||width<12||width>300)return failure('PARAMS','探索設定が不正です。');
   const origin={demand:Array(19).fill(0),catEnergy:cats.map(()=>0),catMeals:cats.map(()=>0),
    recipes:[],energy:0,used:onHand};
   let beam=[origin];
   for(let slot=0;slot<mealSlots;slot++){
    const catIndex=slot%cats.length,day=Math.floor(slot/3),potLimit=cap(day);
    const options=candidates[catIndex].filter(r=>r.size<=potLimit);
    const next=[];
    for(const base of beam){
     // Unfilled slots are allowed: a high-energy recipe may outrank numerous
     // cheaper dishes. The algorithm never fabricates ingredients to fill 21.
     next.push(base);
     for(const r of options){
      const demand=base.demand.map((n,i)=>n+r.req[i]);
      let used=onHand;
      for(let i=0;i<19;i++)used+=Math.max(0,demand[i]-future[i]-current[i]);
      if(used>bag)continue;
      const mul=dishMultiplier*(1+extraTasty*(day===6?2:1));
      const energy=base.energy+r.baseStrength*mul;
      const catEnergy=base.catEnergy.slice(),catMeals=base.catMeals.slice();
      catEnergy[catIndex]+=r.baseStrength*mul;catMeals[catIndex]++;
      next.push({demand,catEnergy,catMeals,recipes:[...base.recipes,r.id],energy,used});
     }
    }
    const processed=slot+1,remaining=mealSlots-processed;
    // Normalize current category coverage; preserve enough of both high-energy
    // and low-bag usage states for the next meal (bounded, deterministic beam).
    const futureMax=Math.max(1,remaining*Math.max(...best)*dishMultiplier*(1+2*extraTasty));
    const ordering=(s)=>{
     const ratio=score(s,slots,best);
     const efficiency=s.energy/Math.max(1,s.used-onHand+5);
     return ratio+.045*Math.min(1,efficiency/(futureMax/Math.max(1,remaining)))+
      .005*(bag-s.used)/bag;
    };
    next.sort((a,b)=>ordering(b)-ordering(a)||b.energy-a.energy||a.used-b.used||
     a.recipes.join(',').localeCompare(b.recipes.join(',')));
    const selected=[],seen=new Set(),buckets=new Map();
    for(const state of next){
     const h=state.catMeals.join(',')+'|'+state.demand.join(',');
     if(seen.has(h))continue;seen.add(h);
     const bucket=Math.min(12,Math.floor(state.used/Math.max(1,bag/13)));
     const k=state.catMeals.join(',')+'|'+bucket;
     const n=buckets.get(k)||0;
     if(n>=5)continue;
     buckets.set(k,n+1);selected.push(state);
     if(selected.length>=width)break;
    }
    beam=selected;
   }
   beam.sort((a,b)=>score(b,slots,best)-score(a,slots,best)||b.energy-a.energy||
    a.used-b.used);
   const bestState=beam[0];
   if(!bestState||!bestState.recipes.length)
    return failure('NO_FEASIBLE_PLAN','現在のバッグ容量・鍋容量・食材条件では備蓄対象の料理を組めません。');
   const goals={},topups={},production={},ingredients={};
   for(let i=0;i<19;i++){
    const code=INGREDIENT_CODES[i];
    goals[code]=Math.max(0,bestState.demand[i]-future[i]);
    topups[code]=Math.max(0,goals[code]-current[i]);
    production[code]=future[i];ingredients[code]=bestState.demand[i];
   }
   const byId=new Map(recipes.map(r=>[r.id,r]));
   const perCategory=cats.map((cat,i)=>{
    const selections={};
    for(let n=i;n<bestState.recipes.length;n++){
     // Actual chronological slot choices are in the selected list only;
     // use recipe category rather than a slot-position assumption.
     const id=bestState.recipes[n];
     if(byId.get(id)?.type!==cat)continue;
     selections[id]=(selections[id]||0)+1;
    }
    return {category:cat,meals:bestState.catMeals[i],
     energyProxy:Math.round(bestState.catEnergy[i]),
     dishes:Object.entries(selections).map(([id,count])=>({
      id,name:byId.get(id).name,count,baseStrength:byId.get(id).baseStrength}))
      .sort((a,b)=>b.baseStrength-a.baseStrength||a.id.localeCompare(b.id))};
   });
   const selectedCount=bestState.recipes.length;
   return {status:'PROVISIONAL',method:'BOUNDED_BEAM_V1',
    scope:'F3_PREP_ONLY',objective:'ENERGY_WITH_BALANCED_CATEGORIES',
    recipeSource:'src/recipes.js (2026-09-15 fixed source snapshot)',
    recipesUsed:selectedCount,mealSlots,energyProxy:Math.round(bestState.energy),
    categories:perCategory,goals,topups,production,demand:ingredients,
    capacity:{bag,starting:onHand,additional:Object.values(topups).reduce((a,b)=>a+b,0),
     used:bestState.used,free:bag-bestState.used,potWeekday:cap(0),potSunday:cap(6)},
    assumptions:{
     recipeLevel:'baseStrength only',forecastProvided:Object.values(production).some(Boolean),
     camp:input.camp,extraPot,tastyChance:extraTasty,dishMultiplier,
     noUnverifiedExtraIngredients:true,
     eventWeekProductionTiming:'F4 pending',fieldBonus:'not applied',
     autoOptimization:'bounded proxy; not a guaranteed global maximum'},
    warnings:[
     '基礎エナジーに基づく暫定備蓄試算です。レシピレベル・追加食材・げんき・曜日別生産はF4で連続最適化します。',
     ...(selectedCount<mealSlots?['バッグ容量・食材制約により21食すべては組めません。']:[]),
     ...(Object.values(production).some(Boolean)?['食材生産予測は週合計として扱い、入手時刻の制約は未計算です。']:[])
    ]};
  }catch(e){return failure('INVALID_INPUT',e&&e.message||'料理・食材データが不正です。');}
 }
 return Object.freeze({INGREDIENT_CODES,CATEGORIES,plan,normalizeRecipes});
});

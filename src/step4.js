/* STEP4 bounded preparation arithmetic. Never treats drop expectations as guaranteed.
 * Week starts Mon 07:30, ends next Mon 04:00; 21 is a maximum meal count
 * for one event week, NOT a promise that every recipe can be cooked.
 */
(function(root){
'use strict';
const Master=root.PokeMaster,Recipes=root.PokeRecipes;
const KEYS=Object.keys(Master.ingredients);
function integer(value,min,max,label){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(label+' の入力が不正です。');
 return value;
}
function plan(input){
 if(!input||typeof input!=='object')throw Error('準備条件がありません。');
 if(!Array.isArray(Recipes)||!Master?.ingredients)throw Error('料理・食材マスターが不足しています。');
 const targets=input.recipeTargets===undefined?
  [{recipeId:input.recipeId,meals:input.meals}]:input.recipeTargets;
 if(!Array.isArray(targets)||targets.length<1||targets.length>21)
  throw Error('イベント週に作る料理を1品以上選択してください。');
 const recipes=[],seen=new Set(),required={};
 let meals=0;
 for(const item of targets){
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('料理の内訳が不正です。');
  const recipe=Recipes.find(r=>r.id===item.recipeId);
  if(!recipe)throw Error('イベント週に作る料理を選択してください。');
  if(seen.has(recipe.id))throw Error('同じ料理が重複しています。食数をまとめて入力してください。');
  seen.add(recipe.id);
  const count=integer(item.meals,1,21,'料理ごとの予定食数');
  meals+=count;
  if(meals>21)throw Error('複数料理の予定食数の合計は21食以内にしてください。');
  for(const [k,v] of Object.entries(recipe.requirements)){
   if(!KEYS.includes(k))throw Error('レシピに未登録の食材があります。');
   required[k]=(required[k]||0)+integer(v,1,1000,'1食の必要食材')*count;
  }
  recipes.push({id:recipe.id,name:recipe.name,type:recipe.type,
   meals:count,perMeal:Object.values(recipe.requirements).reduce((n,v)=>n+v,0),
   energy70:recipe.strength70});
 }
 const capacity=integer(input.bagCapacity,1,10000,'食材バッグ容量');
 const mode=input.priority;
 if(!['energy','stock'].includes(mode))throw Error('備蓄方針が不正です。');
 const carry=input.carryover||{};
 if(!carry||typeof carry!=='object'||Array.isArray(carry)||Object.keys(carry).some(k=>!KEYS.includes(k)))
  throw Error('持ち越し食材の種類が不正です。');
 for(const value of Object.values(carry))integer(value,0,10000,'持ち越し個数');
 const carried=KEYS.reduce((n,k)=>n+(carry[k]||0),0);
 if(carried>capacity)throw Error('持ち越し予定食材の合計がバッグ容量を超えています。');
 const warnings=['21食は7日間×3食の上限です。実際の調理成立や食材の獲得確率を保証する計算ではありません。'];
 if(recipes.length>1)warnings.push('複数料理の食数を合算しています。各料理を作る曜日・時間帯や、食事間の在庫補充は計算していません。');
 if(Number.isInteger(input.potSize)&&input.potSize>=7&&recipes.some(r=>r.perMeal>input.potSize))
  warnings.push('選んだ料理の一部は必要枠数が現在の通常鍋容量を超えています。鍋拡張などがない通常日の成立を保証できません。');
 if(input.foodMode==='random')warnings.push('料理カテゴリがランダムです。このレシピは採用されたカテゴリの場合だけの仮定です。');
 else if(input.foodMode&&recipes.some(r=>r.type!==input.foodMode))warnings.push('設定中の料理カテゴリと異なる料理が含まれます。カテゴリを確認してください。');
 if(input.eventEffects)warnings.push('イベント補正メモは食材必要個数へ自動換算していません。');
 const quotaRatio=mode==='stock'?0.9:0.3;
 // These fractions are USER PRIORITY HEURISTICS, not game rules. A manual
 // carryover that already exceeds the quota is never silently discarded.
 const budget=Math.max(0,Math.floor(capacity*quotaRatio)-carried);
 const unmet=KEYS.map(key=>({key,needed:required[key]||0,already:carry[key]||0,
  remaining:Math.max(0,(required[key]||0)-(carry[key]||0))}))
  .filter(r=>r.remaining>0);
 const totalRemaining=unmet.reduce((n,r)=>n+r.remaining,0);
 const available=Math.min(budget,totalRemaining),additions={};
 // Exact bounded integer proportional allocation via largest remainder,
 // not fractional item allocation. Never add unrelated ingredients.
 if(totalRemaining){
  let allocated=0;
  const residues=[];
  for(const row of unmet){
   const ideal=available*row.remaining/totalRemaining;
   const floor=Math.floor(ideal);
   additions[row.key]=floor;allocated+=floor;
   residues.push({key:row.key,fraction:ideal-floor,priority:row.remaining});
  }
  residues.sort((a,b)=>b.fraction-a.fraction||b.priority-a.priority||a.key.localeCompare(b.key));
  for(let i=0;i<available-allocated;i++)additions[residues[i].key]++;
 }
 const rows=KEYS.filter(k=>(required[k]||0)>0||(carry[k]||0)>0).map(key=>{
  const start=carry[key]||0,newStock=additions[key]||0,need=required[key]||0;
  const half=Math.ceil(newStock*3/7);
  return {key,name:Master.ingredients[key],perMeal:recipes.length===1?(Recipes.find(r=>r.id===recipes[0].id).requirements[key]||0):null,
   required:need,carryover:start,toGather:newStock,target:start+newStock,
   firstHalf:half,secondHalf:newStock-half,
   uncovered:Math.max(0,need-start-newStock)};
 });
 const packed=carried+available;
 const result={recipe:recipes.length===1?recipes[0]:null,recipes,
  meals,capacity,mode,quotaRatio,initialCount:carried,plannedNew:available,
  eventStartStock:packed,uncovered:rows.reduce((n,x)=>n+x.uncovered,0),
  rows,warnings,exact:false};
 if(result.uncovered>0)result.warnings.push('必要食材すべてを1週間分確保する計画ではありません。バッグ枠と優先方針による未充足個数を表示しています。');
 if(carried>Math.floor(capacity*quotaRatio))
  result.warnings.push('入力済み持ち越し数が方針上の備蓄枠を超えています。入力済みの在庫を勝手に減らさず、追加備蓄0としました。');
 return result;
}
function ingredientGuide({box,sleepIds,dayTeams,plan:prepared}){
 if(!prepared?.rows||!Array.isArray(box)||!Array.isArray(sleepIds))
  throw Error('編成ガイドの入力が不正です。');
 const idMap=new Map(box.map(p=>[p.id,p])),species=new Map(Master.species.map(x=>[x.name,x]));
 const valid=ids=>Array.isArray(ids)&&ids.length===5&&new Set(ids).size===5&&ids.every(id=>idMap.has(id));
 const fallback=valid(sleepIds)?[...sleepIds]:box.slice(0,5).map(p=>p.id);
 const guide={morning:[...fallback],noon:[...fallback],evening:[...fallback]},warnings=[];
 if(!valid(fallback))return {teams:null,matches:[],warnings:['手持ちが5匹未満なので、朝昼夜の5匹の準備候補は作成できません。']};
 if(prepared.mode==='energy'){
  for(const key of ['morning','noon','evening'])
   if(valid(dayTeams?.[key]))guide[key]=[...dayTeams[key]];
  warnings.push('今週のエナジー優先では既存の日中編成（未入力なら睡眠5匹）を維持します。イベント週の3編成や睡眠5匹は変更しません。');
  return {teams:guide,matches:[],warnings};
 }
 const weights=new Map(prepared.rows.filter(r=>r.toGather>0).map(r=>[r.key,r.toGather]));
 if(!weights.size){
  warnings.push('追加備蓄目標がありません。睡眠用5匹を日中も維持する参考案を表示します。');
  return {teams:guide,matches:[],warnings};
 }
 const ranked=box.map((p,index)=>{
  const sp=species.get(p.pokemon);
  const slots=p.level>=60?3:p.level>=30?2:1;
  let score=0;const matches=[];
  if(sp)for(let j=0;j<slots;j++){
   const key=KEYS.find(k=>Master.ingredients[k]===p.ingredients?.[j]);
   const entry=(sp.mythIng||sp.ings||[]).find(x=>x&&x.name===key&&x['c'+(j+1)]>0);
   if(entry&&weights.has(key)){
    score+=Math.min(10,entry['c'+(j+1)])*weights.get(key);
    matches.push(key);
   }
  }
  return {id:p.id,index,score,matches};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 const chosen=ranked.filter(x=>x.score>0).slice(0,5);
 const chosenIds=chosen.map(x=>x.id);
 for(const id of fallback)if(chosenIds.length<5&&!chosenIds.includes(id))chosenIds.push(id);
 for(const p of box)if(chosenIds.length<5&&!chosenIds.includes(p.id))chosenIds.push(p.id);
 for(const key of ['morning','noon','evening'])guide[key]=[...chosenIds];
 warnings.push('備蓄優先の編成は食材枠の一致度による参考候補です。確率・せいかく・スキル・げんき・満杯・週内獲得数の順位を表すものではありません。');
 warnings.push('0:00～7:30の睡眠5匹は変更しません。朝は7:30の初回回収後に切替え、昼夜の入替は任意です。');
 return {teams:guide,matches:chosen,warnings};
}
const api={plan,ingredientGuide};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStep4=api;
})(typeof globalThis!=='undefined'?globalThis:this);

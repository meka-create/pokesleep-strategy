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
// One explicitly bounded preparation-week scenario. Reuse the STEP2 simulator;
// do not manufacture a second ingredient-production formula or infer the
// preparation field from the *event* field. This is not a forecast of the
// user's real cooking/stock movements during the preparation week.
function forecast({box,sleepIds,teams,plan:prepared,weeklyOptions,field,fieldBonus,camp,
 cookingMode='none',foodMode='random',inventorySource='carryover'},simulate){
 if(typeof simulate!=='function')throw Error('週間計算器を利用できません。');
 if(typeof field!=='string'||!field.trim()||field.length>80)
  throw Error('準備週のフィールドを指定してください。');
 integer(fieldBonus,0,100,'準備週のフィールドボーナス');
 if(!prepared||!Array.isArray(prepared.rows)||!Number.isSafeInteger(prepared.capacity))
  throw Error('先に有効な備蓄計画を計算してください。');
 if(!teams||!['morning','noon','evening'].every(key=>Array.isArray(teams[key])&&teams[key].length===5)||
    !Array.isArray(sleepIds)||sleepIds.length!==5)
  throw Error('準備週の参考編成と固定睡眠5匹を先に用意してください。');
 if(!weeklyOptions||typeof weeklyOptions!=='object'||Array.isArray(weeklyOptions))
  throw Error('週間試算条件がありません。');
 if(!['none','saved'].includes(cookingMode)||
    !['random','curry','salad','dessert'].includes(foodMode)||
    !['carryover','simulation'].includes(inventorySource))
  throw Error('準備週の参考試算条件が不正です。');
 if(cookingMode==='saved'&&foodMode==='random')
  throw Error('料理ありの試算では準備週の料理カテゴリを指定してください。');
 if(cookingMode==='saved'&&weeklyOptions.recipeMode!=='best'&&!weeklyOptions.recipeId)
  throw Error('7日試算タブで料理レシピを選択して保存してください。');
 if(cookingMode==='saved'&&weeklyOptions.recipeMode!=='best'){
  const recipe=Recipes.find(r=>r.id===weeklyOptions.recipeId);
  if(!recipe||recipe.type!==foodMode)
   throw Error('7日試算のレシピと準備週の料理カテゴリが一致しません。');
 }
 const initialIngredients={};
 const source=inventorySource==='carryover'?
  Object.fromEntries(prepared.rows.map(r=>[r.key,r.carryover])):
  (weeklyOptions.initialIngredients||{});
 for(const [key,value] of Object.entries(source)){
  if(!KEYS.includes(key))throw Error('週初在庫の食材が不正です。');
  const count=integer(value,0,10000,'週初在庫');
  if(count)initialIngredients[key]=count;
 }
 const runInput={box,teams:{...teams,sleep:[...sleepIds]},options:{
  ...weeklyOptions,map:field.trim(),fieldBonus,camp:camp===true,
  bagCapacity:prepared.capacity,initialIngredients,
  recipeId:cookingMode==='saved'?weeklyOptions.recipeId:'',
  recipeMode:cookingMode==='saved'?weeklyOptions.recipeMode:'fixed',
  foodMode:cookingMode==='saved'?foodMode:'random',
  extraMode:cookingMode==='saved'?weeklyOptions.extraMode:'none',
  successMode:cookingMode==='saved'?weeklyOptions.successMode:'none',
  eventEffects:''
 }};
 const result=simulate(runInput);
 if(!result||!result.ingredients||typeof result.ingredients!=='object'||Array.isArray(result.ingredients)||
    !result.inventory||typeof result.inventory!=='object'||Array.isArray(result.inventory))
  throw Error('週間計算器の食材出力が不正です。');
 for(const [key,value] of [...Object.entries(result.ingredients),...Object.entries(result.inventory)])
  if(!KEYS.includes(key)||!Number.isFinite(value)||value<0)
   throw Error('週間計算器の食材出力が不正です。');
 const bagEnd=Object.values(result.inventory).reduce((sum,v)=>sum+v,0);
 if(bagEnd>prepared.capacity+1e-7)throw Error('週間計算器の週末在庫がバッグ容量を超えています。参考試算を中止しました。');
 const rows=prepared.rows.filter(r=>r.required>0||r.target>0).map(r=>{
  const expected=result.ingredients[r.key]||0,final=result.inventory[r.key]||0;
  return {key:r.key,name:r.name,targetNew:r.toGather,expectedNew:expected,
   expectedFinal:final,targetFinal:r.target,
   expectedShortfall:Math.max(0,r.target-final)};
 });
 return {field:field.trim(),fieldBonus,camp:camp===true,cookingMode,foodMode,inventorySource,
  targetNew:rows.reduce((sum,r)=>sum+r.targetNew,0),
  expectedNew:rows.reduce((sum,r)=>sum+r.expectedNew,0),
  rows,allExpectedNew:Object.values(result.ingredients).reduce((sum,v)=>sum+v,0),
  expectedBagEnd:bagEnd,
  weeklyEnergy:Number.isFinite(result.total)?result.total:null,
  cookingEnergy:Number.isFinite(result.cooking)?result.cooking:null,
  modelWarnings:Array.isArray(result.warnings)?[...result.warnings]:[],
  assumptions:[
   inventorySource==='carryover'? 'イベント週へ持ち越す予定の食材を準備週の開始時点で所持している仮定です。実際の現在庫とは限りません。':
    '週初在庫は「7日試算」で最後に保存した初期食材数です。準備週の現在庫として正しいか確認が必要です。',
   cookingMode==='none'?'準備週は料理を一切せず、バッグ容量内で食材を回収する仮定です。食事の消費・回復・エナジーは含みません。':
    '準備週の料理は「7日試算」で保存したレシピ・料理方式を使います。成立は期待食材数に依存する近似で、失敗分岐・実際の食事時刻を検証していません。',
   '回収間隔・睡眠スコア・初期げんき・食材ゲット系の抽選候補は「7日試算」の保存設定を利用します。',
   '結果は確率的な獲得・残存在庫の期待値近似であり、整数の保証数、目標達成確率、最適編成の証明ではありません。'
  ],exact:false};
}
// Compare two explicitly labelled *heuristics* under the same week settings.
// Required-ingredient shortfall is measured against the same event recipe demand,
// not each mode's different bag-share target. Never infer a winning strategy.
function compareModes({planInput,box,sleepIds,dayTeams,weeklyOptions,field,fieldBonus,camp,
 cookingMode='none',foodMode='random',inventorySource='carryover'},simulate){
 if(!planInput||typeof planInput!=='object'||Array.isArray(planInput))
  throw Error('比較する備蓄計画がありません。');
 const scenarios={};
 for(const priority of ['energy','stock']){
  const prepared=plan({...planInput,priority});
  const guide=ingredientGuide({box,sleepIds,dayTeams,plan:prepared});
  if(!guide.teams)throw Error('比較に必要な準備週の5匹編成を作成できません。');
  const estimate=forecast({box,sleepIds,teams:guide.teams,plan:prepared,weeklyOptions,
   field,fieldBonus,camp,cookingMode,foodMode,inventorySource},simulate);
  const finalByKey=new Map(estimate.rows.map(r=>[r.key,r.expectedFinal]));
  const expectedRequiredShortfall=prepared.rows.reduce((sum,r)=>
   sum+Math.max(0,r.required-(finalByKey.get(r.key)||0)),0);
  scenarios[priority]={priority,teams:guide.teams,forecast:estimate,
   plannedNew:prepared.plannedNew,expectedRequiredShortfall,
   warnings:[...prepared.warnings,...guide.warnings],exact:false};
 }
 const sameTeams=['morning','noon','evening'].every(key=>
  scenarios.energy.teams[key].every((id,i)=>id===scenarios.stock.teams[key][i]));
 return {scenarios,sameTeams,exact:false,assumptions:[
  '二つの方針は新規備蓄の暫定配分比率（30%／90%）と参考編成を比較したものです。最適化の証明や推奨順位ではありません。',
  '不足は両方とも同じイベント週の料理必要総数から週末期待在庫を引いた参考値です。実際の整数在庫・成立確率は保証されません。',
  '今週のエナジーは同じ既存7日モデルで計算しています。備蓄との交換比率を評価した総合スコアではありません。'
 ]};
}
const api={plan,ingredientGuide,forecast,compareModes};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStep4=api;
})(typeof globalThis!=='undefined'?globalThis:this);

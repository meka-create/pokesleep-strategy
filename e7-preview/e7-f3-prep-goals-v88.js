/* F3 v88: event-scoped, read-only goals for the existing U2 prep card.
 * The only writers remain the existing category Save and inventory Save controls.
 * A goal calculation is never mistaken for a confirmed event-week plan.
 */
(function(){
'use strict';
const q=s=>document.querySelector(s);
const Opt=window.PokeF3StockpileV120,Prefs=window.PokeF3PrepPrefsV120,Scope=window.PokeE7InventoryScope,E1=window.PokeE7E1;
const goalCells=[...document.querySelectorAll('#goal-panel .goal-grid .food')];
const stockCells=[...document.querySelectorAll('#inventory-panel .actual-grid .food')];
const total=q('#goal-panel .row.total strong');
const goalCard=q('#goal-panel>.card:first-child');
if(!Opt||!Prefs||!Scope||!E1||!Array.isArray(window.PokeRecipes)||
 goalCells.length!==20||stockCells.length!==20||!total||!goalCard)return;
const status=document.createElement('p');status.id='f3-prep-status';
status.className='f3-status';status.setAttribute('role','status');
goalCard.append(status);
const productionDetails=document.createElement('details');
productionDetails.id='f3-b-production';
const productionSummary=document.createElement('summary');
productionSummary.textContent='食材別のおすすめポケモン';
const productionBody=document.createElement('div');
productionBody.id='f3-b-production-content';
productionDetails.append(productionSummary,productionBody);goalCard.append(productionDetails);
let sourcePromise=null,renderToken=0,lastRequestedToken=0,currentScenario=null;
// F4 preflight audit: the optional F3-B reference is deliberately lazy.
// Loading an unexpanded secondary section must not parse a private box or
// fetch the pinned source catalog on every preparation-tab navigation.
function requestOpenScenario(){
 if(!productionDetails.open||!currentScenario)return;
 const {ctx,base,token}=currentScenario;
 if(lastRequestedToken===token)return;
 lastRequestedToken=token;
 void refreshProduction(ctx,base,token);
}
productionDetails.addEventListener('toggle',requestOpenScenario);
function sourceModels(){
 if(!sourcePromise)sourcePromise=Promise.all(
  ['../f1/f1-b-target-source-v1.json','../f1/f1-b-help-traits-v1.json']
   .map(async u=>{const res=await fetch(u,{cache:'no-store'});
    if(!res.ok)throw Error('SOURCE_UNAVAILABLE');return res.json();}))
  .then(([snapshot,traits])=>({snapshot,traits,
   legal:window.PokeF1LegalBuild,rates:window.PokeF1BaseRates}))
  .catch(e=>{sourcePromise=null;throw e;});
 return sourcePromise;
}
function showRecommendations(source,items){
 productionBody.replaceChildren();
 if(source.status!=='PROVISIONAL'){
  productionBody.textContent=source.message;
  return;
 }
 for(const cell of stockCells){
  const indices=source.byIngredient[cell.dataset.item];
  if(!indices||!cell.classList.contains('needed'))continue;
  const row=document.createElement('div');row.className='ingredient-picks';
  row.dataset.ingredient=cell.dataset.item;
  const name=cell.querySelector('.name').textContent.trim();
  const icon=document.createElement('img');icon.src=cell.querySelector('.pic').src;
  icon.alt=name;icon.title=name;
  const choices=document.createElement('span');
  choices.textContent=indices.map(i=>{
   const item=items[i];
   return (item.nickname||item.pokemon)+' Lv.'+item.level;
  }).join(' ／ ')||'該当する個体なし';
  row.append(icon,choices);productionBody.append(row);
 }
}
async function refreshProduction(ctx,base,token){
 const bridge=window.PokeF3ProductionScenario;
 if(!bridge){productionDetails.hidden=true;return;}
 let box;
 try{
  const raw=localStorage.getItem('pokesleep-strategy-e7-box-v1');
  if(!raw){productionBody.textContent='ボックスにポケモンを登録してください。';return;}
  box=JSON.parse(raw);
  if(box?.version!==1||!Array.isArray(box.items))throw Error('BOX_SCHEMA');
  if(!box.items.length){productionBody.textContent='ボックスにポケモンを登録してください。';return;}
 }catch(_){productionDetails.hidden=false;productionBody.textContent='ボックス情報を確認してください。';return;}
 productionDetails.hidden=false;productionBody.textContent='候補を計算中…';
 try{
  const deps=await sourceModels();
  if(token!==renderToken)return;
  const result=bridge.recommend({items:box.items,camp:ctx.camp,
   targetIngredients:base.demand},deps);
  if(token!==renderToken)return;
  showRecommendations(result,box.items);
 }catch(_){
  if(token===renderToken){
   lastRequestedToken=0;
   productionBody.textContent='計算原典を読み込めません。オフラインの場合は保存済みの準備目標を利用してください。';
  }
 }
}
const codes=new Map(stockCells.map(cell=>[
 cell.querySelector('.name')?.textContent?.trim(),cell.dataset.item]));
function resolveSelection(){
 const url=new URLSearchParams(location.search),fromUrl=url.get('eventStart'),eventId=url.get('eventId');
 let selected=null;
 try{selected=JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')||'null');}
 catch(e){}
 const week=fromUrl||selected?.weekStart;
 const id=eventId||(selected?.weekStart===week?selected.id:null);
 if(!Scope.validWeek(week)||!Scope.validEventId(id))
  throw Error('作戦タブでイベントを選択してください。');
 return {week,id};
}
function readContext(){
 const {week,id}=resolveSelection(),suffix=week+':'+encodeURIComponent(id);
 const draft=Prefs.preview?.();
 const raw=localStorage.getItem('pokesleep-strategy-u2-e6-prep-v1:'+suffix);
 if(!raw&&!draft)throw Error('備蓄する料理カテゴリを選んで保存してください。');
 const own=raw?JSON.parse(raw):null;
 if(raw&&(own?.version!==1||own.weekStart!==week||own.eventId!==id||
  !own.prep||own.prep.count!==own.prep.categories?.length||
  ![1,2,3].includes(own.prep.count)))throw Error('備蓄カテゴリの保存内容を確認してください。');
 const chosenCategories=draft?.input.categories||own?.prep.categories||[];
 if(!chosenCategories.length)throw Error('備蓄する料理カテゴリを選択してください。');
 const ledgerRaw=localStorage.getItem('pokesleep-strategy-u3-e3-v1:'+suffix+':conditions');
 if(!ledgerRaw)throw Error('作戦タブでイベント条件を保存してください。');
 const ledger=E1.validateConditionLedger(JSON.parse(ledgerRaw));
 if(ledger.weekStart!==week||ledger.eventId!==id||
  !['CONFIRMED','MISSING'].includes(ledger.confirmed?.status))
  throw Error('イベント条件を保存してください。');
 const fields=ledger.confirmed.fields;
 if(!['','curry','salad','dessert','all'].includes(fields.food)||
  typeof fields.camp!=='boolean')
  throw Error('イベントの料理・チケット条件を確認してください。');
 // The three F3 categories may be prepared before the weekly cooking type
 // is confirmed. A later single-category event does not cancel this hedge.
 // F4/F5 project only the eligible category; F3 retains all saved targets.
 const playerRaw=localStorage.getItem('pokesleep-strategy-e7-player-v1');
 const player=playerRaw?JSON.parse(playerRaw):null;
 if(player&&player.version!==1)throw Error('プレイヤー情報を確認してください。');
  const verified=window.PokeF3M3EventV131?.resolve({
   weekStart:week,eventId:id,source:fields.source,
   potCapacity:player?.pot},window.PokeM1LiteEnergyV128);
  if(verified?.status!=='EVENT_READY')
   throw Error('イベント補正・鍋容量を照合できません：'+
    (verified?.reason||'M3_EVENT_SOURCE_UNAVAILABLE'));
 const stockRaw=Scope.read(localStorage,week,id);
 const stock=stockRaw?E1.validateInventoryTimeline(stockRaw,week):null;
 const values=stock?.currentInventory?.values||stock?.startInventory?.values||{};
 const current={};
 for(const [name,code] of codes){
  const n=values[name]??0;
  if(!Number.isSafeInteger(n)||n<0||n>10000)throw Error('食材在庫の数値を確認してください。');
  current[code]=n;
 }
 return {week,id,revision:ledger.confirmed.revision,
  categories:chosenCategories,foodUnconfirmed:!fields.food,draft:draft?.input||null,
  preparationMode:fields.food==='all'?'ALL_MEALS':'ALTERNATIVE_WEEKLY_FOOD',
  camp:fields.camp,pot:verified.effectivePot,bag:player?.bag,current,
   event:verified.event,eventPotMultiplier:verified.event.potSize,
  preference:Prefs.read(week,id)};
}
function badge(cell,count){
 const media=cell.querySelector('.food-media');
 let el=media.querySelector('.target-chip');
 if(count<=0){el?.remove();return;}
 if(!el){el=document.createElement('span');el.className='target-chip';media.append(el);}
 el.replaceChildren();
 el.setAttribute('aria-label','目標 '+count+'個');
 const word=document.createElement('span');word.className='target-word';word.textContent='目標';
 const number=document.createElement('b');number.textContent=String(count);
 const unit=document.createElement('small');unit.textContent='個';
 el.append(word,number,unit);
}
function drawGoals(goals){
 let sum=0;
 for(let i=0;i<goalCells.length;i++){
  const cell=goalCells[i],stock=stockCells[i];
  const name=cell.querySelector('.name')?.textContent?.trim();
  const code=codes.get(name),count=code?(goals[code]||0):0;
  sum+=count;
  cell.classList.toggle('needed',count>0);cell.classList.toggle('not-needed',count<=0);
  stock.classList.toggle('needed',count>0);stock.classList.toggle('not-needed',count<=0);
  const val=cell.querySelector('.goal-value');val.replaceChildren();
  if(count>0){
   const b=document.createElement('b');b.textContent=String(count);
   const unit=document.createElement('small');unit.textContent='個';
   val.append(b,unit);
  }else{
   const dash=document.createElement('span');dash.className='dash';dash.textContent='―';val.append(dash);
  }
  badge(stock,count);
 }
 total.textContent=sum.toLocaleString('ja-JP')+'個';
}
// v124: link the EXACT adopted event-owned 29-window plan to opening targets.
// Never create/reconcile stable IDs from Prep, never rewrite a plan/inventory.
// When the cooking schedule, Box, owner, source or revision disagrees, the
// v120 capacity-safe conservative target remains visible.
async function applyAdoptedOpening(ctx,base,token){
 const Store=window.PokeF4CRealStoreV112,Bridge=window.PokeF4BE7ReadOnly;
 const Clock=window.PokeF4BGameWeek,IDs=window.PokeF4CStableBoxIDs;
 const Adapter=window.PokeF4F1RosterAdapter,Model=window.PokeF3AdoptedOpeningV124;
 if(!Store||!Bridge||!Clock||!IDs||!Adapter||!Model||ctx.draft)return;
 // v124 requires all selected meals to be actually cooked. Alternative
 // weekly categories are not simultaneously consumed, so its additive
 // production deduction must not reduce this conservative max reserve.
 if(base.preparationMode==='ALTERNATIVE_WEEKLY_FOOD'&&
  base.alternativeCategories>1)return;
 const k=Store.key('plan',ctx.week,ctx.id);
 if(!localStorage.getItem(k))return;
 const explanation=(message)=>{
  if(token!==renderToken)return;
  status.textContent=message;
 };
 try{
  const mock=new URLSearchParams(location.search).get('previewNow');
  const instant=mock?(mock+(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(mock)?':00':'')+'+09:00'):
   new Date().toISOString();
  const original=Bridge.readContext(localStorage,{scope:Scope,e1:E1,weekClock:Clock},instant);
  if(token!==renderToken)return;
  if(original.status!=='CONTEXT_READY'||original.weekStart!==ctx.week||
   original.eventId!==ctx.id||original.clock.phase!=='BEFORE'){
   explanation('採用済み作戦の条件を照合できないため、時間別生産は未控除です。');return;
  }
  const prefs='pokesleep-strategy-f3-v120:prep:'+ctx.week+':'+encodeURIComponent(ctx.id);
  const carry=Store.key('carry',ctx.week,ctx.id);
  const carryRaw=localStorage.getItem(carry);
  const c={...original,
   previousCarryRevision:carryRaw?
    (JSON.parse(carryRaw)?.revision||'INVALID_CARRY'):null,
   prepPreferenceRevision:localStorage.getItem(prefs)||null};
  const model=await sourceModels();
  const ids=await Store.verifyExistingIdentities(localStorage,c.privateBoxRows,{
   identity:IDs,crypto:window.crypto});
  if(token!==renderToken)return;
  if(ids.status!=='IDENTITIES_READY'){
   explanation('ボックスの個体ID照合が未完了のため、時間別生産は未控除です。');return;
  }
  const bonus=c.player?.bonuses?.[c.fields.field];
  if(!Number.isSafeInteger(bonus)||bonus<0||bonus>100){
   explanation('フィールドボーナスが未確定のため、生産予測を控除していません。');return;
  }
  const roster=Adapter.adapt({items:c.privateBoxRows,camp:c.fields.camp,
   fieldBonus:bonus,favoriteTypes:[]},{
   snapshot:model.snapshot,traits:model.traits,legal:model.legal,
   rates:model.rates,master:window.PokeMaster});
  if(roster.status!=='READY'){
    explanation('F1計算対象の実ボックス編成を確認できないため、生産予測は未控除です。');return;
   }
   const adjusted=window.PokeF3M3EventV131?.adjust(roster.profiles,ctx.event,
    window.PokeM1LiteEnergyV128,window.PokeF1SkillValues);
   if(adjusted?.status!=='ROSTER_READY'){
    explanation('イベント食材補正または個体スキルLvを照合できないため、生産予測は未控除です。');return;
   }
   const adopted=Store.readPlan(localStorage,c,ids,roster.sourceCommit,
   window.PokeRecipes,c.clock);
  if(adopted.status!=='ADOPTED'){
   explanation('採用済み作戦が現在の条件と一致しないため、生産予測を控除していません。再提案・採用後に更新されます。');return;
  }
  const result=Model.calculate({ctx:c,plan:adopted.plan,identity:ids,
   roster:{...roster,profiles:adjusted.profiles},recipes:window.PokeRecipes,
    base,bagCapacity:ctx.bag,
   currentStock:ctx.current});
  if(token!==renderToken)return;
  if(result.status!=='PROVISIONAL'){
   explanation(result.reason==='PLANNED_RECIPE_DIFFERS'||result.reason==='PLANNED_MEAL_COUNT_DIFFERS'?
    '採用済み作戦の料理・食数が備蓄設定と異なるため、目標を減らしていません。':
    '実編成の予測食材とバッグ容量を安全に両立できないため、目標を減らしていません。');
   return;
  }
  // Check immutable owner inputs once more after all async work.
  const fresh=readContext();
   if(fresh.week!==ctx.week||fresh.id!==ctx.id||
    fresh.revision!==ctx.revision||fresh.pot!==ctx.pot||
    JSON.stringify(fresh.current)!==JSON.stringify(ctx.current)||
    fresh.eventPotMultiplier!==ctx.eventPotMultiplier)return;
   if(localStorage.getItem(k)!==adopted.revision||
    localStorage.getItem('pokesleep-strategy-e7-box-v1')!==ids.boxRaw||
   localStorage.getItem(Store.LEDGER)!==ids.ledgerRevision||
   localStorage.getItem(prefs)!==c.prepPreferenceRevision)return;
  drawGoals(result.goals);
  const saved=Object.values(result.deductedExpected).reduce((a,b)=>a+b,0);
  status.textContent=saved?'採用作戦の生産見込みで '+saved.toLocaleString('ja-JP')+'個控除':'';
  for(const row of productionBody.querySelectorAll('.ingredient-picks')){
   if(!result.goals[row.dataset.ingredient])row.remove();
  }
  productionDetails.hidden=!Object.values(result.goals).some(n=>n>0);
 }catch(_){explanation('計算原典または保存状態を照合できないため、生産予測は未控除です。');}
}

function render(){
 const token=++renderToken;
 try{
  const ctx=readContext();
  const pref=ctx.preference;
  const aligned=pref&&pref.categories.length===ctx.categories.length&&
   ctx.categories.every(c=>pref.categories.includes(c));
  const result=Opt.make({recipes:window.PokeRecipes,categories:ctx.categories,
   camp:ctx.camp,bagCapacity:ctx.bag,potCapacity:ctx.pot,
   preparationMode:ctx.preparationMode,
   currentStock:ctx.current,
   selectedRecipes:ctx.draft?.selectedRecipes||(aligned?pref.selectedRecipes:undefined),
   targetMeals:ctx.draft?.targetMeals||(aligned?pref.targetMeals:undefined)});
  if(result.status!=='PROVISIONAL')throw Error(result.message);
  drawGoals(result.goals);
  status.textContent=ctx.draft?'未保存の目標プレビュー':ctx.foodUnconfirmed?'料理未確定':'';
  status.dataset.state='ready';
  currentScenario={ctx,base:result,token};
  if(!ctx.draft)void applyAdoptedOpening(ctx,result,token);
  productionDetails.hidden=false;
  if(productionDetails.open)requestOpenScenario();
  else productionBody.replaceChildren();
 }catch(error){
  drawGoals({});
  status.textContent=error.message||'備蓄目標を算出できません。';
  status.dataset.state='blocked';
  currentScenario=null;
  productionDetails.hidden=true;productionBody.replaceChildren();
 }
}
const rerender=()=>queueMicrotask(render);
 window.addEventListener('pokesleep-prep-v120-saved',rerender);
 window.addEventListener('pokesleep-prep-v121-preview',rerender);
q('#e6-prep-save')?.addEventListener('click',rerender);
q('#save-inventory')?.addEventListener('click',rerender);
window.addEventListener('storage',e=>{
 if(e.key===null||e.key?.startsWith('pokesleep-strategy-u2-e6-prep-v1:')||
  e.key?.startsWith('pokesleep-strategy-u2-e2-v1:')||
  e.key?.startsWith('pokesleep-strategy-u3-e3-v1:')||
  e.key==='pokesleep-strategy-e7-player-v1'||
  e.key==='pokesleep-strategy-e7-box-v1')render();
});
window.addEventListener('pageshow',e=>{if(e.persisted)render();});
render();
})();

/* F3 v88: event-scoped, read-only goals for the existing U2 prep card.
 * The only writers remain the existing category Save and inventory Save controls.
 * A goal calculation is never mistaken for a confirmed event-week plan.
 */
(function(){
'use strict';
const q=s=>document.querySelector(s);
const Opt=window.PokeF3PrepOptimizer,Scope=window.PokeE7InventoryScope,E1=window.PokeE7E1;
const goalCells=[...document.querySelectorAll('#goal-panel .goal-grid .food')];
const stockCells=[...document.querySelectorAll('#inventory-panel .actual-grid .food')];
const total=q('#goal-panel .row.total strong');
const goalCard=q('#goal-panel>.card:first-child');
if(!Opt||!Scope||!E1||!Array.isArray(window.PokeRecipes)||
 goalCells.length!==19||stockCells.length!==19||!total||!goalCard)return;
const status=document.createElement('p');status.id='f3-prep-status';
status.className='f3-status';status.setAttribute('role','status');
goalCard.append(status);
const detail=document.createElement('details');detail.id='f3-prep-breakdown';
const summary=document.createElement('summary');summary.textContent='料理内訳';
const content=document.createElement('div');content.id='f3-prep-dishes';
detail.append(summary,content);goalCard.append(detail);
// F3-B production scenario is read-only, secondary, and never replaces the
// confirmed preparation targets. Defer nonessential data loads until ready.
const productionDetails=document.createElement('details');
productionDetails.id='f3-b-production';
const productionSummary=document.createElement('summary');
productionSummary.textContent='実個体の食材生産（参考）';
const productionBody=document.createElement('div');
productionBody.id='f3-b-production-content';
productionDetails.append(productionSummary,productionBody);detail.append(productionDetails);
let sourcePromise=null,renderToken=0;
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
function showProductionResult(ctx,base,source){
 productionBody.replaceChildren();
 const write=(text,cls='f3-caveat')=>{
  const p=document.createElement('p');p.className=cls;p.textContent=text;
  productionBody.append(p);
 };
 if(source.status!=='PROVISIONAL'){
  write(source.message||'ボックスの個体情報を確認してください。');
  return;
 }
 const members=source.teamSpecies.join('・');
 write('仮の5匹：'+members,'f3-category-result');
 const projection=Opt.plan({recipes:window.PokeRecipes,categories:ctx.categories,
  camp:ctx.camp,potCapacity:ctx.pot,bagCapacity:ctx.bag,
  currentStock:ctx.current,forecastProduction:source.scenarioProduction});
 const all=source.scenarioProduction;
 const ranked=Object.entries(all).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6);
 const labelFor=Object.fromEntries([...codes].map(([jp,code])=>[code,jp]));
 write('168時間の0げんき基準・連続編成シナリオ（主な食材）：'+
  (ranked.map(([key,n])=>(labelFor[key]||key)+' 約'+n+'個').join('、')||'対象なし'));
 if(projection.status==='PROVISIONAL'){
  write('この仮生産を使った場合の料理候補：'+projection.recipesUsed+'食（生産なし：'+base.recipesUsed+'食）');
  const differences=Object.entries(base.topups)
   .filter(([key,n])=>n!==(projection.topups[key]||0))
   .map(([key,n])=>({key,before:n,after:projection.topups[key]||0,diff:Math.abs(n-(projection.topups[key]||0))}))
   .sort((a,b)=>b.diff-a.diff).slice(0,5);
  if(differences.length)write('必要な追加収集数の比較（仮定による変化）：'+differences.map(
   x=>(labelFor[x.key]||x.key)+' '+x.before+'→'+x.after).join('、'));
 }
 write('実際の編成ではありません。げんき・所持数・回収・スキル・収集時刻は未反映。'+
  (source.assumedMintCount||source.assumedRibbonCount?
   ' ミント未記入'+source.assumedMintCount+'匹／睡眠時間未記入'+source.assumedRibbonCount+'匹は仮定値です。':'')+
  ' 生産量は確実ではないため、準備目標から自動控除しません。');
}
async function refreshProduction(ctx,base,token){
 const bridge=window.PokeF3ProductionScenario;
 if(!bridge){productionDetails.hidden=true;return;}
 let box;
 try{
  const raw=localStorage.getItem('pokesleep-strategy-e7-box-v1');
  if(!raw){productionDetails.hidden=true;return;}
  box=JSON.parse(raw);
  if(box?.version!==1||!Array.isArray(box.items))throw Error('BOX_SCHEMA');
 }catch(_){productionDetails.hidden=false;productionBody.textContent='ボックス情報を確認してください。';return;}
 productionDetails.hidden=false;productionBody.textContent='計算原典を照合中…';
 try{
  const deps=await sourceModels();
  if(token!==renderToken)return;
  const result=bridge.estimate({items:box.items,camp:ctx.camp,
   targetIngredients:base.demand},deps);
  if(token!==renderToken)return;
  showProductionResult(ctx,base,result);
 }catch(_){
  if(token===renderToken)
   productionBody.textContent='計算原典を読み込めません。オフラインの場合は保存済みの準備目標を利用してください。';
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
 const raw=localStorage.getItem('pokesleep-strategy-u2-e6-prep-v1:'+suffix);
 if(!raw)throw Error('備蓄する料理カテゴリを選んで保存してください。');
 const own=JSON.parse(raw);
 if(own?.version!==1||own.weekStart!==week||own.eventId!==id||
  !own.prep||own.prep.count!==own.prep.categories?.length||
  ![1,2,3].includes(own.prep.count))throw Error('備蓄カテゴリの保存内容を確認してください。');
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
 if(fields.food&&fields.food!=='all'&&own.prep.categories.some(c=>c!==fields.food))
  throw Error('備蓄する料理カテゴリとイベント条件の料理が一致しません。');
 const playerRaw=localStorage.getItem('pokesleep-strategy-e7-player-v1');
 const player=playerRaw?JSON.parse(playerRaw):null;
 if(player&&player.version!==1)throw Error('プレイヤー情報を確認してください。');
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
  categories:own.prep.categories,foodUnconfirmed:!fields.food,
  camp:fields.camp,pot:player?.pot,bag:player?.bag,current};
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
function render(){
 const token=++renderToken;
 try{
  const ctx=readContext();
  const result=Opt.plan({recipes:window.PokeRecipes,categories:ctx.categories,
   camp:ctx.camp,bagCapacity:ctx.bag,potCapacity:ctx.pot,
   currentStock:ctx.current});
  if(result.status!=='PROVISIONAL')throw Error(result.message);
  drawGoals(result.goals);
  status.textContent='F3暫定目標（既存78料理）'+(ctx.foodUnconfirmed?'・料理未確定':'')+' · '+result.recipesUsed+'/'+result.mealSlots+
   '食 · バッグ '+result.capacity.used.toLocaleString('ja-JP')+'/'+
   result.capacity.bag.toLocaleString('ja-JP')+'個';
  status.dataset.state='ready';detail.hidden=false;
  content.replaceChildren();
  for(const group of result.categories){
   const section=document.createElement('p');section.className='f3-category-result';
   section.textContent=({'curry':'カレー','salad':'サラダ','dessert':'デザート'}[group.category])+
    ' '+group.meals+'食：'+(group.dishes.map(d=>d.name+' ×'+d.count).join('、')||'対象なし');
   content.append(section);
  }
  const caveat=document.createElement('p');caveat.className='f3-caveat';
  caveat.textContent='基礎エナジーによる備蓄参考値。レシピレベル・料理チャンス・イベント中の食材生産は未反映。'+
   (ctx.foodUnconfirmed?' 料理未確定のため、選択カテゴリを均等優先する準備用シナリオです。':'')+
   (ctx.week>='2026-11-16'?' 11/16追加予定の新食材「ひとくちナッツ」と新料理3種は未反映。':'');
  content.append(caveat);
  void refreshProduction(ctx,result,token);
 }catch(error){
  drawGoals({});
  status.textContent=error.message||'備蓄目標を算出できません。';
  status.dataset.state='blocked';
  detail.hidden=true;content.replaceChildren();
  productionDetails.hidden=true;productionBody.replaceChildren();
 }
}
const rerender=()=>queueMicrotask(render);
q('#e6-prep-save')?.addEventListener('click',rerender);
q('#save-inventory')?.addEventListener('click',rerender);
window.addEventListener('storage',e=>{
 if(e.key===null||e.key?.startsWith('pokesleep-strategy-u2-e6-prep-v1:')||
  e.key?.startsWith('pokesleep-strategy-u2-e2-v1:')||
  e.key?.startsWith('pokesleep-strategy-u3-e3-v1:')||
  e.key==='pokesleep-strategy-e7-player-v1')render();
});
window.addEventListener('pageshow',e=>{if(e.persisted)render();});
render();
})();

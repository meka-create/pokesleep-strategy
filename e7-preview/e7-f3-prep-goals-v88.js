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
 if(ledger.weekStart!==week||ledger.eventId!==id||ledger.confirmed?.status!=='CONFIRMED')
  throw Error('イベント条件が確定していません。');
 const fields=ledger.confirmed.fields;
 if(!['curry','salad','dessert','all'].includes(fields.food)||
  typeof fields.camp!=='boolean')
  throw Error('イベントの料理・チケット条件を確認してください。');
 if(fields.food!=='all'&&own.prep.categories.some(c=>c!==fields.food))
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
  categories:own.prep.categories,
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
 try{
  const ctx=readContext();
  const result=Opt.plan({recipes:window.PokeRecipes,categories:ctx.categories,
   camp:ctx.camp,bagCapacity:ctx.bag,potCapacity:ctx.pot,
   currentStock:ctx.current});
  if(result.status!=='PROVISIONAL')throw Error(result.message);
  drawGoals(result.goals);
  status.textContent='F3暫定目標 · '+result.recipesUsed+'/'+result.mealSlots+
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
  caveat.textContent='レシピの基礎エナジーによる備蓄参考値。レシピレベル・料理チャンス・イベント中の食材生産は未反映。';
  content.append(caveat);
 }catch(error){
  drawGoals({});
  status.textContent=error.message||'備蓄目標を算出できません。';
  status.dataset.state='blocked';
  detail.hidden=true;content.replaceChildren();
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

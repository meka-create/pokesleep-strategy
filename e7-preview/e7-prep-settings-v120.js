/* F3 v120 preparation selectors: event-owned, one recipe and meal limit per category. */
(function(root){
 'use strict';
 const calc=root.PokeF3StockpileV120,catCard=document.getElementById('e6-prep-category-card');
 if(!calc||!catCard)return;
 const q=s=>document.querySelector(s),types=calc.CATS,allRecipes=root.PokeRecipes;
 const selectedKey='pokesleep-strategy-u3-e3-v1:selected';
 const qs=new URLSearchParams(location.search);
 let selected=null;
 try{selected=JSON.parse(localStorage.getItem(selectedKey)||'null');}catch(_){}
 const week=qs.get('eventStart')||selected?.weekStart;
 const id=qs.get('eventId')||(selected?.weekStart===week?selected?.id:null);
 const goodWeek=/^\d{4}-\d{2}-\d{2}$/.test(week||'')&&
  new Date(week+'T12:00:00Z').getUTCDay()===1;
 const valid=goodWeek&&typeof id==='string'&&id.length>0&&id.length<=160;
 const key=(w,e)=>'pokesleep-strategy-f3-v120:prep:'+w+':'+encodeURIComponent(e);
 const oldKey=valid?'pokesleep-strategy-u2-e6-prep-v1:'+week+':'+encodeURIComponent(id):null;
 const newKey=valid?key(week,id):null;
 function read(w,e){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(w||'')||typeof e!=='string'||!e)return null;
  const raw=localStorage.getItem(key(w,e));
  if(!raw)return null;
  const r=JSON.parse(raw);
  if(r?.kind!=='F3_STOCKPILE_PREF_V120'||r.version!==1||
   r.weekStart!==w||r.eventId!==e||
   !Array.isArray(r.categories)||r.categories.length<1||r.categories.length>3||
   new Set(r.categories).size!==r.categories.length||
   r.categories.some(c=>!types.includes(c))||
   !r.selectedRecipes||!r.targetMeals)return null;
  return r;
 }
 const section=document.createElement('div');
 section.id='f3-v120-controls';
 section.setAttribute('aria-label','レシピと目標食数');
 const msg=document.createElement('p');msg.id='f3-v120-warning';msg.setAttribute('role','status');
 section.append(msg);
 catCard.insertBefore(section,q('#e6-prep-save'));
 const style=document.createElement('style');style.id='f3-v120-controls-style';
 style.textContent='#f3-v120-controls{display:grid;gap:8px;margin-top:9px}'+
  '.f3-v120-row{padding:9px;border:1px solid #4b6077;border-radius:10px;background:#1d3045;display:grid;gap:6px}'+
  '.f3-v120-row label{display:grid;gap:4px;color:#dee8f2;font-size:12px;font-weight:600}'+
  '.f3-v120-row select{width:100%;min-height:40px;padding:5px 8px;border-radius:8px;color:#f5f7fc;background:#17283c;border:1px solid #6b8299;font:inherit;font-size:12px}'+
  '.f3-v120-head{font-size:12px;font-weight:750;color:#f5e0b2}'+
  '#f3-v120-warning{font-size:11px;color:#e3c48b;margin:1px 0;line-height:1.45}';
 document.head.append(style);
 function cfg(){
  try{
   const raw=localStorage.getItem('pokesleep-strategy-e7-player-v1');
   const player=raw?JSON.parse(raw):null;
   const suffix=week+':'+encodeURIComponent(id);
   const led=localStorage.getItem('pokesleep-strategy-u3-e3-v1:'+suffix+':conditions');
   const c=led?JSON.parse(led):null;
   return {potCapacity:player?.pot,bagCapacity:player?.bag,
    camp:c?.confirmed?.fields?.camp};
  }catch(_){return {};}
 }
 function current(){
  try{
   const raw=root.PokeE7InventoryScope.read(localStorage,week,id);
   const data=raw?root.PokeE7E1.validateInventoryTimeline(raw,week):null;
   const values=data?.currentInventory?.values||data?.startInventory?.values||{};
   const stock={};
   for(const cell of document.querySelectorAll('#inventory-panel .actual-grid .food')){
    const code=cell.dataset.item,name=cell.querySelector('.name')?.textContent?.trim();
    stock[code]=values[name]??0;
   }
   return stock;
  }catch(_){return null;}
 }
 function categories(){
  const count=Number(q('[data-stock-count][aria-pressed="true"]')?.dataset.stockCount||0);
  if(count===3)return [...types];
  return types.filter(t=>q('[data-stock-type="'+t+'"]')?.getAttribute('aria-pressed')==='true')
   .filter((_,i,a)=>a.length===count);
 }
 let saved=null;
 try{if(valid)saved=read(week,id);}catch(_){}
 let recipes={...(saved?.selectedRecipes||{})},meals={...(saved?.targetMeals||{})};
 let needsReview=false,renderKey='';
 function build(){
  const cats=categories(),conf=cfg(),stock=current();
  const selectedRecipes={},targetMeals={};
  for(const c of cats){
   const top=calc.catalog(allRecipes,c,conf.potCapacity,conf.camp);
   if(top.length)selectedRecipes[c]=recipes[c]&&top.some(x=>x.id===recipes[c])?
    recipes[c]:top[0].id;
   targetMeals[c]=meals[c]??'auto';
  }
  return {categories:cats,...conf,currentStock:stock??{},recipes:allRecipes,
   selectedRecipes,targetMeals};
 }
 function draw(){
  section.querySelectorAll('.f3-v120-row').forEach(n=>n.remove());
  if(!valid){msg.textContent='イベントを選択してください。';return;}
  const p=build();
  if(!p.categories.length){msg.textContent='カテゴリを選ぶとレシピと食数を設定できます。';return;}
  const result=calc.make(p);
  msg.textContent=result.status==='PROVISIONAL'?
   '各カテゴリ1種類。バッグ容量内で最大21食分。':
   result.message||'食材目標を計算できません。';
  for(const type of p.categories){
   const top=calc.catalog(allRecipes,type,p.potCapacity,p.camp);
   const row=document.createElement('div');row.className='f3-v120-row';
   const head=document.createElement('div');head.className='f3-v120-head';
   head.textContent=({curry:'カレー',salad:'サラダ',dessert:'デザート'}[type]);
   const recipeLabel=document.createElement('label');recipeLabel.textContent='レシピ（高エナジー上位5件）';
   const recipeSelect=document.createElement('select');
   recipeSelect.setAttribute('aria-label',head.textContent+'のレシピ');
   for(const r of top){
    const o=document.createElement('option');o.value=r.id;
    o.textContent=r.name+'（'+r.baseStrength.toLocaleString('ja-JP')+' / '+r.size+'個）';
    recipeSelect.append(o);
   }
   recipeSelect.value=p.selectedRecipes[type]||'';
   recipeSelect.addEventListener('change',()=>{
    recipes[type]=recipeSelect.value;
    // Changed ingredients invalidate a previously chosen manual count.
    meals[type]='auto';needsReview=false;draw();
   });
   recipeLabel.append(recipeSelect);
   const mealLabel=document.createElement('label');mealLabel.textContent='目標食数';
   const mealSelect=document.createElement('select');
   mealSelect.setAttribute('aria-label',head.textContent+'の目標食数');
   const allowed=calc.mealOptions({...p,selectedRecipes:{...p.selectedRecipes,[type]:recipeSelect.value}},type);
   const auto=document.createElement('option');auto.value='auto';
   auto.textContent='自動（バッグ容量に合わせる）';
   mealSelect.append(auto);
   for(const n of allowed){
    const o=document.createElement('option');o.value=String(n);o.textContent=n+'食分';
    mealSelect.append(o);
   }
   const choice=p.targetMeals[type];
   if(choice!=='auto'&&!allowed.includes(choice)){
    meals[type]='auto';needsReview=true;
    msg.textContent='容量や他カテゴリの設定が変わりました。食数を再選択して保存してください。';
   }
   mealSelect.value=meals[type]??'auto';
   mealSelect.addEventListener('change',()=>{
    meals[type]=mealSelect.value==='auto'?'auto':Number(mealSelect.value);
    needsReview=false;draw();
   });
   mealLabel.append(mealSelect);
   row.append(head,recipeLabel,mealLabel);section.append(row);
  }
  renderKey=JSON.stringify([p.categories,p.bagCapacity,p.potCapacity,p.camp,recipes,meals]);
 }
 for(const b of catCard.querySelectorAll('[data-stock-count],[data-stock-type]'))
  b.addEventListener('click',()=>queueMicrotask(()=>{needsReview=false;draw();}));
 q('#e6-prep-save').addEventListener('click',e=>{
  e.preventDefault();e.stopImmediatePropagation();
  if(!valid)return;
  const p=build();
  const res=calc.make(p);
  if(res.status!=='PROVISIONAL'||needsReview){
   msg.textContent=needsReview?'食数を再選択してください。':res.message||'設定を確認してください。';
   return;
  }
  const draft={count:p.categories.length,categories:p.categories};
  const stamp=new Date().toISOString();
  const oldRecord={version:1,weekStart:week,eventId:id,prep:draft,savedAt:stamp};
  const newRecord={kind:'F3_STOCKPILE_PREF_V120',version:1,weekStart:week,eventId:id,
   categories:p.categories,selectedRecipes:res.selectedRecipes,
   targetMeals:res.targetMeals,allocatedMeals:res.counts,savedAt:stamp};
  const oldRaw=localStorage.getItem(oldKey),newRaw=localStorage.getItem(newKey);
  try{
   const old=oldRaw?JSON.parse(oldRaw):null,prior=newRaw?JSON.parse(newRaw):null;
   if(old&&(old.weekStart!==week||old.eventId!==id)||
      prior&&(prior.weekStart!==week||prior.eventId!==id))
    throw Error('EVENT_OWNER');
   localStorage.setItem(oldKey,JSON.stringify(oldRecord));
   localStorage.setItem(newKey,JSON.stringify(newRecord));
   saved=newRecord;msg.textContent='';root.PokeUI.toast('備蓄レシピと食数を保存しました');
   root.dispatchEvent(new Event('pokesleep-prep-v120-saved'));
  }catch(_){
   try{if(oldRaw===null)localStorage.removeItem(oldKey);else localStorage.setItem(oldKey,oldRaw);
    if(newRaw===null)localStorage.removeItem(newKey);else localStorage.setItem(newKey,newRaw);}catch(_){}
   msg.textContent='保存できませんでした。既存データを保護しています。';
  }
 },true);
 const refresh=()=>{const sig=JSON.stringify([categories(),cfg(),recipes,meals]);
  if(sig!==renderKey)draw();};
 root.addEventListener('storage',e=>{
  if(e.key===oldKey||e.key===newKey||e.key==='pokesleep-strategy-e7-player-v1'){
   saved=read(week,id);recipes={...(saved?.selectedRecipes||{})};
   meals={...(saved?.targetMeals||{})};draw();
  }
 });
 q('#save-inventory')?.addEventListener('click',()=>queueMicrotask(draw));
 root.PokeF3PrepPrefsV120=Object.freeze({key,read,build,categories,refresh});
 draw();
})(window);

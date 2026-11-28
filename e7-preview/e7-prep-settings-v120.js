/* F3 v121: compact, event-owned recipe selector in the EXISTING U2 lower card.
 * Keep the upper 19 ingredient cards and both top tab anchors bit-for-bit intact.
 * Editing only previews; persistence is explicit and atomic for both keys.
 */
(function(root){
 'use strict';
 const calc=root.PokeF3StockpileV120,card=document.getElementById('e6-prep-category-card');
 if(!calc||!card)return;
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
 const saveButton=q('#e6-prep-save'),legacyMsg=q('#e6-prep-message');
 const countGroup=card.querySelector('.e6-prep-count');
 const typeGroup=q('#e6-prep-types');
 const title=card.querySelector('.card-heading');
 if(!saveButton||!countGroup||!typeGroup||!title)return;
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
 function oldCategories(){
  if(!valid)return [];
  try{
   const r=JSON.parse(localStorage.getItem(oldKey)||'null');
   if(r?.weekStart!==week||r.eventId!==id||r.prep?.count!==r.prep?.categories?.length||
    ![1,2,3].includes(r.prep.count)||new Set(r.prep.categories).size!==r.prep.count||
    r.prep.categories.some(c=>!types.includes(c)))return [];
   return types.filter(c=>r.prep.categories.includes(c));
  }catch(_){return [];}
 }
 function cfg(){
  try{
   const raw=localStorage.getItem('pokesleep-strategy-e7-player-v1');
   const player=raw?JSON.parse(raw):null;
   const suffix=week+':'+encodeURIComponent(id);
   const led=localStorage.getItem('pokesleep-strategy-u3-e3-v1:'+suffix+':conditions');
   const c=led?JSON.parse(led):null;
   const fields=c?.confirmed?.fields;
    const verified=root.PokeF3M3EventV131?.resolve({
     weekStart:week,eventId:id,source:fields?.source,
     potCapacity:player?.pot},root.PokeM1LiteEnergyV128);
    return {potCapacity:verified?.status==='EVENT_READY'?verified.effectivePot:null,
     bagCapacity:player?.bag,camp:fields?.camp,
     // One fixed weekly food = mutually exclusive alternative food cases.
     preparationMode:fields?.food==='all'?'ALL_MEALS':'ALTERNATIVE_WEEKLY_FOOD',
     eventBlocked:verified?.status==='BLOCKED'?
      'イベント補正・鍋容量を照合できません：'+verified.reason:null};
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
  const active=types.filter(c=>q('[data-stock-type="'+c+'"]')?.getAttribute('aria-pressed')==='true');
  return active.length===count?active:[];
 }
 const summary=document.createElement('div');summary.id='prep-v121-summary';
 summary.setAttribute('aria-live','polite');
 title.after(summary);
 const section=document.createElement('div');section.id='f3-v120-controls';
 section.setAttribute('aria-label','レシピと目標食数');
 const notice=document.createElement('p');notice.id='f3-v120-warning';
 notice.setAttribute('role','status');section.append(notice);
 typeGroup.after(section);
 const actions=document.createElement('div');actions.id='prep-v121-actions';
 const cancel=document.createElement('button');cancel.type='button';
 cancel.id='prep-v121-cancel';cancel.className='btn secondary';cancel.textContent='キャンセル';
 saveButton.before(actions);actions.append(cancel,saveButton);
 const style=document.createElement('style');style.id='prep-v121-style';
 style.textContent=
  '#e6-prep-category-card:not(.prep-v121-editing) .e6-prep-count,'+
  '#e6-prep-category-card:not(.prep-v121-editing) .e6-prep-types,'+
  '#e6-prep-category-card:not(.prep-v121-editing) #f3-v120-controls{display:none!important}'+
  '#prep-v121-summary{margin-top:7px;display:grid;gap:5px;font-size:12px;line-height:1.4}'+
  '.prep-v121-summary-row{display:grid;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;gap:5px}'+
  '.prep-v121-summary-row span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.prep-v121-summary-row strong{color:var(--gold);font-size:12px;font-variant-numeric:tabular-nums}'+
  '.prep-v121-summary-type{color:var(--muted);font-size:11px}'+
  '.prep-v121-capacity{display:flex;justify-content:space-between;align-items:center;gap:7px;padding-top:6px;margin-top:4px;border-top:1px solid var(--line);font-size:11px}'+
  '.prep-v121-capacity strong{color:var(--gold);font-variant-numeric:tabular-nums}'+
  '#f3-prep-status:empty{display:none}'+
  '#f3-b-production>summary{cursor:pointer;font-weight:700;font-size:12px}'+
  '.ingredient-picks{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}'+
  '.ingredient-picks img{width:30px;height:30px;object-fit:contain}'+
  '#f3-v120-controls{display:grid;gap:4px;margin-top:9px}'+
  '.prep-v121-row{display:grid;grid-template-columns:54px minmax(0,1fr) 98px;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}'+
  '.prep-v121-row:last-child{border-bottom:0}'+
  '.prep-v121-row label{display:block;min-width:0}'+
  '.prep-v121-row label span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}'+
  '.prep-v121-row select{width:100%;min-width:0;min-height:40px;padding:5px 5px;background:#17283c;color:var(--ink);border:1px solid #61768c;border-radius:9px;font:inherit;font-size:12px}'+
  '#f3-v120-warning{font-size:11px;color:#e3c48b;margin:2px 0;line-height:1.45}'+
  '#f3-v120-warning:empty{display:none}'+
  '#prep-v121-actions{display:flex;gap:7px;margin-top:9px}'+
  '#prep-v121-actions .btn{flex:1;min-width:0;width:auto;margin:0}'+
  '#prep-v121-cancel[hidden]{display:none!important}'+
  '#e6-prep-category-card.prep-v121-editing #prep-v121-summary .prep-v121-summary-row{display:none}'+
  '@media(max-width:350px){.prep-v121-row{grid-template-columns:44px minmax(0,1fr) 85px;gap:4px}.prep-v121-row select{font-size:11px;padding:4px}.prep-v121-summary-row{grid-template-columns:44px minmax(0,1fr) auto}}';
 document.head.append(style);
 const label={curry:'カレー',salad:'サラダ',dessert:'デザート'};
 let saved=null;
 try{if(valid)saved=read(week,id);}catch(_){}
 let recipes={},meals={},editing=false,needsReview=false,warning='',restoring=false;
 // One editor is opened automatically only when the event lacks a saved category.
 editing=valid&&oldCategories().length===0;
 function resetDraft(){
  saved=valid?read(week,id):null;
  recipes={...(saved?.selectedRecipes||{})};
  meals={...(saved?.targetMeals||{})};
  needsReview=false;warning='';
 }
 try{resetDraft();}catch(_){saved=null;recipes={};meals={};warning='保存データの形式を確認してください。';}
 function restoreButtons(){
  const cats=oldCategories();
  if(!cats.length)return;
  restoring=true;
  try{
   card.querySelector('[data-stock-count="'+cats.length+'"]')?.click();
   if(cats.length<3)for(const c of cats)
    card.querySelector('[data-stock-type="'+c+'"]')?.click();
  }finally{restoring=false;}
 }
 function recipeOptions(type,settings){
  const ranked=calc.catalog(allRecipes,type,settings.potCapacity,settings.camp);
  // Keep a previously saved smaller dish available when editing its plan.
  return ranked.filter((r,index)=>index<5||r.id===saved?.selectedRecipes?.[type]);
 }
 function build(){
  const cats=categories(),conf=cfg(),stock=current();
  const chosen={},wanted={};
  for(const c of cats){
   const top=recipeOptions(c,conf);
   if(top.length)chosen[c]=recipes[c]&&top.some(x=>x.id===recipes[c])?
    recipes[c]:top[0].id;
   wanted[c]=meals[c]??'auto';
  }
  return {categories:cats,...conf,currentStock:stock,recipes:allRecipes,
   selectedRecipes:chosen,targetMeals:wanted};
 }
 function calculate(input){
   if(!input.currentStock)return {status:'BLOCKED',message:'食材在庫を確認してください。'};
   if(input.eventBlocked)return {status:'BLOCKED',message:input.eventBlocked};
   return calc.make(input);
 }
 function savedResult(){
  const cats=oldCategories();
  if(!cats.length)return null;
  const setting=cfg(),stock=current();
  if(!stock)return {status:'BLOCKED',message:'食材在庫を確認してください。'};
   if(setting.eventBlocked)return {status:'BLOCKED',message:setting.eventBlocked};
   return calc.make({recipes:allRecipes,categories:cats,...setting,currentStock:stock,
   selectedRecipes:saved?.selectedRecipes,
   targetMeals:saved?.targetMeals});
 }
 function preview(){if(!editing||!valid)return null;const input=build();
  return {input,result:calculate(input)};}
 function line(parent,cls,text){
  const el=document.createElement('span');el.className=cls||'';
  el.textContent=text;parent.append(el);return el;
 }
 function drawSummary(result){
  summary.replaceChildren();
  if(!valid){line(summary,'prep-v121-hint','作戦でイベントを選択してください。');return;}
  if(!result){line(summary,'prep-v121-hint','備蓄する料理を設定してください。');return;}
  if(result.status!=='PROVISIONAL'){
   line(summary,'prep-v121-hint',result.message||'料理の設定を確認してください。');
   return;
  }
  for(const cat of result.categories){
   const row=document.createElement('div');row.className='prep-v121-summary-row';
   line(row,'prep-v121-summary-type',label[cat.type]);
   line(row,'',cat.name);
   const strong=document.createElement('strong');strong.textContent=cat.count+'食';row.append(strong);
   summary.append(row);
  }
  const bottom=document.createElement('div');bottom.className='prep-v121-capacity';
  line(bottom,'',editing?'備蓄後の空き・未保存プレビュー':'備蓄後の空き');
  const free=document.createElement('strong');
  free.textContent=result.capacity.free.toLocaleString('ja-JP')+' / '+
   result.capacity.bag.toLocaleString('ja-JP')+'個';
  bottom.append(free);summary.append(bottom);
 }
 function broadcast(){root.dispatchEvent(new Event('pokesleep-prep-v121-preview'));}
 function draw(){
  card.classList.toggle('prep-v121-editing',editing);
  cancel.hidden=!editing||oldCategories().length===0;
  saveButton.textContent=editing?'料理・食数を保存':'料理・食数を変更';
  saveButton.disabled=!valid;
  legacyMsg.textContent='';
  section.querySelectorAll('.prep-v121-row').forEach(n=>n.remove());
  const p=editing?preview():null;
  const result=p?p.result:savedResult();
  drawSummary(result);
  notice.textContent=warning;
  if(!editing){broadcast();return;}
  if(!p?.input.categories.length){
   notice.textContent=warning||'カテゴリ数と料理カテゴリを選択してください。';
   broadcast();return;
  }
  for(const type of p.input.categories){
   const top=recipeOptions(type,p.input);
   const row=document.createElement('div');row.className='prep-v121-row';
   line(row,'prep-v121-summary-type',label[type]);
   const recipeLabel=document.createElement('label');
   const recipeHelp=document.createElement('span');recipeHelp.textContent='レシピ';
   recipeLabel.append(recipeHelp);
   const recipeSelect=document.createElement('select');
   recipeSelect.setAttribute('aria-label',label[type]+'のレシピ');
   for(const r of top){
    const o=document.createElement('option');o.value=r.id;
    o.textContent=r.name+'（'+r.baseStrength.toLocaleString('ja-JP')+'）';
    recipeSelect.append(o);
   }
   recipeSelect.value=p.input.selectedRecipes[type]||'';
   recipeSelect.addEventListener('change',()=>{
    recipes[type]=recipeSelect.value;warning='';needsReview=false;
    const next=build(),count=meals[type];
    if(count!=='auto'&&count!==undefined&&
     !calc.mealOptions(next,type).includes(count)){
     meals[type]='auto';
     warning='新しい料理では以前の食数が容量を超えるため、自動に変更しました。';
    }
    draw();
   });
   recipeLabel.append(recipeSelect);
   const mealLabel=document.createElement('label');
   const mealHelp=document.createElement('span');mealHelp.textContent='目標食数';
   mealLabel.append(mealHelp);
   const mealSelect=document.createElement('select');
   mealSelect.setAttribute('aria-label',label[type]+'の目標食数');
   const allowed=calc.mealOptions(p.input,type);
   const auto=document.createElement('option');auto.value='auto';
   const autoCount=result.status==='PROVISIONAL'?result.counts[type]:null;
   auto.textContent='自動'+(autoCount?'（'+autoCount+'食）':'');
   mealSelect.append(auto);
   for(const n of allowed){
    const o=document.createElement('option');o.value=String(n);o.textContent=n+'食';
    mealSelect.append(o);
   }
   const chosen=p.input.targetMeals[type];
   if(chosen!=='auto'&&!allowed.includes(chosen)){
    meals[type]='auto';needsReview=true;
    warning='他の料理・バッグ容量の変更で、食数が容量を超えました。食数を再確認してください。';
    mealSelect.value='auto';
   }else mealSelect.value=String(chosen);
   mealSelect.addEventListener('change',()=>{
    meals[type]=mealSelect.value==='auto'?'auto':Number(mealSelect.value);
    needsReview=false;warning='';draw();
   });
   mealLabel.append(mealSelect);
   row.append(recipeLabel,mealLabel);section.append(row);
  }
  notice.textContent=warning;
  broadcast();
 }
 function openEditor(){
  try{resetDraft();}catch(_){warning='保存データを読み込めません。';}
  restoreButtons();
  editing=true;
  draw();
 }
 function closeEditor(){
  editing=false;needsReview=false;warning='';
  try{resetDraft();}catch(_){warning='保存データを読み込めません。';}
  draw();
 }
 for(const b of card.querySelectorAll('[data-stock-count],[data-stock-type]'))
  b.addEventListener('click',()=>queueMicrotask(()=>{
   if(restoring||!editing)return;
   warning='';needsReview=false;draw();
  }));
 cancel.addEventListener('click',closeEditor);
 saveButton.addEventListener('click',e=>{
  e.preventDefault();e.stopImmediatePropagation();
  if(!valid)return;
  if(!editing){openEditor();return;}
  const input=build(),result=calculate(input);
  if(result.status!=='PROVISIONAL'||needsReview){
   warning=needsReview?'目標食数を確認してください。':
    result.message||'料理・食数の設定を確認してください。';
   draw();return;
  }
  const stamp=new Date().toISOString();
  const oldRecord={version:1,weekStart:week,eventId:id,
   prep:{count:input.categories.length,categories:input.categories},savedAt:stamp};
  const newRecord={kind:'F3_STOCKPILE_PREF_V120',version:1,weekStart:week,eventId:id,
   categories:input.categories,selectedRecipes:result.selectedRecipes,
   targetMeals:result.targetMeals,allocatedMeals:result.counts,savedAt:stamp};
  const oldRaw=localStorage.getItem(oldKey),newRaw=localStorage.getItem(newKey);
  try{
   const old=oldRaw?JSON.parse(oldRaw):null,prior=newRaw?JSON.parse(newRaw):null;
   if(old&&(old.weekStart!==week||old.eventId!==id)||
    prior&&(prior.weekStart!==week||prior.eventId!==id))throw Error('EVENT_OWNER');
   localStorage.setItem(oldKey,JSON.stringify(oldRecord));
   localStorage.setItem(newKey,JSON.stringify(newRecord));
   saved=newRecord;editing=false;needsReview=false;warning='';
   draw();root.PokeUI.toast('料理・食数を保存しました');
   root.dispatchEvent(new Event('pokesleep-prep-v120-saved'));
  }catch(_){
   try{
    if(oldRaw===null)localStorage.removeItem(oldKey);else localStorage.setItem(oldKey,oldRaw);
    if(newRaw===null)localStorage.removeItem(newKey);else localStorage.setItem(newKey,newRaw);
   }catch(_){}
   warning='保存できませんでした。既存のデータは保護しています。';draw();
  }
 },true);
 const refresh=()=>draw();
 root.addEventListener('storage',e=>{
  if(e.key===oldKey||e.key===newKey||
   e.key==='pokesleep-strategy-e7-player-v1'||e.key?.startsWith('pokesleep-strategy-u2-e2-v1:')){
   if(e.key===oldKey||e.key===newKey){
    try{resetDraft();}catch(_){warning='保存内容を確認してください。';}
    editing=false;
   }
   draw();
  }
 });
 q('#save-inventory')?.addEventListener('click',()=>queueMicrotask(draw));
 root.PokeF3PrepPrefsV120=Object.freeze({key,read,build,categories,refresh,preview,
  isEditing:()=>editing});
 draw();
})(window);

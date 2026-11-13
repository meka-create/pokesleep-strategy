/* F4-B v93 UI: opt-in, separate from accepted E7, no persistence writes.
 * Registered private individuals appear only in the current device UI.
 * Nothing is saved, transmitted, logged, embedded in URL or returned by core.
 */
(()=>{
 'use strict';
 const doc=document,q=id=>doc.getElementById(id);
 const api=window.PokeF4BE7ReadOnly,weekClock=window.PokeF4BGameWeek;
 const deps={scope:window.PokeE7InventoryScope,e1:window.PokeE7E1,
  weekClock,baseCore:window.PokeF4ChronologicalCore,
  exactCore:window.PokeF4BChronologicalCore,
  roster:window.PokeF4F1RosterAdapter,
  legal:window.PokeF1LegalBuild,rates:window.PokeF1BaseRates,
  master:window.PokeMaster,recipes:window.PokeRecipes};
 const LABELS=['前週日曜・持越し','月曜の睡眠','火曜の睡眠','水曜の睡眠',
  '木曜の睡眠','金曜の睡眠','土曜の睡眠','日曜の睡眠'];
 const DAYS=['月','火','水','木','金','土','日'];
 const names={BEFORE:'準備週',DURING:'イベント週',ENDED:'終了'};
 let ctx=null,box=[],identity='',teams=Array(8).fill(null),
  editing=-1,busy=false,epoch=0,modelsPromise=null;
 const make=(tag,text,cls)=>{
  const el=doc.createElement(tag);
  if(text!==undefined)el.textContent=text;
  if(cls)el.className=cls;
  return el;
 };
 function infoRow(label,value){
  const dt=make('dt',label),dd=make('dd',value);
  q('context-info').append(dt,dd);
 }
 function readBox(){
  try{
   const raw=localStorage.getItem('pokesleep-strategy-e7-box-v1');
   const data=JSON.parse(raw||'null');
   return data?.version===1&&Array.isArray(data.items)&&
    data.items.length<=10000&&data.items.every(x=>x&&typeof x.pokemon==='string')?
    data.items:[];
  }catch(_){return [];}
 }
 function fingerprint(c,rows){
  return JSON.stringify([c.status,c.reason||null,c.weekStart||null,
   c.eventId||null,c.conditionRevision||null,c.inventoryRevision||null,
   c.autoSleep||false,c.player||null,c.fields||null,rows]);
 }
 function labelFor(index){
  const item=box[index];
  return item?(item.nickname?item.nickname+' · ':'')+
   item.pokemon+' Lv.'+item.level:'個体を選択';
 }
 function invalidate(reason=''){
  epoch++;
  q('calc-result').replaceChildren();
  q('calc-status').textContent=reason;
 }
 function createFavorites(){
  const group=q('favorites');
  group.replaceChildren();
  const opts=deps.master?.types||{};
  const saved=ctx?.status==='CONTEXT_READY'?ctx.savedBerrySetup?.types:null;
  for(let i=0;i<3;i++){
   const label=make('label','きのみ'+(i+1));
   const select=make('select');select.dataset.favorite=String(i);
   const blank=make('option','選択');blank.value='';select.append(blank);
   for(const [english,jp] of Object.entries(opts)){
    const option=make('option',jp);option.value=english;
    select.append(option);
   }
   const candidate=saved?.[i]||'';
   const key=Object.keys(opts).find(k=>opts[k]===candidate)||candidate;
   select.value=Object.hasOwn(opts,key)?key:'';
   select.addEventListener('change',()=>invalidate());
   label.append(select);group.append(label);
  }
 }
 function renderTeams(){
  const container=q('team-list');container.replaceChildren();
  if(!box.length){
   container.append(make('p','ボックスに個体を5匹以上登録してください。','hint'));
   return;
  }
  const auto=ctx?.status==='CONTEXT_READY'&&ctx.autoSleep;
  for(let day=0;day<8;day++){
   if(auto&&day>0)continue;
   const row=make('div',undefined,'team-row');
   const left=make('div');
   left.append(make('strong',LABELS[day]),
    make('small',teams[day]?teams[day].map(labelFor).join('・'):'実個体5匹を設定'));
   const right=make('div',undefined,'team-actions');
   const btn=make('button',teams[day]?'変更':'設定','secondary');
   btn.type='button';btn.addEventListener('click',()=>openEditor(day));right.append(btn);
   if(day===1&&teams[1]&&!auto){
    const copy=make('button','7晩へコピー','secondary');copy.type='button';
    copy.setAttribute('aria-label','月曜の睡眠編成を7晩すべてへコピー');
    copy.addEventListener('click',()=>{
     for(let i=2;i<8;i++)teams[i]=[...teams[1]];
     invalidate('7晩の指定を更新しました。');renderTeams();
    });
    right.append(copy);
   }
   row.append(left,right);container.append(row);
  }
  q('night-message').textContent=auto?
   '睡眠自動ON：前週の5匹のみ指定。月〜日は合法個体から自動候補を探索します。':
   '睡眠自動OFF：前週の5匹と月〜日7晩の各5匹を指定してください。';
 }
 function refresh(){
  const c=api.readContext(localStorage,deps,new Date().toISOString());
  const rows=c.status==='CONTEXT_READY'?c.privateBoxRows:readBox();
  const next=fingerprint(c,rows);
  if(next!==identity){
   identity=next;teams=Array(8).fill(null);
   invalidate('保存情報が変更されたため、参考計算の選択を初期化しました。');
   if(q('team-dialog').open)q('team-dialog').close();
  }
  ctx=c;box=rows;
  q('context-info').replaceChildren();
  if(c.status!=='CONTEXT_READY'){
   q('status').textContent='保存条件の確認が必要です';
   q('context-message').textContent=c.message||'イベント条件、食材在庫を確認してください。';
   infoRow('実ボックス',box.length+'匹');
  }else{
   q('status').textContent='イベントと実ボックスを照合しました';
   const officialRules=c.fields.source!=null?
    window.PokeF4COfficialRules?.match(c.fields.source):null;
   q('context-message').textContent=c.fields.source!=null?
    (officialRules?.status==='RULES_MATCHED_ONLY'?
     'F4-C：11/16公式ボーナスの条件付き計算式は準備済み。新食材・新料理の原典とげんき・スキル・回収などの週間接続が未完了のため、正式なイベント週の試算は停止します。':
     'この公式イベントの効果は未検証のため、週間エナジー試算は停止します。'):
    '手動イベントの中立参考モデルです。表示数値は実ゲームの確定値ではありません。';
   infoRow('ゲーム週',c.weekStart+' 04:00〜翌月曜04:00');
   infoRow('段階',names[c.clock.phase]||'—');
   infoRow('登録個体',box.length+'匹');
   infoRow('睡眠設定',c.autoSleep?'自動ON':'自動OFF（手動）');
   infoRow('在庫','イベントIDで分離して確認済み');
  }
  createFavorites();renderTeams();
 }
 function openEditor(day){
  if(box.length<5||busy)return;
  editing=day;
  q('dialog-title').textContent=LABELS[day]+' · 実個体5匹';
  q('dialog-message').textContent='';
  q('team-form').replaceChildren();
  for(let i=0;i<5;i++){
   const label=make('label',(i+1)+'匹目');
   const select=make('select');select.dataset.member=String(i);
   const blank=make('option','実個体を選択');blank.value='';select.append(blank);
   for(let n=0;n<box.length;n++){
    const option=make('option',labelFor(n));option.value=String(n);select.append(option);
   }
   select.value=teams[day]?String(teams[day][i]):'';
   label.append(select);q('team-form').append(label);
  }
  q('team-dialog').showModal();
 }
 q('dialog-cancel').addEventListener('click',()=>q('team-dialog').close());
 q('dialog-apply').addEventListener('click',()=>{
  const fields=[...q('team-form').querySelectorAll('select[data-member]')];
  const values=fields.map(s=>s.value===''?null:Number(s.value));
  if(values.length!==5||values.some(n=>!Number.isSafeInteger(n)||n<0||n>=box.length)||
   new Set(values).size!==5){
   q('dialog-message').textContent='重複のない実個体5匹を指定してください。';return;
  }
  teams[editing]=values;q('team-dialog').close();
  invalidate();renderTeams();
 });
 q('team-dialog').addEventListener('close',()=>{editing=-1;});
 let selectedIdentity='';
 function modelSources(){
  if(!modelsPromise){
   const paths=['../f1/f1-b-target-source-v1.json','../f1/f1-b-help-traits-v1.json'];
   modelsPromise=Promise.all(paths.map(async path=>{
    const res=await fetch(path,{cache:'no-store'});
    if(!res.ok)throw Error('検証用原典を読み込めませんでした。');
    return res.json();
   })).then(([snapshot,traits])=>({snapshot,traits}))
    .catch(e=>{modelsPromise=null;throw e;});
  }
  return modelsPromise;
 }
 function showResult(reference,rows){
  const node=q('calc-result'),result=reference.result;
  node.replaceChildren();
  const metrics=make('div',undefined,'metrics');
  for(const [label,n] of [
   ['参考エナジー',result.energyProxy],
   ['料理',result.mealEnergyProxy],
   ['きのみ',result.berryEnergyProxy]
  ]){
   const item=make('span',label),b=make('b',Math.round(n).toLocaleString('ja-JP'));
   item.prepend(b);metrics.append(item);
  }
  node.append(metrics,make('p','29時間帯・168時間／前週睡眠3.5時間＋最終睡眠4時間。全数値は暫定参考値です。','hint'));
  const nights=make('details');
  nights.append(make('summary','曜日別の参考編成（21日中枠・7晩）'));
  for(let d=0;d<7;d++){
   const day=make('div',undefined,'result-line');
   day.append(make('strong',DAYS[d]+'曜日'));
   for(const row of result.slots.slice(1+d*4,1+d*4+4)){
    const party=row.team.map(id=>{
     const ix=Number(id.slice(1));
     return Number.isInteger(ix)&&ix>=0&&ix<rows.length?rows[ix].pokemon:'未照合';
    }).join('・');
    day.append(make('p',({morning:'朝',noon:'昼',evening:'夜',sleep:'睡眠'}[row.slot]||row.slot)+
     '：'+party+(row.recipeId?'／料理 '+row.recipeId:''),'hint'));
   }
   nights.append(day);
  }
  node.append(nights);
  node.append(make('p','前週睡眠のきのみ参考値 '+result.carryBerryExcludedProxy.toLocaleString('ja-JP')+
   ' は当週エナジーへ加算していません。げんき、スキル、所持や料理レベルは未計算です。','hint'));
 }
 q('run').addEventListener('click',async()=>{
  if(busy)return;
  const c=api.readContext(localStorage,deps,new Date().toISOString());
  const freshRows=c.status==='CONTEXT_READY'?c.privateBoxRows:readBox();
  if(fingerprint(c,freshRows)!==identity){
   refresh();q('calc-status').textContent='ボックスまたはイベント情報が変更されました。再指定してください。';
   return;
  }
  if(c.status!=='CONTEXT_READY'){q('calc-status').textContent=c.message||'イベントを確認してください。';return;}
  if(c.fields.source!=null){
   q('calc-status').textContent='F4-Cの個別ルールは用意済みですが、公式イベントの週間計算は未完成のため停止しました。';return;
  }
  if(c.fields.field.endsWith('EX')){
   q('calc-status').textContent='EX固有効果は未計算のため停止しました。';return;
  }
  const previous=teams[0],manual=teams.slice(1);
  if(!previous||(c.autoSleep!==true&&manual.some(team=>!team))){
   q('calc-status').textContent='前週日曜と、手動の場合は7晩の実個体編成を指定してください。';return;
  }
  const chosen=[...q('favorites').querySelectorAll('select[data-favorite]')].map(s=>s.value);
  if(chosen.length!==3||chosen.some(x=>!x)||new Set(chosen).size!==3){
   q('calc-status').textContent='好みのきのみ3種類を重複なしで指定してください。';return;
  }
  busy=true;const request=++epoch,identityAtStart=identity,rowsAtStart=box;
  q('run').disabled=true;invalidate();const token=epoch;
  q('calc-status').textContent='実個体・原典を検証しています…';
  try{
   const source=await modelSources();
   const now=api.readContext(localStorage,deps,new Date().toISOString());
   const latest=now.status==='CONTEXT_READY'?now.privateBoxRows:readBox();
   if(identityAtStart!==fingerprint(now,latest)||identityAtStart!==identity||token!==epoch){
    refresh();q('calc-status').textContent='保存情報が更新されました。再指定してください。';return;
   }
   const result=api.reference(localStorage,{
    instant:new Date().toISOString(),neutralReferenceOnly:true,
    favoriteTypes:chosen,previousWeekSleepIndices:previous,
    realNightTeamIndices:c.autoSleep?null:manual
   },{...deps,...source});
   if(token!==epoch)return;
   if(result.status!=='PROVISIONAL'){
    q('calc-status').textContent=result.message||result.reason||'参考試算を実行できません。';
    return;
   }
   q('calc-status').textContent='中立条件の参考計算のみ完了。正式作戦には未反映です。';
   showResult(result,rowsAtStart);
  }catch(_){if(token===epoch)q('calc-status').textContent='原典の読込または参考計算に失敗しました。';}
  finally{busy=false;q('run').disabled=false;}
 });
 q('refresh').addEventListener('click',refresh);
 window.addEventListener('storage',refresh);
 refresh();
})();

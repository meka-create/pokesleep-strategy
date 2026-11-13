/* F1-D independent acceptance preview. E7 U3 is mounted read-only in an
 * unchanged E7 shell; F1-D injects a single opt-in card. No local writes. */
(()=>{
'use strict';
const shell=document.getElementById('e7-shell');
const loader=document.getElementById('loading');
const api=globalThis.PokeF1DE7Input;
const bridge=globalThis.PokeF1CSimulationBridge;
const ingredients=globalThis.PokeMaster.ingredients;
const names={curry:'カレー',salad:'サラダ',dessert:'デザート'};
const messages={
 OUTSIDE_F1_SCOPE:'この種族・フォームはまだ試算対象外です。',
 INVALID_BUILD:'個体の食材・性格・サブスキルの入力を確認してください。',
 UNVERIFIED_INDIVIDUAL_RATE:'レベル・メインスキル・ミント等の入力を確認してください。',
 UNVERIFIED_ACTIVE_FOOD:'レベルで解放済みの食材を確認してください。',
 INVALID_SOURCE_OR_TEAM:'計算データが一致しません。ページを再読み込みしてください。',
 INVALID_F1C_INPUT:'F1-C計算エンジンを読み込めません。',
 WEEKLY_SIMULATOR_REJECTED_INPUT:'週間試算の入力条件を確認してください。',
 MEW_EFFECT_NOT_IDENTIFIED:'ミュウの選択メインスキルを確認してください。'
};
const fmt=n=>new Intl.NumberFormat('ja-JP').format(Math.round(Number(n)||0));
const reader=()=>api.context(localStorage,globalThis.PokeE7InventoryScope);
const q=(id,doc=active)=>doc?.getElementById(id);
let active=null,frame=null,loaded=null,indices=['','','','',''],fingerprint='',identity='',busy=false,epoch=0;
const identityOf=c=>c.status==='READY'?
 c.key+'|'+c.eventRevision+'|'+c.inventoryRevision+'|'+JSON.stringify(c.fields)+'|'+JSON.stringify(c.player):
 c.status+'|'+c.reason;
const create=(doc,tag,cls,txt)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
const insertStyle=doc=>{
 const style=create(doc,'style');
 style.id='f1d-style';
 style.textContent=[
 '#f1d-card{border-color:#53677e}',
 '#f1d-card h2{margin:0;font-size:16px;font-weight:800}',
 '#f1d-card .f1d-title{display:flex;gap:10px;align-items:center;justify-content:space-between}',
 '#f1d-card .f1d-pill{font-size:10px;color:#f6d894;border:1px solid #957b48;border-radius:50px;padding:2px 7px}',
 '#f1d-card .f1d-note{font-size:12px;color:#b8c8d8;margin:7px 0}',
 '#f1d-card details{margin:9px 0;border:1px solid #435970;border-radius:9px;background:#14243a;padding:9px}',
 '#f1d-card summary{cursor:pointer;font-weight:700;font-size:13px}',
 '#f1d-card .f1d-fields{display:grid;gap:8px;margin-top:10px}',
 '#f1d-card label{display:grid;gap:3px;font-size:12px;color:#d3e0ec}',
 '#f1d-card select{width:100%;height:39px;padding:6px 8px;border:1px solid #62758b;border-radius:8px;background:#253c53;color:#f0f5fb;font:inherit;font-size:13px}',
 '#f1d-card .f1d-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
 '#f1d-card button.f1d-run{width:100%;min-height:42px;background:#e9bd6a;color:#172331;font-size:14px;font-weight:800;border:0;border-radius:9px}',
 '#f1d-card button.f1d-run:disabled{opacity:.6}',
 '#f1d-card .f1d-status{font-size:12px;color:#edc58b;margin:8px 0;min-height:1px}',
 '#f1d-card .f1d-big{font-size:24px;font-weight:850;color:#f4cb80;font-variant-numeric:tabular-nums}',
 '#f1d-card .f1d-parts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:8px 0}',
 '#f1d-card .f1d-part{padding:7px 3px;border:1px solid #425970;border-radius:8px;text-align:center;font-size:11px}',
 '#f1d-card .f1d-part strong{display:block;font-size:14px;color:#f0f5fa}',
 '#f1d-card .f1d-days{list-style:none;margin:8px 0;padding:0}',
 '#f1d-card .f1d-days li{display:flex;justify-content:space-between;padding:3px 1px;border-bottom:1px solid #354b62;font-size:12px}',
 '#f1d-card .f1d-warnings{font-size:11px;color:#c0cfdf;padding-left:17px;line-height:1.6}'
 ].join('\n');
 doc.head.append(style);
};
function card(doc){
 const section=create(doc,'section','card');section.id='f1d-card';section.setAttribute('aria-label','週間参考試算');
 const row=create(doc,'div','f1d-title');row.append(create(doc,'h2',null,'週間参考試算'),create(doc,'span','f1d-pill','F1-D'));
 section.append(row,create(doc,'p','f1d-note','実個体5匹で7日間を仮計算。自動最適化はまだ行いません。'));
 const event=create(doc,'p','f1d-note');event.id='f1d-event';section.append(event);
 const details=create(doc,'details');details.id='f1d-picker';
 const summary=create(doc,'summary',null,'実個体を5匹選択');summary.id='f1d-picker-title';details.append(summary);
 const fields=create(doc,'div','f1d-fields');
 for(let i=0;i<5;i++){
  const label=create(doc,'label',null,String(i+1)+'匹目');
  const select=create(doc,'select');select.dataset.f1dIndex=String(i);
  select.setAttribute('aria-label',String(i+1)+'匹目の個体');
  select.addEventListener('change',()=>{indices[i]=select.value;invalidate();refresh();});
  label.append(select);fields.append(label);
 }
 const foodLabel=create(doc,'label',null,'試算する料理カテゴリ');foodLabel.id='f1d-food-label';
 const food=create(doc,'select');food.id='f1d-food';
 const blank=create(doc,'option',null,'カテゴリを選択');blank.value='';food.append(blank);
 for(const [value,name] of Object.entries(names)){
  const op=create(doc,'option',null,name);op.value=value;food.append(op);
 }
 food.addEventListener('change',invalidate);foodLabel.append(food);fields.append(foodLabel);
 const params=create(doc,'div','f1d-options');
 for(const [id,text,values,chosen,suffix] of [
  ['f1d-tap','回収間隔',[120,150,180],150,'分'],
  ['f1d-score','睡眠スコア',[60,80,90,100],100,'']
 ]){
  const label=create(doc,'label',null,text),select=create(doc,'select');select.id=id;
  for(const n of values){
   const op=create(doc,'option',null,n+suffix);op.value=String(n);
   if(n===chosen)op.selected=true;
   select.append(op);
  }
  select.addEventListener('change',invalidate);label.append(select);params.append(label);
 }
 fields.append(params);details.append(fields);section.append(details);
 const button=create(doc,'button','f1d-run','週間期待値を試算');button.id='f1d-run';button.type='button';
 button.addEventListener('click',calculate);section.append(button);
 const status=create(doc,'p','f1d-status');status.id='f1d-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const result=create(doc,'div');result.id='f1d-result';section.append(status,result);
 return section;
}
function invalidate(){
 epoch++;
 q('f1d-result')?.replaceChildren();
 const status=q('f1d-status');if(status)status.textContent='';
}
function refresh(){
 if(!active)return;
 const current=reader(),box=current.status==='READY'?JSON.stringify(current.items):'';
 if(box!==fingerprint){indices=['','','','',''];fingerprint=box;invalidate();}
 const freshIdentity=identityOf(current);
 if(freshIdentity!==identity){identity=freshIdentity;invalidate();}
 const info=q('f1d-event'),button=q('f1d-run'),summary=q('f1d-picker-title');
 if(current.status!=='READY'){
  info.textContent=current.message||'イベントとボックスを確認してください。';
  summary.textContent='イベント・ボックス未設定';button.disabled=true;
 }else{
  info.textContent=current.selection.weekStart.slice(5).replace('-','/')+'開始 · '+current.fields.field+' · '+current.items.length+'匹登録';
  button.disabled=busy;
  const count=indices.filter(x=>x!=='').length;
  summary.textContent='実個体を5匹選択'+(count?'（'+count+'/5）':'');
 }
 for(const select of active.querySelectorAll('select[data-f1d-index]')){
  const i=Number(select.dataset.f1dIndex);
  select.replaceChildren();
  const op=create(active,'option',null,'個体を選択');op.value='';select.append(op);
  if(current.status==='READY'){
   current.items.forEach((item,j)=>{
    const option=create(active,'option',null,(item.nickname?item.nickname+' · ':'')+item.pokemon+' Lv.'+item.level);
    option.value=String(j);select.append(option);
   });
   select.value=indices[i];select.disabled=false;
  }else select.disabled=true;
 }
 const f=q('f1d-food-label');
 if(f)f.hidden=current.status!=='READY'||current.fields.food!=='all';
}
let dataPromise=null;
function models(){
 if(!dataPromise)dataPromise=Promise.all(['../f1/f1-b-target-source-v1.json','../f1/f1-b-help-traits-v1.json']
  .map(async url=>{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Source fetch failed');return response.json();}))
  .then(([snapshot,traits])=>({snapshot,traits,
    rates:globalThis.PokeF1BaseRates,legal:globalThis.PokeF1LegalBuild,
    simulator:globalThis.PokeF1CSimulator,master:globalThis.PokeMaster}))
  .catch(e=>{dataPromise=null;throw e;});
 return dataPromise;
}
function resultView(prepared,result){
 const doc=active,node=q('f1d-result');
 node.replaceChildren();
 node.append(create(doc,'p','f1d-note','7日間・固定5匹の暫定期待値'),
  create(doc,'div','f1d-big',fmt(result.weeklyEnergy)+' エナジー'));
 const parts=create(doc,'div','f1d-parts');
 for(const [label,value] of [['きのみ',result.breakdown.berries],['料理',result.breakdown.cooking],['スキル',result.breakdown.skills]]){
  const sub=create(doc,'div','f1d-part',label);sub.append(create(doc,'strong',null,fmt(value)));parts.append(sub);
 }
 node.append(parts);
 const detail=create(doc,'details'),sum=create(doc,'summary',null,'曜日別の参考値');detail.append(sum);
 const list=create(doc,'ul','f1d-days');
 result.breakdown.days.forEach((day,i)=>{
  const row=create(doc,'li');row.append(create(doc,'span',null,['月','火','水','木','金','土','日'][i]+'曜日'),
   create(doc,'strong',null,fmt((day.berries||0)+(day.cooking||0)+(day.skills||0))));
  list.append(row);
 });
 detail.append(list);node.append(detail);
 const notes=[...prepared.notes,...(result.warnings||[])];
 const warning=create(doc,'details');warning.append(create(doc,'summary',null,'計算条件・注意点'));
 const ul=create(doc,'ul','f1d-warnings');
 for(const note of notes)ul.append(create(doc,'li',null,note));
 warning.append(ul);node.append(warning);
 node.append(create(doc,'p','f1d-note','参考値です。曜日・時間帯別の編成最適化は後続工程で行います。'));
}
async function calculate(){
 if(busy||!active)return;
 const doc=active,current=reader(),status=q('f1d-status'),button=q('f1d-run');
 if(current.status!=='READY'){status.textContent=current.message||'保存状態を確認してください。';return;}
 const save=doc.getElementById('event-save');
 if(save&&!save.hidden&&!save.disabled){
  status.textContent='イベント条件を保存してから試算してください。';return;
 }
 const options={foodCategory:q('f1d-food').value,
  tapMinutes:Number(q('f1d-tap').value),sleepScore:Number(q('f1d-score').value)};
 const prepared=api.modelInput(current,indices.map(x=>x===''?null:Number(x)),options,ingredients);
 if(prepared.status!=='READY'){
  status.textContent=prepared.message||'試算条件を確認してください。';
  q('f1d-picker').open=true;return;
 }
 busy=true;button.disabled=true;const ticket=++epoch;
 status.textContent='7日間の参考値を計算中…';
 q('f1d-result').replaceChildren();
 try{
  const deps=await models();
  if(ticket!==epoch||doc!==active)return;
  await new Promise(resolve=>setTimeout(resolve,0));
  const result=bridge.simulateWeekly(prepared.input,deps);
  if(ticket!==epoch||doc!==active)return;
  const latest=reader();
  if(identityOf(current)!==identityOf(latest)||fingerprint!==JSON.stringify(latest.items)){
   status.textContent='イベントまたはボックスが変わりました。再度試算してください。';return;
  }
  if(result.status!=='PROVISIONAL'){
   status.textContent=messages[result.reason]||
     '試算できない条件があります（'+String(result.reason||'未対応')+'）。';
   q('f1d-picker').open=true;return;
  }
  status.textContent='';resultView(prepared,result);q('f1d-picker').open=false;
 }catch(_){
  if(ticket===epoch)status.textContent='計算データを読み込めません。オンラインで再読み込みしてください。';
 }finally{busy=false;if(doc===active)button.disabled=reader().status!=='READY';}
}
function mount(doc){
 if(!doc||doc===active&&doc.getElementById('f1d-card'))return;
 const anchor=doc.getElementById('week-content');if(!anchor)return;
 active=doc;fingerprint='';identity='';indices=['','','','',''];
 insertStyle(doc);anchor.after(card(doc));refresh();
}
function connect(){
 let shellDoc;try{shellDoc=shell.contentDocument;}catch(_){return;}
 const plan=shellDoc?.getElementById('view-plan');if(!plan)return;
 if(frame!==plan){
  frame=plan;plan.addEventListener('load',()=>{try{mount(plan.contentDocument);}catch(_){}});
 }
 try{if(plan.contentDocument?.getElementById('week-content'))mount(plan.contentDocument);}catch(_){}
}
shell.addEventListener('load',()=>{loader.hidden=true;connect();});
window.addEventListener('pageshow',connect);
window.addEventListener('storage',e=>{
 if(e.storageArea!==localStorage)return;
 if(e.key===null||e.key.startsWith('pokesleep-strategy-u3-e3-v1:')||
  e.key.startsWith('pokesleep-strategy-u2-e2-v1:')||
  e.key==='pokesleep-strategy-e7-box-v1'||e.key==='pokesleep-strategy-e7-player-v1')refresh();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
connect();
})();

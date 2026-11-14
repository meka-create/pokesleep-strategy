/* E7 F4-C v110: local real-Box proposal viewer, no write/adoption. */
(function(root){'use strict';
const q=id=>document.getElementById(id),node=q('f4c-real-card');
if(!node)return;
const api=root.PokeF4CBaselineProposalV110,bridge=root.PokeF4BE7ReadOnly;
const deps={scope:root.PokeE7InventoryScope,e1:root.PokeE7E1,
 weekClock:root.PokeF4BGameWeek,bridge,
 baseCore:root.PokeF4ChronologicalCore,
 healerPolicy:root.PokeF4CHealerPolicy,healerSearch:root.PokeF4CHealerSearch,
 itemRank:root.PokeF4CItemAwareRank,skillValues:root.PokeF1SkillValues,
 roster:root.PokeF4F1RosterAdapter,legal:root.PokeF1LegalBuild,
 rates:root.PokeF1BaseRates,master:root.PokeMaster,recipes:root.PokeRecipes};
const types=deps.master?.types||{},DAYS=['月','火','水','木','金','土','日'];
const s={main:null,secondary:null,night:Array(5).fill(null),
 previous:Array(5).fill(null),favorites:Array(3).fill(null)};
let rows=[],ctx=null,fingerprint='',modelPromise=null,result=null,busy=false,epoch=0;
const nodeText=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
const labelAt=i=>rows[i]?((rows[i].nickname||rows[i].pokemon)+' · '+rows[i].pokemon+' Lv.'+rows[i].level):'—';
function message(text,error=false){q('f4c-real-status').textContent=text;q('f4c-real-status').dataset.error=String(error);}
function invalidate(text=''){epoch++;result=null;q('f4c-real-result').replaceChildren();if(text)message(text);}
function selector(title,items,value,onChange){
 const label=nodeText('label');label.className='f4c-field';label.append(nodeText('span',title));
 const el=nodeText('select'),blank=nodeText('option','選択');blank.value='';el.append(blank);
 for(const [key,name] of items){const op=nodeText('option',name);op.value=String(key);el.append(op);}
 el.value=value===null||value===undefined?'':String(value);
 el.addEventListener('change',()=>{onChange(el.value);invalidate('条件が変更されました。再提案してください。');});
 label.append(el);return label;
}
function createFields(){
 const options=rows.map((_,i)=>[i,labelAt(i)]);
 const healer=q('f4c-real-healers'),sleep=q('f4c-real-night'),prev=q('f4c-real-previous'),fav=q('f4c-real-favorites');
 for(const e of [healer,sleep,prev,fav])e.replaceChildren();
 healer.append(selector('主ヒーラー',options,s.main,v=>s.main=v===''?null:Number(v)));
 healer.append(selector('副ヒーラー',options,s.secondary,v=>s.secondary=v===''?null:Number(v)));
 for(let i=0;i<5;i++){
  sleep.append(selector((i+1)+'匹目',options,s.night[i],v=>s.night[i]=v===''?null:Number(v)));
  prev.append(selector((i+1)+'匹目',options,s.previous[i],v=>s.previous[i]=v===''?null:Number(v)));
 }
 for(let i=0;i<3;i++)fav.append(selector('きのみ '+(i+1),Object.entries(types),s.favorites[i],v=>s.favorites[i]=v||null));
}
function fingerprintFor(c){return JSON.stringify([c?.status,c?.reason,c?.eventId,
 c?.weekStart,c?.fields,c?.player,c?.conditionRevision,c?.inventoryRevision,
 c?.autoSleep,c?.privateBoxRows]);}
function refresh(){
 const c=bridge.readContext(localStorage,deps,new Date().toISOString());
 const hasEvent=(()=>{try{return !!JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')||'null')?.id;}catch(_){return false;}})();
 node.hidden=!hasEvent;
 const identity=fingerprintFor(c);
 if(identity!==fingerprint){
  fingerprint=identity;ctx=c;rows=c.status==='CONTEXT_READY'?c.privateBoxRows:[];
  s.main=null;s.secondary=null;s.night.fill(null);s.previous.fill(null);s.favorites.fill(null);
  const favorites=c?.savedBerrySetup?.types;
  if(Array.isArray(favorites))s.favorites=favorites.slice(0,3).map(v=>Object.hasOwn(types,v)?v:Object.keys(types).find(k=>types[k]===v)||null);
  invalidate();createFields();
 }else ctx=c;
 const usable=c.status==='CONTEXT_READY'&&c.clock.phase==='BEFORE'&&
  !c.autoSleep&&!c.fields.field?.endsWith('EX');
 q('f4c-real-run').disabled=!usable||busy;
 q('f4c-real-official').hidden=c.status!=='CONTEXT_READY'||c.fields.source==null;
 if(c.status!=='CONTEXT_READY')message(c.message||'条件・在庫・ボックスの保存情報を確認してください。',true);
 else if(c.clock.phase!=='BEFORE')message('週途中の再提案はF5工程です。開始済みの週を遡って提案しません。',true);
 else if(c.autoSleep)message('現在のF4-C基礎版は睡眠自動OFFで、実個体5匹を手動固定します。',true);
 else if(c.fields.field?.endsWith('EX'))message('EX特殊補正は基礎版で未対応です。',true);
 else if(!result)message('主・副ヒーラー、睡眠用5匹、前週日曜用5匹、好みのきのみを指定してください。');
 return c;
}
async function models(){
 if(!modelPromise)modelPromise=Promise.all(['../f1/f1-b-target-source-v1.json',
  '../f1/f1-b-help-traits-v1.json'].map(async url=>{
   const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('SOURCE_UNAVAILABLE');return r.json();
 })).then(([snapshot,traits])=>({snapshot,traits})).catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
function display(res){
 const target=q('f4c-real-result');target.replaceChildren();
 const metric=nodeText('p','参考エナジー '+Math.round(res.energyExpected).toLocaleString('ja-JP')+
  '（既知の通常データ基準）');metric.className='f4c-metric';target.append(metric);
 target.append(nodeText('p',res.officialEffectsExcluded?
  '公式イベント補正・新食材・新料理は未反映です。実際のイベントエナジーではありません。':
  '回収、スキル、げんきに仮定を含むため、厳密なエナジーではありません。'));
 const recipeNames=new Map(deps.recipes.map(x=>[x.id,x.name]));
 for(let day=0;day<7;day++){
  const group=nodeText('details');group.open=day===0;group.append(nodeText('summary',DAYS[day]+'曜日'));
  for(const row of res.slots.slice(1+day*4,5+day*4)){
   const slot=nodeText('div');slot.className='f4c-real-slot';
   slot.append(nodeText('strong',({morning:'朝 7:30–12:00',noon:'昼 12:00–18:00',
    evening:'夜 18:00–0:00',sleep:'睡眠枠'}[row.slot]||row.slot)));
   slot.append(nodeText('p',row.team.map(id=>labelAt(Number(id.slice(1)))).join(' / ')));
   if(row.slot!=='sleep')slot.append(nodeText('p','料理：'+
    (row.recipeId?(recipeNames.get(row.recipeId)||'要確認'):'料理なし')));
   group.append(slot);
  }
  target.append(group);
 }
 const footer=nodeText('p','この実個体提案は未採用です。安全な個体IDの保存・復元と正式作戦画面への採用は、次のF4-C工程で接続します。');
 footer.className='f4c-warning';target.append(footer);
}
async function run(){
 if(busy)return;const c=refresh();if(c.status!=='CONTEXT_READY'||c.clock.phase!=='BEFORE')return;
 busy=true;q('f4c-real-run').disabled=true;
 const original=fingerprint,token=++epoch;message('実ボックスと原典を照合し、29窓を探索しています…');
 try{
  const sources=await models(),fresh=refresh();
  if(token!==epoch||fingerprint!==original||fresh.status!=='CONTEXT_READY'){
   message('在庫・条件・ボックスが更新されました。再指定してください。',true);return;
  }
  const answer=api.propose(fresh,{
   explicitBaselineConsent:q('f4c-real-consent').checked,
   favoriteTypes:[...s.favorites],
   primaryHealerIndex:s.main,secondaryHealerIndex:s.secondary,
   previousWeekSleepIndices:[...s.previous],sleepTeamIndices:[...s.night]
  },{...deps,...sources});
  if(answer.status!=='PROVISIONAL'){message('提案を生成できません：'+answer.reason,true);return;}
  result=answer;display(answer);message('実ボックスを参照した29窓の参考提案ができました（未採用）。');
 }catch(_){message('計算原典の取得または提案生成に失敗しました。',true);}
 finally{busy=false;q('f4c-real-run').disabled=false;}
}
q('f4c-real-run').addEventListener('click',run);
q('f4c-real-refresh').addEventListener('click',refresh);
q('f4c-real-consent').addEventListener('change',()=>invalidate('公式イベント補正の扱いが変更されました。'));
window.addEventListener('storage',refresh);window.addEventListener('pageshow',refresh);
root.PokeF4CBaselineUI=Object.freeze({refresh});refresh();
})(window);

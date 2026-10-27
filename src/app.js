(function(){
'use strict';
const $=id=>document.getElementById(id);
const storage=window.PokeStorage;
let state=storage.load();
// Each exported observation belongs to the *successful run*, never to subsequently edited settings.
let lastRunSnapshot=null;
// Keep an earlier successful simulation/observation snapshot intact but never
// present its scores as if they had been calculated from newly changed inputs.
function markResultsStale(keepComparison=false){
 const result=$('simResult'),warning=$('simStaleNotice');
 if(!result.hidden)warning.hidden=false;
 stalePreparation();
 // Native change listeners pass an Event object; only the deliberate literal
 // boolean true (after applying a candidate) may preserve comparison values.
 if(keepComparison!==true)clearStep3Evaluations();
}
const save=()=>{try{storage.save(state);$('storageNotice').textContent='このブラウザ内への保存：利用可能';$('storageNotice').className='small ok';$('criticalNotice').hidden=true;return true;}catch(e){
$('storageNotice').textContent=storage.getLoadError()||'保存に失敗しました。現在の変更は未保存です。設定・保存からJSONバックアップを取得してください。';$('storageNotice').className='small warn';$('criticalNotice').textContent=$('storageNotice').textContent;$('criticalNotice').hidden=false;return false;}};
const notifySave=(success,ok)=>toast(success?(ok||'保存しました。'):'保存に失敗しました。設定・保存からJSONバックアップを取得してください。');
const enc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,3500);}
function setTab(tab){for(const btn of document.querySelectorAll('.tab')){const active=btn.dataset.tab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false');}for(const p of document.querySelectorAll('.panel'))p.hidden=p.id!==`panel-${tab}`;}
function fillEvent(){let e=state.event;const map={eventName:'name',eventStart:'start',eventDuration:'duration',eventMap:'map',eventBerries:'berries',eventEffects:'effects',food1:'food1',food2:'food2'};for(const [id,k] of Object.entries(map))$(id).value=e[k]??'';for(const id of ['campPrep','camp1','camp2'])$(id).checked=!!e[id];showDuration();}
function showDuration(){const two=$('eventDuration').value==='2';$('food2Row').hidden=!two;$('camp2Row').hidden=!two;}
function readEvent(){const e={name:$('eventName').value.trim(),start:$('eventStart').value,duration:Number($('eventDuration').value),map:$('eventMap').value.trim(),berries:$('eventBerries').value.trim(),effects:$('eventEffects').value.trim(),food1:$('food1').value,food2:$('food2').value};for(const id of ['campPrep','camp1','camp2'])e[id]=$(id).checked;return e;}
// The event form is editable without committing it. Never calculate a new
// week from *old* persisted map/food settings while the screen shows new ones.
function hasUnsavedEventEdits(){
 const draft=readEvent();
 return Object.keys(draft).some(key=>draft[key]!==state.event[key]);
}
for(const id of ['eventName','eventStart','eventDuration','eventMap','eventBerries',
 'eventEffects','food1','food2','campPrep','camp1','camp2'])
 $(id).addEventListener('change',markResultsStale);
function status(){let name=state.event.name||'イベント未設定';$('dataState').textContent=`${state.box.length}匹登録 / 睡眠パーティ ${state.sleepIds.length}/5匹 / ${name}`;$('boxTotal').textContent=`${state.box.length}匹`;$('boxCountTab').textContent=state.box.length;}
function renderSleep(){const ids=state.sleepIds;const selected=ids.map(id=>state.box.find(p=>p.id===id)).filter(Boolean);$('sleepCount').textContent=`${selected.length} / 5`;
 $('sleepList').innerHTML=selected.length?selected.map((p,i)=>`<div class="sleep-item"><span class="sleep-index">${i+1}</span><span class="sleep-title">${enc(p.nickname||p.pokemon)}<small>${enc(p.pokemon)} · Lv${p.level}</small></span><button data-remove="${enc(p.id)}" class="remove" aria-label="${enc(p.pokemon)}を外す">外す</button></div>`).join(''):'<div class="empty-mini">まだ選択されていません。下の一覧から5匹選んでください。</div>';
 for(const btn of $('sleepList').querySelectorAll('[data-remove]'))btn.addEventListener('click',()=>{const previous=[...state.sleepIds];state.sleepIds=state.sleepIds.filter(id=>id!==btn.dataset.remove);const saved=save();if(!saved)state.sleepIds=previous;notifySave(saved,'睡眠パーティを変更しました。');renderBox();renderSimulator();if(saved)markResultsStale();});}
function renderBox(){status();renderSleep();let q=$('searchPokemon').value.toLocaleLowerCase('ja');const found=state.box.filter(p=>[p.nickname,p.pokemon].some(s=>(s||'').toLocaleLowerCase('ja').includes(q)));const view=found.slice(0,120);
 $('pokemonList').innerHTML=view.length?view.map(p=>{const selected=state.sleepIds.includes(p.id);return `<div class="pokemon-row"><div class="pokemon-symbol">${enc((p.pokemon||'?').slice(0,1))}</div><div class="pokemon-info"><b>${enc(p.nickname||p.pokemon)}</b><div>${enc(p.pokemon)} · Lv${p.level} · スキルLv${p.skillLevel}</div><div class="pokemon-details">${enc(p.nature||'せいかく未設定')} / ${enc(p.ingredients.filter(Boolean).join('・')||'食材未設定')}</div></div><button class="pick ${selected?'selected':''}" data-add="${enc(p.id)}" ${!selected&&state.sleepIds.length>=5?'disabled':''}>${selected?'選択中':'睡眠用に追加'}</button></div>`;}).join(''):'<div class="card empty">'+(state.box.length?'該当するポケモンがありません。':'CSVを読み込むとここに一覧が表示されます。')+'</div>';
 $('boxMore').hidden=found.length<=120;$('boxMore').textContent=found.length>120?`検索結果 ${found.length}匹のうち、先頭120匹を表示しています。検索して絞り込んでください。`:'';
 for(const btn of $('pokemonList').querySelectorAll('[data-add]'))btn.addEventListener('click',()=>{let id=btn.dataset.add;const previous=[...state.sleepIds];if(state.sleepIds.includes(id)){state.sleepIds=state.sleepIds.filter(x=>x!==id);}else if(state.sleepIds.length<5)state.sleepIds.push(id);const saved=save();if(!saved)state.sleepIds=previous;notifySave(saved,'睡眠パーティを変更しました。');renderBox();if(saved)markResultsStale();});
 // Sleep-party completion happens on the box tab; immediately sync the simulator
 // readiness gate rather than waiting for a new roster edit or a page reload.
 updateRosterStatus();
}
function download(filename,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('eventDuration').addEventListener('change',showDuration);
$('saveEvent').addEventListener('click',()=>{const previous=state.event,oldUpdatedAt=state.updatedAt;state.event=readEvent();state.updatedAt=new Date().toISOString();const saved=save();if(!saved){state.event=previous;state.updatedAt=oldUpdatedAt;}status();markResultsStale();notifySave(saved,'イベント条件を保存しました。');});
for(const btn of document.querySelectorAll('.tab'))btn.addEventListener('click',()=>setTab(btn.dataset.tab));
$('searchPokemon').addEventListener('input',renderBox);
$('csvFile').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;$('importError').hidden=true;try{
 if(file.size>8*1024*1024)throw new Error('ファイルが8MBを超えています。');
 const text=await file.text();const result=PokeCsv.parseBoxText(text);
 const kept=storage.reconcileSleepIds(state,result.items);
 if(state.box.length&&!confirm(`ボックスを${result.items.length}匹で置き換えますか？ 睡眠パーティは一致する個体のみ引き継ぎます（${kept.length}/${state.sleepIds.length}匹）。`))return;
 const simTeams={};
 for(const key of ['morning','noon','evening']){
  simTeams[key]=storage.reconcileSleepIds({box:state.box,sleepIds:state.simulation.teams[key]||[]},result.items);
 }
 const previous=state;state={...state,box:result.items,sleepIds:kept,simulation:{...state.simulation,teams:simTeams},updatedAt:new Date().toISOString()};
 const saved=save();if(!saved)state=previous;renderBox();fillSimulation();if(saved){stalePreparation();lastRunSnapshot=null;$('simResult').hidden=true;}notifySave(saved,`${result.items.length}匹を読み込みました。睡眠パーティは${kept.length}匹を引き継ぎました。`);
 }catch(e){$('importError').textContent=e.message||String(e);$('importError').hidden=false;}finally{ev.target.value='';}});
$('downloadBackup').addEventListener('click',()=>{download(`pokesleep_event_backup_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');toast('バックアップを保存しました。');});
$('backupFile').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('ファイルが大きすぎます。');const data=storage.validateState(JSON.parse(await file.text()));if(!confirm(`バックアップを復元し、現在の${state.box.length}匹と設定を置き換えますか？`))return;const previous=state;state=data;storage.allowRecovery();const saved=save();if(!saved)state=previous;fillEvent();renderBox();fillSimulation();fillPreparation();if(saved){lastRunSnapshot=null;$('simResult').hidden=true;}notifySave(saved,'バックアップを復元しました。');}catch(e){alert('復元できませんでした：'+e.message);}finally{ev.target.value='';}});
$('clearData').addEventListener('click',()=>{if(!confirm('ボックス・睡眠パーティ・イベント条件をすべて削除します。実行しますか？'))return;const previous=state;state=storage.newState();storage.allowRecovery();const saved=save();if(!saved)state=previous;fillEvent();if(saved)$('searchPokemon').value='';renderBox();fillSimulation();fillPreparation();if(saved){lastRunSnapshot=null;$('simResult').hidden=true;}notifySave(saved,'端末内の保存情報を消去しました。');});
// STEP3 candidate scores stay ephemeral; only explicit apply changes daytime teams.
let step3Candidates=[],step3Source='',step3Evaluations=[],step3EvaluationToken=0;
const step3Fingerprint=()=>JSON.stringify({box:state.box,sleepIds:state.sleepIds,
 event:state.event});
function clearStep3Evaluations(){
 step3EvaluationToken++;
 step3Evaluations=[];
 $('autoCompare').disabled=step3Candidates.length===0;
 $('autoCompareProgress').textContent='';
 if(step3Candidates.length)renderStep3Candidates();
}
function clearStep3Candidates(){
 step3Candidates=[];step3Source='';
 clearStep3Evaluations();
 $('autoCandidateList').replaceChildren();
 $('autoCandidateStatus').textContent='';
 $('autoCandidateError').hidden=true;
}
function renderStep3Candidates(){
 const error=$('autoCandidateError'),list=$('autoCandidateList');
 list.replaceChildren();
 const evaluated=new Map(step3Evaluations.map(row=>[row.candidate.code,row]));
 const ordered=step3Evaluations.length===step3Candidates.length?
  PokeStep3.orderEvaluations(step3Evaluations).map(x=>x.candidate):
  step3Candidates;
 const rosterLabel=ids=>ids.map(id=>{
  const p=state.box.find(x=>x.id===id);
  return p?(p.nickname||p.pokemon)+'（'+p.pokemon+' Lv'+p.level+'）':id;
 }).join('、');
 const fmt=n=>Math.round(n).toLocaleString('ja-JP');
 for(const candidate of ordered){
  const card=document.createElement('div');card.className='step3-candidate-card';
  const title=document.createElement('h4');title.textContent=candidate.title;
  const desc=document.createElement('p');desc.textContent=candidate.description;
  const scored=evaluated.get(candidate.code);
  if(scored){
   const numbers=document.createElement('p');numbers.className='step3-score';
   numbers.textContent='週間モデル予測 '+fmt(scored.score.total)+' エナジー（きのみ '+fmt(scored.score.berries)+
    '／料理 '+fmt(scored.score.cooking)+'／直接スキル '+fmt(scored.score.skills)+'）';
   const caution=document.createElement('p');caution.className='step3-uncertainty';
   caution.textContent='参考値・実ゲーム順位未検証。'+(scored.caveats.length?
    '要注意：'+scored.caveats.join('、')+'。':'計算式の全体精度は未実証。');
   card.append(numbers,caution);
   if(scored.warnings.length){
    const details=document.createElement('details');
    details.className='step3-model-warnings';
    const summary=document.createElement('summary');
    summary.textContent='計算器の警告をすべて確認（'+scored.warnings.length+'件）';
    details.append(summary);
    for(const warning of scored.warnings){
     const entry=document.createElement('p');entry.textContent=warning;
     details.append(entry);
    }
    card.append(details);
   }
  }
  const slots=document.createElement('p');slots.className='step3-candidate-schedule';
  slots.textContent='朝7:30～12:00：'+rosterLabel(candidate.teams.morning)+
   '\n昼12:00～18:00：'+rosterLabel(candidate.teams.noon)+
   '\n夜18:00～0:00：'+rosterLabel(candidate.teams.evening);
  const timing=document.createElement('p');timing.className='step3-candidate-timing';
  const c=candidate.changes;
  timing.textContent='交代数（毎日・入替個体）：7:30 '+c.morning+'、12:00 '+c.noon+
   '、18:00 '+c.evening+'、0:00 '+c.bedtime+'。計 '+c.total+
   '匹分／日。7:30は先に回収してから切替。0:00以降の睡眠5匹は固定。';
  const action=document.createElement('button');
  action.type='button';action.className='secondary';
  action.textContent='この候補を朝・昼・夜に反映';
  action.addEventListener('click',()=>{
   if(step3Fingerprint()!==step3Source||hasUnsavedEventEdits()){
    error.textContent='手持ち・睡眠5匹・イベント条件が変わりました。候補を再生成してください。';
    error.hidden=false;return;
   }
   if(!confirm('朝・昼・夜の手動編成をこの候補で上書きしますか？ 睡眠パーティは変更しません。'))return;
   // A failed localStorage write must not leave a falsely applied day team.
   const previous=state.simulation.teams;
   state.simulation.teams={...previous,
    morning:[...candidate.teams.morning],noon:[...candidate.teams.noon],
    evening:[...candidate.teams.evening]};
   if(!save()){
    state.simulation.teams=previous;
    error.textContent='編成の保存に失敗しました。手動編成は変更していません。保存領域を確認してください。';
    error.hidden=false;
    return;
   }
   renderSimulator();markResultsStale(true);
   notifySave(true,'日中の候補を反映しました。下の7日間試算で詳細を確認できます。');
   setTab('simulate');
  });
  card.append(title,desc,slots,timing,action);list.append(card);
 }
}
function showStep3Candidates(){
 clearStep3Candidates();
 const error=$('autoCandidateError');error.hidden=true;
 try{
  if(hasUnsavedEventEdits())throw Error('イベント条件に未保存の変更があります。イベント条件を保存してから候補を作成してください。');
  const output=PokeStep3.createCandidates({box:state.box,sleepIds:state.sleepIds,map:state.event.map});
  step3Candidates=output.candidates;step3Source=step3Fingerprint();
  $('autoCompare').disabled=!step3Candidates.length;
  renderStep3Candidates();
  $('autoCandidateStatus').textContent='候補 '+step3Candidates.length+'件。'+
   output.warnings.join(' ')+' 適用するまで現在の手動編成は変更されません。';
 }catch(e){
  clearStep3Candidates();error.textContent=e.message||String(e);error.hidden=false;
 }
}
function compareStep3Candidates(){
 const error=$('autoCandidateError');error.hidden=true;
 try{
  if(!step3Candidates.length)throw Error('先に候補を作成してください。');
  if(step3Fingerprint()!==step3Source||hasUnsavedEventEdits())
   throw Error('手持ち・睡眠5匹・イベント条件が変わりました。候補を再生成してください。');
  // The settings are read from CURRENT controls without requiring an existing
  // complete manual daytime team. Never save these trial-only inputs.
  const settings=readSimulation(true);
  const fingerprint=JSON.stringify({source:step3Fingerprint(),settings});
  clearStep3Evaluations();
  const token=step3EvaluationToken;
  const candidates=step3Candidates.slice(0,6),failed=[];
  const started=Date.now();
  let index=0;
  $('autoCompare').disabled=true;
  const progress=$('autoCompareProgress');
  progress.textContent='0/'+candidates.length+'件の7日間試算を開始しています。';
  function next(){
   if(token!==step3EvaluationToken)return;
   try{
    if(hasUnsavedEventEdits()||JSON.stringify({source:step3Fingerprint(),
      settings:readSimulation(true)})!==fingerprint){
     step3Evaluations=[];
     progress.textContent='入力条件が変更されました。旧比較結果は破棄しました。再比較してください。';
     $('autoCompare').disabled=false;renderStep3Candidates();return;
    }
    if(index>=candidates.length||(index>0&&Date.now()-started>45000)){
     const complete=index===candidates.length;
     const success=step3Evaluations.length;
     if(success)renderStep3Candidates();
     progress.textContent=(complete?'比較終了':'45秒の安全上限に達したため比較を中断')+
      '：'+success+'/'+candidates.length+'件成功。'+
      (complete&&failed.length===0?'全候補の週間モデル予測を参考表示（3%以内は入替数で表示順調整）。':!complete?'未評価候補が残っているため全候補の比較は未完成です。':'計算できない候補があるため全候補の比較は未完成です。')+
      (failed.length?' 計算できなかった候補：'+failed.join('、')+'。':'')+
      ' 実ゲーム順位は未検証です。';
     $('autoCompare').disabled=false;return;
    }
    const c=candidates[index];index++;
    try{
     step3Evaluations.push(PokeStep3.evaluateCandidate({
      candidate:c,box:state.box,sleepIds:state.sleepIds,
      options:{...settings,map:state.event.map,camp:state.event.camp1,
       foodMode:state.event.food1,eventEffects:state.event.effects}
     }));
    }catch(e){failed.push(c.title+'（'+(e.message||String(e))+'）');}
    progress.textContent=index+'/'+candidates.length+'件を評価しました。';
    setTimeout(next,0); // one expensive weekly evaluation per event-loop turn
   }catch(e){
    step3Evaluations=[];
    renderStep3Candidates();
    progress.textContent='比較を中断し、途中の結果を破棄しました：'+(e.message||String(e));
    $('autoCompare').disabled=false;
   }
  }
  setTimeout(next,0);
 }catch(e){error.textContent=e.message||String(e);error.hidden=false;}
}
$('autoCandidates').addEventListener('click',showStep3Candidates);
$('autoCompare').addEventListener('click',compareStep3Candidates);
const rosterKeys=['morning','noon','evening'];
const ingredientEditors=Object.create(null);
const magnetEditors=Object.create(null);
function renderSimulator(){
 if(!window.PokeSimulator)return;
 for(const key of rosterKeys){
  const holder=document.querySelector('[data-roster="'+key+'"]');if(!holder)continue;
  const previous=state.simulation.teams[key]||[];
  holder.replaceChildren();
  for(let i=0;i<5;i++){
    const line=document.createElement('label');line.className='sim-slot';
    const index=document.createElement('b');index.textContent=String(i+1);
    const select=document.createElement('select');select.setAttribute('aria-label',key+' '+(i+1)+'匹目');
    const empty=document.createElement('option');empty.value='';empty.textContent='ポケモンを選択';select.append(empty);
    for(const p of state.box){
      const o=document.createElement('option');o.value=p.id;o.textContent=(p.nickname||p.pokemon)+' / '+p.pokemon+' Lv'+p.level;select.append(o);
    }
    select.value=previous[i]||'';
    select.addEventListener('change',()=>{
      const values=Array.from(holder.querySelectorAll('select')).map(x=>x.value);
      const chosen=values.filter(Boolean);
      if(new Set(chosen).size!==chosen.length){
        select.value=state.simulation.teams[key]?.[i]||'';
        toast('同じ時間帯に同一個体を2匹指定できません。');
        return;
      }
      const previousTeams=state.simulation.teams;
      state.simulation.teams={...previousTeams,[key]:values};
      const saved=save();
      if(!saved){state.simulation.teams=previousTeams;select.value=previous[i]||'';renderSimulator();}
      notifySave(saved,'試算用パーティを保存しました。');
      updateRosterStatus();if(saved)markResultsStale();
    });
    line.append(index,select);holder.append(line);
  }
 }
 updateRosterStatus();
}
function updateRosterStatus(){
 const status=$('simRosterStatus');if(!status)return;
 const missing=[];
 for(const [key,name] of [['morning','朝'],['noon','昼'],['evening','夜']]){
  const count=(state.simulation.teams[key]||[]).filter(Boolean).length;
  if(count!==5)missing.push(name+' '+count+'/5');
 }
 if(state.sleepIds.length!==5)missing.push('睡眠 '+state.sleepIds.length+'/5');
 status.textContent=missing.length?'未完成：'+missing.join(' ／ '):'朝・昼・夜・睡眠の20枠が揃いました。試算できます。';
 status.className='small '+(missing.length?'warn':'ok');
 $('runSim').disabled=missing.length>0;
}
function fillSimulation(){
 clearStep3Candidates();
 const sim=state.simulation||storage.defaultSimulation();
 $('simFieldBonus').value=sim.fieldBonus;
 $('simTap').value=sim.tapMinutes;
 $('simPot').value=sim.potSize;
 $('simBagCapacity').value=sim.bagCapacity||0;
 $('simSleepScore').value=sim.sleepScore;
 $('simInitialEnergy').value=sim.initialEnergy;
 $('simRecipe').replaceChildren();
 const blank=document.createElement('option');blank.value='';blank.textContent='料理は計算しない';$('simRecipe').append(blank);
 for(const r of PokeSimulator.RECIPES){
  const o=document.createElement('option');o.value=r.id;
  o.textContent=({curry:'カレー',salad:'サラダ',dessert:'デザート'}[r.type]||r.type)+'｜'+r.name+'（'+Object.values(r.requirements).reduce((a,b)=>a+b,0)+'個）';
  $('simRecipe').append(o);
 }
 $('simRecipe').value=sim.recipeId;
 $('simRecipeMode').value=sim.recipeMode||'fixed';
 $('simExtraMode').value=sim.extraMode||'none';
 $('simSuccessMode').value=sim.successMode||'none';
 const container=$('simIngredientFields');container.replaceChildren();
 for(const [key,name] of Object.entries(PokeMaster.ingredients)){
  const label=document.createElement('label');label.className='field';
  const span=document.createElement('span');span.textContent=name;
  const input=document.createElement('input');input.type='number';input.min='0';input.max='10000';input.step='1';
  input.value=sim.initialIngredients[key]||0;input.setAttribute('aria-label',name+' の初期在庫数');
  label.append(span,input);container.append(label);ingredientEditors[key]=input;
 }
 const magnetContainer=$('simMagnetFields');magnetContainer.replaceChildren();
 const discovered=new Set(sim.magnetIngredients||[]);
 for(const [key,name] of Object.entries(PokeMaster.ingredients)){
  const label=document.createElement('label');label.className='field sim-magnet-choice';
  const input=document.createElement('input');input.type='checkbox';input.checked=discovered.has(key);
  input.setAttribute('aria-label',name+' を食材ゲット候補に含める');
  const span=document.createElement('span');span.textContent=name;
  label.append(input,span);magnetContainer.append(label);magnetEditors[key]=input;
 }
 renderSimulator();
}
function readSimulation(forCandidates=false){
 const numbers=[['simFieldBonus',0,100],['simTap',120,180],['simPot',7,300],['simBagCapacity',0,10000],['simSleepScore',0,100],['simInitialEnergy',0,150]];
 const data={};
 for(const [id,min,max] of numbers){
  const raw=$(id).value.trim(),v=Number(raw);if(raw===''||!Number.isFinite(v)||v<min||v>max||!Number.isInteger(v))throw Error(id+' の入力値を確認してください。');
  data[id]=v;
 }
 const initialIngredients={};
 for(const [key,input] of Object.entries(ingredientEditors)){
  const raw=String(input.value).trim(),v=Number(raw);
  if(raw===''||!Number.isInteger(v)||v<0||v>10000)throw Error((PokeMaster.ingredients[key]||key)+' の在庫数を確認してください。');
  if(v!==0)initialIngredients[key]=v;
 }
 const magnetIngredients=Object.entries(magnetEditors).filter(([key,input])=>input.checked).map(([key])=>key);
 const teams={};
 if(state.sleepIds.length!==5)throw Error('ボックスタブで睡眠パーティ5匹を指定してください。');
 for(const key of rosterKeys){
  if(forCandidates){teams[key]=[...state.sleepIds];continue;}
  const values=Array.from(document.querySelector('[data-roster="'+key+'"]').querySelectorAll('select')).map(x=>x.value);
  if(values.length!==5||values.some(v=>!v)||new Set(values).size!==5)throw Error('朝・昼・夜のすべての枠に異なる5匹を指定してください。');
  teams[key]=values;
 }
 return {teams,fieldBonus:data.simFieldBonus,tapMinutes:data.simTap,potSize:data.simPot,bagCapacity:data.simBagCapacity,sleepScore:data.simSleepScore,initialEnergy:data.simInitialEnergy,recipeId:$('simRecipe').value,recipeMode:$('simRecipeMode').value,extraMode:$('simExtraMode').value,successMode:$('simSuccessMode').value,initialIngredients,magnetIngredients};
}
// Native form changes must not leave a previous 7-day result looking current.
for(const id of ['simFieldBonus','simTap','simPot','simBagCapacity','simSleepScore',
 'simInitialEnergy','simRecipeMode','simRecipe','simExtraMode','simSuccessMode'])
 $(id).addEventListener('change',markResultsStale);
$('simIngredientFields').addEventListener('change',markResultsStale);
$('simMagnetFields').addEventListener('change',markResultsStale);
$('fillAllRosters').addEventListener('click',()=>{
 if(state.sleepIds.length!==5){toast('先にボックスタブで睡眠用5匹を選択してください。');setTab('box');return;}
 const previous=state.simulation.teams;state.simulation.teams={...previous};for(const key of rosterKeys)state.simulation.teams[key]=[...state.sleepIds];
 const saved=save();if(!saved)state.simulation.teams=previous;renderSimulator();if(saved)markResultsStale();notifySave(saved,'睡眠パーティを朝・昼・夜に一括設定しました。');
});
for(const btn of document.querySelectorAll('.sim-copy'))btn.addEventListener('click',()=>{
 const from=btn.dataset.copyFrom,to=btn.dataset.copyTo;
 const ids=from==='sleep'?state.sleepIds:state.simulation.teams[from];
 if(ids.length!==5||ids.some(id=>!id)){toast('コピー元の5匹が揃っていません。');return;}
 const previous=state.simulation.teams;state.simulation.teams={...previous,[to]:[...ids]};const saved=save();if(!saved)state.simulation.teams=previous;notifySave(saved,'5匹の編成をコピーしました。');renderSimulator();if(saved)markResultsStale();
});
$('runSim').addEventListener('click',()=>{
 $('simError').hidden=true;
 try{
  if(hasUnsavedEventEdits())throw Error('イベント条件に未保存の変更があります。イベントタブで「イベント条件を保存」を押してから再試算してください。');
  const sim=readSimulation();
  const runInput={box:state.box,teams:{...sim.teams,sleep:state.sleepIds},options:{...sim,map:state.event.map,camp:state.event.camp1,foodMode:state.event.food1,eventEffects:state.event.effects}};
  // Do not overwrite a previously valid saved setup if this week's calculation
  // is rejected (e.g. inventory exceeds the configured shared bag).
  const result=PokeSimulator.simulate(runInput);
  const previous=state.simulation;
  state.simulation=sim;
  const saved=save();if(!saved){state.simulation=previous;throw Error('設定を保存できません。バックアップを取得してから再試行してください。');}
  const version=document.querySelector('.step-mark')?.textContent.match(/v(\d+\.\d+\.\d+)/)?.[1];
  lastRunSnapshot=PokeObservation.captureSimulation(runInput,result,version,new Date().toISOString());
  $('planStatus').textContent='今回の試算を記録用に保持しました。事前予測として利用する場合は週開始前にJSONを保存してください。';
  const yen=n=>Math.round(n).toLocaleString('ja-JP');
  $('simTotal').textContent=yen(result.total)+' エナジー（計上できた項目のみ・暫定）';
  const stats=[['きのみ',result.berries],['料理',result.cooking],['直接スキル',result.skills]];
  const breakdown=$('simBreakdown');breakdown.replaceChildren();
  for(const [label,value] of stats){const cell=document.createElement('div');cell.className='sim-stat';const a=document.createElement('small');a.textContent=label;const b=document.createElement('strong');b.textContent=yen(value);cell.append(a,b);breakdown.append(cell);}
  $('simDaily').replaceChildren();
  for(const day of result.days){const row=document.createElement('div');row.className='sim-day';const total=day.berries+day.cooking+day.skills;const left=document.createElement('span');left.textContent='第'+day.day+'日';const right=document.createElement('strong');right.textContent=yen(total);row.append(left,right);$('simDaily').append(row);}
  $('simNightEnergy').replaceChildren();
  const sleepIds=state.sleepIds;
  const average=values=>sleepIds.reduce((sum,id)=>sum+Number(values[id]||0),0)/sleepIds.length;
  for(const night of result.nightEnergy){
   const row=document.createElement('div');row.className='sim-day';
   const left=document.createElement('span');left.textContent='第'+night.day+'夜（'+night.hours+'時間）';
   const right=document.createElement('strong');
   const before=average(night.beforeSleep).toFixed(1),low=average(night.beforeRecovery).toFixed(1);
   const after=average(night.afterRecovery).toFixed(1);
   right.textContent=night.day===7
    ?before+' → '+low+'（翌月曜4:00・回復前）'
    :before+' → '+low+' → '+after;
   row.append(left,right);$('simNightEnergy').append(row);
  }
  $('simMealSummary').textContent='期待値モデルで料理を計上 '+result.meals.length+' / 21食（初期食材の確定在庫だけで必須材料を満たす計画 '+result.initialCoveredMeals+'食／生産期待値に依存 '+result.estimatedMeals+'食、料理エナジー '+yen(result.cooking)+'）。'
   +' 不確実な生産由来の食材を使う料理：'+result.expectedSourceMeals+'食・'+yen(result.expectedSourceMealEnergy)+'エナジー相当（成立確率ではありません）。'
   +' スキル期待値による鍋拡張に依存する料理：'+result.potDependentMeals+'食（食材由来の分類とは重複します）。'
   +'追加食材：'+(sim.extraMode==='fill'?'期待値で計上':'OFF')+'／大成功：'+(sim.successMode==='expected'?'推定期待値で計上':'OFF')+'。'
   +(result.extraHelps>0?' 追加おてつだい '+result.extraHelps.toFixed(1)+'回（期待値、獲得きのみ・食材へ反映）。':'');
  $('simMeals').replaceChildren();
  if(!result.meals.length)$('simMeals').textContent='成立したレシピなし／未計上';
  for(const meal of result.meals){
   const row=document.createElement('div');row.className='sim-day';
   const label=document.createElement('span');label.textContent='第'+meal.day+'日 '+meal.meal+'：'+meal.name+
    '（必須材料：'+(meal.initialCovered?'入力した初期食材で充足':'生産期待値に依存')+
    (meal.expectedMandatoryUnits>1e-9?'／確定在庫不足 '+meal.expectedMandatoryUnits.toFixed(1)+'個':'')+
    '／合計'+meal.count+'個'+(meal.extraEnergy?'／追加分+'+yen(meal.extraEnergy):'')+
    (meal.expectedExtraUnits>1e-9?'／追加食材も期待値に依存':'')+
    (meal.potDependent?'／鍋拡張のスキル期待値に依存':'')+
    (meal.expectedSource?'／料理エナジーは生産期待値由来を含む':'')+
    (meal.successProbability?'／大成功推定'+Math.round(meal.successProbability*100)+'%':'')+'）';
   const score=document.createElement('strong');score.textContent=yen(meal.energy);
   row.append(label,score);$('simMeals').append(row);
  }
  $('simIngredients').replaceChildren();
  const entries=Object.entries(result.ingredients).sort((a,b)=>b[1]-a[1]);
  for(const [key,value] of entries){const row=document.createElement('div');row.className='sim-day';const name=document.createElement('span');const viaSkill=result.skillIngredients[key]||0;name.textContent=(PokeMaster.ingredients[key]||key)+(viaSkill>0?'（スキル由来 '+viaSkill.toFixed(1)+'個を含む）':'');const count=document.createElement('strong');count.textContent=value.toFixed(1)+' 個';row.append(name,count);$('simIngredients').append(row);}
  if(!entries.length)$('simIngredients').textContent='食材獲得なし／未計上';
  const note=$('simWarnings');note.replaceChildren();for(const warning of result.warnings){const p=document.createElement('p');p.textContent=warning;note.append(p);}
  $('simResult').hidden=false;
  $('simStaleNotice').hidden=true;
  for(const id of ['obsMonday','obsTotal','obsBerry','obsCooking','obsScreenshot'])$(id).value='';
  for(const id of ['obsNoUnmodeledEvents','obsSameCollectionSchedule','obsNoUntrackedItems','obsStartStrengthVerified','obsWeekBoundaryReconciled','obsConfirmedSummary'])$(id).checked=false;
  $('obsError').hidden=true;
  $('obsResult').textContent='この試算時点の設定を記録用に保持しました。観測数値・確認項目は未入力です。';
  $('simResult').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){lastRunSnapshot=null;$('simResult').hidden=true;$('simError').textContent=e.message||String(e);$('simError').hidden=false;}
});



$('downloadPlan').addEventListener('click',()=>{
 $('planError').hidden=true;
 try{
  const plan=PokeObservation.makePlan(lastRunSnapshot,$('obsMonday').value);
  download('pokesleep_preweek_plan_'+plan.week.mondayDate+'.json',
   JSON.stringify(plan,null,2),'application/json;charset=utf-8');
  $('planStatus').textContent='事前予測JSONを保存しました（対象週：'+plan.week.mondayDate+
   '／試算時刻：'+plan.capture.capturedAt+'）。端末時計・ファイル内容の独立証明ではありません。';
 }catch(e){$('planError').textContent=e.message||String(e);$('planError').hidden=false;}
});
$('planFile').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 $('planError').hidden=true;
 try{
  if(file.size>8*1024*1024)throw Error('事前予測JSONは8MB以下にしてください。');
  const plan=JSON.parse(await file.text());
  const restored=PokeObservation.snapshotFromPlan(plan);
  lastRunSnapshot=restored;
  $('obsMonday').value=restored.plannedWeekMonday;
  for(const id of ['obsTotal','obsBerry','obsCooking','obsScreenshot'])$(id).value='';
  for(const id of ['obsNoUnmodeledEvents','obsSameCollectionSchedule','obsNoUntrackedItems',
    'obsStartStrengthVerified','obsWeekBoundaryReconciled','obsConfirmedSummary'])$(id).checked=false;
  $('obsError').hidden=true;
  $('obsResult').textContent='事前予測を復元しました。週まとめの実測値と実際に確認した条件のみ入力してください。';
  $('planStatus').textContent='事前予測：'+restored.plannedWeekMonday+'／試算時刻 '+restored.capturedAt+
   '。現在の手持ち・設定を上書きしていません。ファイルは自己申告記録であり精度PASSではありません。';
 }catch(e){$('planError').textContent=e.message||String(e);$('planError').hidden=false;}
 finally{ev.target.value='';}
});

$('downloadObservation').addEventListener('click',()=>{
 $('obsError').hidden=true;
 try{
  const form={
   mondayDate:$('obsMonday').value,
   total:$('obsTotal').value,berryAndStrengthSkill:$('obsBerry').value,
   cooking:$('obsCooking').value,
   screenshotReference:$('obsScreenshot').value,
   confirmedSummary:$('obsConfirmedSummary').checked,
   noUnmodeledEvents:$('obsNoUnmodeledEvents').checked,
   sameCollectionSchedule:$('obsSameCollectionSchedule').checked,
   noUntrackedItems:$('obsNoUntrackedItems').checked,
   startStrengthVerified:$('obsStartStrengthVerified').checked,
   weekBoundaryReconciled:$('obsWeekBoundaryReconciled').checked
  };
  const report=PokeObservation.makeReport(lastRunSnapshot,form,new Date().toISOString());
  const compared=PokeObservation.preview(report);
  const difference=n=>(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP');
  const timingLabel={PRE_WEEK:'週開始前に記録した試算（端末時計上・独立証明なし）',DURING_WEEK:'週途中の試算',AFTER_WEEK:'週終了後の事後試算'};
  const note='試算の時期：'+timingLabel[compared.forecastTiming.phase]+'。実測−試算：総'+difference(compared.signedDeltaObservedMinusModel.total)+
   '／きのみ＋直接スキル'+difference(compared.signedDeltaObservedMinusModel.berryAndStrengthSkill)+
   '／料理'+difference(compared.signedDeltaObservedMinusModel.cooking)+
   '。週まとめ入力：'+compared.summaryRecordingTime.recordedAt+'（端末時計上・独立証明なし）。単週観測のため精度・編成順位は未検証（STEP2 HOLD）。';
  const concerns=[
   ...(!compared.weeklySummaryBucketsReconcile?['ゲーム週まとめの総エナジーと2欄の合計が一致しません。']:[]),
   ...(compared.unconfirmedConditions.length?['確認できていない条件が'+compared.unconfirmedConditions.length+'項目あります。']:[]),
   ...compared.modelLimitations.map(x=>'モデルの未検証：'+x)
  ];
  $('obsResult').textContent=note+(concerns.length?' 要確認：'+concerns.join(' '):'');
  download('pokesleep_weekly_observation_'+report.week.mondayDate+'.json',
   JSON.stringify(report,null,2),'application/json;charset=utf-8');
 }catch(e){$('obsError').textContent=e.message||String(e);$('obsError').hidden=false;}
});


$('observationFile').addEventListener('change',async ev=>{
 const files=Array.from(ev.target.files||[]);if(!files.length)return;
 const result=$('obsImportResult'),error=$('obsImportError');
 result.replaceChildren();error.hidden=true;
 try{
  if(files.length>4)throw Error('観測JSONは一度に最大4ファイルです。');
  if(files.some(file=>file.size>8*1024*1024)||
     files.reduce((sum,file)=>sum+file.size,0)>12*1024*1024)
   throw Error('観測JSONは各8MB以下、合計12MB以下にしてください。');
  const reports=[];
  for(const file of files)reports.push(JSON.parse(await file.text()));
  const batch=PokeObservation.reviewImportedReports(reports,PokeSimulator.simulate);
  const numeric=n=>Math.round(n).toLocaleString('ja-JP');
  const signed=n=>(n>0?'+':'')+numeric(n);
  const add=t=>{const row=document.createElement('p');row.textContent=t;result.append(row);};
  if(batch.count>1){
   add('複数週の観測記録 '+batch.count+'件（ゲーム実測の真正性・精度は未検証）。');
   add('記録された試算入力：'+(batch.sameSavedInputs?'全件同一':'差異あり。週ごとに条件が異なる可能性があります。'));
   if(batch.duplicateMondays.length)
    add('重複した対象週：'+batch.duplicateMondays.join('、')+'。同じ週を独立した複数回の観測と数えないでください。');
   if(batch.conflictingMondays.length)
    add('要確認：同一週でフィールドまたは週まとめ数値が矛盾しています：'+batch.conflictingMondays.join('、'));
   if(batch.conflictingInputsMondays.length)
    add('要確認：同一週の記録なのに保存された試算入力（ポケモン・編成・設定）に差異があります：'+batch.conflictingInputsMondays.join('、')+
      '。どちらの試算が実ゲームの条件に対応するか確認してください。');
   add('個別の未確認・モデル制限がある記録：'+batch.confoundedCount+'件。単純な平均誤差や編成順位を推定しません。');
  }
  for(const replay of batch.items){
   add('対象週：'+replay.week.mondayDate+'／'+replay.week.field);
   if(replay.summaryRecordingTime)add('週まとめ記録日時：'+replay.summaryRecordingTime.recordedAt+'（端末時計上・独立証明なし）。');
   else add('週まとめ記録日時：旧観測JSONでは未保存。日付は自己申告として扱います。');
   const timingLabel={PRE_WEEK:'週開始前記録（端末時計上・独立証明なし）',DURING_WEEK:'週途中記録',AFTER_WEEK:'週終了後の事後記録'};
   add('試算保存の時期：'+timingLabel[replay.forecastTiming.phase]+'／保存時刻 '+replay.forecastTiming.capturedAt);
   add('ゲーム実測：'+numeric(replay.observed.total)+'／記録時の試算：'+numeric(replay.capturedModel.total)+
       '／現行モデルでの再試算：'+numeric(replay.currentModel.total));
   const d=replay.signedDeltaObservedMinusCurrent;
   add('ゲーム実測−現行モデル：合計 '+signed(d.total)+
       '／きのみ＋直接エナジースキル '+signed(d.berryAndStrengthSkill)+
       '／料理 '+signed(d.cooking));
   add('記録時の試算と現行モデル：'+(replay.captureComparison.matchesCurrentModel?'一致':'差異あり（要調査）'));
   if(!replay.weeklySummaryBucketsReconcile)
    add('要確認：ゲーム週まとめの総計と2欄の合計が一致しません。');
   for(const problem of replay.confounders)add('要確認：'+problem);
   for(const limitation of replay.modelLimitations)add('モデルの未検証：'+limitation);
  }
  // Two observed weeks cannot validate the healer ranking; only display
  // a descriptive delta after a strict saved-input and provenance screen.
  if(batch.r02TwoWeekScreen){
   const pair=batch.r02TwoWeekScreen;
   if(pair.status==='DESCRIPTIVE_ONLY'){
    const d=pair.comparison;
    add('R02ヒーラー1匹対2匹：保存した試算条件は1匹交代の2週として一致（参考情報のみ）。');
    add('ヒーラー1匹の週 '+d.oneHealerMonday+'／ヒーラー2匹の週 '+d.twoHealerMonday+'。');
    add('ゲーム入力の2匹−1匹差 '+signed(d.observedDeltaTwoMinusOne)+
        '／モデル期待値の2匹−1匹差 '+signed(d.modeledDeltaTwoMinusOne)+
        '／差同士の隔たり '+signed(d.descriptiveDeltaDisagreement)+' エナジー。');
    for(const note of pair.notes)add('比較の限界：'+note);
    add('R02の回復時刻・同時確率とゲーム順位は未検証。参考差分を勝者・精度PASSにしません（STEP2 HOLD）。');
   }else{
    add('R02ヒーラー1匹対2匹：2週の参考比較は条件不一致・検証不足のため保留。');
    for(const why of pair.blockers)add('R02比較保留：'+why);
   }
  }
  add(batch.count===1?
   '実ゲームの単週観測です。画像照合・モデル精度・編成順位は未検証（STEP2 HOLD）。':
   '複数の記録は条件差と重複の品質点検用です。画像照合・モデル精度・編成順位は未検証（STEP2 HOLD）。');
 }catch(e){result.replaceChildren();error.textContent=e.message||String(e);error.hidden=false;
 }finally{ev.target.value='';}
});


$('shareObservationFile').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 const error=$('shareObservationError'),result=$('shareObservationResult');
 error.hidden=true;result.textContent='';
 try{
  if(file.size>8*1024*1024)throw Error('共有用に変換する観測JSONは8MB以下にしてください。');
  const report=JSON.parse(await file.text());
  const redacted=PokeObservation.shareObservation(report,PokeSimulator.simulate);
  const output='pokesleep_weekly_observation_share_'+redacted.week.mondayDate+'.json';
  download(output,JSON.stringify(redacted,null,2),'application/json;charset=utf-8');
  result.textContent='計算と観測の判定を照合して、共有用コピーを保存しました。'+
   'ニックネーム・内部ID・スクリーンショット識別子・自由記述メモは含めません。'+
   '種族・能力・編成・日付・エナジーは残ります。匿名性・ゲーム実測の真正性・精度は保証しません（STEP2 HOLD）。';
 }catch(e){error.textContent=e.message||String(e);error.hidden=false;}
 finally{ev.target.value='';}
});

$('storageNotice').textContent=storage.getLoadError()|| (storage.available()?'このブラウザ内への保存：利用可能':'この環境は保存が制限されています。必ずJSONバックアップをご利用ください。');
if(storage.getLoadError()){$('storageNotice').className='small warn';$('criticalNotice').textContent=storage.getLoadError();$('criticalNotice').hidden=false;}
// STEP4: preparation is a separate stored plan, not an edit to the event
// week roster, fixed sleeping party, or the STEP2 energy calculation.
const prepCarryEditors=Object.create(null);
let prepExtraEditors=[];
let prepForecastToken=0;
function stalePreparation(){
 prepForecastToken++;
 $('prepForecast').disabled=false;
 $('prepCompare').disabled=false;
 $('prepForecastResult').hidden=true;
 $('prepForecastStatus').textContent='';
 $('prepCompareResult').hidden=true;
 $('prepCompareStatus').textContent='';
 if(!$('prepResult').hidden)$('prepStale').hidden=false;
}
function fillPrepRecipeOptions(select){
 select.replaceChildren();
 const empty=document.createElement('option');empty.value='';empty.textContent='料理を選択';select.append(empty);
 for(const r of PokeRecipes){
  const option=document.createElement('option');option.value=r.id;
  option.textContent=({curry:'カレー',salad:'サラダ',dessert:'デザート'}[r.type]||r.type)+
   '｜'+r.name+'（'+Object.values(r.requirements).reduce((a,b)=>a+b,0)+'個／食）';
  select.append(option);
 }
}
function appendPrepRecipeEditor(target={recipeId:'',meals:1}){
 if(prepExtraEditors.length>=20)return;
 const row=document.createElement('div');row.className='step4-recipe-row';
 const recipeLabel=document.createElement('label');recipeLabel.className='field';
 const recipeTitle=document.createElement('span');recipeTitle.textContent='追加する料理';
 const recipe=document.createElement('select');fillPrepRecipeOptions(recipe);
 recipe.value=target.recipeId;recipeLabel.append(recipeTitle,recipe);
 const countLabel=document.createElement('label');countLabel.className='field';
 const countTitle=document.createElement('span');countTitle.textContent='予定食数';
 const count=document.createElement('input');count.type='number';count.min='1';count.max='21';count.step='1';count.value=target.meals;
 countLabel.append(countTitle,count);
 const remove=document.createElement('button');remove.type='button';remove.className='secondary step4-remove-recipe';
 remove.textContent='この料理を外す';
 const entry={row,recipe,count};
 remove.addEventListener('click',()=>{
  prepExtraEditors=prepExtraEditors.filter(x=>x!==entry);
  $('prepExtraRecipes').replaceChildren(...prepExtraEditors.map(x=>x.row));
  stalePreparation();
 });
 recipe.addEventListener('change',stalePreparation);count.addEventListener('change',stalePreparation);
 row.append(recipeLabel,countLabel,remove);
 prepExtraEditors.push(entry);$('prepExtraRecipes').append(row);
}
function fillPreparation(){
 const prep=state.preparation||storage.defaultPreparation();
 const targets=prep.recipeTargets?.length?prep.recipeTargets:[{recipeId:prep.recipeId,meals:prep.meals}];
 fillPrepRecipeOptions($('prepRecipe'));
 $('prepRecipe').value=targets[0].recipeId;
 $('prepMeals').value=targets[0].meals;
 prepExtraEditors=[];$('prepExtraRecipes').replaceChildren();
 for(const target of targets.slice(1))appendPrepRecipeEditor(target);
 $('prepCapacity').value=prep.bagCapacity||state.simulation?.bagCapacity||0;
 $('prepPriority').value=prep.priority;
 $('prepField').value=prep.field||'';
 $('prepFieldBonus').value=prep.fieldBonus??0;
 $('prepForecastCooking').value=prep.forecastCooking||'none';
 $('prepForecastFoodMode').value=prep.forecastFoodMode||'random';
 $('prepForecastStockSource').value=prep.forecastInventorySource||'carryover';
 const holder=$('prepCarryFields');holder.replaceChildren();
 for(const [key,name] of Object.entries(PokeMaster.ingredients)){
  const label=document.createElement('label');label.className='field';
  const title=document.createElement('span');title.textContent=name;
  const input=document.createElement('input');input.type='number';input.min='0';input.max='10000';input.step='1';
  input.value=prep.carryover[key]||0;input.setAttribute('aria-label',name+' の持ち越し予定数');
  label.append(title,input);holder.append(label);prepCarryEditors[key]=input;
 }
 prepForecastToken++;
 $('prepForecast').disabled=false;
 $('prepCompare').disabled=false;
 $('prepResult').hidden=true;$('prepStale').hidden=true;$('prepError').hidden=true;
 $('prepForecastResult').hidden=true;$('prepForecastStatus').textContent='';
 $('prepCompareResult').hidden=true;$('prepCompareStatus').textContent='';
}
function readPreparation(){
 const getInt=(id,min,max)=>{
  const raw=String($(id).value).trim(),num=Number(raw);
  if(raw===''||!Number.isSafeInteger(num)||num<min||num>max)throw Error(id+' の整数入力値を確認してください。');
  return num;
 };
 const carryover={};
 for(const [key,input] of Object.entries(prepCarryEditors)){
  const raw=String(input.value).trim(),number=Number(raw);
  if(raw===''||!Number.isSafeInteger(number)||number<0||number>10000)
   throw Error((PokeMaster.ingredients[key]||key)+' の持ち越し予定数を確認してください。');
  if(number)carryover[key]=number;
 }
 const recipeTargets=[{recipeId:$('prepRecipe').value,meals:getInt('prepMeals',1,21)},
  ...prepExtraEditors.map(({recipe,count})=>{
   const raw=String(count.value).trim(),meals=Number(raw);
   if(raw===''||!Number.isSafeInteger(meals)||meals<1||meals>21)
    throw Error('追加料理の予定食数を1～21の整数で入力してください。');
   return {recipeId:recipe.value,meals};
  })];
 if(recipeTargets.some(r=>!r.recipeId))throw Error('すべての料理を選択してください。');
 if(new Set(recipeTargets.map(r=>r.recipeId)).size!==recipeTargets.length)
  throw Error('同じ料理が重複しています。食数をまとめて入力してください。');
 if(recipeTargets.reduce((n,r)=>n+r.meals,0)>21)
  throw Error('予定食数の合計は21食以内にしてください。');
 return {recipeId:recipeTargets[0].recipeId,meals:recipeTargets[0].meals,recipeTargets,
  bagCapacity:getInt('prepCapacity',1,10000),priority:$('prepPriority').value,
  carryover,field:$('prepField').value.trim(),fieldBonus:getInt('prepFieldBonus',0,100),
  forecastCooking:$('prepForecastCooking').value,
  forecastFoodMode:$('prepForecastFoodMode').value,
  forecastInventorySource:$('prepForecastStockSource').value};
}
function calculatePreparation(){
 const error=$('prepError');error.hidden=true;
 try{
  if(hasUnsavedEventEdits())throw Error('イベント条件が未保存です。イベントタブで「イベント条件を保存」を押してください。');
  const prep=readPreparation();
  const result=PokeStep4.plan({...prep,potSize:state.simulation.potSize,
   foodMode:state.event.food1,eventEffects:state.event.effects});
  const guide=PokeStep4.ingredientGuide({box:state.box,sleepIds:state.sleepIds,
   dayTeams:state.simulation.teams,plan:result});
  const previous=state.preparation;state.preparation=prep;
  if(!save()){state.preparation=previous;throw Error('準備計画を保存できませんでした。保存領域を確認してください。');}
  prepForecastToken++;
  $('prepForecast').disabled=false;
  $('prepCompare').disabled=false;
  $('prepForecastResult').hidden=true;$('prepForecastStatus').textContent='';
  $('prepCompareResult').hidden=true;$('prepCompareStatus').textContent='';
  const format=n=>n.toLocaleString('ja-JP');
  $('prepSummary').textContent=result.recipe?
   '「'+result.recipe.name+'」'+result.meals+'食分の計画':
   result.recipes.length+'品・合計'+result.meals+'食分の計画';
  $('prepRecipeBreakdown').textContent='料理内訳：'+result.recipes.map(r=>r.name+' × '+r.meals+'食').join('／');
  $('prepCoverage').textContent='必要食材 '+format(result.rows.reduce((n,r)=>n+r.required,0))+
   '個／現在の持ち越し予定 '+format(result.initialCount)+
   '個／準備週で新たに集める目標 '+format(result.plannedNew)+
   '個／イベント開始時の計画在庫 '+format(result.eventStartStock)+' / '+format(result.capacity)+
   '個（未充足 '+format(result.uncovered)+'個）。';
  const display=$('prepIngredients');display.replaceChildren();
  const summary=document.createElement('p');summary.className='small muted';
  summary.textContent='食材別：必要総数／既存持ち越し／前半の新規目標／後半の新規目標／イベント開始時の見込数／未充足数';
  display.append(summary);
  for(const row of result.rows){
   const line=document.createElement('div');line.className='step4-ingredient-line';
   const title=document.createElement('strong');title.textContent=row.name;
   const detail=document.createElement('span');
   detail.textContent='必要 '+row.required+'／既存 '+row.carryover+'／前半 +'+
    row.firstHalf+'／後半 +'+row.secondHalf+'／開始時 '+row.target+'／不足 '+row.uncovered;
   line.append(title,detail);display.append(line);
  }
  const early=result.rows.reduce((n,r)=>n+r.firstHalf,0);
  const late=result.rows.reduce((n,r)=>n+r.secondHalf,0);
  $('prepPhases').textContent='月曜7:30～木曜7:30ごろ（最初の3日相当）に新規'+format(early)+
   '個、残る4日相当に新規'+format(late)+'個を目標として配分。進捗区分は便宜的な比率で、収集速度や週境界をシミュレーションした結果ではありません。';
  const names=ids=>ids.map(id=>{
   const p=state.box.find(x=>x.id===id);
   return p?(p.nickname||p.pokemon)+'（'+p.pokemon+'）':'不明';
  }).join('、');
  $('prepTeams').textContent=guide.teams?
   '朝7:30～12:00：'+names(guide.teams.morning)+
   '\n昼12:00～18:00：'+names(guide.teams.noon)+
   '\n夜18:00～0:00：'+names(guide.teams.evening):
   '5匹の編成ガイドを作成できません。';
  const warnings=$('prepWarnings');warnings.replaceChildren();
  for(const text of [...result.warnings,...guide.warnings]){
   const paragraph=document.createElement('p');paragraph.textContent='・'+text;warnings.append(paragraph);
  }
  $('prepResult').hidden=false;$('prepStale').hidden=true;
  toast('備蓄計画を保存しました。計算は参考目標です。');
  return {prep,result,guide};
 }catch(e){error.textContent=e.message||String(e);error.hidden=false;stalePreparation();return null;}
}
function forecastPreparation(){
 const prepared=calculatePreparation();
 if(!prepared)return;
 const token=++prepForecastToken;
 const status=$('prepForecastStatus'),button=$('prepForecast');
 button.disabled=true;status.textContent='既存の7日間計算器で参考獲得量を試算中…';
 setTimeout(()=>{
  try{
   if(token!==prepForecastToken)return;
   const forecast=PokeStep4.forecast({
    box:state.box,sleepIds:state.sleepIds,teams:prepared.guide.teams,
    plan:prepared.result,weeklyOptions:state.simulation,
    field:prepared.prep.field,fieldBonus:prepared.prep.fieldBonus,
    camp:state.event.campPrep,
    cookingMode:prepared.prep.forecastCooking,
    foodMode:prepared.prep.forecastFoodMode,
    inventorySource:prepared.prep.forecastInventorySource
   },PokeSimulator.simulate);
   if(token!==prepForecastToken)return;
   const one=n=>n.toLocaleString('ja-JP',{maximumFractionDigits:1,minimumFractionDigits:1});
   $('prepForecastSummary').textContent='準備週 '+forecast.field+'（FB '+forecast.fieldBonus+'%、いいキャンプ'+
    (forecast.camp?'ON':'OFF')+'）／'+
    (forecast.cookingMode==='none'?'料理なし':'料理あり')+
    '／新規備蓄目標 '+forecast.targetNew+
    '個／対象食材の獲得期待値 '+one(forecast.expectedNew)+
    '個／週末バッグ合計期待値 '+one(forecast.expectedBagEnd)+'個'+
    (forecast.cookingMode==='saved'&&forecast.weeklyEnergy!==null?
     '／週間エナジー参考値 '+Math.round(forecast.weeklyEnergy).toLocaleString('ja-JP')+
      '（料理 '+Math.round(forecast.cookingEnergy||0).toLocaleString('ja-JP')+'）':'')+'。';
   const items=$('prepForecastIngredients');items.replaceChildren();
   for(const r of forecast.rows){
    const line=document.createElement('div');line.className='step4-ingredient-line';
    const name=document.createElement('strong');name.textContent=r.name;
    const detail=document.createElement('span');
    detail.textContent='イベント開始目標 '+r.targetFinal+'／獲得期待 '+one(r.expectedNew)+
     '／週末在庫期待 '+one(r.expectedFinal)+'／期待値上の不足 '+one(r.expectedShortfall);
    line.append(name,detail);items.append(line);
   }
   const warnings=$('prepForecastWarnings');warnings.replaceChildren();
   for(const message of [...forecast.assumptions,...forecast.modelWarnings]){
    const line=document.createElement('p');line.textContent='・'+message;warnings.append(line);
   }
   $('prepForecastResult').hidden=false;
   status.textContent='参考試算が完了しました。整数個数・料理成立率・目標達成確率の保証ではありません。';
  }catch(e){
   if(token===prepForecastToken)status.textContent='参考試算できませんでした：'+(e.message||String(e));
  }finally{if(token===prepForecastToken)button.disabled=false;}
 },0);
}
function comparePreparation(){
 const prepared=calculatePreparation();
 if(!prepared)return;
 const token=++prepForecastToken;
 const status=$('prepCompareStatus'),button=$('prepCompare');
 button.disabled=true;status.textContent='同じ準備週条件で2つの参考編成を試算中…';
 setTimeout(()=>{
  try{
   if(token!==prepForecastToken)return;
   const comparison=PokeStep4.compareModes({
    planInput:{...prepared.prep,potSize:state.simulation.potSize,
     foodMode:state.event.food1,eventEffects:state.event.effects},
    box:state.box,sleepIds:state.sleepIds,dayTeams:state.simulation.teams,
    weeklyOptions:state.simulation,field:prepared.prep.field,
    fieldBonus:prepared.prep.fieldBonus,camp:state.event.campPrep,
    cookingMode:prepared.prep.forecastCooking,
    foodMode:prepared.prep.forecastFoodMode,
    inventorySource:prepared.prep.forecastInventorySource
   },PokeSimulator.simulate);
   if(token!==prepForecastToken)return;
   const one=n=>n.toLocaleString('ja-JP',{maximumFractionDigits:1,minimumFractionDigits:1});
   const display=$('prepCompareRows');display.replaceChildren();
   for(const [priority,label] of [['energy','今週のエナジー優先'],['stock','イベント備蓄優先']]){
    const scenario=comparison.scenarios[priority];
    const line=document.createElement('div');line.className='step4-ingredient-line';
    const title=document.createElement('strong');title.textContent=label;
    const detail=document.createElement('span');
    detail.textContent='新規備蓄の配分目標 '+scenario.plannedNew+'個／'+
     '料理必要総数に対する週末不足の期待値 '+one(scenario.expectedRequiredShortfall)+'個／'+
     '週末バッグ期待値 '+one(scenario.forecast.expectedBagEnd)+'個／'+
     '準備週エナジー参考値 '+(scenario.forecast.weeklyEnergy===null?'計算不可':
      Math.round(scenario.forecast.weeklyEnergy).toLocaleString('ja-JP'));
    line.append(title,detail);display.append(line);
   }
   const warnings=$('prepCompareWarnings');warnings.replaceChildren();
   for(const message of [comparison.sameTeams?
    '両方の方針で日中の参考編成は同じです。数値が同じでも異常とは限りません。':
    '日中の参考編成は方針により異なります。睡眠5匹とイベント週の編成は変更していません。',
    ...comparison.assumptions,...comparison.scenarios.energy.forecast.assumptions,
    ...comparison.scenarios.energy.forecast.modelWarnings,
    ...comparison.scenarios.stock.forecast.modelWarnings]){
    const line=document.createElement('p');line.textContent='・'+message;warnings.append(line);
   }
   $('prepCompareResult').hidden=false;
   status.textContent='2方針の参考比較が完了しました。最適順位や実ゲーム精度の判定ではありません。';
  }catch(e){
   if(token===prepForecastToken)status.textContent='2方針の比較ができませんでした：'+(e.message||String(e));
  }finally{if(token===prepForecastToken)button.disabled=false;}
 },0);
}
for(const id of ['prepRecipe','prepMeals','prepCapacity','prepPriority'])
 $(id).addEventListener('change',stalePreparation);
for(const id of ['prepField','prepFieldBonus','prepForecastCooking','prepForecastFoodMode','prepForecastStockSource'])
 $(id).addEventListener('change',stalePreparation);
$('prepAddRecipe').addEventListener('click',()=>{appendPrepRecipeEditor();stalePreparation();});
$('prepCarryFields').addEventListener('change',stalePreparation);
for(const id of ['eventStart','eventMap','food1','eventEffects','campPrep'])
 $(id).addEventListener('change',stalePreparation);
$('prepCalculate').addEventListener('click',calculatePreparation);
$('prepForecast').addEventListener('click',forecastPreparation);
$('prepCompare').addEventListener('click',comparePreparation);

fillEvent();renderBox();fillSimulation();fillPreparation();setTab('event');
})();

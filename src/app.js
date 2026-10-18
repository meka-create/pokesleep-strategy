(function(){
'use strict';
const $=id=>document.getElementById(id);
const storage=window.PokeStorage;
let state=storage.load();
// Each exported observation belongs to the *successful run*, never to subsequently edited settings.
let lastRunSnapshot=null;
const save=()=>{try{storage.save(state);$('storageNotice').textContent='このブラウザ内への保存：利用可能';$('storageNotice').className='small ok';$('criticalNotice').hidden=true;return true;}catch(e){
$('storageNotice').textContent=storage.getLoadError()||'保存に失敗しました。現在の変更は未保存です。設定・保存からJSONバックアップを取得してください。';$('storageNotice').className='small warn';$('criticalNotice').textContent=$('storageNotice').textContent;$('criticalNotice').hidden=false;return false;}};
const notifySave=(success,ok)=>toast(success?(ok||'保存しました。'):'保存に失敗しました。設定・保存からJSONバックアップを取得してください。');
const enc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,3500);}
function setTab(tab){for(const btn of document.querySelectorAll('.tab')){const active=btn.dataset.tab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false');}for(const p of document.querySelectorAll('.panel'))p.hidden=p.id!==`panel-${tab}`;}
function fillEvent(){let e=state.event;const map={eventName:'name',eventStart:'start',eventDuration:'duration',eventMap:'map',eventBerries:'berries',eventEffects:'effects',food1:'food1',food2:'food2'};for(const [id,k] of Object.entries(map))$(id).value=e[k]??'';for(const id of ['campPrep','camp1','camp2'])$(id).checked=!!e[id];showDuration();}
function showDuration(){const two=$('eventDuration').value==='2';$('food2Row').hidden=!two;$('camp2Row').hidden=!two;}
function readEvent(){const e={name:$('eventName').value.trim(),start:$('eventStart').value,duration:Number($('eventDuration').value),map:$('eventMap').value.trim(),berries:$('eventBerries').value.trim(),effects:$('eventEffects').value.trim(),food1:$('food1').value,food2:$('food2').value};for(const id of ['campPrep','camp1','camp2'])e[id]=$(id).checked;return e;}
function status(){let name=state.event.name||'イベント未設定';$('dataState').textContent=`${state.box.length}匹登録 / 睡眠パーティ ${state.sleepIds.length}/5匹 / ${name}`;$('boxTotal').textContent=`${state.box.length}匹`;$('boxCountTab').textContent=state.box.length;}
function renderSleep(){const ids=state.sleepIds;const selected=ids.map(id=>state.box.find(p=>p.id===id)).filter(Boolean);$('sleepCount').textContent=`${selected.length} / 5`;
 $('sleepList').innerHTML=selected.length?selected.map((p,i)=>`<div class="sleep-item"><span class="sleep-index">${i+1}</span><span class="sleep-title">${enc(p.nickname||p.pokemon)}<small>${enc(p.pokemon)} · Lv${p.level}</small></span><button data-remove="${enc(p.id)}" class="remove" aria-label="${enc(p.pokemon)}を外す">外す</button></div>`).join(''):'<div class="empty-mini">まだ選択されていません。下の一覧から5匹選んでください。</div>';
 for(const btn of $('sleepList').querySelectorAll('[data-remove]'))btn.addEventListener('click',()=>{state.sleepIds=state.sleepIds.filter(id=>id!==btn.dataset.remove);notifySave(save(),'睡眠パーティを変更しました。');renderBox();renderSimulator();});}
function renderBox(){status();renderSleep();let q=$('searchPokemon').value.toLocaleLowerCase('ja');const found=state.box.filter(p=>[p.nickname,p.pokemon].some(s=>(s||'').toLocaleLowerCase('ja').includes(q)));const view=found.slice(0,120);
 $('pokemonList').innerHTML=view.length?view.map(p=>{const selected=state.sleepIds.includes(p.id);return `<div class="pokemon-row"><div class="pokemon-symbol">${enc((p.pokemon||'?').slice(0,1))}</div><div class="pokemon-info"><b>${enc(p.nickname||p.pokemon)}</b><div>${enc(p.pokemon)} · Lv${p.level} · スキルLv${p.skillLevel}</div><div class="pokemon-details">${enc(p.nature||'せいかく未設定')} / ${enc(p.ingredients.filter(Boolean).join('・')||'食材未設定')}</div></div><button class="pick ${selected?'selected':''}" data-add="${enc(p.id)}" ${!selected&&state.sleepIds.length>=5?'disabled':''}>${selected?'選択中':'睡眠用に追加'}</button></div>`;}).join(''):'<div class="card empty">'+(state.box.length?'該当するポケモンがありません。':'CSVを読み込むとここに一覧が表示されます。')+'</div>';
 $('boxMore').hidden=found.length<=120;$('boxMore').textContent=found.length>120?`検索結果 ${found.length}匹のうち、先頭120匹を表示しています。検索して絞り込んでください。`:'';
 for(const btn of $('pokemonList').querySelectorAll('[data-add]'))btn.addEventListener('click',()=>{let id=btn.dataset.add;if(state.sleepIds.includes(id)){state.sleepIds=state.sleepIds.filter(x=>x!==id);}else if(state.sleepIds.length<5)state.sleepIds.push(id);notifySave(save(),'睡眠パーティを変更しました。');renderBox();});}
function download(filename,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('eventDuration').addEventListener('change',showDuration);
$('saveEvent').addEventListener('click',()=>{state.event=readEvent();state.updatedAt=new Date().toISOString();const saved=save();status();notifySave(saved,'イベント条件を保存しました。');});
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
 state.box=result.items;state.sleepIds=kept;state.simulation.teams=simTeams;state.updatedAt=new Date().toISOString();const saved=save();renderBox();fillSimulation();lastRunSnapshot=null;$('simResult').hidden=true;notifySave(saved,`${result.items.length}匹を読み込みました。睡眠パーティは${kept.length}匹を引き継ぎました。`);
 }catch(e){$('importError').textContent=e.message||String(e);$('importError').hidden=false;}finally{ev.target.value='';}});
$('downloadBackup').addEventListener('click',()=>{download(`pokesleep_event_backup_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');toast('バックアップを保存しました。');});
$('backupFile').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('ファイルが大きすぎます。');const data=storage.validateState(JSON.parse(await file.text()));if(!confirm(`バックアップを復元し、現在の${state.box.length}匹と設定を置き換えますか？`))return;state=data;storage.allowRecovery();const saved=save();fillEvent();renderBox();fillSimulation();lastRunSnapshot=null;$('simResult').hidden=true;notifySave(saved,'バックアップを復元しました。');}catch(e){alert('復元できませんでした：'+e.message);}finally{ev.target.value='';}});
$('clearData').addEventListener('click',()=>{if(!confirm('ボックス・睡眠パーティ・イベント条件をすべて削除します。実行しますか？'))return;state=storage.newState();storage.allowRecovery();const saved=save();fillEvent();$('searchPokemon').value='';renderBox();fillSimulation();lastRunSnapshot=null;$('simResult').hidden=true;notifySave(saved,'端末内の保存情報を消去しました。');});
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
        select.value=previous[i]||'';
        toast('同じ時間帯に同一個体を2匹指定できません。');
        return;
      }
      state.simulation.teams[key]=values;
      notifySave(save(),'試算用パーティを保存しました。');
      updateRosterStatus();
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
function readSimulation(){
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
 const teams={};for(const key of rosterKeys){
  const values=Array.from(document.querySelector('[data-roster="'+key+'"]').querySelectorAll('select')).map(x=>x.value);
  if(values.length!==5||values.some(v=>!v)||new Set(values).size!==5)throw Error('朝・昼・夜のすべての枠に異なる5匹を指定してください。');
  teams[key]=values;
 }
 if(state.sleepIds.length!==5)throw Error('ボックスタブで睡眠パーティ5匹を指定してください。');
 return {teams,fieldBonus:data.simFieldBonus,tapMinutes:data.simTap,potSize:data.simPot,bagCapacity:data.simBagCapacity,sleepScore:data.simSleepScore,initialEnergy:data.simInitialEnergy,recipeId:$('simRecipe').value,recipeMode:$('simRecipeMode').value,extraMode:$('simExtraMode').value,successMode:$('simSuccessMode').value,initialIngredients,magnetIngredients};
}
$('fillAllRosters').addEventListener('click',()=>{
 if(state.sleepIds.length!==5){toast('先にボックスタブで睡眠用5匹を選択してください。');setTab('box');return;}
 for(const key of rosterKeys)state.simulation.teams[key]=[...state.sleepIds];
 const saved=save();renderSimulator();notifySave(saved,'睡眠パーティを朝・昼・夜に一括設定しました。');
});
for(const btn of document.querySelectorAll('.sim-copy'))btn.addEventListener('click',()=>{
 const from=btn.dataset.copyFrom,to=btn.dataset.copyTo;
 const ids=from==='sleep'?state.sleepIds:state.simulation.teams[from];
 if(ids.length!==5||ids.some(id=>!id)){toast('コピー元の5匹が揃っていません。');return;}
 state.simulation.teams[to]=[...ids];notifySave(save(),'5匹の編成をコピーしました。');renderSimulator();
});
$('runSim').addEventListener('click',()=>{
 $('simError').hidden=true;
 try{
  const sim=readSimulation();state.simulation=sim;
  const saved=save();if(!saved)throw Error('設定を保存できません。バックアップを取得してから再試行してください。');
  const runInput={box:state.box,teams:{...sim.teams,sleep:state.sleepIds},options:{...sim,map:state.event.map,camp:state.event.camp1,foodMode:state.event.food1,eventEffects:state.event.effects}};
  const result=PokeSimulator.simulate(runInput);
  const version=document.querySelector('.step-mark')?.textContent.match(/v(\d+\.\d+\.\d+)/)?.[1];
  lastRunSnapshot=PokeObservation.captureSimulation(runInput,result,version,new Date().toISOString());
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
  for(const id of ['obsMonday','obsTotal','obsBerry','obsCooking','obsScreenshot'])$(id).value='';
  for(const id of ['obsNoUnmodeledEvents','obsSameCollectionSchedule','obsNoUntrackedItems','obsStartStrengthVerified','obsWeekBoundaryReconciled','obsConfirmedSummary'])$(id).checked=false;
  $('obsError').hidden=true;
  $('obsResult').textContent='この試算時点の設定を記録用に保持しました。観測数値・確認項目は未入力です。';
  $('simResult').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){lastRunSnapshot=null;$('simResult').hidden=true;$('simError').textContent=e.message||String(e);$('simError').hidden=false;}
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
  const report=PokeObservation.makeReport(lastRunSnapshot,form);
  const compared=PokeObservation.preview(report);
  const difference=n=>(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP');
  const note='実測−試算：総'+difference(compared.signedDeltaObservedMinusModel.total)+
   '／きのみ＋直接スキル'+difference(compared.signedDeltaObservedMinusModel.berryAndStrengthSkill)+
   '／料理'+difference(compared.signedDeltaObservedMinusModel.cooking)+
   '。単週観測のため精度・編成順位は未検証（STEP2 HOLD）。';
  const concerns=[
   ...(!compared.weeklySummaryBucketsReconcile?['ゲーム週まとめの総エナジーと2欄の合計が一致しません。']:[]),
   ...(compared.unconfirmedConditions.length?['確認できていない条件が'+compared.unconfirmedConditions.length+'項目あります。']:[])
  ];
  $('obsResult').textContent=note+(concerns.length?' 要確認：'+concerns.join(' '):'');
  download('pokesleep_weekly_observation_'+report.week.mondayDate+'.json',
   JSON.stringify(report,null,2),'application/json;charset=utf-8');
 }catch(e){$('obsError').textContent=e.message||String(e);$('obsError').hidden=false;}
});


$('storageNotice').textContent=storage.getLoadError()|| (storage.available()?'このブラウザ内への保存：利用可能':'この環境は保存が制限されています。必ずJSONバックアップをご利用ください。');
if(storage.getLoadError()){$('storageNotice').className='small warn';$('criticalNotice').textContent=storage.getLoadError();$('criticalNotice').hidden=false;}
fillEvent();renderBox();fillSimulation();setTab('event');
})();

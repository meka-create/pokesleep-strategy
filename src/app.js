(function(){
'use strict';
const $=id=>document.getElementById(id);
const storage=window.PokeStorage;
let state=storage.load();
const save=()=>{try{storage.save(state);$('storageNotice').textContent='このブラウザ内への保存：利用可能';$('storageNotice').className='small ok';$('criticalNotice').hidden=true;return true;}catch(e){$('storageNotice').textContent=storage.getLoadError()||'保存に失敗しました。現在の変更は未保存です。設定・保存からJSONバックアップを取得してください。';$('storageNotice').className='small warn';$('criticalNotice').textContent=$('storageNotice').textContent;$('criticalNotice').hidden=false;return false;}};
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
 for(const btn of $('sleepList').querySelectorAll('[data-remove]'))btn.addEventListener('click',()=>{state.sleepIds=state.sleepIds.filter(id=>id!==btn.dataset.remove);notifySave(save(),'睡眠パーティを変更しました。');renderBox();});}
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
 state.box=result.items;state.sleepIds=kept;state.updatedAt=new Date().toISOString();const saved=save();renderBox();notifySave(saved,`${result.items.length}匹を読み込みました。睡眠パーティは${kept.length}匹を引き継ぎました。`);
 }catch(e){$('importError').textContent=e.message||String(e);$('importError').hidden=false;}finally{ev.target.value='';}});
$('downloadBackup').addEventListener('click',()=>{download(`pokesleep_event_backup_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');toast('バックアップを保存しました。');});
$('backupFile').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('ファイルが大きすぎます。');const data=storage.validateState(JSON.parse(await file.text()));if(!confirm(`バックアップを復元し、現在の${state.box.length}匹と設定を置き換えますか？`))return;state=data;storage.allowRecovery();const saved=save();fillEvent();renderBox();notifySave(saved,'バックアップを復元しました。');}catch(e){alert('復元できませんでした：'+e.message);}finally{ev.target.value='';}});
$('clearData').addEventListener('click',()=>{if(!confirm('ボックス・睡眠パーティ・イベント条件をすべて削除します。実行しますか？'))return;state=storage.newState();storage.allowRecovery();const saved=save();fillEvent();$('searchPokemon').value='';renderBox();notifySave(saved,'端末内の保存情報を消去しました。');});
$('storageNotice').textContent=storage.getLoadError()|| (storage.available()?'このブラウザ内への保存：利用可能':'この環境は保存が制限されています。必ずJSONバックアップをご利用ください。');
if(storage.getLoadError()){$('storageNotice').className='small warn';$('criticalNotice').textContent=storage.getLoadError();$('criticalNotice').hidden=false;}
fillEvent();renderBox();setTab('event');
})();

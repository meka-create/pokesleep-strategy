/* E7 v56 app-wide settings: fail-closed player data + localStorage backup/restore.
 * All data stays on this browser unless explicitly downloaded by the user.
 */
(()=>{
'use strict';
const PREFIX='pokesleep-strategy-';
const PLAYER=PREFIX+'e7-player-v1';
const BOX=PREFIX+'e7-box-v1';
const SELECTED=PREFIX+'u3-e3-v1:selected';
const MAGIC='pokesleep-strategy-backup';
const MAX_BYTES=8_000_000;
const MAX_RECORDS=20000;
const FIELDS=['ワカクサ本島','シアンの砂浜','トープ洞窟','ウノハナ雪原','ラピスラズリ湖畔',
 'ゴールド旧発電所','アンバー渓谷','ワカクサ本島EX','シアンの砂浜EX'];
const $=id=>document.getElementById(id);
function emptyPlayer(){return {version:1,pot:null,bag:null,
 bonuses:Object.fromEntries(FIELDS.map(f=>[f,null]))};}
function validPlayer(v){
 return !!v&&v.version===1&&Object.keys(v.bonuses||{}).length===FIELDS.length&&
  FIELDS.every(f=>Object.hasOwn(v.bonuses,f)&&
   (v.bonuses[f]===null||(Number.isInteger(v.bonuses[f])&&v.bonuses[f]>=0&&
   v.bonuses[f]<=100&&v.bonuses[f]%5===0)))&&
  ['pot','bag'].every(k=>v[k]===null||(Number.isInteger(v[k])&&v[k]>0&&v[k]<=5000));
}
// Match the E7 Box validator. A malformed imported Box must never silently
// overwrite the player's collection via backup restore.
const boxKeys=['nickname','pokemon','level','skillLevel','ing1','ing2','ing3','mainSkill',
 'nature','mint','lv10','lv25','lv50','lv70','lv80','ribbon','shiny','favorite'];
const optionalText=['nickname','ing1','ing2','ing3','mainSkill','lv10','lv25','lv50','lv70','lv80','favorite'];
function validBox(v){
 return !!v&&v.version===1&&Array.isArray(v.items)&&v.items.length<=10000&&
 v.items.every(item=>item&&
  boxKeys.every(k=>Object.hasOwn(item,k))&&
  typeof item.pokemon==='string'&&item.pokemon.trim().length>0&&item.pokemon.length<=160&&
  Number.isInteger(item.level)&&item.level>0&&item.level<=150&&
  Number.isInteger(item.skillLevel)&&item.skillLevel>=1&&item.skillLevel<=8&&
  typeof item.nature==='string'&&item.nature.trim().length>0&&item.nature.length<=80&&
  optionalText.every(k=>item[k]===null||(typeof item[k]==='string'&&
   item[k].length<=(k==='nickname'?160:250)))&&
  (item.mint===null||typeof item.mint==='boolean')&&
  (item.shiny===null||typeof item.shiny==='boolean')&&
  (item.ribbon===null||(Number.isSafeInteger(item.ribbon)&&item.ribbon>=0&&item.ribbon<=100000)));
}
function validSelected(v){
 if(!v||typeof v.id!=='string'||v.id.length<1||v.id.length>160||
  typeof v.weekStart!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(v.weekStart))return false;
 const d=new Date(v.weekStart+'T12:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===v.weekStart&&d.getUTCDay()===1;
}
function readPlayer(){
 const raw=localStorage.getItem(PLAYER);
 if(raw===null)return emptyPlayer();
 const value=JSON.parse(raw);
 if(!validPlayer(value))throw Error('プレイヤー情報の保存内容が不正です。');
 return value;
}
function readStore(){
 const arr=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  if(key&&key.startsWith(PREFIX))arr.push({key,value:localStorage.getItem(key)});
 }
 arr.sort((a,b)=>a.key.localeCompare(b.key));
 return arr;
}
function safeKey(key){
 return typeof key==='string'&&key.startsWith(PREFIX)&&key.length<=600&&
  !/[\u0000-\u001f\u007f]/.test(key);
}
function validateRecords(records,strictKnown=true){
 if(!Array.isArray(records)||records.length>MAX_RECORDS)throw Error('保存件数が上限を超えています。');
 const seen=new Set();
 let size=0;
 for(const r of records){
  if(!r||!safeKey(r.key)||typeof r.value!=='string'||seen.has(r.key))
   throw Error('バックアップのキーまたは形式が不正です。');
  seen.add(r.key);
  size+=r.key.length+r.value.length;
  if(size>MAX_BYTES)throw Error('バックアップが大きすぎます。');
  if(strictKnown&&(r.key===PLAYER||r.key===BOX||r.key===SELECTED)){
   let value;
   try{value=JSON.parse(r.value)}catch{throw Error('重要な保存データがJSONではありません。');}
   if((r.key===PLAYER&&!validPlayer(value))||(r.key===BOX&&!validBox(value))||
    (r.key===SELECTED&&!validSelected(value)))
    throw Error('プレイヤー情報・ボックス・イベント選択の内容が不正です。');
  }
 }
 return records;
}
function parseBackup(text){
 let value;
 try{value=JSON.parse(text)}catch{throw Error('JSONファイルを読み取れません。');}
 if(!value||value.format!==MAGIC||value.version!==1||
  typeof value.exportedAt!=='string'||!Number.isFinite(Date.parse(value.exportedAt)))
  throw Error('ポケスリ作戦室のバックアップ形式ではありません。');
 validateRecords(value.records);
 return value;
}
function setStatus(id,message,error=false){
 const node=$(id);node.textContent=message;node.dataset.error=String(error);
}
function numberInput(input,min,max,step=1){
 const raw=input.value.trim();
 const good=raw===''||(/^\d+$/.test(raw)&&Number(raw)>=min&&Number(raw)<=max&&Number(raw)%step===0);
 input.setAttribute('aria-invalid',String(!good));
 return good?(raw===''?null:Number(raw)):undefined;
}
function build(){
 const dialog=document.createElement('dialog');
 dialog.id='e7-settings-dialog';
 dialog.setAttribute('aria-labelledby','e7-settings-title');
 dialog.innerHTML=[
  '<div class="settings-top"><h2 id="e7-settings-title">設定</h2>',
  '<button type="button" id="e7-settings-close" class="settings-close" aria-label="閉じる">×</button></div>',
  '<div class="settings-content">',
  '<details id="e7-player-settings"><summary>プレイヤー情報</summary><div class="settings-panel">',
  '<div class="settings-grid">',
  '<label>通常の鍋容量<input id="e7-settings-pot" inputmode="numeric" autocomplete="off" placeholder="未入力"></label>',
  '<label>食材バッグ容量<input id="e7-settings-bag" inputmode="numeric" autocomplete="off" placeholder="未入力"></label>',
  '</div><p class="settings-subtitle">フィールドボーナス</p>',
  '<div id="e7-settings-bonuses" class="settings-grid"></div>',
  '<div class="settings-actions"><button type="button" id="e7-settings-player-save" class="settings-btn">保存</button></div>',
  '<p id="e7-player-status" class="settings-status" role="status" aria-live="polite"></p>',
  '</div></details>',
  '<details id="e7-backup-settings"><summary>バックアップ・復元</summary><div class="settings-panel">',
  '<p class="settings-muted">作戦・在庫・ボックス・プレイヤー情報など、この端末に保存された作戦室データをまとめて保存します。</p>',
  '<div class="settings-actions"><button type="button" id="e7-settings-export" class="settings-btn alt">保存データを書き出す</button></div>',
  '<label>バックアップを読み込む<input id="e7-settings-import-file" type="file" accept=".json,application/json"></label>',
  '<p id="e7-settings-import-summary" class="settings-muted"></p>',
  '<div class="settings-actions"><button type="button" id="e7-settings-restore" class="settings-btn" disabled>バックアップから復元</button></div>',
  '<p class="settings-muted">復元すると現在の作戦室データがバックアップの内容に置き換わります。先に書き出しておくことをおすすめします。ボックスのCSV登録とは別の機能です。</p>',
  '<p id="e7-backup-status" class="settings-status" role="status" aria-live="polite"></p>',
  '</div></details></div>'
 ].join('');
 document.body.append(dialog);
 for(const [i,field] of FIELDS.entries()){
  const label=document.createElement('label');
  label.textContent=field;
  const input=document.createElement('input');
  input.id='e7-settings-bonus-'+i;
  input.dataset.field=field;
  input.inputMode='numeric';
  input.autocomplete='off';
  input.placeholder='未入力';
  label.append(input);
  $('e7-settings-bonuses').append(label);
 }
 const bonusInputs=Array.from($('e7-settings-bonuses').querySelectorAll('input'));
 let pending=null;
 function refresh(){
  const save=$('e7-settings-player-save');
  try{
   const player=readPlayer();
   $('e7-settings-pot').value=player.pot??'';
   $('e7-settings-bag').value=player.bag??'';
   for(const input of bonusInputs)input.value=player.bonuses[input.dataset.field]??'';
   save.disabled=false;
   setStatus('e7-player-status','');
  }catch(e){
   save.disabled=true;
   setStatus('e7-player-status','保存済みプレイヤー情報を検証できません。上書きはできません。バックアップを確認してください。',true);
  }
  pending=null;$('e7-settings-import-file').value='';
  $('e7-settings-import-summary').textContent='';
  $('e7-settings-restore').disabled=true;
  setStatus('e7-backup-status','');
 }
 function open(){
  if(dialog.open)return;
  refresh();
  dialog.showModal();
 }
 function close(){dialog.close();}
 $('e7-settings-close').addEventListener('click',close);
 dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
 $('e7-settings-player-save').addEventListener('click',()=>{
  const next=emptyPlayer();
  next.pot=numberInput($('e7-settings-pot'),1,5000);
  next.bag=numberInput($('e7-settings-bag'),1,5000);
  for(const input of bonusInputs)next.bonuses[input.dataset.field]=numberInput(input,0,100,5);
  if(!validPlayer(next)){
   setStatus('e7-player-status','数値を確認してください。フィールドボーナスは5%刻みです。',true);return;
  }
  try{
   readPlayer(); // fail closed on corrupted data
   localStorage.setItem(PLAYER,JSON.stringify(next));
   setStatus('e7-player-status','プレイヤー情報を保存しました。');
   window.dispatchEvent(new Event('e7-player-saved'));
  }catch{
   setStatus('e7-player-status','保存できませんでした。以前のデータを保持しています。',true);
  }
 });
 $('e7-settings-export').addEventListener('click',()=>{
  try{
   const records=validateRecords(readStore(),false); // Export raw records even when recovery is needed.
   const backup={format:MAGIC,version:1,exportedAt:new Date().toISOString(),records};
   const text=JSON.stringify(backup,null,2);
   if(text.length>MAX_BYTES+MAX_RECORDS*70)throw Error('保存内容が大きすぎます。');
   const blob=new Blob([text],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a'),now=new Date();
   const stamp=now.getFullYear().toString()+String(now.getMonth()+1).padStart(2,'0')+
     String(now.getDate()).padStart(2,'0')+'-'+
     String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');
   a.download='pokesleep-strategy-backup-'+stamp+'.json';
   a.href=url;document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setStatus('e7-backup-status',records.length+'件を書き出しました。');
  }catch(e){
   setStatus('e7-backup-status','書き出しできませんでした：'+(e.message||'保存領域を確認してください。'),true);
  }
 });
 $('e7-settings-import-file').addEventListener('change',async event=>{
  pending=null;$('e7-settings-restore').disabled=true;
  $('e7-settings-import-summary').textContent='';
  setStatus('e7-backup-status','');
  const file=event.target.files?.[0];
  if(!file)return;
  try{
   if(file.size>MAX_BYTES+MAX_RECORDS*70)throw Error('ファイルが大きすぎます。');
   const parsed=parseBackup(await file.text());
   pending=parsed;
   $('e7-settings-import-summary').textContent=
    parsed.records.length+'件の保存データ ／ 書き出し日時：'+
    new Date(parsed.exportedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
   $('e7-settings-restore').disabled=false;
  }catch(e){
   setStatus('e7-backup-status','読み込みできません：'+(e.message||'形式を確認してください。'),true);
  }
 });
 $('e7-settings-restore').addEventListener('click',()=>{
  if(!pending)return;
  let before;
  try{
   // Revalidate immediately before mutation; do not trust stale file input.
   validateRecords(pending.records);
   before=readStore();
   validateRecords(before,false); // Allow recovery over a damaged current record.
  }catch(e){
   setStatus('e7-backup-status','復元できません：'+(e.message||'保存領域を確認してください。'),true);return;
  }
  const msg='現在の作戦室データ '+before.length+'件を、選択したバックアップ '+
    pending.records.length+'件に置き換えます。\n未保存の入力も失われます。復元しますか？';
  if(!window.confirm(msg))return;
  const same=(actual,expected)=>actual.length===expected.length&&
   actual.every((r,i)=>r.key===expected[i].key&&r.value===expected[i].value);
  const put=(records)=>{
   for(const rec of readStore())localStorage.removeItem(rec.key);
   for(const rec of records)localStorage.setItem(rec.key,rec.value);
   if(!same(readStore(),records))throw Error('書き込み内容が一致しません。');
  };
  try{
   put(pending.records);
  }catch(e){
   try{put(before);setStatus('e7-backup-status','復元に失敗したため、元のデータに戻しました。',true);}
   catch{setStatus('e7-backup-status','復元と元データの回復に失敗しました。保存領域を確認してください。',true);}
   return;
  }
  // Beforeunload of old Strategy frames must never re-save pre-restore data.
  for(const id of ['view-plan','view-prep']){
   try{const win=$(id)?.contentWindow;if(win&&win.location.origin===location.origin)
    win.__pokesleepE7ResetRevoked=true;
   }catch{}
  }
  window.alert('バックアップから復元しました。画面を再読み込みします。');
  location.reload();
 });
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.protocol!=='pokesleep-e7-v51'||
   event.data.action!=='open-settings')return;
  if(!['view-plan','view-prep','view-box'].some(id=>$(id)?.contentWindow===event.source))return;
  open();
 });
 window.E7Settings=Object.freeze({open,parseBackup,validateRecords,readStore});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});
else build();
})();

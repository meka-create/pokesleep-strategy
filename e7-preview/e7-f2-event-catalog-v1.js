/* F2: verified upstream weekly events and Japanese names; independent of event/user storage.
 * Raw sources are always fetched at the SAME pinned commit. A failing/partial
 * refresh never replaces the last validated full catalog. No saved event edits. */
(function(root){
'use strict';
const KEY='pokesleep-strategy-e7-f2-catalog-v1';
const REPO='nitoyon/pokesleep-tool';
const API='https://api.github.com/repos/'+REPO+'/commits/main';
const RAW='https://raw.githubusercontent.com/'+REPO+'/';
const DATA='src/data/event.json', LANG='src/i18n/ja/events.json';
const STAMP=/^\d{4}-\d{2}-\d{2}T04:00:00$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const HEX=/^[a-f0-9]{40}$/;
const DAY_MS=86400000;
const TYPES=new Set(['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']);
const MULTIPLIERS=new Set(['dish','potSize','skillTrigger','dreamShard','skillIngredient','ingredientMagnet','ingredientDraw','berryBurst','carryLimitMul']);
const ADDITIONS=new Set(['skillLevel','ingredient','berry','energyFromDish','carryLimitAdd','globalCarryLimitAdd']);
const SUPPORTED=new Set([...MULTIPLIERS,...ADDITIONS,'fixedBerries','fixedAreas','extraIng','bigBerry']);
function plain(x){if(x===null||typeof x!=='object'||Array.isArray(x))return false;const p=Object.getPrototypeOf(x);return p===null||Object.getPrototypeOf(p)===null;}
function dateMs(x){
 if(typeof x!=='string'||!DAY.test(x))return NaN;
 const n=Date.parse(x+'T12:00:00Z');
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===x?n:NaN;
}
function validWeek(x){const n=dateMs(x);return Number.isFinite(n)&&new Date(n).getUTCDay()===1;}
function validWeekly(x){
 if(!plain(x)||typeof x.name!=='string'||!x.name.trim()||x.name.length>100||
  typeof x.start!=='string'||typeof x.end!=='string'||
  !STAMP.test(x.start)||!STAMP.test(x.end)||
  !validWeek(x.start.slice(0,10))||
  dateMs(x.end.slice(0,10))-dateMs(x.start.slice(0,10))!==7*DAY_MS||
  !plain(x.target)||!plain(x.effects))return false;
 const target=x.target;
 if(Object.keys(target).some(k=>k!=='type'&&k!=='specialty'))return false;
 if('specialty' in target&&!['Ingredients','Berries','Skills'].includes(target.specialty))return false;
 if('type' in target&&(!Array.isArray(target.type)||!target.type.length||target.type.length>18||
  target.type.some(t=>!TYPES.has(t)||target.type.indexOf(t)!==target.type.lastIndexOf(t))))return false;
 for(const [key,val] of Object.entries(x.effects)){
  if(key.length>60)return false;
  if(MULTIPLIERS.has(key)&&(!Number.isFinite(val)||val<=0||val>20))return false;
  if(ADDITIONS.has(key)&&(!Number.isSafeInteger(val)||val<0||val>1000))return false;
  if(key==='fixedBerries'&&(!Array.isArray(val)||val.length!==3||
   val.some(t=>t!==null&&!TYPES.has(t))||new Set(val.filter(Boolean)).size!==val.filter(Boolean).length))return false;
  if(key==='fixedAreas'&&(!Array.isArray(val)||!val.length||val.length>20||
   val.some(n=>!Number.isInteger(n)||n<0||n>30)))return false;
  if((key==='extraIng'||key==='bigBerry')&&(typeof val!=='string'||!val||val.length>80))return false;
  // New, unfamiliar effects may be displayed as unverified, never calculated.
  if(!SUPPORTED.has(key)){
   if(!/^[a-zA-Z][a-zA-Z0-9]{0,59}$/.test(key)||
    !(['string','number','boolean'].includes(typeof val))||
    (typeof val==='number'&&(!Number.isFinite(val)||Math.abs(val)>10000))||
    (typeof val==='string'&&val.length>100))return false;
  }
 }
 return true;
}
function resolveName(key,dict,seen=new Set()){
 if(!plain(dict)||typeof key!=='string'||key.length>100||seen.has(key))return null;
 const raw=dict[key];
 if(typeof raw!=='string'||!raw.trim()||raw.length>160)return null;
 const next=new Set(seen);next.add(key);
 let bad=false;
 const resolved=raw.replace(/\$t\(events\.([^)]+)\)/g,(_,ref)=>{
  const v=resolveName(ref,dict,next);if(!v){bad=true;return '';}return v;
 });
 return bad||resolved.includes('$t(')||resolved.length>180?null:resolved;
}
function validDrowsy(x){
 return plain(x)&&typeof x.name==='string'&&x.name.length>0&&x.name.length<=80&&
  Number.isFinite(dateMs(x.day))&&Number.isFinite(x.bonus)&&x.bonus>0&&x.bonus<=20;
}
function prepare(data,lang,{revision,checkedAt}={}){
 if(!plain(data)||!Array.isArray(data.bonus)||data.bonus.length>1000||
  !Array.isArray(data.drowsy)||data.drowsy.length>1000||
  !plain(lang)||!plain(lang.events))throw Error('Invalid upstream event schema');
 if(typeof revision!=='string'||revision.length>120)throw Error('Invalid catalog revision');
 const bonus=[],drowsy=[],translations={},seen=new Set(),invalid=[];
 for(const event of data.bonus){
  if(!validWeekly(event)){invalid.push('weekly-shape');continue;}
  const name=resolveName(event.name,lang.events);
  if(!name){invalid.push('missing-translation');continue;}
  const id='pokesleep-tool:'+event.name+':'+event.start.slice(0,10);
  if(id.length>160||seen.has(id)){invalid.push('duplicate-weekly');continue;}
  seen.add(id);
  // JSON-only clones guarantee user input or other objects cannot be smuggled in.
  bonus.push(JSON.parse(JSON.stringify({name:event.name,start:event.start,end:event.end,
   target:event.target,effects:event.effects})));
  translations[event.name]=name;
 }
 for(const x of data.drowsy){
  if(!validDrowsy(x)){invalid.push('daily-shape');continue;}
  const id=x.day+'|'+x.name;
  if(drowsy.some(y=>y.day+'|'+y.name===id)){invalid.push('duplicate-daily');continue;}
  drowsy.push({name:x.name,day:x.day,bonus:x.bonus});
 }
 if(!bonus.length)throw Error('No valid weekly event candidates');
 bonus.sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name));
 drowsy.sort((a,b)=>a.day.localeCompare(b.day));
 return {version:1,revision,checkedAt:typeof checkedAt==='string'?checkedAt:'',
  bonus,drowsy,translations,invalidCount:invalid.length};
}
function readLastKnownGood(storage){
 try{
  const r=JSON.parse(storage.getItem(KEY)||'null');
  if(!plain(r)||r.version!==1||!HEX.test(r.revision)||!Array.isArray(r.bonus)||
   !Array.isArray(r.drowsy)||!plain(r.translations))return null;
  // Even persistent records must pass the current code's contract again.
  const verified=prepare({bonus:r.bonus,drowsy:r.drowsy},
   {events:r.translations},{revision:r.revision,checkedAt:r.checkedAt});
  if(verified.bonus.length!==r.bonus.length||verified.drowsy.length!==r.drowsy.length)return null;
  return verified;
 }catch(e){return null;}
}
function embedded(data,names){
 return prepare({bonus:data,drowsy:[]},{events:names},
  {revision:'verified-bundled-20261107',checkedAt:'2026-11-07'});
}
async function jsonResponse(fetchImpl,url,signal,maxBytes){
 const response=await fetchImpl(url,{signal,cache:'no-store',mode:'cors'});
 if(!response||!response.ok)throw Error('Upstream HTTP '+(response&&response.status));
 const text=await response.text();
 if(typeof text!=='string'||text.length>maxBytes)throw Error('Upstream size limit exceeded');
 return JSON.parse(text);
}
async function refresh({fetchImpl,storage,timeoutMs=6500,nowISO}={}){
 if(typeof fetchImpl!=='function')throw Error('Network fetch required');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const meta=await jsonResponse(fetchImpl,API,controller.signal,150000);
  if(!plain(meta)||!HEX.test(meta.sha))throw Error('No pinned upstream commit');
  const [data,lang]=await Promise.all([
   jsonResponse(fetchImpl,RAW+meta.sha+'/'+DATA,controller.signal,250000),
   jsonResponse(fetchImpl,RAW+meta.sha+'/'+LANG,controller.signal,100000)
  ]);
  const catalog=prepare(data,lang,{revision:meta.sha,
   checkedAt:typeof nowISO==='string'?nowISO:new Date().toISOString()});
  // A partial upstream file must not wipe healthy records from prior refreshes.
  const last=storage?readLastKnownGood(storage):null;
  if(last&&catalog.bonus.length<Math.max(1,Math.floor(last.bonus.length*.65)))
   throw Error('Suspicious upstream shrink');
  if(storage){
   // This namespace contains only public upstream records; never touch E7 saves.
   try{storage.setItem(KEY,JSON.stringify(catalog));}catch(e){}
  }
  return catalog;
 }finally{clearTimeout(timer);}
}
const specialty={Ingredients:'食材とくい',Berries:'きのみとくい',Skills:'スキルとくい'};
const LABELS={
 dish:'料理エナジー',potSize:'鍋容量',skillTrigger:'スキル発生率',
 dreamShard:'ゆめのかけら獲得量',skillIngredient:'食材ゲット系スキル',
 ingredientMagnet:'食材ゲットS',ingredientDraw:'食材セレクトS',
 berryBurst:'きのみバースト',carryLimitMul:'最大所持数'
};
const ADD_LABELS={ingredient:'食材のおてつだい',berry:'きのみのおてつだい',
 skillLevel:'メインスキル Lv',energyFromDish:'料理のげんき回復',
 carryLimitAdd:'対象ポケモンの最大所持数',globalCarryLimitAdd:'全員の最大所持数'};
function candidate(event,catalog){
 if(!validWeekly(event)||!catalog||!catalog.translations[event.name])throw Error('Unverified source candidate');
 const effects=event.effects,notes=[],unknown=[];
 if(event.name==='bountiful banquet week vol1')notes.push('すべての料理カテゴリで調理可能（既知イベント特例）');
 if(event.target.specialty)notes.push('対象：'+specialty[event.target.specialty]);
 if(event.target.type)notes.push('対象タイプ：'+event.target.type.join('・'));
 for(const [key,value] of Object.entries(effects)){
  if(LABELS[key]){
   if(value!==1)notes.push(LABELS[key]+' ×'+value);
  }else if(ADD_LABELS[key]){
   if(value!==0)notes.push(ADD_LABELS[key]+' +'+value);
  }else if(key==='fixedBerries'){
   notes.push('確定きのみ：'+value.map(v=>v||'未確定').join('、'));
  }else if(key==='fixedAreas'){
   // These are SOURCE INDEXES, not validated area identities.
   unknown.push(key);
  }else if(!SUPPORTED.has(key)||key==='extraIng'||key==='bigBerry'){
   unknown.push(key);
  }
 }
 if(unknown.length)notes.push('その他の補正は要確認');
 const start=event.start.slice(0,10),end=event.end.slice(0,10);
 const days=catalog.drowsy.filter(x=>x.day>=start&&x.day<end);
 return {id:'pokesleep-tool:'+event.name+':'+start,sourceKey:event.name,
  name:catalog.translations[event.name],start,end,
  bonus:notes.join('／')||'補正の追加なし',
  unknownEffects:unknown.length>0,foodAll:event.name==='bountiful banquet week vol1',
  changesBerries:Array.isArray(effects.fixedBerries)&&effects.fixedBerries.some(Boolean),
  eligibleFields:null,
  // F3/F4 will interpret these typed provenance fields; not added to F1-D energy.
  verifiedEffects:JSON.parse(JSON.stringify(effects)),
  verifiedTarget:JSON.parse(JSON.stringify(event.target)),
  dailyDrowsy:days.map(x=>({...x})),
  upstreamRevision:catalog.revision,
  upstreamSource:REPO+'/'+DATA,translationSource:REPO+'/'+LANG};
}
root.PokeE7F2Catalog=Object.freeze({KEY,API,DATA,LANG,prepare,embedded,refresh,
 readLastKnownGood,candidate,validWeekly,resolveName});
})(typeof window!=='undefined'?window:globalThis);

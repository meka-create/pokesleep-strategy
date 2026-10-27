(function(root){
'use strict';
const KEY='pokesleep-event-planner/step1/v1';
const defaultSimulation=()=>({teams:{morning:[],noon:[],evening:[]},fieldBonus:0,tapMinutes:150,potSize:57,bagCapacity:0,sleepScore:88,initialEnergy:100,recipeId:'',recipeMode:'fixed',extraMode:'none',successMode:'none',magnetIngredients:[],initialIngredients:{}});
const defaultWeeklyPlan=()=>({sleepAuto:false,dayTeams:[],manualSleepTeams:[],autoSleepTeams:[]});
const defaultPreparation=()=>({recipeId:'',meals:21,recipeTargets:[],priority:'stock',bagCapacity:0,carryover:{},field:'',fieldBonus:0,forecastCooking:'none',forecastFoodMode:'random',forecastInventorySource:'carryover'});
const newState=()=>({version:1,box:[],sleepIds:[],simulation:defaultSimulation(),weeklyPlan:defaultWeeklyPlan(),preparation:defaultPreparation(),event:{name:'',start:'',duration:1,map:'',food1:'random',food2:'random',berries:'',effects:'',campPrep:false,camp1:false,camp2:false},updatedAt:''});
const cleanText=(v, max=1000)=>typeof v==='string'&&v.length<=max;
const validEnum=(v,choices)=>choices.includes(v);
// This module validates localStorage on startup BEFORE master.js is loaded.
// Keep the supported ingredient key set local and consistent with master/API.
const INGREDIENT_KEYS=new Set(['leek','mushroom','egg','potato','apple','herb',
 'sausage','milk','honey','oil','ginger','tomato','cacao','tail','soy','corn',
 'coffee','pumpkin','avocado']);
const canonicalDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const dt=new Date(value+'T00:00:00Z');
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===value;
};
// W1: Persist optional 7x(day) and 7x(night) schedules while remaining JSON v1.
// An empty schedule means use the established legacy daytime/sleep rosters.
// A non-empty schedule must contain all seven days with complete five-member teams.
function validateWeeklyPlan(raw,ids){
 const p=raw===undefined?defaultWeeklyPlan():raw;
 if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.sleepAuto!=='boolean')
  throw Error('週間パーティ設定が不正です。');
 const validateTeam=(team,label)=>{
  if(!Array.isArray(team)||team.length!==5||new Set(team).size!==5||
    team.some(id=>typeof id!=='string'||!ids.has(id)))
   throw Error(label+'の5匹パーティが不正です。');
  return [...team];
 };
 const weeklyArray=(value,label,part)=>{
  if(!Array.isArray(value)||![0,7].includes(value.length))
   throw Error(label+'は7日分のパーティを指定してください。');
  return value.map((row,d)=>{
   if(part){
    if(!row||typeof row!=='object'||Array.isArray(row))
     throw Error(label+(d+1)+'日目が不正です。');
    return Object.fromEntries(['morning','noon','evening'].map(key=>
     [key,validateTeam(row[key],label+(d+1)+'日目'+key)]));
   }
   return validateTeam(row,label+(d+1)+'日目');
  });
 };
 return {sleepAuto:p.sleepAuto,
  dayTeams:weeklyArray(p.dayTeams,'日中曜日別パーティ',true),
  manualSleepTeams:weeklyArray(p.manualSleepTeams,'手動睡眠パーティ',false),
  autoSleepTeams:weeklyArray(p.autoSleepTeams,'自動睡眠パーティ',false)};
}
function resolveWeeklyPlan(state){
 const plan=validateWeeklyPlan(state.weeklyPlan,new Set(state.box.map(p=>p.id)));
 const daytime=plan.dayTeams.length?plan.dayTeams:
  Array.from({length:7},()=>Object.fromEntries(['morning','noon','evening'].map(key=>
   [key,[...state.simulation.teams[key]]])));
 const nights=plan.sleepAuto?plan.autoSleepTeams:plan.manualSleepTeams;
 if(plan.sleepAuto&&!nights.length)
  throw Error('睡眠自動提案ONですが、7晩の提案が未作成です。');
 return {teamsByDay:daytime,
  sleepTeamsByDay:nights.length?nights:Array.from({length:7},()=>[...state.sleepIds]),
  sleepAuto:plan.sleepAuto};
}
function validateState(x){
 if(!x||x.version!==1||!Array.isArray(x.box)||!Array.isArray(x.sleepIds)||!x.event||typeof x.event!=='object'||Array.isArray(x.event))throw new Error('対応していないバックアップ形式です。');
 if(x.box.length>10000)throw new Error('ボックスが大きすぎます。');
 for(const p of x.box){
  if(!p||typeof p!=='object'||typeof p.id!=='string'||!p.id||!cleanText(p.pokemon,120)||!p.pokemon||!cleanText(p.nickname,300)||!Number.isInteger(p.level)||p.level<1||p.level>100||!Number.isInteger(p.skillLevel)||p.skillLevel<1||p.skillLevel>20||!Array.isArray(p.ingredients)||p.ingredients.length!==3||!p.ingredients.every(v=>cleanText(v,120))||!Array.isArray(p.subskills)||p.subskills.length!==5||!p.subskills.every(v=>cleanText(v,120))||!cleanText(p.mainSkill,120)||!cleanText(p.nature,120)||!(p.sleepHours===null||(Number.isFinite(p.sleepHours)&&p.sleepHours>=0))||typeof p.shiny!=='boolean')throw new Error('ポケモンデータが不正です。');
 }
 const ids=new Set(x.box.map(p=>p.id));
 if(ids.size!==x.box.length)throw new Error('ボックスに重複した内部IDがあります。');
 if(x.sleepIds.some(id=>typeof id!=='string'||!ids.has(id))||new Set(x.sleepIds).size!==x.sleepIds.length||x.sleepIds.length>5)throw new Error('睡眠パーティが不正です。');
 const e=x.event;
 if(![1,2].includes(Number(e.duration))||!validEnum(e.food1,['random','curry','salad','dessert'])||!validEnum(e.food2,['random','curry','salad','dessert'])||!cleanText(e.name,100)||!cleanText(e.start,10)||!cleanText(e.map,80)||!cleanText(e.berries,100)||!cleanText(e.effects,1000)||!['campPrep','camp1','camp2'].every(k=>typeof e[k]==='boolean'))throw new Error('イベント設定が不正です。');
 if(e.start&&!canonicalDate(e.start))throw new Error('イベント開始日が不正です。');
 const prep=x.preparation??defaultPreparation();
 if(!prep||typeof prep!=='object'||Array.isArray(prep)||
    !cleanText(prep.recipeId,80)||
    !Number.isInteger(prep.meals)||prep.meals<1||prep.meals>21||
    !['energy','stock'].includes(prep.priority)||
    !Number.isInteger(prep.bagCapacity)||prep.bagCapacity<0||prep.bagCapacity>10000||
    !cleanText(prep.field??'',80)||!Number.isInteger(prep.fieldBonus??0)||
    (prep.fieldBonus??0)<0||(prep.fieldBonus??0)>100||
    !['none','saved'].includes(prep.forecastCooking??'none')||
    !['random','curry','salad','dessert'].includes(prep.forecastFoodMode??'random')||
    !['carryover','simulation'].includes(prep.forecastInventorySource??'carryover')||
    !prep.carryover||Object.prototype.toString.call(prep.carryover)!=='[object Object]')
  throw Error('準備週の設定が不正です。');
 // Older v1 backups contain only recipeId/meals. Preserve that single recipe
 // when migrating, while allowing new backups to store up to 21 meal types.
 const targets=prep.recipeTargets===undefined?
  (prep.recipeId?[{recipeId:prep.recipeId,meals:prep.meals}]:[]):prep.recipeTargets;
 if(!Array.isArray(targets)||targets.length>21)throw Error('準備週の料理内訳が不正です。');
 const seenRecipes=new Set();let mealCount=0;
 const recipeTargets=targets.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||!cleanText(row.recipeId,80)||
     !row.recipeId||!Number.isInteger(row.meals)||row.meals<1||row.meals>21||
     seenRecipes.has(row.recipeId))throw Error('準備週の料理内訳が不正です。');
  seenRecipes.add(row.recipeId);mealCount+=row.meals;
  return {recipeId:row.recipeId,meals:row.meals};
 });
 if(mealCount>21)throw Error('準備週の料理は合計21食以内で指定してください。');
 const carryover={};
 for(const [k,v] of Object.entries(prep.carryover)){
  if(!INGREDIENT_KEYS.has(k)||!Number.isInteger(v)||v<0||v>10000)
   throw Error('準備週の持ち越し食材数が不正です。');
  carryover[k]=v;
 }
 if(Object.values(carryover).reduce((n,v)=>n+v,0)>prep.bagCapacity&&prep.bagCapacity!==0)
  throw Error('準備週の持ち越し食材数がバッグ容量を超えています。');
 const weeklyPlan=validateWeeklyPlan(x.weeklyPlan,ids);
 const sim=x.simulation===undefined?defaultSimulation():x.simulation;
 if(!sim||typeof sim!=='object'||!sim.teams||typeof sim.teams!=='object')throw new Error('計算設定が不正です。');
 const teams={};
 for(const key of ['morning','noon','evening']) {
  const a=sim.teams[key];
  const chosen=Array.isArray(a)?a.filter(Boolean):[];
  if(!Array.isArray(a)||a.length>5||new Set(chosen).size!==chosen.length||a.some(id=>typeof id!=='string'||(id!==''&&!ids.has(id))))throw new Error('計算用パーティが不正です。');
  teams[key]=[...a];
 }
 const between=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(!between(sim.fieldBonus,0,100)||!between(sim.tapMinutes,120,180)||!between(sim.potSize,7,300)||!between(sim.bagCapacity??0,0,10000)||!Number.isInteger(sim.bagCapacity??0)||!between(sim.sleepScore,0,100)||!between(sim.initialEnergy,0,150)||!cleanText(sim.recipeId,80)||!['fixed','fallback','best'].includes(sim.recipeMode??'fixed')||!['none','fill'].includes(sim.extraMode??'none')||!['none','expected'].includes(sim.successMode??'none')||!sim.initialIngredients||typeof sim.initialIngredients!=='object'||Array.isArray(sim.initialIngredients))throw new Error('計算設定が不正です。');
 const magnet=sim.magnetIngredients??[];
 if(!Array.isArray(magnet)||magnet.length>19||new Set(magnet).size!==magnet.length||magnet.some(k=>typeof k!=='string'||!INGREDIENT_KEYS.has(k)))throw new Error('発見済み食材の設定が不正です。');
 for(const [k,v] of Object.entries(sim.initialIngredients))if(!INGREDIENT_KEYS.has(k)||!Number.isInteger(v)||v<0||v>10000)throw new Error('初期食材数が不正です。');
 return {version:1,box:x.box,sleepIds:[...x.sleepIds],weeklyPlan,preparation:{recipeId:prep.recipeId,meals:prep.meals,recipeTargets,priority:prep.priority,bagCapacity:prep.bagCapacity,carryover,field:prep.field??'',fieldBonus:prep.fieldBonus??0,forecastCooking:prep.forecastCooking??'none',forecastFoodMode:prep.forecastFoodMode??'random',forecastInventorySource:prep.forecastInventorySource??'carryover'},simulation:{teams,fieldBonus:sim.fieldBonus,tapMinutes:sim.tapMinutes,potSize:sim.potSize,bagCapacity:sim.bagCapacity??0,sleepScore:sim.sleepScore,initialEnergy:sim.initialEnergy,recipeId:sim.recipeId,recipeMode:sim.recipeMode??'fixed',extraMode:sim.extraMode??'none',successMode:sim.successMode??'none',magnetIngredients:[...magnet],initialIngredients:{...sim.initialIngredients}},event:{name:e.name,start:e.start,duration:Number(e.duration),map:e.map,berries:e.berries,effects:e.effects,food1:e.food1,food2:e.food2,campPrep:e.campPrep,camp1:e.camp1,camp2:e.camp2},updatedAt:typeof x.updatedAt==='string'?x.updatedAt:''};
}
// Preserve selected individuals on a refreshed export. First match full IV-like
// fingerprints; only fall back to nickname+species when BOTH boxes are unique.
function reconcileSleepIds(previous, next){
 const selected=previous.sleepIds.map(id=>previous.box.find(p=>p.id===id)).filter(Boolean);
 const used=new Set();const result=[];
 const signature=p=>JSON.stringify([p.nickname,p.pokemon,p.level,p.skillLevel,p.ingredients,p.mainSkill,p.nature,p.subskills,p.sleepHours,p.shiny]);
 for(const original of selected){
  let match=next.find(p=>!used.has(p.id)&&signature(p)===signature(original));
  if(!match){
   const key=p=>JSON.stringify([p.nickname,p.pokemon]);
   const oldMatches=previous.box.filter(p=>key(p)===key(original));
   const newMatches=next.filter(p=>key(p)===key(original));
   if(oldMatches.length===1&&newMatches.length===1&&!used.has(newMatches[0].id))match=newMatches[0];
  }
  if(match){used.add(match.id);result.push(match.id);}
 }
 return result;
}
// A CSV reimport changes internal IDs. Remap *every* stored slot before
// persisting the replacement box; never retain dangling IDs or silently
// choose an ambiguous replacement individual. Incomplete weekly plans are
// invalidated as a whole and surfaced to the user for reconfiguration.
function reconcileWeeklyPlan(previous,nextBox){
 const old=validateWeeklyPlan(previous.weeklyPlan,new Set(previous.box.map(p=>p.id)));
 const invalidated=[];
 function remap(team){
  return reconcileSleepIds({box:previous.box,sleepIds:team},nextBox);
 }
 function remapNights(source,label){
  if(!source.length)return [];
  const rows=source.map(remap);
  if(rows.some(ids=>ids.length!==5)){invalidated.push(label);return [];}
  return rows;
 }
 function remapDays(source){
  if(!source.length)return [];
  const result=source.map(row=>Object.fromEntries(['morning','noon','evening'].map(key=>
   [key,remap(row[key])])));
  if(result.some(row=>['morning','noon','evening'].some(key=>row[key].length!==5))){
   invalidated.push('曜日別の日中パーティ');return [];
  }
  return result;
 }
 const dayTeams=remapDays(old.dayTeams);
 const manualSleepTeams=remapNights(old.manualSleepTeams,'手動睡眠7晩');
 const autoSleepTeams=remapNights(old.autoSleepTeams,'睡眠自動提案7晩');
 const sleepAuto=old.sleepAuto&&autoSleepTeams.length===7;
 if(old.sleepAuto&&!sleepAuto)invalidated.push('睡眠自動提案ON');
 return {plan:{dayTeams,manualSleepTeams,autoSleepTeams,sleepAuto},invalidated};
}
let loadError='';
function load(){try{const s=localStorage.getItem(KEY);loadError='';return s?validateState(JSON.parse(s)):newState();}catch(e){loadError='保存済みデータを読み込めません。上書きを防止しています。バックアップから復元するか、すべてのローカルデータを消去してください。';return newState();}}
function save(state){if(loadError)throw new Error(loadError);localStorage.setItem(KEY,JSON.stringify(validateState(state)));}
function allowRecovery(){loadError='';}
function getLoadError(){return loadError;}
function available(){try{const k=KEY+'/probe';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch(e){return false;}}
const api={newState,defaultSimulation,defaultPreparation,defaultWeeklyPlan,validateWeeklyPlan,resolveWeeklyPlan,validateState,reconcileSleepIds,reconcileWeeklyPlan,load,save,available,getLoadError,allowRecovery,KEY};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
'use strict';
const KEY='pokesleep-event-planner/step1/v1';
const defaultSimulation=()=>({teams:{morning:[],noon:[],evening:[]},fieldBonus:0,tapMinutes:150,potSize:57,sleepScore:88,initialEnergy:100,recipeId:'',initialIngredients:{}});
const newState=()=>({version:1,box:[],sleepIds:[],simulation:defaultSimulation(),event:{name:'',start:'',duration:1,map:'',food1:'random',food2:'random',berries:'',effects:'',campPrep:false,camp1:false,camp2:false},updatedAt:''});
const cleanText=(v, max=1000)=>typeof v==='string'&&v.length<=max;
const validEnum=(v,choices)=>choices.includes(v);
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
 if(e.start&&!/^\d{4}-\d{2}-\d{2}$/.test(e.start))throw new Error('イベント開始日が不正です。');
 const sim=x.simulation===undefined?defaultSimulation():x.simulation;
 if(!sim||typeof sim!=='object'||!sim.teams||typeof sim.teams!=='object')throw new Error('計算設定が不正です。');
 const teams={};
 for(const key of ['morning','noon','evening']) {
  const a=sim.teams[key];
  const chosen=Array.isArray(a)?a.filter(Boolean):[];
  if(!Array.isArray(a)||a.length>5||new Set(chosen).size!==chosen.length||a.some(id=>typeof id!=='string'||(id!==''&&!ids.has(id))))throw new Error('計算用パーティが不正です。');
  teams[key]=[...a];
 }
 const between=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!between(sim.fieldBonus,0,100)||!between(sim.tapMinutes,120,180)||!between(sim.potSize,7,300)||!between(sim.sleepScore,0,100)||!between(sim.initialEnergy,0,150)||!cleanText(sim.recipeId,80)||!sim.initialIngredients||typeof sim.initialIngredients!=='object'||Array.isArray(sim.initialIngredients))throw new Error('計算設定が不正です。');
 for(const [k,v] of Object.entries(sim.initialIngredients))if(!cleanText(k,40)||!Number.isInteger(v)||v<0||v>10000)throw new Error('初期食材数が不正です。');
 return {version:1,box:x.box,sleepIds:[...x.sleepIds],simulation:{teams,fieldBonus:sim.fieldBonus,tapMinutes:sim.tapMinutes,potSize:sim.potSize,sleepScore:sim.sleepScore,initialEnergy:sim.initialEnergy,recipeId:sim.recipeId,initialIngredients:{...sim.initialIngredients}},event:{name:e.name,start:e.start,duration:Number(e.duration),map:e.map,berries:e.berries,effects:e.effects,food1:e.food1,food2:e.food2,campPrep:e.campPrep,camp1:e.camp1,camp2:e.camp2},updatedAt:typeof x.updatedAt==='string'?x.updatedAt:''};
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
let loadError='';
function load(){try{const s=localStorage.getItem(KEY);loadError='';return s?validateState(JSON.parse(s)):newState();}catch(e){loadError='保存済みデータを読み込めません。上書きを防止しています。バックアップから復元するか、すべてのローカルデータを消去してください。';return newState();}}
function save(state){if(loadError)throw new Error(loadError);localStorage.setItem(KEY,JSON.stringify(validateState(state)));}
function allowRecovery(){loadError='';}
function getLoadError(){return loadError;}
function available(){try{const k=KEY+'/probe';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch(e){return false;}}
const api={newState,defaultSimulation,validateState,reconcileSleepIds,load,save,available,getLoadError,allowRecovery,KEY};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this);

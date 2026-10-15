(function(root){
'use strict';
const KEY='pokesleep-event-planner/step1/v1';
const newState=()=>({version:1,box:[],sleepIds:[],event:{name:'',start:'',duration:1,map:'',food1:'random',food2:'random',berries:'',effects:'',campPrep:false,camp1:false,camp2:false},updatedAt:''});
function validateState(x){
 if(!x||x.version!==1||!Array.isArray(x.box)||!Array.isArray(x.sleepIds)||!x.event||typeof x.event!=='object')throw new Error('対応していないバックアップ形式です。');
 if(x.box.length>10000)throw new Error('ボックスが大きすぎます。');
 for(const p of x.box){if(!p||typeof p.id!=='string'||typeof p.pokemon!=='string'||!Number.isInteger(p.level)||p.level<1)throw new Error('ポケモンデータが不正です。');}
 const ids=new Set(x.box.map(p=>p.id));
 if(ids.size!==x.box.length)throw new Error('ボックスに重複した内部IDがあります。');
 const sleep=x.sleepIds.filter(id=>ids.has(id));
 if(new Set(sleep).size!==sleep.length||sleep.length>5)throw new Error('睡眠パーティに重複・超過があります。');
 const e=x.event;
 if(![1,2].includes(Number(e.duration))||!['random','curry','salad','dessert'].includes(e.food1)||!['random','curry','salad','dessert'].includes(e.food2))throw new Error('イベント設定が不正です。');
 return {version:1,box:x.box,sleepIds:sleep,event:{...newState().event,...e,duration:Number(e.duration)},updatedAt:typeof x.updatedAt==='string'?x.updatedAt:''};
}
function load(){try{const s=localStorage.getItem(KEY);return s?validateState(JSON.parse(s)):newState();}catch(e){return newState();}}
function save(state){localStorage.setItem(KEY,JSON.stringify(validateState(state)));}
function available(){try{const k=KEY+'/probe';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch(e){return false;}}
const api={newState,validateState,load,save,available,KEY};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this);

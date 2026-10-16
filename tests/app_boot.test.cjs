const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../src');
function boot(){
 const items=new Map(),callbacks=new Map();let serial=0;
 function element(tag='div',id){
  const e={id:id||'generated-'+(++serial),tagName:tag,children:[],dataset:{},hidden:false,checked:false,disabled:false,files:[],className:'',classList:{toggle(){},add(){},remove(){}},
   _value:'',get value(){return this._value},set value(v){this._value=String(v)},
   _html:'',get innerHTML(){return this._html},set innerHTML(v){this._html=String(v);this.children=[]},
   textContent:'',setAttribute(){},addEventListener(n,f){callbacks.set(this.id+':'+n,f)},append(...a){this.children.push(...a)},appendChild(v){this.children.push(v)},replaceChildren(...a){this.children=[...a]},
   querySelectorAll(q){return q==='select'?this.children.flatMap(x=>x.children.filter(y=>y.tagName==='select')):[]},scrollIntoView(){},click(){},remove(){}};
  if(id)items.set(id,e);return e;
 }
 const rosters=Object.fromEntries(['morning','noon','evening'].map(k=>[k,element('div','roster-'+k)]));
 const tabs=['event','box','simulate','settings'].map(k=>{const x=element('button','tab'+k);x.dataset.tab=k;return x});
 const panels=['event','box','simulate','settings'].map(k=>element('div','panel-'+k));
 const copy=['sleep','morning','noon'].map((from,i)=>{const x=element('button','copy'+i);x.dataset.copyFrom=from;x.dataset.copyTo=['morning','noon','evening'][i];return x});
 const document={getElementById:id=>items.get(id)||element('input',id),querySelectorAll:s=>s==='.tab'?tabs:s==='.panel'?panels:s==='.sim-copy'?copy:[],
  querySelector:s=>{const m=s.match(/data-roster="([^"]+)"/);return m?rosters[m[1]]:null},createElement:tag=>element(tag),body:{appendChild(){}}};
 const one={id:'i0',pokemon:'ライチュウ',nickname:'test',level:60,skillLevel:6,ingredients:['とくせんリンゴ','あったかジンジャー','とくせんエッグ'],mainSkill:'エナジーチャージS',nature:'さみしがり',subskills:['きのみの数S','','','',''],sleepHours:1000,shiny:false};
 const box=Array.from({length:5},(_,i)=>({...one,id:'i'+i}));const ids=box.map(x=>x.id);
 const event={name:'test',start:'2026-10-19',duration:1,map:'シアンの砂浜',food1:'curry',food2:'random',berries:'',effects:'',campPrep:false,camp1:false,camp2:false};
 const data=new Map([['pokesleep-event-planner/step1/v1',JSON.stringify({version:1,box,sleepIds:ids,event,updatedAt:''})]]);
 const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const ctx={document,localStorage,confirm:()=>true,alert:()=>{},URL,Blob,setTimeout:()=>1,clearTimeout(){}};
 ctx.globalThis=ctx;ctx.window=ctx;
 vm.createContext(ctx);
 for(const name of ['csv.js','storage.js','master.js','simulator.js','app.js'])
  vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),ctx,{filename:name});
 return {ctx,items,rosters,callbacks,data};
}
test('STEP2 browser startup and one-tap team setup produce results',()=>{
 const app=boot();
 assert.deepEqual(Object.values(app.rosters).map(r=>r.children.length),[5,5,5]);
 assert.equal(app.items.get('runSim').disabled,true);
 app.callbacks.get('fillAllRosters:click')();
 assert.equal(app.items.get('runSim').disabled,false);
 app.items.get('simRecipe').value='apple_curry';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simResult').hidden,false);
 assert.match(app.items.get('simTotal').textContent,/エナジー/);
 assert.equal(app.items.get('simDaily').children.length,7);
});
test('fixed slots do not collapse when selecting the fourth slot first',()=>{
 const app=boot(),holder=app.rosters.morning;
 const selectors=holder.querySelectorAll('select');
 selectors[3].value='i3';
 app.callbacks.get(selectors[3].id+':change')();
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.deepEqual(saved.simulation.teams.morning,['','','','i3','']);
});

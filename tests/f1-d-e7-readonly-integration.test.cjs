'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const load=(file,root={},dependencies={})=>{
 const sandbox={module:{exports:{}},globalThis:root,window:root,
  require:specifier=>{if(Object.hasOwn(dependencies,specifier))return dependencies[specifier];throw Error(specifier)}};
 vm.runInNewContext(read(file),sandbox,{filename:file});
 return sandbox.module.exports;
};
const snapshot=require('../f1/f1-b-target-source-v1.json');
const traits=require('../f1/f1-b-help-traits-v1.json');
const root={},scope=load('e7-preview/e7-inventory-scope-v78.js',root);
const api=load('f1/f1-d-e7-input-v1.js',root);
const legal=load('f1/f1-b-legal-build-v2.js',root);
const rates=load('f1/f1-b-base-rates-v1.js',root,{'./f1-b-legal-build-v2.js':legal});
const cBridge=load('f1/f1-c-step2-simulation-bridge-v1.js',root);
for(const f of ['src/master.js','src/recipes.js','f1/f1-c-simulator-v1.js'])load(f,root);
const dependencies={snapshot,traits,legal,rates,master:root.PokeMaster,
 simulator:root.PokeF1CSimulator};
const W='2026-11-16',A='manual:'+W,B='event-2026-11';
const sMap=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,
 setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),
 dump:()=>Object.fromEntries(m)};};
const species=new Map(snapshot.targets.map(s=>[s.name,s]));
const food=(t,slot)=>{
 const special=legal.SPECIAL_FOODS[t];
 if(special)return snapshot.dictionaries.ingredients[Object.keys(special[slot-1])[0]];
 const a=species.get(t),c=[a.sourceProfile.ing1,a.sourceProfile.ing2,a.sourceProfile.ing3]
  .slice(0,slot).find(x=>x&&x.name!=='unknown'&&x['c'+slot]>0);
 if(!c)throw Error('Missing test food '+t+'/'+slot);
 return snapshot.dictionaries.ingredients[c.name];
};
const item=(pokemon,nick='同じニックネーム')=>{
 const t=species.get(pokemon);
 return {pokemon,nickname:nick,level:50,skillLevel:3,
  ing1:food(pokemon,1),ing2:food(pokemon,2),ing3:food(pokemon,3),
  nature:'てれや',mainSkill:t.sourceProfile.mainSkillJa,mint:null,ribbon:null,shiny:false,
  favorite:'',lv10:'きのみの数S',lv25:'おてつだいボーナス',
  lv50:'おてつだいスピードS',lv70:'リサーチEXPボーナス',lv80:'げんき回復ボーナス'};
};
const FIVE=['エーフィ','リザードン','ゲンガー','ライチュウ','サーナイト'];
function populate(s,id=A,stock=25,all=false){
 s.setItem(api.SELECTED,JSON.stringify({weekStart:W,id}));
 const key=api.eventKey(W,id),values=Object.fromEntries(
  Object.values(root.PokeMaster.ingredients).map(name=>[name,0]));
 values['とくせんリンゴ']=stock;
 s.setItem(key,JSON.stringify({version:1,weekStart:W,eventId:id,
  confirmed:{weekStart:W,eventId:id,status:'CONFIRMED',
   savedAt:'2026-11-13T00:00:00Z',revision:'rev-'+id,missingFields:[],
   fields:{field:'シアンの砂浜',food:all?'all':'curry',camp:true,source:null}}}));
 s.setItem(scope.scopedKey(W,id),JSON.stringify({
  version:2,weekStart:W,eventId:id,preparationLatest:null,startInventory:null,
  currentInventory:{weekStart:W,savedAt:'2026-11-13T00:00:00Z',
   revision:'stock-'+stock,values}
 }));
 s.setItem(api.BOX,JSON.stringify({version:1,source:'pokesleep-tool-header-mapped',
  items:FIVE.map(n=>item(n)).concat(item('ミュウ'))}));
 const f=['ワカクサ本島','シアンの砂浜','トープ洞窟','ウノハナ雪原','ラピスラズリ湖畔',
  'ゴールド旧発電所','アンバー渓谷','ワカクサ本島EX','シアンの砂浜EX'];
 s.setItem(api.PLAYER,JSON.stringify({version:1,pot:57,bag:600,
  bonuses:Object.fromEntries(f.map(x=>[x,x==='シアンの砂浜'?50:null]))}));
}
test('F1-D reads confirmed event, five indexed actual individuals and player/inventory without writes',()=>{
 const s=sMap();populate(s);const before=s.dump(),c=api.context(s,scope);
 assert.equal(c.status,'READY');assert.equal(c.items.length,6);
 const out=api.modelInput(c,[0,1,2,3,4],{},root.PokeMaster.ingredients);
 assert.equal(out.status,'READY');assert.equal(out.mode,'FIVE_FIXED_ALL_28_SLOTS_NOT_OPTIMIZED');
 assert.equal(out.input.box.length,5);assert.equal(out.input.teamsByDay.length,7);
 assert.equal(out.input.sleepTeamsByDay.length,7);
 assert.equal(out.input.options.initialIngredients.apple,25);
 assert.equal(out.input.options.fieldBonus,50);
 assert.equal(out.input.options.camp,true);
 assert.equal(out.input.options.potSize,57);
 assert.equal(out.input.options.bagCapacity,600);
 assert.equal(out.input.box[0].mint,false);
 assert.equal(out.input.box[0].ribbon,0);
 assert.equal(out.input.box[0].nickname,'同じニックネーム');
 assert.deepEqual(s.dump(),before,'all E7 records must remain byte-for-byte unchanged');
});
test('F1-D one week with two events never mixes inventories or identities',()=>{
 const s=sMap();populate(s,A,25);populate(s,B,77);
 // Explicitly choose A again; B was last saved/selected by fixture.
 s.setItem(api.SELECTED,JSON.stringify({weekStart:W,id:A}));
 const aa=api.context(s,scope);
 assert.equal(api.modelInput(aa,[0,1,2,3,4],{},root.PokeMaster.ingredients).input.options.initialIngredients.apple,25);
 s.setItem(api.SELECTED,JSON.stringify({weekStart:W,id:B}));
 const bb=api.context(s,scope);
 assert.equal(api.modelInput(bb,[0,1,2,3,4],{},root.PokeMaster.ingredients).input.options.initialIngredients.apple,77);
 assert.notEqual(aa.key,bb.key);assert.notEqual(aa.eventRevision,bb.eventRevision);
});
test('F1-D refuses unconfirmed event and event-owner-corrupt stock, never resets a saved box',()=>{
 const s=sMap();populate(s);const before=s.getItem(api.BOX);
 s.removeItem(api.SELECTED);assert.equal(api.context(s,scope).reason,'NO_EVENT');
 s.setItem(api.SELECTED,JSON.stringify({weekStart:W,id:A}));
 s.setItem(api.eventKey(W,A),'{broken');
 assert.notEqual(api.context(s,scope).status,'READY');
 populate(s);
 s.setItem(scope.scopedKey(W,A),JSON.stringify({version:2,weekStart:W,eventId:B}));
 assert.equal(api.context(s,scope).reason,'INVALID_INVENTORY');
 assert.equal(s.getItem(api.BOX),before);
});
test('F1-D all categories require explicit selection, duplicate/out-of-range team indices rejected',()=>{
 const s=sMap();populate(s,A,0,true);const c=api.context(s,scope);
 assert.equal(api.modelInput(c,[0,1,2,3,4],{},root.PokeMaster.ingredients).reason,'SET_FOOD_CATEGORY');
 assert.equal(api.modelInput(c,[0,0,2,3,4],{foodCategory:'curry'},root.PokeMaster.ingredients).reason,'SELECT_FIVE');
 assert.equal(api.modelInput(c,[0,1,2,3,99],{foodCategory:'curry'},root.PokeMaster.ingredients).reason,'SELECT_FIVE');
 assert.equal(api.modelInput(c,[0,1,2,3,4],{foodCategory:'dessert'},root.PokeMaster.ingredients).status,'READY');
});
test('F1-D handles nullable optional source cells explicitly without rewriting CSV',()=>{
 const s=sMap();populate(s);const c=api.context(s,scope);
 const out=api.modelInput(c,[0,1,2,3,4],{},root.PokeMaster.ingredients);
 assert(out.notes.some(n=>n.includes('ミント')));
 assert(out.notes.some(n=>n.includes('睡眠時間')));
 assert(c.items.every(x=>x.mint===null&&x.ribbon===null));
});
test('F1-D full integration uses source-backed F1-C weekly engine and returns provisional energy',()=>{
 const s=sMap();populate(s);const c=api.context(s,scope);
 const built=api.modelInput(c,[0,1,2,3,4],{},root.PokeMaster.ingredients);
 const week=cBridge.simulateWeekly(built.input,dependencies);
 assert.equal(week.status,'PROVISIONAL',week.reason);
 assert(Number.isFinite(week.weeklyEnergy)&&week.weeklyEnergy>0);
 assert.equal(week.coveredIndividuals,5);
 assert.equal(week.breakdown.days.length,7);
 assert.equal(week.userRowsRetained,false);
});
test('F1-D leaves E7 UI, E7 service worker, root and protected simulator unmodified',()=>{
 const src=read('f1/f1-d-e7-input-v1.js');
 assert.doesNotMatch(src,/\.setItem\(|\.removeItem\(|indexedDB|document\./);
 const html=read('f1d-preview/index.html');
 assert.match(html,/src="\.\.\/e7-preview\/index\.html"/);
 assert.match(html,/\.\.\/f1\/f1-d-e7-input-v1\.js/);
 const ui=read('f1d-preview/f1-d-ui.js');
 assert.match(ui,/FIVE_FIXED|実個体5匹|7日間を仮計算/);
 assert.doesNotMatch(ui,/\.setItem\(|\.removeItem\(/);
 assert.match(read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html'),/この画面の編成は表示用の仮提案/);
});

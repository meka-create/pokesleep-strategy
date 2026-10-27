const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../src');
function boot({noSleep=false,withSixth=false,withHealers=false}={}){
 const items=new Map(),callbacks=new Map(),callbackOwners=new Map(),timers=[];let serial=0,failWrites=false;
 function element(tag='div',id){
  const e={id:id||'generated-'+(++serial),tagName:tag,children:[],dataset:{},hidden:false,checked:false,disabled:false,files:[],className:'',classList:{toggle(){},add(){},remove(){}},
   _value:'',get value(){return this._value},set value(v){this._value=String(v)},
   _html:'',get innerHTML(){return this._html},set innerHTML(v){this._html=String(v);this.children=[]},
   textContent:'',setAttribute(){},addEventListener(n,f){const key=this.id+':'+n,previous=callbackOwners.get(key)===this?callbacks.get(key):null;callbacks.set(key,previous?(...args)=>{previous(...args);f(...args);}:f);callbackOwners.set(key,this)},append(...a){this.children.push(...a)},appendChild(v){this.children.push(v)},replaceChildren(...a){this.children=[...a]},
   querySelectorAll(q){
    if(q==='select')return this.children.flatMap(x=>x.children.filter(y=>y.tagName==='select'));
    if(q==='[data-add]'||q==='[data-remove]'){
     const attr=q==='[data-add]'?'add':'remove';
     const re=new RegExp('data-'+attr+'="([^"]+)"','g');
     return Array.from(this._html.matchAll(re),m=>{
      const btn=element('button',this.id+'-virtual-'+attr+'-'+m[1]);
      btn.dataset[attr]=m[1];return btn;
     });
    }
    return [];
   },scrollIntoView(){},click(){},remove(){}};
  if(id)items.set(id,e);return e;
 }
 const rosters=Object.fromEntries(['morning','noon','evening'].map(k=>[k,element('div','roster-'+k)]));
 const tabs=['event','box','simulate','prep','settings'].map(k=>{const x=element('button','tab'+k);x.dataset.tab=k;return x});
 const panels=['event','box','simulate','prep','settings'].map(k=>element('div','panel-'+k));
 const copy=['sleep','morning','noon'].map((from,i)=>{const x=element('button','copy'+i);x.dataset.copyFrom=from;x.dataset.copyTo=['morning','noon','evening'][i];return x});
 // Read the version from the actual shipped template; a hard-coded 0.2.44
 // allowed the UI test fixture to miss regressions in saved provenance.
 const versionMatch=fs.readFileSync(path.join(base,'index.template.html'),'utf8')
  .match(/STEP 4 · v(\d+\.\d+\.\d+)/);
 assert.ok(versionMatch,'built UI must advertise a parseable version');
 const headerVersion=element('span','headerVersion');
 headerVersion.textContent='STEP 4 · v'+versionMatch[1];
 const document={getElementById:id=>items.get(id)||element('input',id),querySelectorAll:s=>s==='.tab'?tabs:s==='.panel'?panels:s==='.sim-copy'?copy:[],
  querySelector:s=>{if(s==='.step-mark')return headerVersion;const m=s.match(/data-roster="([^"]+)"/);return m?rosters[m[1]]:null},createElement:tag=>element(tag),body:{appendChild(){}}};
 const one={id:'i0',pokemon:'ライチュウ',nickname:'test',level:60,skillLevel:6,ingredients:['とくせんリンゴ','あったかジンジャー','とくせんエッグ'],mainSkill:'エナジーチャージS',nature:'さみしがり',subskills:['きのみの数S','','','',''],sleepHours:1000,shiny:false};
 const box=Array.from({length:withSixth?6:5},(_,i)=>({
  ...one,id:'i'+i,
  pokemon:withHealers&&i<2?(i===0?'プクリン':'サーナイト'):one.pokemon
 }));const ids=box.slice(0,5).map(x=>x.id);
 const event={name:'test',start:'2026-10-19',duration:1,map:'シアンの砂浜',food1:'curry',food2:'random',berries:'',effects:'',campPrep:false,camp1:false,camp2:false};
 const data=new Map([['pokesleep-event-planner/step1/v1',JSON.stringify({version:1,box,sleepIds:noSleep?[]:ids,event,updatedAt:''})]]);
 const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(failWrites)throw Error('quota');data.set(k,String(v));},removeItem:k=>data.delete(k)};
 // Freeze the browser clock AFTER the fixture's target game week (Oct 19-26).
 // CI must not depend on the wall-clock date of this test run.
 class TestDate extends Date{
  constructor(...args){super(...(args.length?args:['2026-11-10T00:00:00.000Z']));}
  static now(){return Date.parse('2026-11-10T00:00:00.000Z');}
 }
 const ctx={document,localStorage,confirm:()=>true,alert:()=>{},URL,Blob,
  Date:TestDate,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};
 ctx.globalThis=ctx;ctx.window=ctx;
 vm.createContext(ctx);
 for(const name of ['csv.js','storage.js','master.js','recipes.js','ingredient-distribution.js','simulator.js','step3.js','step4.js','observation.js','app.js'])
  vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),ctx,{filename:name});
 return {ctx,items,rosters,callbacks,data,
  setFailWrites:value=>{failWrites=value;},
  tickTimer:()=>{const callback=timers.shift();if(callback)callback();},
  flushTimers:(limit=50)=>{let count=0;while(timers.length&&count++<limit)timers.shift()();
   assert.ok(count<=limit,'scheduled UI work must be bounded');}};
}
test('STEP2 browser startup and one-tap team setup produce results',()=>{
 const app=boot();
 assert.deepEqual(Object.values(app.rosters).map(r=>r.children.length),[5,5,5]);
 assert.equal(app.items.get('runSim').disabled,true);
 app.callbacks.get('fillAllRosters:click')();
 assert.equal(app.items.get('runSim').disabled,false);
 app.items.get('simRecipe').value='apple_curry';
 assert.equal(app.items.get('simRecipe').children.length,79);
 assert.equal(app.items.get('simRecipeMode').value,'fixed');
 assert.equal(app.items.get('simIngredientFields').children.length,19);
 assert.equal(app.items.get('simMagnetFields').children.length,19);
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simResult').hidden,false);
 assert.match(app.items.get('simTotal').textContent,/エナジー/);
 assert.equal(typeof app.ctx.PokeIngredientDistribution.evaluateRecipeOutcomes,'function');
 assert.equal(app.items.get('simDaily').children.length,7);
 assert.equal(app.items.get('simNightEnergy').children.length,7);
});
test('fixed slots do not collapse when selecting the fourth slot first',()=>{
 const app=boot(),holder=app.rosters.morning;
 const selectors=holder.querySelectorAll('select');
 selectors[3].value='i3';
 app.callbacks.get(selectors[3].id+':change')();
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.deepEqual(saved.simulation.teams.morning,['','','','i3','']);
});

test('all 19 ingredient input values survive simulation save and restore',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 const label=app.items.get('simIngredientFields').children[3];
 label.children[1].value='45';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(Object.values(saved.simulation.initialIngredients).includes(45),true);
});

test('discovered ingredient checkboxes save only selected ingredient pool',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 const labels=app.items.get('simMagnetFields').children;
 labels[0].children[0].checked=true;
 labels[3].children[0].checked=true;
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(saved.simulation.magnetIngredients.length,2);
 const expected=Object.keys(app.ctx.PokeMaster.ingredients);
 assert.deepEqual(saved.simulation.magnetIngredients,[expected[0],expected[3]]);
});

test('auto dish choice survives save and creates meal trace in real UI wiring',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.items.get('simRecipeMode').value='best';
 app.items.get('simRecipe').value='';
 const arr=app.items.get('simIngredientFields').children;
 // Enough apples and milk to cook dishes during the week.
 for(let i=0;i<arr.length;i++){
  if(['とくせんリンゴ','モーモーミルク'].includes(arr[i].children[0].textContent))arr[i].children[1].value='100';
 }
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 const state=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(state.simulation.recipeMode,'best');
 // The sample event is curry: auto must not choose desserts or salads.
 assert.equal(app.items.get('simResult').hidden,false);
 assert.ok(app.items.get('simMeals').children.length>0);
 assert.match(app.items.get('simMealSummary').textContent,/期待値モデルで料理を計上/);
 assert.match(app.items.get('simMealSummary').textContent,/生産期待値に依存/);
 assert.match(app.items.get('simMealSummary').textContent,/不確実な生産由来の食材を使う料理/);
 assert.ok(app.items.get('simMeals').children.some(x=>x.children[0].textContent.includes('必須材料：')));
});

test('optional extra food and great-success settings persist with meal trace',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.items.get('simRecipeMode').value='best';
 app.items.get('simExtraMode').value='fill';
 app.items.get('simSuccessMode').value='expected';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(saved.simulation.extraMode,'fill');
 assert.equal(saved.simulation.successMode,'expected');
 assert.equal(app.items.get('simResult').hidden,false);
});

test('result summary reflects actual optional culinary settings, not stale blanket exclusion',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.items.get('simRecipeMode').value='best';
 app.items.get('simExtraMode').value='fill';
 app.items.get('simSuccessMode').value='expected';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.match(app.items.get('simMealSummary').textContent,/追加食材：期待値で計上/);
 assert.match(app.items.get('simMealSummary').textContent,/大成功：推定期待値で計上/);
});

test('real weekly observation button rejects unverifiable data then saves exact simulated roster JSON',async()=>{
 const app=boot(),files=[];
 app.ctx.URL={createObjectURL(blob){files.push(blob);return 'blob:observation-test';},
  revokeObjectURL(){}};
 app.callbacks.get('fillAllRosters:click')();
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simResult').hidden,false);
 assert.equal(app.items.get('obsNoUnmodeledEvents').checked,false);
 assert.equal(app.items.get('obsConfirmedSummary').checked,false);
 app.items.get('obsMonday').value='2026-10-18'; // Sunday: reject
 app.items.get('obsTotal').value='1000';
 app.items.get('obsBerry').value='600';
 app.items.get('obsCooking').value='400';
 app.items.get('obsConfirmedSummary').checked=true;
 app.callbacks.get('downloadObservation:click')();
 assert.equal(app.items.get('obsError').hidden,false);
 assert.match(app.items.get('obsError').textContent,/月曜日/);
 assert.equal(files.length,0);
 app.items.get('obsMonday').value='2026-10-19';
 // Edits after the successful run MUST NOT change the captured observation.
 app.items.get('simFieldBonus').value='95';
 app.callbacks.get('downloadObservation:click')();
 assert.equal(app.items.get('obsError').hidden,true,app.items.get('obsError').textContent);
 assert.equal(files.length,1);
 assert.match(app.items.get('obsResult').textContent,/STEP2 HOLD/);
 const report=JSON.parse(await files[0].text());
 assert.equal(report.schema,'step2-m1-weekly-observation-v1');
 assert.equal(report.week.mondayDate,'2026-10-19');
 assert.equal(report.week.field,'シアンの砂浜');
 assert.equal(report.input.box.length,5);
 assert.equal(report.input.options.fieldBonus,0);
 assert.deepEqual(report.input.teams.sleep,['i0','i1','i2','i3','i4']);
 assert.equal(report.provenance.source,'in_game_weekly_summary');
 assert.equal(report.provenance.noUnmodeledEvents,false);
 assert.equal(report.capture.appVersion,fs.readFileSync(path.join(base,'index.template.html'),'utf8').match(/STEP 4 · v(\d+\.\d+\.\d+)/)[1]);
 assert.equal(report.capture.screenshotReviewedByApp,false);
 assert.equal(report.observed.total,1000);
 assert.equal(report.observed.berryAndStrengthSkill,600);
 assert.equal(report.observed.cooking,400);
});

test('import of observed-week JSON replays archived roster without changing current browser storage',async()=>{
 const app=boot(),blobs=[];
 app.ctx.URL={createObjectURL(blob){blobs.push(blob);return 'blob:review-test';},revokeObjectURL(){}};
 app.callbacks.get('fillAllRosters:click')();
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 app.items.get('obsMonday').value='2026-10-19';
 app.items.get('obsTotal').value='1000';
 app.items.get('obsBerry').value='600';
 app.items.get('obsCooking').value='400';
 app.items.get('obsConfirmedSummary').checked=true;
 app.callbacks.get('downloadObservation:click')();
 assert.equal(blobs.length,1);
 const savedJSON=await blobs[0].text();
 const savedLocalStorage=app.data.get('pokesleep-event-planner/step1/v1');
 const inputFile=app.items.get('observationFile');
 inputFile.files=[{size:savedJSON.length,text:async()=>savedJSON}];
 await app.callbacks.get('observationFile:change')({target:inputFile});
 assert.equal(app.items.get('obsImportError').hidden,true,app.items.get('obsImportError').textContent);
 const visible=app.items.get('obsImportResult').children.map(p=>p.textContent).join('\n');
 assert.match(visible,/対象週：2026-10-19/);
 assert.match(visible,/記録時の試算と現行モデル：一致/);
 assert.match(visible,/実ゲームの単週観測です/);
 assert.match(visible,/STEP2 HOLD/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),savedLocalStorage);
 inputFile.files=[{size:5,text:async()=>'{'}];
 await app.callbacks.get('observationFile:change')({target:inputFile});
 assert.equal(app.items.get('obsImportError').hidden,false);
 assert.equal(app.items.get('obsImportResult').children.length,0);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),savedLocalStorage);
});


test('multiple weekly observations show duplicate warnings without altering storage',async()=>{
 const app=boot(),blobs=[];
 app.ctx.URL={createObjectURL(blob){blobs.push(blob);return 'blob:batch-test';},revokeObjectURL(){}};
 app.callbacks.get('fillAllRosters:click')();
 app.callbacks.get('runSim:click')();
 app.items.get('obsMonday').value='2026-10-19';
 app.items.get('obsTotal').value='1000';
 app.items.get('obsBerry').value='600';
 app.items.get('obsCooking').value='400';
 app.items.get('obsConfirmedSummary').checked=true;
 app.callbacks.get('downloadObservation:click')();
 const original=JSON.parse(await blobs[0].text());
 const second=JSON.parse(JSON.stringify(original));
 second.observed.total=1001;
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 const fileInput=app.items.get('observationFile');
 const asFile=value=>({size:JSON.stringify(value).length,text:async()=>JSON.stringify(value)});
 fileInput.files=[asFile(original),asFile(second)];
 await app.callbacks.get('observationFile:change')({target:fileInput});
 assert.equal(app.items.get('obsImportError').hidden,true,app.items.get('obsImportError').textContent);
 let visible=app.items.get('obsImportResult').children.map(x=>x.textContent).join('\n');
 assert.match(visible,/複数週の観測記録 2件/);
 assert.match(visible,/重複した対象週：2026-10-19/);
 assert.match(visible,/同一週でフィールドまたは週まとめ数値が矛盾/);
 assert.match(visible,/STEP2 HOLD/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
 fileInput.files=[asFile(original),{size:100,text:async()=>'{'}];
 await app.callbacks.get('observationFile:change')({target:fileInput});
 assert.equal(app.items.get('obsImportError').hidden,false);
 assert.equal(app.items.get('obsImportResult').children.length,0);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
});

test('S2-B: sleep party toggles immediately synchronize trial readiness without a reload',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 assert.equal(app.items.get('runSim').disabled,false);
 const click=()=>app.callbacks.get('pokemonList-virtual-add-i0:click')();
 click();
 assert.equal(app.items.get('runSim').disabled,true,'4 sleep members must block trial');
 assert.match(app.items.get('simRosterStatus').textContent,/睡眠 4\/5/);
 click();
 assert.equal(app.items.get('runSim').disabled,false,'restored 5 sleep members must allow trial');
 assert.match(app.items.get('simRosterStatus').textContent,/20枠が揃いました/);
});

test('S2-B: editing an event, team or food option flags old scores; a new run resets the warning',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simStaleNotice').hidden,true);
 app.items.get('simFieldBonus').value='15';
 app.callbacks.get('simFieldBonus:change')();
 assert.equal(app.items.get('simStaleNotice').hidden,false);
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simStaleNotice').hidden,true);
 app.items.get('eventMap').value='ゴールド旧発電所';
 app.callbacks.get('saveEvent:click')();
 assert.equal(app.items.get('simStaleNotice').hidden,false);
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simStaleNotice').hidden,true);
 const first=app.rosters.morning.querySelectorAll('select')[0];
 first.value='i1'; // swap i0 and i1 using an available unused individual
 // A team needs five unique members; the test can trigger a roster update
 // using a copy action, which also changes the underlying week conditions.
 app.callbacks.get('copy0:click')();
 assert.equal(app.items.get('simStaleNotice').hidden,false);
});

test('S2-B: CSV16-col import -> sleep five -> day rosters -> 7-day result -> JSON save',async()=>{
 const app=boot({noSleep:true});
 const headers=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3',
  'メインスキル','せいかく','Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い'];
 const rows=Array.from({length:5},(_,i)=>[
  'smoke'+i,'ライチュウ','30','3','とくせんリンゴ','','',
  'エナジーチャージS','まじめ','','','','','','0','false']);
 const csv=[headers.join(','),...rows.map(x=>x.join(','))].join('\r\n');
 const picker=app.items.get('csvFile');
 picker.files=[{size:csv.length,text:async()=>csv}];
 await app.callbacks.get('csvFile:change')({target:picker});
 assert.equal(app.items.get('importError').hidden,true,app.items.get('importError').textContent);
 assert.match(app.items.get('dataState').textContent,/5匹登録/);
 assert.equal(app.items.get('runSim').disabled,true);
 for(let i=1;i<=5;i++)app.callbacks.get('pokemonList-virtual-add-p-'+i+':click')();
 assert.equal(app.items.get('runSim').disabled,true,'day slots still unset');
 app.callbacks.get('fillAllRosters:click')();
 assert.equal(app.items.get('runSim').disabled,false);
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.match(app.items.get('simTotal').textContent,/エナジー/);
 assert.equal(app.items.get('simDaily').children.length,7);
 assert.equal(app.items.get('simNightEnergy').children.length,7);
 const state=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(state.box.length,5);
 assert.equal(state.sleepIds.length,5);
 for(const name of ['morning','noon','evening'])assert.equal(state.simulation.teams[name].length,5);
 assert.equal(app.ctx.PokeStorage.validateState(state).box.length,5);
 // Exercise actual backup download, clear and restoration through UI handlers.
 const blobs=[];
 app.ctx.URL={createObjectURL(blob){blobs.push(blob);return 'blob:smoke-backup';},revokeObjectURL(){}};
 app.callbacks.get('downloadBackup:click')();
 assert.equal(blobs.length,1);
 const backedUp=await blobs[0].text();
 assert.equal(JSON.parse(backedUp).box.length,5);
 app.callbacks.get('clearData:click')();
 assert.match(app.items.get('dataState').textContent,/0匹登録/);
 const restoredFile=app.items.get('backupFile');
 restoredFile.files=[{size:backedUp.length,text:async()=>backedUp}];
 await app.callbacks.get('backupFile:change')({target:restoredFile});
 const recovered=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(recovered.box.length,5);
 assert.equal(recovered.sleepIds.length,5);
 assert.deepEqual(recovered.simulation.teams,state.simulation.teams);
});

test('S2-A: a duplicate after multiple valid roster edits restores the latest saved slot',()=>{
 const app=boot({withSixth:true});
 app.callbacks.get('fillAllRosters:click')();
 const selects=app.rosters.morning.querySelectorAll('select');
 const change=index=>app.callbacks.get(selects[index].id+':change')();
 selects[0].value='i5';change(0); // originally i0
 selects[1].value='i0';change(1); // originally i1
 selects[0].value='i0';change(0); // duplicate with slot 2: reject
 assert.equal(selects[0].value,'i5','must revert to latest valid i5, not original i0');
 assert.deepEqual(JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'))
  .simulation.teams.morning,['i5','i0','i2','i3','i4']);
 assert.equal(new Set(selects.map(x=>x.value)).size,5);
 assert.equal(app.items.get('runSim').disabled,false);
});

test('audit: a failed weekly simulation does not replace last valid local settings',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 app.items.get('simBagCapacity').value='5';
 // Set enough certain initial food to exceed the five-slot shared bag.
 const apple=app.items.get('simIngredientFields').children.find(x=>
  x.children[0].textContent==='とくせんリンゴ');
 assert.ok(apple);
 apple.children[1].value='20';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,false);
 assert.match(app.items.get('simError').textContent,/食材バッグ容量/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before,
  'invalid weekly model input cannot overwrite the previous saved configuration');
});

test('audit: editing event map or meal category without saving cannot produce a misleading new score',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 const original=app.data.get('pokesleep-event-planner/step1/v1');
 app.items.get('eventMap').value='ゴールド旧発電所';
 app.callbacks.get('eventMap:change')();
 assert.equal(app.items.get('simStaleNotice').hidden,false);
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,false);
 assert.match(app.items.get('simError').textContent,/未保存/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),original);
 app.callbacks.get('saveEvent:click')();
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 assert.equal(app.items.get('simStaleNotice').hidden,true);
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(saved.event.map,'ゴールド旧発電所');
 app.items.get('food1').value='dessert';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,false);
 assert.match(app.items.get('simError').textContent,/未保存/);
});

test('S3-A browser: generate A/B/C, apply daylight-only and retain fixed sleep five',()=>{
 const app=boot({withSixth:true,withHealers:true});
 const before=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(app.items.get('autoCandidateList').children.length,0);
 app.callbacks.get('autoCandidates:click')();
 assert.equal(app.items.get('autoCandidateError').hidden,true,app.items.get('autoCandidateError').textContent);
 const cards=app.items.get('autoCandidateList').children;
 assert.ok(cards.length>=3,cards.length);
 const titles=cards.map(c=>c.children[0].textContent);
 assert.ok(titles.some(t=>t.startsWith('A：')),titles.join('; '));
 assert.ok(titles.some(t=>t.startsWith('B：')),titles.join('; '));
 assert.ok(titles.some(t=>t.startsWith('C')),titles.join('; '));
 assert.match(app.items.get('autoCandidateStatus').textContent,/別途STEP2計算器/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),JSON.stringify(before),
  'suggestions must not change any persisted personal settings');
 const candidate=cards.find(c=>c.children[0].textContent.startsWith('A：'));
 const apply=candidate.children[candidate.children.length-1];
 app.callbacks.get(apply.id+':click')();
 const after=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.deepEqual(after.sleepIds,before.sleepIds);
 const skills=app.ctx.PokeMaster.species;
 const healed=ids=>ids.filter(id=>{
  const p=after.box.find(p=>p.id===id);
  return app.ctx.PokeSimulator.isAllHealerSkill(skills.find(s=>s.name===p.pokemon)?.skill);
 }).length;
 assert.equal(healed(after.simulation.teams.morning),2);
 assert.equal(healed(after.simulation.teams.noon),1);
 assert.equal(healed(after.simulation.teams.evening),1);
 assert.equal(app.items.get('runSim').disabled,false);
});
test('S3-A browser: refuse stale candidate after sleep change and refuse unsaved event edits',()=>{
 const app=boot({withSixth:true,withHealers:true});
 app.items.get('eventMap').value='ワカクサ本島';
 app.callbacks.get('autoCandidates:click')();
 assert.equal(app.items.get('autoCandidateError').hidden,false);
 assert.match(app.items.get('autoCandidateError').textContent,/未保存/);
 app.callbacks.get('saveEvent:click')();
 app.callbacks.get('autoCandidates:click')();
 assert.equal(app.items.get('autoCandidateError').hidden,true);
 const cards=app.items.get('autoCandidateList').children;
 assert.ok(cards.length);
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 app.callbacks.get('pokemonList-virtual-add-i0:click')();
 const afterSleep=app.data.get('pokesleep-event-planner/step1/v1');
 assert.notEqual(before,afterSleep);
 const apply=cards[0].children.at(-1);
 app.callbacks.get(apply.id+':click')();
 assert.equal(app.items.get('autoCandidateError').hidden,false);
 assert.match(app.items.get('autoCandidateError').textContent,/再生成/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),afterSleep,
  'stale candidate must not overwrite user manual daytime teams');
});

test('S3-B browser: comparison runs bounded real-engine-shaped trials without mutating storage or observation',()=>{
 const app=boot({withSixth:true,withHealers:true});
 const seen=[];
 app.ctx.PokeSimulator.simulate=input=>{
  seen.push(JSON.parse(JSON.stringify(input)));
  const morning=input.teams.morning.filter(id=>['i0','i1'].includes(id)).length;
  const total=100000+morning*1000+input.options.fieldBonus*100;
  return {total,berries:total*.5,cooking:total*.3,skills:total*.2,
   estimatedMeals:1,warningCount:1,warnings:['料理の独立確率は未検証']};
 };
 app.callbacks.get('autoCandidates:click')();
 const oldData=app.data.get('pokesleep-event-planner/step1/v1');
 const count=app.items.get('autoCandidateList').children.length;
 assert.ok(count>=3);
 app.callbacks.get('autoCompare:click')();
 assert.equal(app.items.get('autoCompare').disabled,true);
 app.flushTimers();
 assert.equal(app.items.get('autoCompare').disabled,false);
 assert.equal(seen.length,count);
 assert.ok(seen.length<=6);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),oldData);
 assert.match(app.items.get('autoCompareProgress').textContent,/比較終了/);
 assert.match(app.items.get('autoCompareProgress').textContent,/実ゲーム順位は未検証/);
 const cards=app.items.get('autoCandidateList').children;
 assert.ok(cards.every(c=>c.children.some(x=>/週間モデル予測/.test(x.textContent))));
 assert.ok(cards.every(c=>c.children.some(x=>/参考値・実ゲーム順位未検証/.test(x.textContent))));
 assert.ok(seen.every(x=>x.teams.sleep.length===5));
 assert.ok(seen.every(x=>x.options.tapMinutes===150));
});
test('S3-C browser: updating ingredients invalidates compared scores without clearing candidate roster',()=>{
 const app=boot({withSixth:true,withHealers:true});
 app.ctx.PokeSimulator.simulate=()=>({
  total:100,berries:50,cooking:30,skills:20,warnings:[]});
 app.callbacks.get('autoCandidates:click')();
 app.callbacks.get('autoCompare:click')();
 app.flushTimers();
 const count=app.items.get('autoCandidateList').children.length;
 assert.ok(count>0);
 assert.ok(app.items.get('autoCandidateList').children.every(c=>
  c.children.some(x=>x.textContent.includes('週間モデル予測'))));
 app.items.get('simFieldBonus').value='20';
 app.callbacks.get('simFieldBonus:change')();
 assert.equal(app.items.get('autoCandidateList').children.length,count);
 assert.ok(app.items.get('autoCandidateList').children.every(c=>
  !c.children.some(x=>x.textContent.includes('週間モデル予測'))));
 assert.equal(app.items.get('autoCompare').disabled,false);
 app.callbacks.get('autoCompare:click')();
 app.flushTimers();
 assert.match(app.items.get('autoCompareProgress').textContent,/比較終了/);
});
test('S3-B browser: not-yet-filled daytime rosters do not block candidate comparison',()=>{
 const app=boot({withSixth:true,withHealers:true});
 assert.equal(app.items.get('runSim').disabled,true,'manual day roster starts unset');
 app.ctx.PokeSimulator.simulate=()=>({
  total:500,berries:200,cooking:100,skills:200,warnings:[]});
 app.callbacks.get('autoCandidates:click')();
 app.callbacks.get('autoCompare:click')();
 app.flushTimers();
 assert.match(app.items.get('autoCompareProgress').textContent,/比較終了/);
 assert.equal(app.items.get('runSim').disabled,true,'automated comparison must not alter manual rosters');
});

test('audit S3 UI: full weekly simulator warning list is visible on demand',()=>{
 const app=boot({withSixth:true,withHealers:true});
 const messages=[
  'レシピと料理カテゴリが一致しません。料理エナジーを計上していません。',
  'フィールドの好みのきのみは未確定',
  '<img src=x onerror=alert(1)> HTML-like message must be plain text'
 ];
 app.ctx.PokeSimulator.simulate=()=>({
  total:1000,berries:500,cooking:300,skills:200,
  warnings:messages
 });
 app.callbacks.get('autoCandidates:click')();
 app.callbacks.get('autoCompare:click')();app.flushTimers();
 const cards=app.items.get('autoCandidateList').children;
 assert.ok(cards.length>0);
 for(const card of cards){
  const details=card.children.find(child=>child.tagName==='details');
  assert.ok(details,'all scored cards expose complete simulator warning details');
  assert.match(details.children[0].textContent,/3件/);
  assert.deepEqual(details.children.slice(1).map(p=>p.textContent),messages);
  assert.ok(details.children.every(x=>x.innerHTML===''));
 }
});
test('audit S3 UI: failing to persist proposed teams keeps previous in-memory and visible roster',()=>{
 const app=boot({withSixth:true,withHealers:true});
 app.callbacks.get('autoCandidates:click')();
 const cards=app.items.get('autoCandidateList').children;
 const candidate=cards.find(c=>c.children[0].textContent.startsWith('A：'));
 assert.ok(candidate);
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 const beforeDisplayed=app.rosters.morning.querySelectorAll('select').map(x=>x.value);
 app.setFailWrites(true);
 app.callbacks.get(candidate.children.at(-1).id+':click')();
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
 assert.deepEqual(app.rosters.morning.querySelectorAll('select').map(x=>x.value),beforeDisplayed);
 assert.match(app.items.get('autoCandidateError').textContent,/編成の保存に失敗/);
 app.setFailWrites(false);
 app.callbacks.get(candidate.children.at(-1).id+':click')();
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.deepEqual(saved.sleepIds,JSON.parse(before).sleepIds);
 assert.equal(saved.simulation.teams.morning.length,5);
});
test('audit S3 UI: invalid mid-run settings discard partial comparison and show explicit interruption',()=>{
 const app=boot({withSixth:true,withHealers:true});
 app.ctx.PokeSimulator.simulate=()=>({
  total:1000,berries:500,cooking:300,skills:200,warnings:[]});
 app.callbacks.get('autoCandidates:click')();
 app.callbacks.get('autoCompare:click')();
 app.tickTimer(); // one successful candidate evaluated
 app.items.get('simFieldBonus').value='not-a-number'; // intentionally no change event
 app.tickTimer(); // errors while re-reading the current input controls
 assert.match(app.items.get('autoCompareProgress').textContent,/途中の結果を破棄/);
 assert.ok(app.items.get('autoCandidateList').children.every(card=>
  !card.children.some(x=>x.textContent.includes('週間モデル予測'))));
 assert.equal(app.items.get('autoCompare').disabled,false);
});

test('audit S3 P1: native change Event argument never preserves a stale scored comparison',()=>{
 const app=boot({withSixth:true,withHealers:true});
 app.ctx.PokeSimulator.simulate=()=>({
  total:1000,berries:500,cooking:300,skills:200,warnings:[]});
 app.callbacks.get('autoCandidates:click')();
 app.callbacks.get('autoCompare:click')();app.flushTimers();
 assert.ok(app.items.get('autoCandidateList').children.every(card=>
  card.children.some(x=>x.textContent.includes('週間モデル予測'))));
 app.items.get('simFieldBonus').value='30';
 app.callbacks.get('simFieldBonus:change')({type:'change',target:app.items.get('simFieldBonus')});
 assert.ok(app.items.get('autoCandidateList').children.every(card=>
  !card.children.some(x=>x.textContent.includes('週間モデル予測'))));
 app.callbacks.get('autoCompare:click')();app.flushTimers();
 assert.ok(app.items.get('autoCandidateList').children.every(card=>
  card.children.some(x=>x.textContent.includes('週間モデル予測'))));
 app.items.get('food1').value='salad';
 app.callbacks.get('food1:change')({type:'change',target:app.items.get('food1')});
 assert.ok(app.items.get('autoCandidateList').children.every(card=>
  !card.children.some(x=>x.textContent.includes('週間モデル予測'))));
});

test('S4 browser: 21 apple curry meals produce saved prep goals but do not alter STEP3/daytime/sleep',()=>{
 const app=boot({withSixth:true,withHealers:true});
 const before=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepMeals').value='21';
 app.items.get('prepCapacity').value='200';
 app.items.get('prepPriority').value='stock';
 const apple=app.items.get('prepCarryFields').children.find(x=>x.children[0].textContent==='とくせんリンゴ');
 assert.ok(apple);
 apple.children[1].value='20';
 app.callbacks.get('prepCalculate:click')();
 assert.equal(app.items.get('prepError').hidden,true,app.items.get('prepError').textContent);
 assert.equal(app.items.get('prepResult').hidden,false);
 assert.match(app.items.get('prepSummary').textContent,/21食分/);
 assert.match(app.items.get('prepCoverage').textContent,/必要食材 147個/);
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(saved.preparation.recipeId,'apple_curry');
 assert.equal(saved.preparation.bagCapacity,200);
 assert.equal(saved.preparation.carryover.apple,20);
 assert.deepEqual(saved.sleepIds,before.sleepIds);
 assert.deepEqual(saved.simulation.teams,before.simulation?.teams||{morning:[],noon:[],evening:[]});
 assert.ok(app.items.get('prepTeams').textContent.includes('朝7:30～12:00'));
});
test('S4 browser: adding a second recipe sums meals, persists targets and rejects duplicates safely',()=>{
 const app=boot({withSixth:true});
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepMeals').value='10';
 app.items.get('prepCapacity').value='600';
 app.callbacks.get('prepAddRecipe:click')();
 const extra=app.items.get('prepExtraRecipes').children[0];
 assert.ok(extra);
 const choice=extra.children[0].children[1],count=extra.children[1].children[1];
 choice.value='curry_03';count.value='11';
 app.callbacks.get('prepCalculate:click')();
 assert.equal(app.items.get('prepError').hidden,true,app.items.get('prepError').textContent);
 assert.match(app.items.get('prepSummary').textContent,/2品・合計21食分/);
 assert.match(app.items.get('prepCoverage').textContent,/必要食材 235個/);
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.deepEqual(saved.preparation.recipeTargets,[{recipeId:'apple_curry',meals:10},{recipeId:'curry_03',meals:11}]);
 assert.equal(saved.preparation.recipeId,'apple_curry');
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 choice.value='apple_curry';
 app.callbacks.get(choice.id+':change')();
 assert.equal(app.items.get('prepStale').hidden,false);
 app.callbacks.get('prepCalculate:click')();
 assert.match(app.items.get('prepError').textContent,/重複/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
});
test('S4 browser: invalid/incomplete prep never overwrites saved plans',()=>{
 const app=boot();
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='0';
 app.callbacks.get('prepCalculate:click')();
 assert.equal(app.items.get('prepError').hidden,false);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
 app.items.get('prepCapacity').value='100';
 const apple=app.items.get('prepCarryFields').children.find(x=>x.children[0].textContent==='とくせんリンゴ');
 apple.children[1].value='101';
 app.callbacks.get('prepCalculate:click')();
 assert.match(app.items.get('prepError').textContent,/バッグ容量を超え/);
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
});
test('S4 browser: saved preparation is preserved across reload and priority switch',()=>{
 const app=boot();
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='100';
 app.items.get('prepPriority').value='energy';
 app.callbacks.get('prepCalculate:click')();
 const p=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1')).preparation;
 assert.equal(p.priority,'energy');
 assert.match(app.items.get('prepCoverage').textContent,/新たに集める目標 30個/);
 app.items.get('prepPriority').value='stock';
 app.callbacks.get('prepPriority:change')({type:'change'});
 assert.equal(app.items.get('prepStale').hidden,false);
 app.callbacks.get('prepCalculate:click')();
 const changed=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(changed.preparation.priority,'stock');
 assert.match(app.items.get('prepCoverage').textContent,/新たに集める目標 90個/);
 assert.equal(app.items.get('prepStale').hidden,true);
 const storage=app.ctx.PokeStorage.validateState(changed);
 assert.equal(storage.preparation.priority,'stock');
});
test('S4 browser: storage failure rolls preparation state back without false success',()=>{
 const app=boot();
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='150';
 const before=app.data.get('pokesleep-event-planner/step1/v1');
 app.setFailWrites(true);
 app.callbacks.get('prepCalculate:click')();
 assert.equal(app.data.get('pokesleep-event-planner/step1/v1'),before);
 assert.equal(app.items.get('prepError').hidden,false);
 assert.match(app.items.get('prepError').textContent,/保存できません/);
 assert.equal(app.items.get('prepResult').hidden,true);
 app.setFailWrites(false);
 app.callbacks.get('prepCalculate:click')();
 assert.equal(app.items.get('prepError').hidden,true);
});
test('S4 browser: preparation field forecast computes on demand and never edits event teams or sleep',()=>{
 const app=boot({withSixth:true});
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepMeals').value='7';
 app.items.get('prepCapacity').value='200';
 app.items.get('prepField').value='シアンの砂浜';
 app.items.get('prepFieldBonus').value='18';
 const original=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 app.callbacks.get('prepForecast:click')();
 assert.equal(app.items.get('prepForecast').disabled,true);
 assert.match(app.items.get('prepForecastStatus').textContent,/試算中/);
 app.flushTimers();
 assert.equal(app.items.get('prepForecast').disabled,false);
 assert.equal(app.items.get('prepForecastResult').hidden,false,app.items.get('prepForecastStatus').textContent);
 assert.match(app.items.get('prepForecastSummary').textContent,/シアンの砂浜.*18%/);
 assert.match(app.items.get('prepForecastSummary').textContent,/期待値/);
 assert.ok(app.items.get('prepForecastWarnings').children.some(x=>x.textContent.includes('料理を一切せず')));
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(saved.preparation.field,'シアンの砂浜');
 assert.equal(saved.preparation.fieldBonus,18);
 assert.deepEqual(saved.sleepIds,original.sleepIds);
 assert.deepEqual(saved.simulation.teams,original.simulation?.teams||{morning:[],noon:[],evening:[]});
 app.items.get('prepFieldBonus').value='19';
 app.callbacks.get('prepFieldBonus:change')({type:'change'});
 assert.equal(app.items.get('prepForecastResult').hidden,true);
 assert.equal(app.items.get('prepStale').hidden,false);
 app.items.get('prepFieldBonus').value='18';
 app.callbacks.get('prepForecast:click')();app.flushTimers();
 assert.equal(app.items.get('prepForecastResult').hidden,false);
 // The reference forecast also depends on the STEP2 collection settings.
 app.callbacks.get('simTap:change')({type:'change'});
 assert.equal(app.items.get('prepForecastResult').hidden,true);
});
test('S4 browser: preparation forecast refuses missing field without false completion',()=>{
 const app=boot();
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='100';
 app.callbacks.get('prepForecast:click')();app.flushTimers();
 assert.equal(app.items.get('prepForecastResult').hidden,true);
 assert.match(app.items.get('prepForecastStatus').textContent,/フィールドを指定/);
});
test('S4 browser: saved cooking scenario shows modeled week-end stock and energy separately',()=>{
 const app=boot();
 app.callbacks.get('fillAllRosters:click')();
 app.items.get('simRecipe').value='apple_curry';
 app.callbacks.get('runSim:click')();
 assert.equal(app.items.get('simError').hidden,true,app.items.get('simError').textContent);
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='600';
 app.items.get('prepField').value='シアンの砂浜';
 app.items.get('prepForecastCooking').value='saved';
 app.items.get('prepForecastFoodMode').value='curry';
 app.items.get('prepForecastStockSource').value='simulation';
 app.callbacks.get('prepForecast:click')();app.flushTimers();
 assert.equal(app.items.get('prepForecastResult').hidden,false,app.items.get('prepForecastStatus').textContent);
 assert.match(app.items.get('prepForecastSummary').textContent,/料理あり/);
 assert.match(app.items.get('prepForecastSummary').textContent,/週間エナジー参考値/);
 assert.ok(app.items.get('prepForecastIngredients').children.some(x=>x.children[1]?.textContent.includes('週末在庫期待')));
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.equal(saved.preparation.forecastCooking,'saved');
 assert.equal(saved.preparation.forecastFoodMode,'curry');
 assert.equal(saved.preparation.forecastInventorySource,'simulation');
});
test('S4 browser: two-mode comparison displays both reference outcomes and invalidates on edits',()=>{
 const app=boot({withSixth:true});
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='100';
 app.items.get('prepField').value='シアンの砂浜';
 const original=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 app.callbacks.get('prepCompare:click')();
 assert.equal(app.items.get('prepCompare').disabled,true);
 assert.match(app.items.get('prepCompareStatus').textContent,/比較|試算中/);
 app.flushTimers();
 assert.equal(app.items.get('prepCompare').disabled,false);
 assert.equal(app.items.get('prepCompareResult').hidden,false,app.items.get('prepCompareStatus').textContent);
 assert.equal(app.items.get('prepCompareRows').children.length,2);
 assert.match(app.items.get('prepCompareRows').children[0].children[0].textContent,/今週のエナジー優先/);
 assert.match(app.items.get('prepCompareRows').children[0].children[1].textContent,/準備週エナジー参考値/);
 assert.ok(app.items.get('prepCompareWarnings').children.some(x=>x.textContent.includes('最適化の証明')));
 const saved=JSON.parse(app.data.get('pokesleep-event-planner/step1/v1'));
 assert.deepEqual(saved.sleepIds,original.sleepIds);
 assert.deepEqual(saved.simulation.teams,original.simulation?.teams||{morning:[],noon:[],evening:[]});
 app.items.get('prepCapacity').value='101';
 app.callbacks.get('prepCapacity:change')({type:'change'});
 assert.equal(app.items.get('prepCompareResult').hidden,true);
});

test('failed event and simulation saves do not leak into later preparation saves',()=>{
 const app=boot();
 const key='pokesleep-event-planner/step1/v1';
 const original=JSON.parse(app.data.get(key));
 app.items.get('eventName').value='UNSAVED-EVENT';
 app.setFailWrites(true);app.callbacks.get('saveEvent:click')();
 assert.equal(app.items.get('storageNotice').className,'small warn');
 app.setFailWrites(false);
 assert.equal(app.items.get('dataState').textContent.includes('UNSAVED-EVENT'),false);
 app.items.get('eventName').value=original.event.name;
 app.callbacks.get('fillAllRosters:click')();
 const savedBefore=JSON.parse(app.data.get(key));
 app.items.get('simFieldBonus').value='33';
 app.setFailWrites(true);app.callbacks.get('runSim:click')();
 app.setFailWrites(false);
 assert.equal(app.items.get('simError').hidden,false);
 app.items.get('prepRecipe').value='apple_curry';
 app.items.get('prepCapacity').value='100';
 app.callbacks.get('prepCalculate:click')();
 const savedAfter=JSON.parse(app.data.get(key));
 assert.equal(savedAfter.event.name,original.event.name);
 assert.equal(savedAfter.simulation.fieldBonus,savedBefore.simulation.fieldBonus);
});
test('failed sleep and daytime bulk edits restore previously saved rosters',()=>{
 const app=boot({withSixth:true});
 const key='pokesleep-event-planner/step1/v1';
 const before=JSON.parse(app.data.get(key));
 app.setFailWrites(true);
 app.callbacks.get('pokemonList-virtual-add-i0:click')();
 app.callbacks.get('fillAllRosters:click')();
 app.setFailWrites(false);
 const after=JSON.parse(app.data.get(key));
 assert.deepEqual(after.sleepIds,before.sleepIds);
 assert.deepEqual(after,before,'failed edits must not change persistent backup');
});

test('failed destructive clear retains stored box, sleep team and event in active UI',()=>{
 const app=boot();
 const key='pokesleep-event-planner/step1/v1';
 const before=JSON.parse(app.data.get(key));
 app.setFailWrites(true);app.callbacks.get('clearData:click')();
 app.setFailWrites(false);
 const after=JSON.parse(app.data.get(key));
 assert.deepEqual(after.box,before.box);
 assert.deepEqual(after.sleepIds,before.sleepIds);
 assert.deepEqual(after.event,before.event);
 assert.equal(app.items.get('boxTotal').textContent,before.box.length+'匹');
 assert.equal(app.items.get('eventName').value,before.event.name);
});

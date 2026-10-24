const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../src');
function boot({noSleep=false}={}){
 const items=new Map(),callbacks=new Map();let serial=0;
 function element(tag='div',id){
  const e={id:id||'generated-'+(++serial),tagName:tag,children:[],dataset:{},hidden:false,checked:false,disabled:false,files:[],className:'',classList:{toggle(){},add(){},remove(){}},
   _value:'',get value(){return this._value},set value(v){this._value=String(v)},
   _html:'',get innerHTML(){return this._html},set innerHTML(v){this._html=String(v);this.children=[]},
   textContent:'',setAttribute(){},addEventListener(n,f){callbacks.set(this.id+':'+n,f)},append(...a){this.children.push(...a)},appendChild(v){this.children.push(v)},replaceChildren(...a){this.children=[...a]},
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
 const tabs=['event','box','simulate','settings'].map(k=>{const x=element('button','tab'+k);x.dataset.tab=k;return x});
 const panels=['event','box','simulate','settings'].map(k=>element('div','panel-'+k));
 const copy=['sleep','morning','noon'].map((from,i)=>{const x=element('button','copy'+i);x.dataset.copyFrom=from;x.dataset.copyTo=['morning','noon','evening'][i];return x});
 const headerVersion=element('span','headerVersion');headerVersion.textContent='STEP 2 · v0.2.44';
 const document={getElementById:id=>items.get(id)||element('input',id),querySelectorAll:s=>s==='.tab'?tabs:s==='.panel'?panels:s==='.sim-copy'?copy:[],
  querySelector:s=>{if(s==='.step-mark')return headerVersion;const m=s.match(/data-roster="([^"]+)"/);return m?rosters[m[1]]:null},createElement:tag=>element(tag),body:{appendChild(){}}};
 const one={id:'i0',pokemon:'ライチュウ',nickname:'test',level:60,skillLevel:6,ingredients:['とくせんリンゴ','あったかジンジャー','とくせんエッグ'],mainSkill:'エナジーチャージS',nature:'さみしがり',subskills:['きのみの数S','','','',''],sleepHours:1000,shiny:false};
 const box=Array.from({length:5},(_,i)=>({...one,id:'i'+i}));const ids=box.map(x=>x.id);
 const event={name:'test',start:'2026-10-19',duration:1,map:'シアンの砂浜',food1:'curry',food2:'random',berries:'',effects:'',campPrep:false,camp1:false,camp2:false};
 const data=new Map([['pokesleep-event-planner/step1/v1',JSON.stringify({version:1,box,sleepIds:noSleep?[]:ids,event,updatedAt:''})]]);
 const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 // Freeze the browser clock AFTER the fixture's target game week (Oct 19-26).
 // CI must not depend on the wall-clock date of this test run.
 class TestDate extends Date{
  constructor(...args){super(...(args.length?args:['2026-11-10T00:00:00.000Z']));}
  static now(){return Date.parse('2026-11-10T00:00:00.000Z');}
 }
 const ctx={document,localStorage,confirm:()=>true,alert:()=>{},URL,Blob,
  Date:TestDate,setTimeout:()=>1,clearTimeout(){}};
 ctx.globalThis=ctx;ctx.window=ctx;
 vm.createContext(ctx);
 for(const name of ['csv.js','storage.js','master.js','recipes.js','ingredient-distribution.js','simulator.js','observation.js','app.js'])
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
 assert.equal(report.capture.appVersion,'0.2.44');
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

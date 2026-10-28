const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function load(name){const module={exports:{}};const code=fs.readFileSync(path.join(__dirname,'..','src',name),'utf8');vm.runInNewContext(code,{module,globalThis:{}},{filename:name});return module.exports;}
const {parseBoxText,parseDelimited}=load('csv.js');
const {validateState,newState,reconcileSleepIds}=load('storage.js');
const HDR=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3','メインスキル','せいかく','Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い'];
const r=['おネキ','ライチュウ','60','6','とくせんリンゴ','あまいミツ','とくせんリンゴ','エナジーチャージS','さみしがり','きのみの数S','おてつだいボーナス','','','','1000','0'];
const row=(values,sep=',')=>values.map(s=>String(s).includes(sep)||String(s).includes('"')||String(s).includes('\n')?'"'+String(s).replaceAll('"','""')+'"':s).join(sep);
const sample=(rows=[r],sep=',')=>'\uFEFF'+[HDR,...rows].map(v=>row(v,sep)).join('\r\n');
test('16-column CSV BOM+CRLF and mixed nickname',()=>{let d=parseBoxText(sample());assert.equal(d.items.length,1);assert.equal(d.items[0].pokemon,'ライチュウ');assert.equal(d.items[0].sleepHours,1000);});
test('same-nickname separate individuals and stable row keys',()=>{let d=parseBoxText(sample([r,r]));assert.equal(d.items.length,2);assert.notEqual(d.items[0].id,d.items[1].id);});
test('quoted commas, escaped quotes and embedded newline',()=>{let a=[...r];a[0]='ぽこ,"あ"\n2号';let d=parseBoxText(sample([a]));assert.equal(d.items[0].nickname,a[0]);});
test('TSV accepted',()=>{let d=parseBoxText(sample([r],'\t'));assert.equal(d.format,'TSV');});
test('invalid row aborts import with row number',()=>{let bad=[...r];bad[2]='不明';assert.throws(()=>parseBoxText(sample([r,bad])),/3行目/);});
test('invalid columns rejected',()=>{assert.throws(()=>parseBoxText('a,b\nc,d'),/16列/);});
test('unclosed CSV quotes rejected',()=>{assert.throws(()=>parseBoxText(sample()+'\n"unfinished'),/引用符/);});
test('backup validation rejects unknown format, duplicate ids, invalid sleep count',()=>{let s=newState();assert.equal(validateState(s).version,1);assert.throws(()=>validateState({version:2}),/対応していない/);const p=parseBoxText(sample()).items[0];s.box=[{...p,id:'x'},{...p,id:'x',level:6}];assert.throws(()=>validateState(s),/重複/);});

test('reject extra quote and trailing data after a closed quoted field',()=>{
 let a=[...r];a[0]='a"b';
 assert.throws(()=>parseBoxText([HDR.join(','),a.join(',')].join('\n')),/引用符/);
 const malformed=sample().replace('"おネキ"','"おネキ"garbage');
 assert.throws(()=>parseDelimited('"a"garbage,b',','),/引用符/);
});
test('do not silently reinterpret unknown shiny values',()=>{
 const a=[...r];a[15]='かもしれない';assert.throws(()=>parseBoxText(sample([a])),/色違い/);
});
test('preserve sleep team across row reordering',()=>{
 const a=[...r],b=[...r];b[0]='別個体';b[2]='45';
 const original=parseBoxText(sample([a,b]));const next=parseBoxText(sample([b,a]));
 const state=newState();state.box=original.items;state.sleepIds=[original.items[0].id];
 assert.deepEqual(Array.from(reconcileSleepIds(state,next.items)),[next.items[1].id]);
});
test('preserve uniquely identifiable level-up, but not ambiguous duplicates',()=>{
 const a=[...r],up=[...r];up[2]='61';
 let old=parseBoxText(sample([a])),newer=parseBoxText(sample([up]));
 const state=newState();state.box=old.items;state.sleepIds=[old.items[0].id];
 assert.deepEqual(Array.from(reconcileSleepIds(state,newer.items)),[newer.items[0].id]);
 const different=[...r];different[2]='50';
 newer=parseBoxText(sample([up,different]));
 assert.equal(reconcileSleepIds(state,newer.items).length,0);
});
test('never silently match one of multiple exact fingerprint duplicates on CSV reimport',()=>{
 const old=parseBoxText(sample([r,r]));
 const state=newState();state.box=old.items;state.sleepIds=[old.items[1].id];
 // One of two indistinguishable individuals disappeared. The remaining row
 // cannot be identified as the selected individual, even though every field
 // of its 16-column export is identical.
 const remaining=parseBoxText(sample([r]));
 assert.deepEqual(Array.from(reconcileSleepIds(state,remaining.items)),[]);
 // A refreshed export with two indistinguishable rows is equally ambiguous;
 // the fact that their row-derived IDs happen to match proves nothing.
 const reordered=parseBoxText(sample([r,r]));
 assert.deepEqual(Array.from(reconcileSleepIds(state,reordered.items)),[]);
 const unique=parseBoxText(sample([r]));
 const identifiable=newState();identifiable.box=unique.items;identifiable.sleepIds=[unique.items[0].id];
 assert.equal(reconcileSleepIds(identifiable,remaining.items).length,1);
});
test('validateState rejects missing arrays, foreign party IDs and event corruptions',()=>{
 const s=newState();s.box=parseBoxText(sample()).items;s.sleepIds=['not-found'];
 assert.throws(()=>validateState(s),/睡眠パーティ/);
 s.sleepIds=[s.box[0].id];s.box[0].ingredients=undefined;
 assert.throws(()=>validateState(s),/ポケモンデータ/);
 s.box=parseBoxText(sample()).items;s.event.campPrep='yes';
 assert.throws(()=>validateState(s),/イベント設定/);
});
test('load error never overwrites corrupted local storage before explicit recovery',()=>{
 const fs=require('node:fs');const vm=require('node:vm');
 const mod={exports:{}};const memory={};
 const storage={getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=String(v),removeItem:k=>delete memory[k]};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/storage.js'),'utf8'),{module:mod,globalThis:{},localStorage:storage});
 const api=mod.exports;memory[api.KEY]='{broken';
 const loaded=api.load();assert.equal(loaded.box.length,0);assert.ok(api.getLoadError());
 assert.throws(()=>api.save(api.newState()),/読み込めません/);
 assert.equal(memory[api.KEY],'{broken');
 api.allowRecovery();api.save(api.newState());assert.ok(memory[api.KEY].startsWith('{'));
});

const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function load(name){const module={exports:{}};const code=fs.readFileSync(path.join(__dirname,'..','src',name),'utf8');vm.runInNewContext(code,{module,globalThis:{}},{filename:name});return module.exports;}
const {parseBoxText,parseDelimited}=load('csv.js');
const {validateState,newState}=load('storage.js');
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
test('backup validation rejects unknown format, duplicate ids, invalid sleep count',()=>{let s=newState();assert.equal(validateState(s).version,1);assert.throws(()=>validateState({version:2}),/対応していない/);s.box=[{id:'x',pokemon:'ピカチュウ',level:5},{id:'x',pokemon:'ピカチュウ',level:6}];assert.throws(()=>validateState(s),/重複/);});

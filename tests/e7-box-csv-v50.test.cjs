'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../previews');
// The browser adapter is a classic script under a package with "type":"module".
 // Execute in an isolated CommonJS-compatible VM instead of relying on require(ESM).
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'e7-box-csv-v50.js'),'utf8'),sandbox);
 const parser=sandbox.module.exports;
const JP=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3','メインスキル','せいかく','まっしろミント',
 'Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い','お気に入り'];
const basic=['こだわり,ポケモン','ピカチュウ','50','5','とくせんリンゴ','あったかジンジャー','とくせんリンゴ','でんきショック','いじっぱり','1',
 'きのみの数S','おてつだいボーナス','','','', '500','0','💛'];
const csv=(head=JP,row=basic)=>head.join(',')+'\n'+row.map(x=>x.includes(',')?'"'+x.replaceAll('"','""')+'"':x).join(',');
test('E7 v50 actual 18-column Japanese exporter contract maps mint, Lv70/80, favorite by header',()=>{
 const result=parser.parseBox(csv());
 assert.equal(result.ok,true);
 assert.equal(result.variant,'current18');
 assert.equal(result.items.length,1);
 const x=result.items[0];
 assert.equal(x.nickname,'こだわり,ポケモン');
 assert.equal(x.pokemon,'ピカチュウ');assert.equal(x.level,50);assert.equal(x.skillLevel,5);
 assert.equal(x.ing2,'あったかジンジャー');assert.equal(x.mint,true);
 assert.equal(x.lv10,'きのみの数S');assert.equal(x.lv25,'おてつだいボーナス');
 assert.equal(x.lv70,'');assert.equal(x.lv80,'');assert.equal(x.ribbon,500);
 assert.equal(x.shiny,false);assert.equal(x.favorite,'💛');
});
test('E7 header mapping supports older 16-column headers without positional shifting',()=>{
 const omit=new Set(['まっしろミント','お気に入り']);
 const oldHead=JP.filter(k=>!omit.has(k));
 const oldRow=basic.filter((_,i)=>!omit.has(JP[i]));
 const got=parser.parseBox(csv(oldHead,oldRow));
 assert.equal(got.ok,true);assert.equal(got.variant,'header-mapped-16');
 assert.equal(got.items[0].mint,null);assert.equal(got.items[0].favorite,null);
 assert.equal(got.items[0].ribbon,500);assert.equal(got.items[0].shiny,false);
});
test('E7 transitional 17-column exporter (favorite before mint) preserves favorite without inventing mint',()=>{
 // Upstream 445bc1d084a1 (2026-10-27): favorites; mint added separately on Oct 29.
 const head=JP.filter(x=>x!=='まっしろミント');
 const row=basic.filter((_,i)=>JP[i]!=='まっしろミント');
 const got=parser.parseBox(csv(head,row));
 assert.equal(got.ok,true);assert.equal(got.variant,'header-mapped-17');
 assert.equal(got.items[0].mint,null);
 assert.equal(got.items[0].favorite,'💛');
 assert.equal(got.items[0].ribbon,500);
});
test('E7 reorders columns correctly, never uses fixed offsets',()=>{
 const indices=[8,0,12,17,9,11,16,1,2,3,4,5,6,7,10,13,14,15];
 const head=indices.map(i=>JP[i]),row=indices.map(i=>basic[i]);
 const got=parser.parseBox(csv(head,row));
 assert.equal(got.ok,true);
 assert.equal(got.items[0].mint,true);assert.equal(got.items[0].nickname,'こだわり,ポケモン');
 assert.equal(got.items[0].ribbon,500);
});
test('E7 unknown columns, duplicated aliases and missing required columns are rejected',()=>{
 assert.throws(()=>parser.parseBox(csv([...JP,'新規項目'],[...basic,'yes'])),/未対応の列/);
 const duplicate=[...JP];duplicate[17]='色違い';
 assert.throws(()=>parser.parseBox(csv(duplicate,basic)),/同じ意味の見出し/);
 const absent=JP.filter(x=>x!=='Lv70');
 assert.throws(()=>parser.parseBox(csv(absent,basic.slice(0,14).concat(basic.slice(15)))),/必要な列/);
});
test('E7 malformed quote and invalid row do not lead to partial adoption',()=>{
 assert.throws(()=>parser.parseBox(JP.join(',')+'\n"壊れた行,ピカチュウ'),/引用符/);
 const mixed=csv()+'\n'+basic.map((v,i)=>i===2?'BAD':v.includes(',')?'"'+v+'"':v).join(',');
 const r=parser.parseBox(mixed);
 assert.equal(r.ok,false);assert.equal(r.items.length,0);assert.equal(r.errors.length,1);
});
test('E7 parser handles quoted multiline field, CRLF and BOM',()=>{
 const input='\uFEFF'+JP.join(',')+'\r\n'+basic.map((x,i)=>i===0?'"改行\n名前"':x.includes(',')?'"'+x+'"':x).join(',')+'\r\n';
 const r=parser.parseBox(input);
 assert.equal(r.ok,true);assert.equal(r.items[0].nickname,'改行\n名前');
});
test('E7 all screens reference v50 and bridge; shell only has 3 independent tabs',()=>{
 const names=['U2_Prep_Local_Ingredients_20261109_v50_E7.html',
  'U3_Strategy_UI_20261109_v50_E7.html','U4_Box_Preview_20261109_v50_E7.html'];
 const frames=names.map(x=>fs.readFileSync(path.join(dir,x),'utf8'));
 for(const [i,s] of frames.entries()){
  assert.match(s.slice(s.indexOf('<title>'),s.indexOf('</title>')),/v50/);
  for(const n of names)assert.ok(s.includes(n),'stale E7 navigation in '+i+' '+n);
  assert.match(s,/e7-unified-bridge-v50\.js/);
  for(const m of s.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
   new vm.Script(m[1]);
 }
 assert.match(frames[1],/sleep:'00:00'/);
 assert.match(frames[1],/calendarDay=slot==='sleep'\?day\+1:day/);
 assert.match(frames[1],/e6DuplicateBerryControlIds\(\)/);
 assert.match(frames[1],/localStorage\.setItem\(E3_SELECTED_KEY,JSON\.stringify\(selection\)\)/);
 assert.doesNotMatch(frames[1],/addEventListener\('click'.*openEdit\(\s*\w+\s*,\s*'morning'/);
 const shell=fs.readFileSync(path.join(dir,'U5_Integrated_20261109_v50_E7.html'),'utf8');
 for(const m of shell.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 assert.match(shell,/now<start\?'prep'/);
 assert.match(shell,/event\.source!==frame\.contentWindow/);
 assert.match(shell,/history\.pushState/);
 assert.doesNotMatch(shell,/pokesleepStock',JSON\.stringify/);
});

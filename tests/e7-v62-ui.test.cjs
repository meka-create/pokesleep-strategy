'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'e7-preview');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
test('E7 v62 shared roster template and protected Box UI contracts',()=>{
 const u3=read('U3_Strategy_UI_20261109_v50_E7.html');
 const box=read('U4_Box_Preview_20261109_v50_E7.html');
 const css=read('e7-box-detail-v60.css');
 assert.match(u3,/className='mon-level'/);
 assert.match(u3,/tile\.append\(lv,icon,label\)/);
 assert.match(u3,/MOCK_STATUS\[id\]\?\.\[0\]/);
 assert.match(u3,/function renderSlots\([\s\S]*?roster\.append\(avatar\(id\)\)/);
 assert.match(u3,/function renderSleepSettings\([\s\S]*?group\.append\(avatar\(id\)\)/);
 assert.match(u3,/\.mon-level\{[^}]*font-size:10px;[^}]*margin:0 0 -1px/);
 assert.match(u3,/@media\(max-width:385px\)\{\.mon-level\{font-size:9px\}/);
 assert.match(u3,/\.avatar\{height:45px;width:45px/);
 assert.match(u3,/\.sleep-team-preview \.avatar\{width:42px;height:42px\}/);
 assert.match(box,/id="box-query" aria-label="検索" placeholder="検索"/);
 assert.match(box,/\.sort\(\(a,b\)=>b\.item\.level-a\.item\.level\|\|a\.index-b\.index\)/);
 assert.match(box,/icon\.addEventListener\('click',\(\)=>openDetail\(index\)\)/);
 assert.match(box,/items:box\.items\.filter\(\(_,i\)=>i!==selectedIndex\)/);
 assert.match(box,/class="actions import-actions"/);
 assert.match(box,/\.import-actions \.btn\{height:38px;min-height:38px/);
 assert.doesNotMatch(box,/id="box-detail-dismiss"/);
 assert.match(css,/#box-delete\{height:32px;min-height:32px/);
 assert.match(read('e7-sw-v50.js'),/pokesleep-strategy-e7-v65-saved-event-calendar/);
 assert.match(read('index.html'),/E7 v65/);
 for(const f of [u3,box]){
  for(const m of f.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g))
   assert.doesNotThrow(()=>new vm.Script(m[1]));
 }
});
test('E7 v62 PokeAPI form map uses the correct eight variants (no guessed IDs)',()=>{
 const spec=read('e7-species-v59.js'),sprites=read('e7-sprites-v59.js');
 const ctx={window:{},Map,Set,Object,Number,Array,JSON,String};
 vm.runInNewContext(spec,ctx);vm.runInNewContext(sprites,ctx);
 const url=name=>ctx.window.PokeSprite.spriteUrl({pokemon:name,shiny:false});
 const names=[
 ['バケッチャ（こだましゅ）',10027],['バケッチャ（ちゅうだましゅ）',710],
 ['バケッチャ（おおだましゅ）',10028],['バケッチャ（ギガだましゅ）',10029],
 ['パンプジン（こだましゅ）',10030],['パンプジン（ちゅうだましゅ）',711],
 ['パンプジン（おおだましゅ）',10031],['パンプジン（ギガだましゅ）',10032]
 ];
 for(const [name,id] of names)assert.ok(url(name).endsWith('/'+id+'.png'),name+': '+url(name));
 assert.equal(url('パンプジン（未知）'),'');
 assert.ok(url('タマザラシ（ホリデー）').endsWith('/363.png'));
});
test('E7 v62 browser: descending sort, controls, correct deletion and strategy levels',{timeout:120000},()=>{
 require('node:child_process').execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v62.py')],{
  cwd:root,timeout:115000,stdio:'pipe'
 });
});

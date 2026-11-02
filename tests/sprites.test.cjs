const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/sprites.js','utf8');
function fixture(extra={}){
 const root={PokeMaster:{species:[{id:1,name:'フシギダネ'},{id:25,name:'ピカチュウ'},{id:37,name:'ロコン'}]},...extra};
 const ctx={window:root,fetch:extra.fetch,URL:extra.URL||URL,Response,Date,setTimeout,clearTimeout};
 vm.runInNewContext(source,ctx);
 return root.PokeSprite;
}
test('ordinary, shiny, verified regional forms and unknown costumes are mapped safely',()=>{
 const api=fixture();
 const normal=api.spriteUrl({pokemon:'フシギダネ',shiny:false});
 assert.equal(normal,'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png');
 assert.equal(api.spriteUrl({pokemon:'フシギダネ',shiny:true}),normal.replace('/1.png','/shiny/1.png'));
 assert.match(api.spriteUrl({pokemon:'ロコン (アローラ)'}),/10103\.png$/);
 assert.match(api.spriteUrl({pokemon:'ウパー (パルデア)'}),/10253\.png$/);
 assert.equal(api.spriteUrl({pokemon:'ピカチュウ (ハロウィン)'}),'');
 assert.equal(api.spriteUrl({pokemon:'未登録ポケモン'}),'');
 assert.match(api.icon({pokemon:'ピカチュウ (ハロウィン)'}),/is-fallback/);
 assert.match(api.icon({pokemon:'フシギダネ'}),/data-sprite-url/);
});
test('visible sprites are throttled, duplicate URLs share a single request',async()=>{
 const calls=[],cacheContents=new Map(),applied=[];
 let blobSerial=0;
 const fakeCache={match:async url=>cacheContents.get(url),put:async(url,r)=>{cacheContents.set(url,r)},delete:async url=>cacheContents.delete(url)};
 const sprites=fixture({
  caches:{open:async()=>fakeCache},
  URL:{createObjectURL:()=>('blob:test-'+(++blobSerial))},
  fetch:async url=>{
   calls.push({url,at:Date.now()});
   return new Response(new Blob(['png'],{type:'image/png'}),{status:200,headers:{'Content-Type':'image/png'}});
  }
 });
 const makeImg=url=>{
  let value='';
  const img={dataset:{spriteUrl:url},isConnected:true,closest:()=>({classList:{add(){},remove(){}}}),
   set src(v){value=v;applied.push(v);queueMicrotask(()=>img.onload?.())},get src(){return value}};
  return img;
 };
 const a='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png';
 const b='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
 const imgs=[makeImg(a),makeImg(a),makeImg(b)];
 sprites.enhance({querySelectorAll:()=>imgs});
 await new Promise(r=>setTimeout(r,550));
 assert.equal(calls.filter(x=>x.url===a).length,1);
 assert.equal(calls.filter(x=>x.url===b).length,1);
 assert.equal(applied.length,3);
 assert.ok(calls[1].at-calls[0].at>=115,'remote requests should be spaced out');
 const cached=makeImg(a);
 sprites.enhance({querySelectorAll:()=>[cached]});
 assert.ok(cached.src.startsWith('blob:'));
 assert.equal(calls.length,2,'repeated image should not re-fetch');
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..','e7-preview');
const hash=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const names={
 'apple-touch-icon.png':'1d35b50fe89c20f82f1b0b6718a1be84a2388392',
 'favicon-16.png':'832307bb14ba84bc41fb4a923e3dbc45fcc21625',
 'favicon-32.png':'8564541dd46f48161d674f9abc612f2ad5470d8e',
 'favicon.ico':'e2e15e2b00c1d6fcde1e84ecfabbdcf240681edb',
 'icon-192.png':'2e58d243227ad5bc0c25b87ea58fafd6b98012d9',
 'icon-512.png':'d9ee94f2587532b625660f80f4415ac0657c4227',
 'icon-header-96.png':'d58c3ae9bae759ef20959437f7161f1b0bd5bfe1',
 'icon-maskable-192.png':'92f3b446a482f6b164573408cdcb139e9c852a56',
 'icon-maskable-512.png':'cfe7eb37484e8887f1a896d99f83a4e38119101b'
};
test('E7 v75 exact uploaded icon blob hashes (seven unchanged, two replaced)',()=>{
 for(const [name,expected] of Object.entries(names)){
  const bytes=fs.readFileSync(path.join(root,'icons',name));
  assert.equal(hash(bytes),expected,name+' must match the attached ZIP exactly');
 }
});
test('E7 v75 Pixel maskable PNG dimensions and signatures',()=>{
 for(const size of [192,512]){
  const bytes=fs.readFileSync(path.join(root,'icons','icon-maskable-'+size+'.png'));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),size);
  assert.equal(bytes.readUInt32BE(20),size);
 }
});
test('E7 v75 manifest, shell and service worker choose new Pixel assets',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'e7-manifest-v50.webmanifest'),'utf8'));
 const masks=manifest.icons.filter(x=>x.purpose==='maskable');
 assert.equal(masks.length,2);
 for(const size of [192,512]){
  const item=masks.find(x=>x.sizes===size+'x'+size);
  assert.ok(item);
  assert.equal(item.src,'icons/icon-maskable-'+size+'.png?v=20261112-pixel3-nocorner');
  assert.equal(item.type,'image/png');
 }
 const sw=fs.readFileSync(path.join(root,'e7-sw-v50.js'),'utf8');
 const shell=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(sw,/pokesleep-strategy-e7-v75-maskable-no-corner-blur-20261112/);
 for(const size of [192,512])assert.ok(sw.includes("'icons/icon-maskable-"+size+".png'"));
 assert.match(shell,/<title>ポケスリ作戦室 E7 v75<\/title>/);
 assert.match(shell,/href="e7-manifest-v50\.webmanifest\?v=20261112-pixel3-nocorner"/);
});
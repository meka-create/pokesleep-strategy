'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'../e7-preview');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const blobSha=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');

test('E7 v69 uses precisely the supplied icon in the common three-tab header',()=>{
 const bridge=read('e7-unified-bridge-v51.js'),icon=fs.readFileSync(path.join(root,'icons/icon-header-96.png'));
 assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(icon.readUInt32BE(16),96);
 assert.equal(icon.readUInt32BE(20),96);
 assert.equal(blobSha(icon),'d58c3ae9bae759ef20959437f7161f1b0bd5bfe1');
 assert.match(bridge,/icon\.src='icons\/icon-header-96\.png'/);
 assert.match(bridge,/icon\.className='e7-header-icon'/);
 assert.match(bridge,/titleNode\.textContent='ポケスリ作戦室'/);
 assert.match(bridge,/titleWrap\.querySelector\('\.sub,\.subbrand,\.smallcap'\)\?\.remove\(\)/);
 assert.match(bridge,/copy\.append\(eventNode\)/);
 assert.match(bridge,/caption\.textContent=name\|\|'for Pokémon Sleep'/);
 assert.match(bridge,/calendar\.toggleAttribute\('hidden',!name\)/);
 assert.match(bridge,/const name=isEventTab\?selectedEventHeader\(\)/);
 assert.match(bridge,/eventNode\.dataset\.kind=name\?'event':'default'/);
 assert.match(bridge,/titleWrap\.append\(copy\)/);
 assert.match(bridge,/wrap\.append\(more,menu\);header\.append\(wrap\)/);
 assert.match(bridge,/text-overflow:ellipsis/);
 assert.match(bridge,/flex:0 0 42px/);
 assert.doesNotThrow(()=>new vm.Script(bridge));
});
test('E7 v69 updates offline cache and installs the supplied PWA icons',()=>{
 const sw=read('e7-sw-v50.js'),html=read('index.html'),manifest=read('e7-manifest-v50.webmanifest');
 assert.match(sw,/pokesleep-strategy-e7-v79-food-layout-20261113/);
 assert.match(sw,/'icons\/icon-header-96\.png'/);
 assert.match(html,/<title>ポケスリ作戦室 E7 v78<\/title>/);
 assert.equal(blobSha(Buffer.from(read('e7-icon-v50.svg'),'utf8')),'14e99856886eaf0141ecf95d61b44c2493bc8c7b');
 assert.equal(JSON.parse(manifest).icons[0].src,'icons/icon-192.png');
});

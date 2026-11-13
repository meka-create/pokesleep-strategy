'use strict';
/* Pre-F2 independent source-contract guard. These are small public upstream
 * representative records, not the user's saved events or private Pokémon. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const U3=read('e7-preview/U3_Strategy_UI_20261109_v50_E7.html');
const SW=read('e7-preview/e7-sw-v50.js');
const ROADMAP=read('development/ROADMAP_CURRENT.md');
const records={
 bonus:[
  {name:'bountiful banquet week vol1',start:'2026-11-16T04:00:00',
   end:'2026-11-23T04:00:00',target:{specialty:'Ingredients'},
   effects:{extraIng:'nuts',ingredient:1,carryLimitAdd:10}},
  {name:'dream shard week 3',start:'2026-11-23T04:00:00',
   end:'2026-11-30T04:00:00',target:{},
   effects:{skillTrigger:1.25,dreamShard:1.5}}
 ],
 drowsy:[{name:'GSD',day:'2026-11-23',bonus:1.5},
  {name:'GSD',day:'2026-11-24',bonus:3}]
};
const malformed=[
 // Existing historical upstream shapes must not be silently stretched/shrunk.
 {name:'historical six days',start:'2025-12-29T04:00:00',end:'2026-01-04T04:00:00',target:{},effects:{}},
 {name:'historical 14 days',start:'2024-03-25T04:00:00',end:'2024-04-08T04:00:00',target:{},effects:{}},
 {name:'historical backwards',start:'2025-07-21T04:00:00',end:'2025-07-14T04:00:00',target:{},effects:{}},
 // Full 7-day local-clock dates are not enough if a timezone is attached.
 {name:'utc disguised as JST',start:'2026-11-16T04:00:00+00:00',end:'2026-11-23T04:00:00+00:00',target:{},effects:{}},
 {name:'JST suffix not an upstream time',start:'2026-11-16T04:00:00+09:00',end:'2026-11-23T04:00:00+09:00',target:{},effects:{}},
 {name:'shifted minutes',start:'2026-11-16T04:00:30',end:'2026-11-23T04:00:30',target:{},effects:{}},
 {name:'absent bonus details',start:'2026-11-16T04:00:00',end:'2026-11-23T04:00:00',target:{},effects:null},
 {name:'absent target',start:'2026-11-16T04:00:00',end:'2026-11-23T04:00:00',target:null,effects:{}}
];
function normalizer(){
 const from=U3.indexOf('function eventCandidateId(x){'),until=U3.indexOf('function currentEventChoice(){',from);
 assert(from>=0&&until>from,'E7 candidate normalizer was moved or deleted');
 const code=U3.slice(from,until);
 const environment={
  validWeek(value){
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
   const d=new Date(value+'T12:00:00Z');
   return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&d.getUTCDay()===1;
  },
  localizeEventName(key){return ({
   'bountiful banquet week vol1':'なんでもペロリ！ごちそうウィーク vol.1',
   'dream shard week 3':'ゆめのかけらGETウィーク vol.3'
  })[key]||key;}
 };
 return vm.runInNewContext(code+';normalizeEventCandidates;',environment);
}
test('pre-F2: source URL and roadmap both point to actual upstream paths',()=>{
 assert.match(U3,/https:\/\/raw\.githubusercontent\.com\/nitoyon\/pokesleep-tool\/main\/src\/data\/event\.json/);
 assert.match(ROADMAP,/src\/data\/event\.json/);
 assert.match(ROADMAP,/src\/i18n\/ja\/events\.json/);
 assert.match(ROADMAP,/last-known-good/);
});
test('pre-F2: accepted weekly bonuses have 04:00 JST boundaries, distinct from drowsy daily rows',()=>{
 const actual=JSON.parse(JSON.stringify(normalizer()(records)));
 assert.equal(actual.length,2);
 const banquet=actual.find(x=>x.sourceKey==='bountiful banquet week vol1');
 assert.equal(banquet.id,'pokesleep-tool:bountiful banquet week vol1:2026-11-16');
 assert.equal(banquet.start,'2026-11-16');
 assert.equal(banquet.end,'2026-11-23');
 assert.equal(banquet.foodAll,true);
 assert.equal(banquet.eligibleFields,null,'a species target never confirms an island');
 assert.equal(banquet.unknownEffects,true,'unimplemented effect remains visibly unverified');
 assert(!actual.some(x=>x.sourceKey==='GSD'),'drowsy power must not become a weekly event');
 assert.equal(actual.find(x=>x.sourceKey==='dream shard week 3').name,'ゆめのかけらGETウィーク vol.3');
});
test('pre-F2: 6/14/reversed days, unexpected offset, seconds and missing shapes cannot become confirmed candidates',()=>{
 const normalize=normalizer();
 const mixed=JSON.parse(JSON.stringify(normalize({bonus:[...records.bonus,...malformed]})));
 assert.equal(mixed.length,2,'unsafe weekly candidates escaped filtering: '+mixed.map(x=>x.sourceKey));
 for(const bad of malformed)
  assert.equal(normalize({bonus:[bad]}).length,0,bad.name);
 assert.throws(()=>normalize({bonus:null}),/Unexpected events payload/);
 assert.throws(()=>normalize({bonus:Array(1001).fill(records.bonus[0])}),/Unexpected events payload/);
 assert.equal(normalize({bonus:[records.bonus[0],records.bonus[0]]}).length,1,'stable ID deduplication');
});
test('pre-F2: source data is display-only and condition confirmation/Box/F1 scopes stay independent',()=>{
 assert.match(U3,/eligibleFields:null,foodAll:allFood/);
 assert.match(U3,/Immutable provenance; parsed effects are never applied as energy numbers/);
 assert.match(U3,/if\(!userConfirmed\)/); // E1 rejects non-user confirmed mutations, via shared core.
 assert.match(read('e7-preview/e7-e1-core-v84.js'),/if\(!userConfirmed\|\|!prev\.editing\)throw/);
 assert.match(read('e7-preview/e7-inventory-scope-v78.js'),/encodeURIComponent\(id\)\+':timeline'/);
 assert.match(SW,/pokesleep-strategy-e7-v84-shared-e1-footer-20261113/);
 assert.match(read('e7-preview/e7-manifest-v50.webmanifest'),/"name"\s*:\s*"作戦室"/);
 const f1=read('f1d-preview/f1-d-ui.js');
 assert.doesNotMatch(f1,/localStorage\.setItem|localStorage\.removeItem/);
 assert.equal(SW.includes("'f1d-preview/"),false,'F1-D must not silently become installed E7');
});

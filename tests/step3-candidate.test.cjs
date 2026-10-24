'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const world=vm.createContext({globalThis:{}});
const rawSpecies=[
 ['h1','fairy','Energy for Everyone S',3400],
 ['h2','fairy','Energy for Everyone S (Berry Juice)',3600],
 ['h3','fairy','Energy for Everyone S (Lunar Blessing)',3900],
 ['n1','electric','Charge Strength S',2200],
 ['n2','electric','Charge Strength S',2300],
 ['n3','electric','Charge Strength S',2400],
 ['n4','electric','Charge Strength S',2500],
 ['n5','electric','Charge Strength S',2600],
 ['n6','electric','Charge Strength S',2700]
];
world.globalThis.PokeMaster={
 species:rawSpecies.map(([name,type,skill,frequency])=>({name,type,skill,frequency,ingRate:20,specialty:'Skills'})),
 berry:{fairy:30,electric:20}
};
world.globalThis.PokeSimulator={
 FAVORITES:{'テストフィールド':['fairy']},
 isAllHealerSkill:x=>x.startsWith('Energy for Everyone S'),
 berryUnit:(type,lv,favorites)=>world.globalThis.PokeMaster.berry[type]+lv+(favorites.includes(type)?20:0)
};
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/step3.js'),'utf8'),world,{filename:'step3.js'});
const api=world.globalThis.PokeStep3;
const make=id=>({id,nickname:id,pokemon:id,level:30,skillLevel:3,ingredients:['','',''],subskills:['','','','','']});
const input=()=>({box:rawSpecies.map(v=>make(v[0])),sleepIds:['h1','n1','n2','n3','n4'],map:'テストフィールド'});
const asPlain=x=>JSON.parse(JSON.stringify(x));
const hc=ids=>ids.filter(id=>id.startsWith('h')).length;
test('S3-A: A morning 2/day 1/evening 1; B one healer all day; fixed sleep unchanged',()=>{
 const data=input(),before=JSON.stringify(data);
 const result=api.createCandidates(data);
 const a=result.candidates.find(x=>x.code==='A'),b=result.candidates.find(x=>x.code==='B');
 assert.ok(a);assert.ok(b);
 assert.equal(hc(a.teams.morning),2);
 assert.equal(hc(a.teams.noon),1);
 assert.equal(hc(a.teams.evening),1);
 assert.deepEqual(asPlain(a.teams.noon),asPlain(a.teams.evening));
 for(const key of ['morning','noon','evening']){
  assert.equal(b.teams[key].length,5);assert.equal(hc(b.teams[key]),1);
  assert.equal(new Set(a.teams[key]).size,5);
  assert.deepEqual(asPlain(b.teams.morning),asPlain(b.teams[key]));
 }
 assert.equal(JSON.stringify(data),before,'generation does not overwrite user box or sleep roster');
});
test('S3-A: four transition counts use 07:30 collection, optional 12:00/18:00, bedtime reset',()=>{
 const data=input(),r=api.createCandidates(data);
 for(const item of r.candidates){
  const c=item.changes;
  assert.deepEqual(asPlain(c),asPlain(api.changes(data.sleepIds,item.teams)));
  assert.equal(c.total,c.morning+c.noon+c.evening+c.bedtime);
  assert.ok([c.morning,c.noon,c.evening,c.bedtime].every(x=>x>=0&&x<=5));
 }
 const a=r.candidates.find(x=>x.code==='A');
 assert.equal(a.changes.evening,0);
 const b=r.candidates.find(x=>x.code==='B');
 assert.equal(b.changes.noon,0);assert.equal(b.changes.evening,0);
});
test('S3-A: skip unattainable healer patterns without fictional substitutes',()=>{
 const onlyOne=input();
 onlyOne.box=onlyOne.box.filter(x=>x.id!=='h2'&&x.id!=='h3');
 const r=api.createCandidates(onlyOne);
 assert.ok(!r.candidates.some(x=>x.code==='A'));
 assert.ok(r.candidates.some(x=>x.code==='B'));
 assert.ok(r.warnings.some(x=>x.includes('A案')));
 const zero={...onlyOne,box:input().box.filter(x=>x.id.startsWith('n')),sleepIds:['n1','n2','n3','n4','n5']};
 const rz=api.createCandidates(zero);
 assert.ok(rz.candidates.every(x=>!x.code.startsWith('A')&&!x.code.startsWith('B')));
 assert.ok(rz.candidates.some(x=>x.code==='C'||x.code==='CS'));
});
test('S3-A: unknown species are not treated as known or promoted to healer',()=>{
 const d=input();
 d.box=[...d.box,make('not-in-master')];
 const r=api.createCandidates(d);
 assert.equal(r.eligibleKnown,9);
 assert.ok(r.warnings.some(w=>w.includes('未登録')));
 assert.ok(r.candidates.every(c=>Object.values(c.teams).every(ids=>!ids.includes('not-in-master'))));
});
test('S3-A: enforce fixed five sleep members and reject missing/duplicate IDs',()=>{
 const d=input();
 for(const ids of [['h1','h1','n1','n2','n3'],['h1','n1'],['h1','n1','n2','n3','INVALID']])
  assert.throws(()=>api.createCandidates({...d,sleepIds:ids}));
});
test('S3-A: no duplicate A/B/C plans, deterministic repeated generation, no game-ranking claim',()=>{
 const data=input();
 const a=asPlain(api.createCandidates(data)),b=asPlain(api.createCandidates(data));
 assert.deepEqual(a,b);
 const keys=a.candidates.map(c=>JSON.stringify(c.teams));
 assert.equal(new Set(keys).size,keys.length);
 assert.ok(a.warnings.some(x=>x.includes('7日比較は未実施')));
 assert.ok(a.candidates.every(x=>!('energy' in x)&&!('rank' in x)));
});

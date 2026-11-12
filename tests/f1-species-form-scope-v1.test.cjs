'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
// The PWA adapters are classic browser scripts in a type=module package.
// Load them through an isolated CommonJS-compatible VM (existing E7 test pattern).
function loadAdapter(relative){
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8'),sandbox);
 return sandbox.module.exports;
}
const Scope=loadAdapter('f1/f1-species-form-scope-v1.js');
const BoxCsv=loadAdapter('e7-preview/e7-box-csv-v50.js');
const root=path.resolve(__dirname,'../e7-preview');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(root,'e7-species-v59.js'),'utf8'),{window});
const catalog=window.PokeMaster.species;
const columns=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3',
 'メインスキル','せいかく','まっしろミント','Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い','お気に入り'];
function csvFor(names){
 const lines=names.map((name,i)=>[
  '個体'+i,name,String(15+i%50),'3','とくせんリンゴ','とくせんリンゴ','あじわいキノコ',
  '食材ゲットS','てれや','0','おてつだいスピードS','所持数アップS',
  'スキル確率アップS','おてつだいスピードM','きのみの数S','0','0','0'].join(','));
 return columns.join(',')+'\n'+lines.join('\n')+'\n';
}
function from(names,options={}){
 const text=csvFor(names);
 const parsed=BoxCsv.parseBox(text);
 assert.equal(parsed.ok,true,parsed.errors?.join(' / '));
 return Scope.buildScope(parsed,catalog,{sha256:crypto.createHash('sha256').update(text).digest('hex'),...options});
}
test('F1-A: 68 distinct individuals define species/form names, not 68 individual configurations',()=>{
 const names=Array.from({length:68},(_,i)=>i%3===0?'ピカチュウ':i%3===1?'ピカチュウ (ホリデー)':'ロコン (アローラ)');
 const result=from(names);
 assert.equal(result.state,'DRAFT_UNVERIFIED_GAME_DATA');
 assert.equal(result.source.individualCount,68);
 assert.equal(result.targets.length,3);
 assert.equal(result.numericalCoverage,'NONE_VERIFIED');
 assert.deepEqual([...result.targets].map(t=>t.name).sort(),['ピカチュウ','ピカチュウ (ホリデー)','ロコン (アローラ)'].sort());
 assert.equal(result.source.csvAdapterCommit,BoxCsv.UPSTREAM_COMMIT);
 assert.match(result.source.sha256,/^[0-9a-f]{64}$/);
 assert(Object.isFrozen(result)&&Object.isFrozen(result.targets));
});
test('F1-A: same Pokedex ID never collapses clothing, size, regional and base forms',()=>{
 const names=['ピカチュウ','ピカチュウ (ホリデー)','ピカチュウ (ハロウィン)','ピカチュウ (キャプテン)',
   'バケッチャ (こだましゅ)','バケッチャ (ギガだましゅ)','ロコン','ロコン (アローラ)'];
 const s=from(Array.from({length:68},(_,i)=>names[i%names.length]));
 assert.equal(s.targets.length,names.length);
 const pikachus=s.targets.filter(t=>t.id===25);
 assert.equal(pikachus.length,4);
 assert(pikachus.some(t=>t.name==='ピカチュウ (ホリデー)'));
 assert(pikachus.some(t=>t.name==='ピカチュウ'));
 assert.equal(s.targets.filter(t=>t.id===710).length,2);
});
test('F1-A: unknown or mistyped species/form rejects entire scope, never guesses by Dex ID',()=>{
 const names=Array(68).fill('ピカチュウ');
 names[18]='ピカチュウ (未知の衣装)';
 assert.throws(()=>from(names),error=>error.code==='UNKNOWN_FORM');
 assert.throws(()=>Scope.buildScope({ok:false,items:names.map(pokemon=>({pokemon})),errors:['bad']},catalog),
   error=>error.code==='SOURCE_INVALID');
});
test('F1-A: count must be 68, no implicit truncation or broadening',()=>{
 assert.throws(()=>from(Array(67).fill('ピカチュウ')),e=>e.code==='SCOPE_COUNT');
 assert.throws(()=>from(Array(69).fill('ピカチュウ')),e=>e.code==='SCOPE_COUNT');
 assert.throws(()=>from(Array(67).fill('ピカチュウ'),{expectedIndividuals:67}),e=>e.code==='SCOPE_COUNT');
 assert.throws(()=>from(Array(69).fill('ピカチュウ'),{expectedIndividuals:69}),e=>e.code==='SCOPE_COUNT');
 const s=from(Array(68).fill('ピカチュウ'));
 assert.equal(s.targets.length,1);
});
test('F1-A: Japanese width normalization is allowed, ambiguous catalog aliases are rejected',()=>{
 const name='ロコン (アローラ)';
 assert.equal(Scope.identity('　ロコン　（アローラ） '),name);
 assert.throws(()=>Scope.indexCatalog([...catalog,{id:37,name:'ロコン （アローラ）',type:'ice'}]),
  e=>e.code==='CATALOG_COLLISION');
});
test('F1-A: unsupported and unverified items remain calculation-blocked',()=>{
 const s=from(Array(68).fill('ピカチュウ (ホリデー)'));
 const accepted=Scope.evaluateIndividual({pokemon:'ピカチュウ (ホリデー)',nature:'いじっぱり',ing1:'whatever'},s,catalog);
 const differentNature=Scope.evaluateIndividual({pokemon:'ピカチュウ (ホリデー)',nature:'おだやか',ing1:'different'},s,catalog);
 assert.equal(accepted.inScope,true);
 assert.equal(differentNature.inScope,true,'Never pin the 68 exact individual configurations');
 assert.equal(accepted.calculation,'BLOCKED');
 assert.equal(accepted.reason,'GAME_DATA_UNVERIFIED');
 const regular=Scope.evaluateIndividual({pokemon:'ピカチュウ'},s,catalog);
 assert.equal(regular.inScope,false);
 assert.equal(regular.reason,'OUTSIDE_F1_SCOPE');
 const novel=Scope.evaluateIndividual({pokemon:'まだ登録されていない種族'},s,catalog);
 assert.equal(novel.reason,'UNKNOWN_SPECIES_FORM');
 assert.equal(novel.calculation,'BLOCKED');
});
test('F1-A: malformed digest and absent proof fail closed, without leaking personal nicknames',()=>{
 const names=Array(68).fill('ピカチュウ');
 assert.throws(()=>from(names,{sha256:'00ab'}),e=>e.code==='HASH');
 const s=Scope.buildScope(BoxCsv.parseBox(csvFor(names)),catalog);
 assert.equal(s.source.sha256,null);
 assert.equal(JSON.stringify(s).includes('個体0'),false);
 assert.equal(JSON.stringify(s).includes('nickname'),false);
});
test('F1-A: frozen E7 UI, box persistence, numerical simulator and PWA files are not modified',()=>{
 const scopeCode=fs.readFileSync(path.resolve(__dirname,'../f1/f1-species-form-scope-v1.js'),'utf8');
 assert.doesNotMatch(scopeCode,/localStorage\.(?:setItem|removeItem)|calculateEnergy|weeklyEnergy/);
 assert.match(scopeCode,/numericalCoverage:'NONE_VERIFIED'/);
});

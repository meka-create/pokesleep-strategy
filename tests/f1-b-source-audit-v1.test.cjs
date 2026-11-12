'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function loadScript(relative){
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8'),sandbox);
 return sandbox.module.exports;
}
const audit=loadScript('f1/f1-b-source-audit-v1.js');
const parser=loadScript('e7-preview/e7-box-csv-v50.js');
const snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-target-source-v1.json'),'utf8'));
const H=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3','メインスキル','せいかく','まっしろミント',
 'Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い','お気に入り'];
const scope=()=>snapshot.targets.map(x=>x.name);
function synthetic(p){
 const jp=snapshot.dictionaries.ingredients;
 const ing=slot=>{
  const refs=[p.sourceProfile.ing1,p.sourceProfile.ing2,p.sourceProfile.ing3].slice(0,slot);
  const found=refs.find(ref=>ref&&ref.name!=='unknown'&&ref['c'+slot]>0);
  return found?jp[found.name]:'未検証食材';
 };
 return {nickname:'TEST',pokemon:p.name,level:50,skillLevel:3,
  ing1:ing(1),ing2:ing(2),ing3:ing(3),mainSkill:p.sourceProfile.mainSkillJa,
  nature:'てれや',mint:false,lv10:'きのみの数S',lv25:'おてつだいボーナス',
  lv50:'おてつだいスピードS',lv70:'',lv80:'',ribbon:0,shiny:false,favorite:''};
}
function toCSV(rows){
 const data=rows.map(x=>[x.nickname,x.pokemon,String(x.level),String(x.skillLevel),
 x.ing1,x.ing2,x.ing3,x.mainSkill,x.nature,'0',x.lv10,x.lv25,x.lv50,x.lv70,x.lv80,'0','0',''].join(','));
 return H.join(',')+'\n'+data.join('\n')+'\n';
}
function fullSample(){
 const ts=[...snapshot.targets,...snapshot.targets.slice(0,3)];
 return ts.map(synthetic);
}
test('F1-B: 69 individuals define 66 distinct species/forms with fixed upstream provenance',()=>{
 const entries=audit.validateSnapshot(snapshot);
 assert.equal(entries.size,66);
 assert.equal(snapshot.initialInput.rowCount,69);
 assert.match(snapshot.initialInput.sourceFileSHA256,/^[a-f0-9]{64}$/);
 assert.equal(snapshot.upstream.pokemonJson.gitBlob,'f45d24b214c03cdf592783207a883d9f573676d2');
 assert.equal(snapshot.upstream.japaneseNames.gitBlob,'fd983be0838a5bfa3d5923464515fcf818c26fe0');
 assert.equal(snapshot.constraints.energyCalculation,'NOT_IMPLEMENTED');
 assert(snapshot.targets.every(x=>x.status==='SOURCE_MAPPED_CALCULATION_BLOCKED'));
});
test('F1-B: synthetic 69-entry E7 CSV audits to 67 mapped and 2 special HOLD, zero false illegals',()=>{
 const parsed=parser.parseBox(toCSV(fullSample()));
 assert.equal(parsed.ok,true);
 const r=audit.auditRoster(parsed,snapshot);
 assert.equal(r.individualCount,69);
 assert.equal(r.scopeCount,66);
 assert.equal(r.sourceMatched,67);
 assert.equal(r.needsSpecialRuleReview,2);
 assert.equal(r.mismatched,0);
 assert.deepEqual([...r.reviewSpecies].sort(),['ダークライ','ミュウ'].sort());
 assert.equal(r.calculation,'BLOCKED');
 assert.equal(r.userRowsRetained,false);
 assert(!JSON.stringify(r).includes('TEST'));
});
test('F1-B: Mew alternative skill and unknown ingredient never become false illegal',()=>{
 const entries=audit.validateSnapshot(snapshot);
 const mew=synthetic(entries.get('ミュウ'));
 mew.mainSkill='げんきオールS'; // Known game skill different from Mew's base skill
 const report=audit.auditIndividual(mew,snapshot,entries);
 assert.equal(report.checks.mainSkill,'SPECIAL_MECHANIC_UNVERIFIED');
 assert.equal(report.checks.ingredients[2],'UNKNOWN_SOURCE_SLOT');
 assert.equal(report.sourceStatus,'NEEDS_SPECIAL_RULE_REVIEW');
 const impossible={...mew,mainSkill:'未定義の仮スキル'};
 const rejected=audit.auditIndividual(impossible,snapshot,entries);
 assert.equal(rejected.checks.mainSkill,'MISMATCH');
 assert.equal(rejected.sourceStatus,'MISMATCH');
 assert.equal(report.calculation,'BLOCKED');
});
test('F1-B: Darkrai special food slots are source-unknown, not automatically rejected',()=>{
 const entries=audit.validateSnapshot(snapshot);
 const r=audit.auditIndividual(synthetic(entries.get('ダークライ')),snapshot,entries);
 assert.equal(r.checks.ingredients[1],'UNKNOWN_SOURCE_SLOT');
 assert.equal(r.checks.ingredients[2],'UNKNOWN_SOURCE_SLOT');
 assert.equal(r.sourceStatus,'NEEDS_SPECIAL_RULE_REVIEW');
});
test('F1-B: known unsupported ingredient, nature and main-skill mismatch remain blocked',()=>{
 const entries=audit.validateSnapshot(snapshot);
 const row=synthetic(entries.get('リザードン'));row.ing2='未確認の食材';
 row.nature='未知のせいかく';row.mainSkill='まちがったスキル';
 const r=audit.auditIndividual(row,snapshot,entries);
 assert.equal(r.sourceStatus,'MISMATCH');
 assert.equal(r.checks.ingredients[1],'MISMATCH');
 assert.equal(r.checks.nature,'MISMATCH');
 assert.equal(r.checks.mainSkill,'MISMATCH');
 assert.equal(r.calculation,'BLOCKED');
});
test('F1-B: unknown species/form, roster count drift, altered form set fail closed',()=>{
 const entries=audit.validateSnapshot(snapshot);
 const form=audit.auditIndividual({pokemon:'パンプジン (未登録サイズ)'},snapshot,entries);
 assert.equal(form.inScope,false);
 assert.equal(form.calculation,'BLOCKED');
 const rows=fullSample();
 assert.throws(()=>audit.auditRoster(parser.parseBox(toCSV(rows.slice(1))),snapshot),e=>e.code==='COUNT');
 const changed=fullSample();changed[0].pokemon='ピカチュウ';
 assert.throws(()=>audit.auditRoster(parser.parseBox(toCSV(changed)),snapshot),e=>e.code==='TARGET_SET');
});
test('F1-B: malformed or non-provenance-checked profile list is rejected',()=>{
 assert.throws(()=>audit.validateSnapshot({...snapshot,targets:snapshot.targets.slice(1)}),e=>e.code==='SNAPSHOT');
 assert.throws(()=>audit.validateSnapshot({...snapshot,dictionaries:null}),e=>e.code==='DICTIONARIES');
 const corrupted={...snapshot,targets:[...snapshot.targets]};corrupted.targets[1]=corrupted.targets[0];
 assert.throws(()=>audit.validateSnapshot(corrupted),e=>e.code==='SNAPSHOT_DUPLICATE');
});
test('F1-B: user CSV itself is NOT committed and E7 frozen screens are not modified',()=>{
 const s=fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-target-source-v1.json'),'utf8');
 assert.doesNotMatch(s,/"nickname"|"ユーザー登録個体"|"items"\s*:\s*\[/);
 const js=fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-source-audit-v1.js'),'utf8');
 assert.doesNotMatch(js,/localStorage\.setItem|fetch\(|calculateEnergy|saveFile/);
});

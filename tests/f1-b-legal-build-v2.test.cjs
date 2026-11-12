'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=relative=>{
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8'),sandbox);
 return sandbox.module.exports;
};
const rules=load('f1/f1-b-legal-build-v2.js');
const parser=load('e7-preview/e7-box-csv-v50.js');
const source=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-target-source-v1.json'),'utf8'));
const dict=source.dictionaries,subkeys=rules.SUBSKILL_KEYS;
const food=(t,slot)=>{
 if(rules.SPECIAL_FOODS[t.name]){
  const key=Object.keys(rules.SPECIAL_FOODS[t.name][slot-1])[0];
  return dict.ingredients[key];
 }
 const refs=[t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3].slice(0,slot);
 const choice=refs.find(ref=>ref&&ref.name!=='unknown'&&ref['c'+slot]>0);
 if(!choice)throw new Error('no source candidate: '+t.name+'/'+slot);
 return dict.ingredients[choice.name];
};
const build=t=>({
 pokemon:t.name,nickname:'SYNTHETIC_DO_NOT_STORE',level:50,skillLevel:3,mint:false,
 ing1:food(t,1),ing2:food(t,2),ing3:food(t,3),
 mainSkill:t.name==='ミュウ'?dict.mainSkills.Metronome:t.sourceProfile.mainSkillJa,
 nature:'てれや',lv10:dict.subskills[subkeys[0]],lv25:dict.subskills[subkeys[1]],
 lv50:dict.subskills[subkeys[2]],lv70:dict.subskills[subkeys[3]],
 lv80:dict.subskills[subkeys[4]],ribbon:0,shiny:false,favorite:''
});
const H=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3',
 'メインスキル','せいかく','まっしろミント','Lv10','Lv25','Lv50','Lv70','Lv80',
 '一緒に眠った時間','色違い','お気に入り'];
const toCSV=rows=>H.join(',')+'\n'+rows.map(x=>[
 x.nickname,x.pokemon,x.level,x.skillLevel,x.ing1,x.ing2,x.ing3,x.mainSkill,
 x.nature,'0',x.lv10,x.lv25,x.lv50,x.lv70,x.lv80,'0','0',''
].join(',')).join('\n')+'\n';
const target=name=>source.targets.find(t=>t.name===name);
test('F1-B v2: scope/profile provenance is pinned, has 66 distinct forms',()=>{
 const entries=rules.validateSource(source);
 assert.equal(entries.size,66);
 assert.equal(rules.PIN.rowCount,69);
 assert.equal(rules.PIN.formCount,66);
 for(const [name,upstream] of [['ミュウ','Mew'],['ダークライ','Darkrai'],
  ['タマザラシ (ホリデー)','Spheal (Holiday)'],
  ['パンプジン (ギガだましゅ)','Gourgeist (Jumbo)']]){
  assert.equal(entries.get(name)?.upstreamName,upstream);
 }
 for(const wrong of [
  {...source,upstream:{...source.upstream,commit:'unknown'}},
  {...source,upstream:{...source.upstream,pokemonJson:{gitBlob:'bad'}}},
  {...source,targets:source.targets.slice(1)},
  {...source,constraints:{...source.constraints,energyCalculation:'DONE'}}
 ])assert.throws(()=>rules.validateSource(wrong),e=>e.code==='PROVENANCE');
 const duplicate={...source,targets:source.targets.slice()};
 duplicate.targets[65]=duplicate.targets[0];
 assert.throws(()=>rules.validateSource(duplicate),e=>e.code==='TARGET_PROFILE');
});
test('F1-B v2: every upstream-known option at every food slot of 64 regular forms stays valid',()=>{
 let attempted=0;
 for(const t of source.targets.filter(x=>!rules.SPECIAL_FOODS[x.name])){
  const baseline=build(t);
  assert.equal(rules.auditBuild(baseline,source).status,'SOURCE_COMPATIBLE',t.name);
  for(let slot=1;slot<=3;slot++){
   const refs=[t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3].slice(0,slot);
   for(const ref of refs){
    if(!ref||ref.name==='unknown'||!(ref['c'+slot]>0))continue;
    const row={...baseline,['ing'+slot]:dict.ingredients[ref.name]};
    const result=rules.auditBuild(row,source);
    assert.equal(result.checks.ingredients[slot-1],'SOURCE_MATCH',t.name+'/'+slot+'/'+ref.name);
    assert.equal(result.status,'SOURCE_COMPATIBLE');
    assert.equal(result.calculation,'BLOCKED');
    attempted++;
   }
  }
 }
 assert(attempted>200,'all food-slot source options were exercised');
});
test('F1-B v2: all 25 natures and the 17 real, distinct subskills are accepted',()=>{
 const baseline=build(target('リザードン'));
 for(const nature of Object.values(dict.natures))
  assert.equal(rules.auditBuild({...baseline,nature},source).status,'SOURCE_COMPATIBLE');
 const realSubs=subkeys.map(k=>dict.subskills[k]);
 assert.equal(realSubs.length,17);
 for(const sub of realSubs){
  const others=realSubs.filter(s=>s!==sub);
  const row={...baseline,lv10:sub,lv25:others[0],lv50:others[1],
   lv70:others[2],lv80:others[3]};
  assert.equal(rules.auditBuild(row,source).status,'SOURCE_COMPATIBLE',sub);
 }
 const bogus={...baseline,lv10:'スキルレベルアップ'};
 assert.equal(rules.auditBuild(bogus,source).checks.subskills[0],'INVALID_SUBSKILL');
 const duplicate={...baseline,lv50:baseline.lv10};
 const report=rules.auditBuild(duplicate,source);
 assert.equal(report.checks.subskills[2],'DUPLICATE_SUBSKILL');
 assert.equal(report.status,'INVALID');
});
test('F1-B v2: Mew food candidates at slots 1/2/3 and exact learnable effects',()=>{
 const t=target('ミュウ'),b=build(t);
 for(let slot=1;slot<=3;slot++){
  const choices=rules.SPECIAL_FOODS['ミュウ'][slot-1];
  for(const [key,count] of Object.entries(choices)){
   assert(count>0);
   const out=rules.auditBuild({...b,['ing'+slot]:dict.ingredients[key]},source);
   assert.equal(out.checks.ingredients[slot-1],'SOURCE_MATCH',key+'/'+slot);
   assert.equal(out.status,'REVIEW_REQUIRED');
  }
 }
 for(const key of rules.MEW_SKILL_KEYS){
  const out=rules.auditBuild({...b,mainSkill:dict.mainSkills[key]},source);
  assert.equal(out.checks.mainSkill,'SPECIAL_EFFECT_UNMODELED',key);
  assert.equal(out.calculation,'BLOCKED');
 }
 for(const ambiguous of [dict.mainSkills.Versatile,dict.mainSkills['Charge Strength S']])
  assert.equal(rules.auditBuild({...b,mainSkill:ambiguous},source).checks.mainSkill,
   'SPECIAL_EFFECT_AMBIGUOUS');
 for(const impossible of [dict.mainSkills['Skill Copy'],
  dict.mainSkills['Berry Burst (Disguise)'],'架空のメインスキル']){
  const out=rules.auditBuild({...b,mainSkill:impossible},source);
  assert.equal(out.checks.mainSkill,'INVALID_MEW_SKILL');
  assert.equal(out.status,'INVALID');
 }
 const tailBefore60=rules.auditBuild({...b,ing1:dict.ingredients.tail},source);
 assert.equal(tailBefore60.checks.ingredients[0],'INVALID_FOOD');
 const unsetThird=rules.auditBuild({...b,ing3:''},source);
 assert.equal(unsetThird.status,'REVIEW_REQUIRED');
 assert.equal(unsetThird.checks.ingredients[2],'UNSET_SLOT');
});
test('F1-B v2: Darkrai has 8 independently enumerated ingredients and sequential unlocks',()=>{
 const t=target('ダークライ'),b=build(t);
 for(let slot=1;slot<=3;slot++){
  for(const [key,count] of Object.entries(rules.SPECIAL_FOODS['ダークライ'][slot-1])){
   assert(count>0);
   const result=rules.auditBuild({...b,['ing'+slot]:dict.ingredients[key]},source);
   assert.equal(result.checks.ingredients[slot-1],'SOURCE_MATCH',key+'/'+slot);
   assert.equal(result.status,'REVIEW_REQUIRED');
  }
 }
 const noUnlock=rules.auditBuild({...b,ing2:'-',ing3:''},source);
 assert.equal(noUnlock.status,'REVIEW_REQUIRED');
 assert.equal(noUnlock.checks.ingredients[1],'UNSET_SLOT');
 const badOrder=rules.auditBuild({...b,ing2:'',ing3:dict.ingredients.coffee},source);
 assert.equal(badOrder.checks.ingredients[2],'INVALID_UNLOCK_ORDER');
 assert.equal(badOrder.status,'INVALID');
 const badSubOrder=rules.auditBuild({...b,lv10:'',lv25:dict.subskills[subkeys[1]]},source);
 assert.equal(badSubOrder.checks.subskills[1],'INVALID_UNLOCK_ORDER');
 assert.equal(badSubOrder.status,'INVALID');
 const wrongSkill=rules.auditBuild({...b,mainSkill:dict.mainSkills.Metronome},source);
 assert.equal(wrongSkill.checks.mainSkill,'INVALID_MAIN_SKILL');
});
test('F1-B v2: 69 synthetic individuals/66 forms, report excludes private rows',()=>{
 const full=source.targets.map(build);
 full.push(...source.targets.slice(0,3).map(build));
 const parsed=parser.parseBox(toCSV(full));
 assert.equal(parsed.ok,true);
 const report=rules.auditRoster(parsed,source);
 assert.equal(report.individualCount,69);
 assert.equal(report.speciesFormCount,66);
 assert.equal(report.sourceCompatible,67);
 assert.equal(report.reviewRequired,2);
 assert.equal(report.invalid,0);
 assert.equal(report.calculation,'BLOCKED');
 assert.equal(report.userRowsRetained,false);
 assert(!JSON.stringify(report).includes('SYNTHETIC_DO_NOT_STORE'));
 assert.throws(()=>rules.auditRoster(parser.parseBox(toCSV(full.slice(1))),source),
  e=>e.code==='CSV_COUNT_OR_PARSE');
});
test('F1-B v2: identity boundary, missing data and read-only effect are fail-closed',()=>{
 const b=build(target('リザードン'));
 const unknown=rules.auditBuild({...b,pokemon:'リザードン (未検証フォーム)'},source);
 assert.equal(unknown.status,'OUTSIDE_SCOPE');
 assert.equal(unknown.calculation,'BLOCKED');
 const missing=rules.auditBuild({...b,ing2:''},source);
 assert.equal(missing.status,'REVIEW_REQUIRED');
 assert.equal(missing.checks.ingredients[1],'INPUT_MISSING');
 const badFood=rules.auditBuild({...b,ing3:'未実装食材'},source);
 assert.equal(badFood.status,'INVALID');
 const out=rules.auditBuild(b,source);
 assert.equal(out.energyModel,'NOT_VERIFIED');
 assert.equal(out.userRowsRetained,false);
 assert(!JSON.stringify(out).includes('SYNTHETIC_DO_NOT_STORE'));
 const code=fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-legal-build-v2.js'),'utf8');
 assert.doesNotMatch(code,/localStorage|sessionStorage|indexedDB|fetch\(|document\.|calculateEnergy/);
 assert(!code.includes('e7-preview/'));
});

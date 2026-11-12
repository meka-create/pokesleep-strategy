/* F1-B source-data audit. No energy calculation, personal-row persistence, or UI effects.
 * The 69 selected individuals define 66 species/forms. Any lawful new individual
 * of those forms may be checked; do not limit it to the 69 uploaded builds.
 */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.PokeF1SourceAudit=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const fail=(code,message)=>Object.assign(new Error(message),{code});
const norm=s=>typeof s==='string'?s.normalize('NFKC').trim().replace(/\s+/gu,' '):'';
function validateSnapshot(snapshot){
 if(snapshot?.schema!=='pokesleep-strategy.f1-b-target-source-v1'||
    snapshot.status!=='SOURCE_MAPPED_CALCULATION_BLOCKED'||
    snapshot.initialInput?.rowCount!==69||
    snapshot.initialInput?.distinctSpeciesForms!==66||
    snapshot.constraints?.energyCalculation!=='NOT_IMPLEMENTED'||
    !Array.isArray(snapshot.targets)||snapshot.targets.length!==66)
  throw fail('SNAPSHOT','F1-Bの検証済み対象マスターが正しくありません。');
 const names=new Set(),sourceNames=new Set();
 for(const t of snapshot.targets){
  if(!norm(t.name)||!Number.isInteger(t.pokedexId)||t.pokedexId<=0||
     !norm(t.upstreamName)||!t.sourceProfile||t.status!=='SOURCE_MAPPED_CALCULATION_BLOCKED'||
     !Number.isFinite(t.sourceProfile.frequency)||t.sourceProfile.frequency<=0)
   throw fail('SNAPSHOT','対象の種族・フォーム情報が不正です。');
  if(names.has(norm(t.name))||sourceNames.has(t.upstreamName))
   throw fail('SNAPSHOT_DUPLICATE','種族・フォームが重複しています。');
  names.add(norm(t.name));sourceNames.add(t.upstreamName);
 }
 if(!snapshot.dictionaries?.ingredients||!snapshot.dictionaries?.natures||
    !snapshot.dictionaries?.subskills)
  throw fail('DICTIONARIES','食材・性格・サブスキルの照合辞書がありません。');
 return new Map(snapshot.targets.map(t=>[norm(t.name),t]));
}
function oneIngredient(profile,slot,wanted,dictionary){
 const present=[];
 const refs=[profile.ing1,profile.ing2,profile.ing3].slice(0,slot);
 let unknown=false;
 for(const ref of refs){
  if(!ref)continue;
  const n=ref['c'+slot];
  if(typeof n!=='number'||n<=0)continue;
  if(ref.name==='unknown'){unknown=true;continue;}
  const jp=dictionary[ref.name];
  if(!jp)return 'UNVERIFIED_SOURCE';
  present.push(jp);
 }
 if(present.includes(wanted))return 'MATCHED';
 // A still-unrevealed source slot is NEVER proof that the CSV is illegal.
 if(unknown)return 'UNKNOWN_SOURCE_SLOT';
 return 'MISMATCH';
}
function auditIndividual(row,snapshot,entries){
 if(!row||typeof row!=='object')throw fail('INPUT','個体情報が不正です。');
 const name=norm(row.pokemon),t=entries.get(name);
 if(!t)return Object.freeze({speciesForm:name||null,inScope:false,
  checks:Object.freeze({identity:'NOT_IN_SCOPE'}),calculation:'BLOCKED'});
 const dict=snapshot.dictionaries,foods=[];
 for(let slot=1;slot<=3;slot++){
  const value=norm(row['ing'+slot]);
  if(!value){foods.push('MISSING_INPUT');continue;}
  foods.push(oneIngredient(t.sourceProfile,slot,value,dict.ingredients));
 }
 const knownNatures=new Set(Object.values(dict.natures));
 const nature=knownNatures.has(norm(row.nature))?'MATCHED':'MISMATCH';
 const knownSubs=new Set(Object.values(dict.subskills));
 const subs=['lv10','lv25','lv50','lv70','lv80'].map(key=>{
  if(row[key]===null||row[key]==='')return 'UNSET_SLOT';
  return knownSubs.has(norm(row[key]))?'MATCHED':'MISMATCH';
 });
 const skill=norm(row.mainSkill)===t.sourceProfile.mainSkillJa?'MATCHED':
  t.sourceProfile.mainSkill==='Versatile'?'SPECIAL_MECHANIC_UNVERIFIED':'MISMATCH';
 const review=foods.includes('UNKNOWN_SOURCE_SLOT')||foods.includes('UNVERIFIED_SOURCE')||
   skill==='SPECIAL_MECHANIC_UNVERIFIED';
 const bad=[...foods,nature,skill,...subs].includes('MISMATCH')||
   foods.includes('MISSING_INPUT');
 return Object.freeze({speciesForm:name,inScope:true,
  checks:Object.freeze({ingredients:Object.freeze(foods),nature,
    subskills:Object.freeze(subs),mainSkill:skill}),
  sourceStatus:bad?'MISMATCH':review?'NEEDS_SPECIAL_RULE_REVIEW':'SOURCE_MATCHED',
  calculation:'BLOCKED'});
}
function auditRoster(parsed,snapshot){
 const entries=validateSnapshot(snapshot);
 if(parsed?.ok!==true||!Array.isArray(parsed.items)||parsed.items.length!==69||
    (Array.isArray(parsed.errors)&&parsed.errors.length!==0))
  throw fail('COUNT','69体のCSV/TSVが全件正常に読み込まれていません。');
 const results=parsed.items.map(item=>auditIndividual(item,snapshot,entries));
 const observed=new Set(results.map(x=>x.speciesForm));
 if(observed.size!==66||observed.size!==entries.size||
   [...observed].some(n=>!entries.has(n)))
  throw fail('TARGET_SET','69体から抽出された種族・フォーム一覧が確定版と一致しません。');
 const stats={sourceMatched:0,needsSpecialRuleReview:0,mismatched:0};
 const reviewNames=new Set(),mismatchNames=new Set();
 for(const result of results){
  if(result.sourceStatus==='SOURCE_MATCHED')stats.sourceMatched++;
  else if(result.sourceStatus==='NEEDS_SPECIAL_RULE_REVIEW'){
   stats.needsSpecialRuleReview++;reviewNames.add(result.speciesForm);
  }else{
   stats.mismatched++;mismatchNames.add(result.speciesForm);
  }
 }
 return Object.freeze({individualCount:69,scopeCount:66,
  ...stats,reviewSpecies:Object.freeze([...reviewNames].sort()),
  mismatchSpecies:Object.freeze([...mismatchNames].sort()),
  calculation:'BLOCKED',
  // Audit is temporary. Never return original rows, nicknames, or all skills.
  userRowsRetained:false});
}
return Object.freeze({validateSnapshot,auditIndividual,auditRoster});
});

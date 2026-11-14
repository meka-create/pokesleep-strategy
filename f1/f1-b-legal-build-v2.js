/* F1-B v2: conservative species/form build legality, NOT an energy calculator.
 * Only uses pinned public species profiles; never stores user rows.
 * SPECIAL rules independently corroborated against wikiwiki.jp/poke_sleep (2026-11-13).
 * Never silently convert a special form into a regular species.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PokeF1LegalBuild=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PIN=Object.freeze({
  schema:'pokesleep-strategy.f1-b-target-source-v1',
  commit:'663bf018f69633d2d7d108b5f833d97874b74c41',
  blob:'f45d24b214c03cdf592783207a883d9f573676d2',
  rowCount:69,formCount:66
 });
 const SUBSKILL_KEYS=Object.freeze([
  'Berry Finding S','Dream Shard Bonus','Energy Recovery Bonus','Helping Bonus',
  'Research EXP Bonus','Sleep EXP Bonus','Skill Level Up M',
  'Skill Level Up S','Inventory Up L','Inventory Up M',
  'Helping Speed M','Ingredient Finder M','Skill Trigger M',
  'Inventory Up S','Helping Speed S','Ingredient Finder S','Skill Trigger S'
 ]);
 const MEW_SKILL_KEYS=Object.freeze([
  'Metronome','Charge Strength S (Random)','Charge Strength M',
  'Dream Shard Magnet S (Random)','Ingredient Magnet S','Energizing Cheer S',
  'Charge Energy S','Energy for Everyone S','Tasty Chance S',
  'Cooking Power-Up S','Extra Helpful S','Berry Burst'
 ]);
 const SPECIAL_FOODS=Object.freeze({
  'ミュウ':Object.freeze([
   Object.freeze({leek:2,egg:2,herb:2,sausage:2,oil:2,soy:2,avocado:2}),
   Object.freeze({leek:3,egg:4,herb:4,sausage:4,oil:4,soy:5,avocado:3}),
   Object.freeze({leek:4,egg:6,herb:5,sausage:7,oil:6,soy:7,avocado:4,tail:2})
  ]),
  'ダークライ':Object.freeze([
   Object.freeze({sausage:2,apple:2,herb:2,milk:2,honey:2,soy:2,corn:2,coffee:2}),
   Object.freeze({sausage:4,apple:5,herb:3,milk:4,honey:4,soy:4,corn:3,coffee:3}),
   Object.freeze({sausage:6,apple:7,herb:5,milk:6,honey:6,soy:6,corn:4,coffee:4})
  ])
 });
 const SLOTS=Object.freeze(['lv10','lv25','lv50','lv70','lv80']);
 const norm=s=>typeof s==='string'?s.normalize('NFKC').trim().replace(/\s+/gu,' '):'';
 const empty=v=>v===null||v===undefined||norm(v)===''||norm(v)==='-';
 const error=(code)=>Object.assign(new Error('F1-B source snapshot validation failed: '+code),{code});
 const freezeArray=a=>Object.freeze(a.slice());
 function validateSource(snapshot){
  if(snapshot?.schema!==PIN.schema||
   snapshot?.status!=='SOURCE_MAPPED_CALCULATION_BLOCKED'||
   snapshot?.initialInput?.rowCount!==PIN.rowCount||
   snapshot?.initialInput?.distinctSpeciesForms!==PIN.formCount||
   snapshot?.upstream?.commit!==PIN.commit||
   snapshot?.upstream?.pokemonJson?.gitBlob!==PIN.blob||
   snapshot?.constraints?.energyCalculation!=='NOT_IMPLEMENTED'||
   snapshot?.constraints?.individualConfigurations!=='ALL_LEGAL_BUILDS_OF_SELECTED_SPECIES_FORMS'||
   !Array.isArray(snapshot?.targets)||snapshot.targets.length!==PIN.formCount)
   throw error('PROVENANCE');
  const dict=snapshot.dictionaries;
  if(!dict?.ingredients||!dict?.natures||!dict?.subskills||!dict?.mainSkills)
   throw error('DICTIONARIES');
  if(SUBSKILL_KEYS.some(k=>!norm(dict.subskills[k]))||
     MEW_SKILL_KEYS.some(k=>!norm(dict.mainSkills[k])))
   throw error('LEGAL_RULE_DICTIONARY_DRIFT');
  const byName=new Map(),bySource=new Set();
  for(const target of snapshot.targets){
   const n=norm(target?.name),p=target?.sourceProfile;
   if(!n||byName.has(n)||!norm(target?.upstreamName)||
      bySource.has(target.upstreamName)||!Number.isInteger(target?.pokedexId)||
      target.pokedexId<=0||target.status!=='SOURCE_MAPPED_CALCULATION_BLOCKED'||
      !p||!Number.isFinite(p.frequency)||p.frequency<=0||
      !Number.isFinite(p.ingredientRate)||!Number.isFinite(p.skillRate)||
      !norm(p.mainSkillJa)||!p.ing1)
    throw error('TARGET_PROFILE');
   byName.set(n,target);bySource.add(target.upstreamName);
  }
  if(byName.get('ミュウ')?.upstreamName!=='Mew'||
     byName.get('ダークライ')?.upstreamName!=='Darkrai')
   throw error('SPECIAL_IDENTITY');
  return byName;
 }
 function normalFood(t,slot,food,dict){
  const profile=t.sourceProfile,refs=[profile.ing1,profile.ing2,profile.ing3].slice(0,slot);
  let unknown=false;
  const allowed=[];
  for(const ref of refs){
   if(!ref)continue;
   if(ref.name==='unknown'){unknown=true;continue;}
   const count=ref['c'+slot];
   if(typeof count!=='number'||count<=0)continue;
   const jp=dict.ingredients[ref.name];
   if(!norm(jp))return 'SOURCE_UNKNOWN';
   allowed.push(jp);
  }
  if(allowed.includes(food))return 'SOURCE_MATCH';
  return unknown?'SOURCE_UNKNOWN':'INVALID_FOOD';
 }
 function specialFood(t,slot,food,dict){
  const pool=SPECIAL_FOODS[t.name][slot-1];
  for(const key of Object.keys(pool)){
   if(dict.ingredients[key]===food&&pool[key]>0)return 'SOURCE_MATCH';
  }
  return 'INVALID_FOOD';
 }
 // Returned reports contain only species identity, statuses and reason codes.
 // No nickname, custom individual stats, level, foods or subs are echoed.
 function auditBuild(row,snapshot){
  const targets=validateSource(snapshot);
  if(!row||typeof row!=='object'||Array.isArray(row))throw error('INDIVIDUAL');
  const name=norm(row.pokemon),t=targets.get(name);
  if(!t)return Object.freeze({speciesForm:name||null,inScope:false,
   status:'OUTSIDE_SCOPE',reasons:freezeArray(['OUTSIDE_F1_SCOPE']),calculation:'BLOCKED'});
  const dict=snapshot.dictionaries,foods=[],subs=[],reasons=[];
  const special=Object.prototype.hasOwnProperty.call(SPECIAL_FOODS,name);
  const add=(field,code)=>{if(code!=='SOURCE_MATCH')reasons.push(field+':'+code);};
  for(let i=1;i<=3;i++){
   const value=norm(row['ing'+i]);
   let code;
   if(empty(row['ing'+i])){
    code=i===1||(!special&&i===2)?'INPUT_MISSING':'UNSET_SLOT';
   }else code=special?specialFood(t,i,value,dict):normalFood(t,i,value,dict);
   foods.push(code);add('ing'+i,code);
  }
  // Mew initially has first two ingredient slots. Darkrai may unlock slots 2/3.
  if(name==='ミュウ'&&foods[1]==='UNSET_SLOT'){
   foods[1]='INPUT_MISSING';add('ing2','INPUT_MISSING');
  }
  if(special&&foods[2]!=='UNSET_SLOT'&&foods[1]==='UNSET_SLOT'){
   foods[2]='INVALID_UNLOCK_ORDER';add('ing3','INVALID_UNLOCK_ORDER');
  }
  const knownNatures=new Set(Object.values(dict.natures).map(norm));
  const nature=knownNatures.has(norm(row.nature))?'SOURCE_MATCH':'INVALID_NATURE';
  add('nature',nature);
  const allowedSubs=new Set(SUBSKILL_KEYS.map(key=>dict.subskills[key]));
  const observed=new Set();
  for(let i=0;i<SLOTS.length;i++){
   const key=SLOTS[i],value=norm(row[key]);
   let code='SOURCE_MATCH';
   if(empty(row[key]))code='UNSET_SLOT';
   else if(!allowedSubs.has(value))code='INVALID_SUBSKILL';
   else if(observed.has(value))code='DUPLICATE_SUBSKILL';
   if(code==='SOURCE_MATCH')observed.add(value);
   subs.push(code);add(key,code);
  }
  if(special){
   for(let i=1;i<subs.length;i++){
    if(subs[i]!=='UNSET_SLOT'&&subs[i-1]==='UNSET_SLOT'){
     subs[i]='INVALID_UNLOCK_ORDER';add(SLOTS[i],'INVALID_UNLOCK_ORDER');
    }
   }
  }
  const skillName=norm(row.mainSkill);
  const mewAllowed=new Set(MEW_SKILL_KEYS.map(key=>norm(dict.mainSkills[key])));
  let mainSkill='SOURCE_MATCH';
  if(!skillName)mainSkill='INPUT_MISSING';
  else if(name==='ミュウ'){
   // The base name "Versatile" is a mechanic, not the selected effect.
   // A generic S label is ambiguous with S(random) in exported versions.
   if(mewAllowed.has(skillName))mainSkill='SPECIAL_EFFECT_UNMODELED';
   else if(skillName===norm(t.sourceProfile.mainSkillJa)||
           skillName===norm(dict.mainSkills['Charge Strength S']))
    mainSkill='SPECIAL_EFFECT_AMBIGUOUS';
   else mainSkill='INVALID_MEW_SKILL';
  }else if(skillName!==norm(t.sourceProfile.mainSkillJa))mainSkill='INVALID_MAIN_SKILL';
  add('mainSkill',mainSkill);
  const hasInvalid=[...foods,nature,...subs,mainSkill].some(c=>c.startsWith('INVALID')||c==='DUPLICATE_SUBSKILL');
  const needsReview=special||[...foods,...subs,mainSkill].some(c=>
   c==='SOURCE_UNKNOWN'||c==='UNSET_SLOT'||c==='INPUT_MISSING'||c.startsWith('SPECIAL_'));
  const status=hasInvalid?'INVALID':needsReview?'REVIEW_REQUIRED':'SOURCE_COMPATIBLE';
  return Object.freeze({
   speciesForm:name,inScope:true,status,
   checks:Object.freeze({ingredients:freezeArray(foods),nature,
    subskills:freezeArray(subs),mainSkill}),
   reasons:freezeArray(reasons),
   // Even SOURCE_COMPATIBLE is NOT an exhaustive legal-build certification.
   // Numeric energy, recipe, bag and main-skill-level rules are F1-C gates.
   calculation:'BLOCKED',energyModel:'NOT_VERIFIED',
   userRowsRetained:false
  });
 }
 function auditRoster(parsed,snapshot){
  const targets=validateSource(snapshot);
  if(parsed?.ok!==true||!Array.isArray(parsed.items)||parsed.items.length!==PIN.rowCount||
     (Array.isArray(parsed.errors)&&parsed.errors.length))
   throw error('CSV_COUNT_OR_PARSE');
  const reports=parsed.items.map(row=>auditBuild(row,snapshot));
  const names=new Set(reports.map(r=>r.speciesForm));
  if(names.size!==PIN.formCount||[...names].some(n=>!targets.has(n)))
   throw error('TARGET_SET');
  const summary={SOURCE_COMPATIBLE:0,REVIEW_REQUIRED:0,INVALID:0,OUTSIDE_SCOPE:0};
  for(const r of reports)summary[r.status]++;
  return Object.freeze({
   individualCount:PIN.rowCount,speciesFormCount:PIN.formCount,
   sourceCompatible:summary.SOURCE_COMPATIBLE,
   reviewRequired:summary.REVIEW_REQUIRED,invalid:summary.INVALID,
   calculation:'BLOCKED',userRowsRetained:false
  });
 }
 return Object.freeze({PIN,SUBSKILL_KEYS,MEW_SKILL_KEYS,SPECIAL_FOODS,
  validateSource,auditBuild,auditRoster});
});

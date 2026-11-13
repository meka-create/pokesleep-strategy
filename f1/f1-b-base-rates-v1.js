/* F1-B v3 / F1-C foundation: pinned, per-individual rate primitives.
 * NO weekly energy, skill effects, time-to-full-bag, user-row storage or UI.
 * Derivation: nitoyon/pokesleep-tool @ 663bf018 (PokemonIv/Nature/SubSkill/
 * NumberUtil/HelpCount); ribbon hours from wikiwiki.jp/poke_sleep.
 */
(function(root,factory){
'use strict';
const api=factory(typeof module==='object'&&module.exports?require('./f1-b-legal-build-v2.js'):root?.PokeF1LegalBuild);
if(typeof module==='object'&&module.exports)module.exports=api;
else if(root)root.PokeF1BaseRates=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(legal){
'use strict';
const LEVELS=[10,25,50,70,80],KEYS=['lv10','lv25','lv50','lv70','lv80'];
const neutral=['Bashful','Hardy','Docile','Quirky','Serious'];
const NATURE_MOD=Object.freeze({
 speedUp:['Lonely','Adamant','Naughty','Brave'],
 speedDown:['Bold','Timid','Calm','Modest'],
 ingUp:['Modest','Mild','Rash','Quiet'],
 ingDown:['Impish','Jolly','Adamant','Careful'],
 skillUp:['Calm','Gentle','Careful','Sassy'],
 skillDown:['Lax','Naive','Naughty','Rash']
});
const ribbonBonus=[0,1,3,6,8];
const ribbonHours=[0,200,500,1000,2000];
const RIBBON_FACTOR={
 0:[1,1,1,1,1],
 1:[1,1,.95,.95,.88],
 2:[1,1,.89,.89,.75]
};
const ADD={
 'Helping Speed M':2,'Helping Speed S':1,
 'Skill Trigger M':2,'Skill Trigger S':1,
 'Ingredient Finder M':2,'Ingredient Finder S':1,
 'Inventory Up L':3,'Inventory Up M':2,'Inventory Up S':1
};
const fail=(code)=>Object.assign(new Error('F1-B rate model: '+code),{code});
const trunc4=n=>Math.floor(Number((n*1e4).toFixed(6)))/1e4;
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
function validateTraits(snapshot,traits){
 if(!legal?.validateSource)throw fail('LEGALITY_LAYER_MISSING');
 const targets=legal.validateSource(snapshot);
 if(traits?.schema!=='pokesleep-strategy.f1-b-help-traits-v1'||
  traits?.status!=='BASE_RATE_ONLY_NOT_WEEKLY_ENERGY'||
  traits?.source?.commit!==snapshot.upstream.commit||
  traits?.source?.pokemonJsonBlob!==snapshot.upstream.pokemonJson.gitBlob||
  traits?.count!==66||!Array.isArray(traits?.traits)||traits.traits.length!==66)
  throw fail('TRAIT_PROVENANCE');
 const found=new Map();
 for(const v of traits.traits){
  if(!targets.has(v.name)||found.has(v.name)||
   targets.get(v.name).upstreamName!==v.upstreamName||
   !integer(v.evolutionCount,-1,4)||!integer(v.evolutionLeft,0,2))
   throw fail('TRAIT_IDENTITY');
  found.set(v.name,v);
 }
 if(found.size!==66)throw fail('TRAIT_SET');
 return found;
}
function natureFactor(nature,mint,kind){
 if(mint)return 1;
 const key={speed:['speedUp','speedDown'],ingredient:['ingUp','ingDown'],skill:['skillUp','skillDown']}[kind];
 if(!key)throw fail('NATURE_FACTOR');
 if(NATURE_MOD[key[0]].includes(nature))return kind==='speed'?.9:1.2;
 if(NATURE_MOD[key[1]].includes(nature))return kind==='speed'?1.075:.8;
 return 1;
}
function ribbonTier(hours){
 if(!Number.isFinite(hours)||hours<0)return null;
 for(let i=4;i>=1;i--)if(hours>=ribbonHours[i])return i;
 return 0;
}
function skillMax(skill){
 if(['Dream Shard Magnet S','Dream Shard Magnet S (Random)',
  'Dream Shard Magnet S (Aura Sphere)','Versatile'].includes(skill))return 8;
 if(['Ingredient Magnet S','Ingredient Magnet S (Plus)',
  'Ingredient Magnet S (Present)','Charge Strength M',
  'Charge Strength M (Bad Dreams)','Charge Strength S',
  'Charge Strength S (Random)','Charge Strength S (Stockpile)',
  'Extra Helpful S','Cooking Power-Up S','Cooking Power-Up S (Minus)',
  'Metronome','Skill Copy (Transform)','Skill Copy (Mimic)',
  'Ingredient Draw S','Ingredient Draw S (Super Luck)',
  'Ingredient Draw S (Hyper Cutter)','Cooking Assist S',
  'Cooking Assist S (Bulk Up)','Cooking Advance S',
  'Cooking Advance S (Mystical Fire)'].includes(skill))return 7;
 return 6;
}
function getIngredient(t,slot,jp,legalFood){
 const food=String(jp||'').normalize('NFKC').trim();
 if(!food)return null;
 if(legalFood){
  for(const [code,count] of Object.entries(legal.SPECIAL_FOODS[t.name][slot-1]))
   if(t.dictionaryIngredients[code]===food&&count>0)return {code,count};
  return null;
 }
 for(const entry of [t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3].slice(0,slot)){
  if(!entry||entry.name==='unknown'||!(entry['c'+slot]>0))continue;
  if(t.dictionaryIngredients[entry.name]===food)return {code:entry.name,count:entry['c'+slot]};
 }
 return null;
}
function evaluate(row,snapshot,traits,options={}){
 const byName=validateTraits(snapshot,traits);
 const prior=legal.auditBuild(row,snapshot);
 const block=(reason)=>Object.freeze({speciesForm:prior.speciesForm||null,calculation:'BLOCKED',
  model:'BASE_RATES_ONLY',status:'BLOCKED',reasons:Object.freeze([reason])});
 if(!prior.inScope)return block('OUTSIDE_F1_SCOPE');
 if(prior.status==='INVALID')return block('INVALID_BUILD');
 if(!integer(row.level,1,100)||!integer(row.skillLevel,1,8))return block('INVALID_LEVEL');
 if(row.mint!==true&&row.mint!==false)return block('UNKNOWN_MINT');
 if(!Number.isFinite(row.ribbon)||row.ribbon<0)return block('UNKNOWN_SLEEP_HOURS');
 if(!integer(options.teammateHelpingBonusCount??0,0,4)||
    (options.goodCamp!==undefined&&typeof options.goodCamp!=='boolean'))
  return block('INVALID_TEAM_OPTIONS');
 const t=snapshot.targets.find(t=>t.name===prior.speciesForm);
 if(row.skillLevel>skillMax(t.sourceProfile.mainSkill))return block('INVALID_SKILL_LEVEL');
 const tr=byName.get(prior.speciesForm);
 // CSV ribbon = sleeping hours, NOT the 0-4 ribbon tier in upstream PokemonIv.
 const ribbon=ribbonTier(row.ribbon);
 if(ribbon===null)return block('UNKNOWN_SLEEP_HOURS');
 const inverse=new Map(Object.entries(snapshot.dictionaries.natures).map(([code,jp])=>[jp,code]));
 const n=inverse.get(row.nature);if(!n)return block('NATURE_NOT_FOUND');
 if(row.mint&&neutral.includes(n))return block('MINT_ON_NEUTRAL_NATURE');
 // Toxicity form nature restrictions need dedicated verification to avoid false legality.
 if(t.upstreamName.startsWith('Toxtricity'))return block('TOXTRICITY_NATURE_FORM_UNMODELED');
 const names=Object.entries(snapshot.dictionaries.subskills).map(([code,jp])=>[jp,code]);
 const fromJapanese=new Map(names);
 const active=KEYS.filter((_,i)=>row.level>=LEVELS[i])
  .map(k=>fromJapanese.get(row[k])).filter(Boolean);
 const total=key=>active.reduce((sum,x)=>sum+(ADD[x]||0)*(x===key?1:0),0);
 const helpingFactor=Math.min(.35,.07*(total('Helping Speed M')+total('Helping Speed S'))+
  .05*((options.teammateHelpingBonusCount??0)+Number(active.includes('Helping Bonus'))));
 const speedNature=natureFactor(n,row.mint,'speed');
 const ri=tr.evolutionLeft;
 const ribbonFactor=RIBBON_FACTOR[ri]?.[ribbon];
 if(ribbonFactor===undefined)return block('RIBBON_FORM_UNKNOWN');
 const seconds=t.sourceProfile.frequency*
  trunc4(((501-row.level)/500)*speedNature*ribbonFactor*(1-helpingFactor))/
  (options.goodCamp?1.2:1);
 const ingRate=trunc4(t.sourceProfile.ingredientRate/100*
  natureFactor(n,row.mint,'ingredient')*
  (1+.18*(total('Ingredient Finder M')+total('Ingredient Finder S'))));
 const skillRate=trunc4(t.sourceProfile.skillRate/100*
  natureFactor(n,row.mint,'skill')*
  (1+.18*(total('Skill Trigger M')+total('Skill Trigger S'))));
 if(!Number.isFinite(seconds)||seconds<=0||ingRate<0||ingRate>1||
    skillRate<0||skillRate>1)return block('SOURCE_NUMERIC_INVALID');
 const carry=Math.ceil((t.sourceProfile.carryLimit+
  5*Math.max(0,tr.evolutionCount)+ribbonBonus[ribbon]+
  6*(total('Inventory Up L')+total('Inventory Up M')+total('Inventory Up S')))*
  (options.goodCamp?1.2:1));
 const berry=(t.specialty==='Berries'||t.specialty==='All'?2:1)+
  Number(active.includes('Berry Finding S'));
 const slots=[],special=!!legal.SPECIAL_FOODS[t.name];
 const withDictionary={...t,dictionaryIngredients:snapshot.dictionaries.ingredients};
 for(let slot=1;slot<=3;slot++){
  if(slot===2&&row.level<30)continue;
  if(slot===3&&row.level<60)continue;
  const ing=getIngredient(withDictionary,slot,row['ing'+slot],special);
  if(!ing)return block('UNVERIFIED_ACTIVE_INGREDIENT_SLOT_'+slot);
  slots.push(ing);
 }
 if(!slots.length)return block('NO_ACTIVE_INGREDIENT');
 const each=ingRate/slots.length;
 const perHelp={};
 for(const slot of slots)perHelp[slot.code]=(perHelp[slot.code]||0)+each*slot.count;
 const specialtyRateStatus=t.name==='ミュウ'?'UNVERIFIED_MEW_SELECTED_SKILL_RATE':'PINNED_SOURCE_BASE_RATE';
 return Object.freeze({
  speciesForm:t.name,calculation:'BLOCKED',model:'BASE_RATES_ONLY',
  status:prior.status==='SOURCE_COMPATIBLE'?'BASE_RATES_AVAILABLE':'SPECIAL_REVIEW_REQUIRED',
  sourceStatus:prior.status,
  // Values below are per completed normal help at fixed 0-energy frequency.
  // Never multiply by 24h here: energy, fullness, sleep/tap cycles are separate.
  referenceHelpSeconds:seconds,
  ingredientProbabilityPerHelp:ingRate,
  berryProbabilityPerHelp:1-ingRate,
  mainSkillProbabilityPerEligibleHelp:t.name==='ミュウ'?null:skillRate,
  skillRateStatus:specialtyRateStatus,
  berryCountPerBerryHelp:berry,
  ingredientCountsPerHelp:Object.freeze({...perHelp}),
  carryLimit:carry,
  ribbonTier:ribbon,
  selectedMainSkillLevel:row.skillLevel,
  // No user row, nickname, unmasked nature, level, or food slot values returned.
  energyStrength:null,
  userRowsRetained:false
 });
}
return Object.freeze({validateTraits,natureFactor,ribbonTier,skillMax,evaluate});
});

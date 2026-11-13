/* F1-C foundation: main-skill value tables transcribed from pinned
 * nitoyon/pokesleep-tool/src/util/MainSkill.ts @ 663bf018.
 * These are per-activation quantities, NOT expected daily/weekly energy.
 * Stateful / randomized / healing effects remain explicitly contextual.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF1SkillValues=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const TABLES=Object.freeze({
  'Charge Strength S':[400,569,785,1083,1496,2066,3212],
  'Charge Strength M':[880,1251,1726,2383,3290,4546,6858],
  'Charge Strength M (Bad Dreams)':[2640,3753,5178,7149,9870,13638,18515],
  'Charge Energy S':[12,16,21,27,34,43],
  'Energizing Cheer S':[12,15,20,25,33,44],
  'Energizing Cheer S (Heal Pulse)':[6,8,10,13,17,22],
  'Energy for Everyone S':[5,7,9,11,15,18],
  'Energy for Everyone S (Berry Juice)':[5,7,9,11,15,18],
  'Ingredient Magnet S':[6,8,11,14,17,21,24],
  'Ingredient Magnet S (Present)':[4,6,8,10,12,15,17],
  'Ingredient Draw S':[5,6,8,11,13,16,18],
  'Extra Helpful S':[6,7,8,9,10,11,12],
  'Cooking Power-Up S':[7,10,12,17,22,27,31],
  'Tasty Chance S':[4,5,6,7,8,10],
  'Berry Burst':[11,14,21,24,27,30],
  'Dream Shard Magnet S (Random)':[300,425,600,837.5,1150,1575,2250,2875]
 });
 const HELP_BOOST=Object.freeze({
  1:[2,3,3,4,4,5],2:[2,3,3,4,5,6],
  3:[3,4,5,6,7,8],4:[4,5,6,7,8,9],5:[6,7,8,9,10,11]
 });
 const RANDOM_CHARGE=Object.freeze([
  [200,800],[285,1138],[393,1570],[542,2166],[748,2992],
  [1033,4132],[1606,6424]
 ]);
 const CONTEXTUAL=new Set(['Charge Strength S (Stockpile)','Metronome',
  'Skill Copy (Transform)','Versatile']);
 const SPECIFIC_UNIT=Object.freeze({
  'Charge Energy S':'SELF_ENERGY_POINTS',
  'Energizing Cheer S':'TARGET_ENERGY_POINTS',
  'Energizing Cheer S (Heal Pulse)':'TARGET_ENERGY_POINTS',
  'Energy for Everyone S':'TEAM_ENERGY_POINTS_EACH',
  'Energy for Everyone S (Berry Juice)':'TEAM_ENERGY_POINTS_EACH',
  'Ingredient Magnet S':'INGREDIENT_ITEMS',
  'Ingredient Magnet S (Present)':'INGREDIENT_ITEMS',
  'Ingredient Draw S':'INGREDIENT_ITEMS',
  'Extra Helpful S':'EXTRA_HELPS',
  'Cooking Power-Up S':'POT_CAPACITY_DELTA',
  'Tasty Chance S':'EXTRA_TASTY_CHANCE_POINTS',
  'Berry Burst':'BERRIES',
  'Dream Shard Magnet S (Random)':'DREAM_SHARDS_EXPECTED',
  'Helper Boost':'EXTRA_HELPS_PER_MEMBER'
 });
 const fail=code=>Object.assign(new Error('F1-C skill values: '+code),{code});
 const maxLevel=skill=>{
  if(CONTEXTUAL.has(skill)&&skill==='Versatile')return 8;
  if(skill==='Dream Shard Magnet S (Random)')return 8;
  if(skill==='Helper Boost'||['Charge Energy S','Energizing Cheer S',
    'Energizing Cheer S (Heal Pulse)','Energy for Everyone S',
    'Energy for Everyone S (Berry Juice)','Tasty Chance S',
    'Berry Burst'].includes(skill))return 6;
  if(Object.hasOwn(TABLES,skill)||CONTEXTUAL.has(skill)||
     skill==='Charge Strength S (Random)')return 7;
  return null;
 };
 const output=(skill,level,status,unit,value,notes)=>Object.freeze({
  skill,level,status,unit,value,notes:Object.freeze(notes||[]),
  // Never pretend a per-proc figure equals expected energy.
  weeklyEnergy:null
 });
 function randomStrength(level,fieldBonusPercent=0){
  if(!Number.isInteger(level)||level<1||level>7||
     !Number.isFinite(fieldBonusPercent)||fieldBonusPercent<0||fieldBonusPercent>100)
   throw fail('RANDOM_ARGUMENT');
  const [lo,hi]=RANDOM_CHARGE[level-1];
  let result=0;
  for(let i=0;i<=150;i++)
   result+=Math.ceil((lo+(hi-lo)*i/150)*(1+fieldBonusPercent/100));
  return result/151;
 }
 function skillValue(skill,level,options={}){
  const cap=maxLevel(skill);
  if(cap===null)return output(skill,level,'UNSUPPORTED_SKILL',null,null,['UNKNOWN_SKILL']);
  if(!Number.isInteger(level)||level<1||level>cap)
   return output(skill,level,'INVALID_LEVEL',null,null,['SKILL_LEVEL_LIMIT']);
  if(!options||typeof options!=='object'||Array.isArray(options))
   throw fail('OPTIONS');
  const bonus=options.fieldBonusPercent??0;
  if(!Number.isFinite(bonus)||bonus<0||bonus>100)throw fail('FIELD_BONUS');
  if(CONTEXTUAL.has(skill))return output(skill,level,'CONTEXT_REQUIRED',null,null,
   [skill==='Versatile'?'MEW_SELECTED_SKILL_AND_CHANCE':'SKILL_STATE_OR_TARGET_REQUIRED']);
  if(skill==='Helper Boost'){
   const n=options.distinctSpeciesCount;
   if(!Number.isInteger(n)||n<1||n>5)
    return output(skill,level,'CONTEXT_REQUIRED',null,null,['DISTINCT_SPECIES_COUNT_REQUIRED']);
   return output(skill,level,'BASE_VALUE_ONLY',SPECIFIC_UNIT[skill],HELP_BOOST[n][level-1],
    ['TEAM_SPECIES_COMPOSITION_REQUIRED_FOR_TOTAL']);
  }
  if(skill==='Charge Strength S (Random)')
   return output(skill,level,'BASE_VALUE_ONLY','ENERGY_PER_ACTIVATION_EXPECTED',
    randomStrength(level,bonus),['151_EQUALLY_SPACED_RESULTS','CEIL_PER_ROLL']);
  const series=TABLES[skill];
  if(!series)return output(skill,level,'UNSUPPORTED_SKILL',null,null,['MISSING_SOURCE_TABLE']);
  const raw=series[level-1];
  if(skill.startsWith('Charge Strength ')){
   const notes=skill.includes('Bad Dreams')?['PARTIAL_NIGHTMARE_TEAM_ENERGY_COST_UNMODELED']:[];
   return output(skill,level,notes.length?'PARTIAL_SIDE_EFFECT_UNMODELED':'BASE_VALUE_ONLY',
    'ENERGY_PER_ACTIVATION',Math.ceil(raw*(1+bonus/100)),notes);
  }
  const note=[];
  if(skill==='Energy for Everyone S (Berry Juice)')note.push('BERRY_JUICE_EXTRA_EFFECT_UNMODELED');
  if(skill==='Energizing Cheer S (Heal Pulse)')note.push('HEAL_PULSE_EXTRA_EFFECT_UNMODELED');
  if(skill==='Ingredient Magnet S (Present)')note.push('PRESENT_ADDITIONAL_EFFECT_UNMODELED');
  if(skill==='Ingredient Draw S')note.push('INGREDIENT_SELECTION_AND_RANDOMNESS_UNMODELED');
  if(skill==='Berry Burst')note.push('BERRY_TYPES_AND_FIELD_BONUS_UNMODELED');
  if(skill==='Dream Shard Magnet S (Random)')note.push('RANDOM_RANGE_AVERAGE_ONLY');
  return output(skill,level,note.length?'PARTIAL_SIDE_EFFECT_UNMODELED':'BASE_VALUE_ONLY',
   SPECIFIC_UNIT[skill],raw,note);
 }
 return Object.freeze({TABLES,HELP_BOOST,RANDOM_CHARGE,CONTEXTUAL,maxLevel,
  randomStrength,skillValue});
});

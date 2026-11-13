/* F4-C v98: source-bounded official banquet rule math, NOT a full optimizer.
 * Exact public announcement https://www.pokemonsleep.net/news/343537333535313639323130383236373539/
 * No I/O, user data, skill-trigger guesses, or storage mutations.
 * New nut base strength, 3 new recipes, camp/Sunday stacking and rounding
 * are not supplied by the announcement: NEVER invent them.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4COfficialRules=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ID='pokesleep-tool:bountiful banquet week vol1:2026-11-16';
 const URL='https://www.pokemonsleep.net/news/343537333535313639323130383236373539/';
 const START='2026-11-16T04:00:00+09:00',END='2026-11-23T04:00:00+09:00';
 const EFFECTS=Object.freeze({ingredient:1,extraIng:'nuts',carryLimitAdd:10});
 const RULES=Object.freeze([
  'banquet-all-recipe-categories','banquet-ingredient-specialty-plus-one',
  'banquet-extra-nut-on-ingredient-help','banquet-carry-limit-plus-ten',
  'banquet-pot-capacity-plus-thirty',
  'banquet-nut-mandatory-recipe-energy-times-1.5',
  'banquet-nut-extra-ingredient-energy-times-1.5'
 ]);
 const blocked=(reason)=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false});
 const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const nat=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 const nonneg=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 // Only an owner-pinned upstream event with matching public bonus fields may
 // activate the arithmetic. Fake "manual" or other official event stays blocked.
 function match(source){
  if(!plain(source)||source.id!==ID||
   source.start!=='2026-11-16'||source.sourceKey!=='bountiful banquet week vol1'||
   !/^[a-f0-9]{40}$/.test(source.upstreamRevision||'')||
   source.verifiedTarget?.specialty!=='Ingredients'||!plain(source.verifiedEffects))
   return blocked('OFFICIAL_SOURCE_NOT_MATCHED');
  if(Object.keys(source.verifiedEffects).length!==3||
   Object.entries(EFFECTS).some(([k,v])=>source.verifiedEffects[k]!==v))
   return blocked('UNVERIFIED_OR_CHANGED_BONUS');
  return Object.freeze({status:'RULES_MATCHED_ONLY',eventId:ID,
   officialURL:URL,ruleCount:RULES.length,
   weeklyEnergyCertified:false,sourceAuthenticityCertified:false,
   writesSavedData:false});
 }
 function active(source,instant){
  const r=match(source);
  if(r.status==='BLOCKED')return r;
  if(typeof instant!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(instant)||
   !Number.isFinite(Date.parse(instant)))return blocked('INVALID_INSTANT');
  if(Date.parse(instant)<Date.parse(START)||Date.parse(instant)>=Date.parse(END))
   return blocked('EVENT_NOT_ACTIVE_AT_INSTANT');
  return r;
 }
 // Event skill bonus applies to a NORMAL INGREDIENT HELP only, never a berry
 // help, skill proc, or ingredient obtained from a main skill.
 function ingredientHelp(source,instant,help={}){
  const r=active(source,instant);if(r.status==='BLOCKED')return r;
  if(!plain(help)||!['Ingredients','Berries','Skills'].includes(help.specialty)||
   !['ingredient','berry','skill'].includes(help.kind)||!nat(help.count,0,100)||
   (help.kind==='ingredient'&&(typeof help.ingredient!=='string'||
    !/^[a-z][a-z0-9_]{0,39}$/.test(help.ingredient))))
   return blocked('HELP_INPUT_INVALID');
  if(help.kind!=='ingredient'||help.specialty!=='Ingredients')
   return Object.freeze({status:'RULE_APPLIED',bonusItems:0,
    extraNuts:0,resultKind:help.kind,
    weeklyEnergyCertified:false,writesSavedData:false});
  const count=help.count+1;
  // The extra nut is in addition to the improved original ingredient help.
  return Object.freeze({status:'RULE_APPLIED',ingredient:help.ingredient,
   ingredientCount:count,extraNuts:1,bonusItems:2,
   // Total count includes two separate additional items, even if original
   // ingredient itself is nuts: caller must merge both into one inventory key.
   totalItems:count+1,weeklyEnergyCertified:false,writesSavedData:false});
 }
 function carryCapacity(source,instant,input={}){
  const r=active(source,instant);if(r.status==='BLOCKED')return r;
  if(!plain(input)||!['Ingredients','Berries','Skills'].includes(input.specialty)||
   !nat(input.baseCapacity,1,1000))return blocked('CARRY_INPUT_INVALID');
  return Object.freeze({status:'RULE_APPLIED',
   capacity:input.baseCapacity+(input.specialty==='Ingredients'?10:0),
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 function cookingPot(source,instant,input={}){
  const r=active(source,instant);if(r.status==='BLOCKED')return r;
  if(!plain(input)||!nat(input.baseCapacity,1,5000)||
   typeof input.camp!=='boolean'||typeof input.sunday!=='boolean')
   return blocked('POT_INPUT_INVALID');
  if(input.camp||input.sunday)
   return blocked('POT_STACKING_ORDER_NOT_VERIFIED');
  return Object.freeze({status:'RULE_APPLIED',capacity:input.baseCapacity+30,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 // displayedRecipeEnergy must be the level-adjusted required-ingredients
 // energy BEFORE event/field/crit multiplier. If the recipe requires nuts,
 // multiply this component by 1.5; extras NEVER multiply the whole dish.
 function mealEnergyComponents(source,instant,input={}){
  const r=active(source,instant);if(r.status==='BLOCKED')return r;
  if(!plain(input)||!plain(input.requiredIngredients)||
   Object.keys(input.requiredIngredients).length===0||
   !Object.values(input.requiredIngredients).every(x=>nat(x,1,500))||
   !nonneg(input.displayedRecipeEnergy)||!nat(input.extraNutCount,0,500)||
   !nonneg(input.nutUnitEnergy))
   return blocked('MEAL_INPUT_INCOMPLETE');
  if(input.nutUnitEnergy===0&&input.extraNutCount>0)
   return blocked('NUT_ENERGY_SOURCE_MISSING');
  const nutRequired=nat(input.requiredIngredients.nuts,1,500);
  const base=input.displayedRecipeEnergy;
  const mandatory=nutRequired?base*1.5:base;
  const extraNuts=input.extraNutCount*input.nutUnitEnergy*1.5;
  return Object.freeze({status:'RULE_APPLIED',mandatoryNutRecipe:nutRequired,
   baseRequiredEnergy:base,requiredEnergyAfterEvent:mandatory,
   extraNutsEnergyAfterEvent:extraNuts,subtotalBeforeFieldAndCritical:mandatory+extraNuts,
   excludedOtherExtraIngredients:true,roundingUnverified:true,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 function coverage(source,input={},deps={}){
  const matched=match(source);if(matched.status==='BLOCKED')return matched;
  if(!Array.isArray(input.ingredientCodes)||!input.ingredientCodes.includes('nuts')||
   input.ingredientCodes.length<20||!Array.isArray(input.recipes)||input.recipes.length<81)
   return blocked('RELEASE_CATALOG_NOT_AVAILABLE');
  if(!plain(input.catalogProvenance)||
   input.catalogProvenance.verifiedAgainstOfficialRelease!==true||
   !/^[a-f0-9]{40}$/.test(input.catalogProvenance.sourceCommit||''))
   return blocked('RELEASE_CATALOG_UNVERIFIED');
  if(typeof deps.eventGate?.inspect!=='function')return blocked('BONUS_GATE_MISSING');
  const report=deps.eventGate.inspect({source,
   implementedEffects:Object.keys(EFFECTS),
   implementedOfficialRules:[...RULES],
   ingredientCodes:input.ingredientCodes,recipes:input.recipes,
   catalogProvenance:input.catalogProvenance});
  if(report.status!=='BONUS_COVERAGE_DECLARED')
   return blocked(report.reason||'RELEASE_COVERAGE_BLOCKED');
  return Object.freeze({status:'RULES_AND_CATALOG_DECLARED',
   eventId:ID,weeklyEnergyCertified:false,
   sourceAuthenticityCertified:false,writesSavedData:false,
   note:'Only rule/math coverage; no game-week health, queues, skills or energy certification.'});
 }
 return Object.freeze({ID,URL,START,END,EFFECTS,RULES,
  match,active,ingredientHelp,carryCapacity,cookingPot,
  mealEnergyComponents,coverage});
});

/* F4 pre-start independent audit v90:
 * Provenance/coverage gate for EVENT BONUSES ONLY.
 * This does NOT compute energy and CANNOT certify a 21+21+7 optimization.
 * Pure: no fetch, storage, box records, user identifiers, or UI modifications.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4EventModelGate=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const EVENT_ID='pokesleep-tool:bountiful banquet week vol1:2026-11-16';
 const RELEASE_DATE='2026-11-16T04:00:00+09:00';
 const OFFICIAL_URL='https://www.pokemonsleep.net/news/343537333535313639323130383236373539/';
 const REQUIRED_SPECIAL=Object.freeze([
  'banquet-all-recipe-categories',
  'banquet-ingredient-specialty-plus-one',
  'banquet-extra-nut-on-ingredient-help',
  'banquet-carry-limit-plus-ten',
  'banquet-pot-capacity-plus-thirty',
  'banquet-nut-mandatory-recipe-energy-times-1.5',
  'banquet-nut-extra-ingredient-energy-times-1.5'
 ]);
 const SOURCE_EXPECTED=Object.freeze({extraIng:'nuts',ingredient:1,carryLimitAdd:10});
 const VALID_EFFECTS=new Set([
  'dish','potSize','skillTrigger','dreamShard','skillIngredient',
  'ingredientMagnet','ingredientDraw','berryBurst','carryLimitMul',
  'skillLevel','ingredient','berry','energyFromDish',
  'carryLimitAdd','globalCarryLimitAdd','fixedBerries','fixedAreas',
  'extraIng','bigBerry'
 ]);
 const blocked=(reason,details={})=>Object.freeze({
  status:'BLOCKED',reason,scope:'EVENT_BONUS_COVERAGE_ONLY',
  weeklyOptimizationCertified:false,sourceAuthenticityCertified:false,...details});
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const isPlain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===null||
   Object.getPrototypeOf(Object.getPrototypeOf(o))===null);
 const validModels=v=>Array.isArray(v)&&v.length<=100&&
  v.every(x=>typeof x==='string'&&x.length>0&&x.length<=100)&&
  new Set(v).size===v.length;
 const hasAll=(list,need)=>need.every(x=>list.includes(x));
 // One immutable official event rule manifest, separate from upstream
 // event.json: it does NOT include the pot +30 / nuts energy x1.5 effects.
 const BOUNTIFUL_BANQUET=Object.freeze({
  eventId:EVENT_ID,releaseDate:RELEASE_DATE,officialURL:OFFICIAL_URL,
  officialEventPeriod:'2026-11-16T04:00:00+09:00/2026-11-23T04:00:00+09:00',
  eventTarget:'Ingredients',sourceEffects:SOURCE_EXPECTED,
  potCapacityBonus:30,mandatoryNutsRecipeMultiplier:1.5,
  extraNutsIngredientMultiplier:1.5,allFoodCategories:true,
  requiredImplementations:REQUIRED_SPECIAL
 });
 function inspect(input={}){
  if(!isPlain(input)||!isPlain(input.source))
   return blocked('EVENT_SOURCE_NOT_CONFIRMED');
  const {source}=input;
  const implementedEffects=input.implementedEffects??[];
  const implementedRules=input.implementedOfficialRules??[];
  if(!validModels(implementedEffects)||!validModels(implementedRules))
   return blocked('INVALID_MODEL_DECLARATION');
  if(!isPlain(source.verifiedEffects)||!isPlain(source.verifiedTarget)||
   typeof source.id!=='string'||typeof source.start!=='string'||
   typeof source.upstreamRevision!=='string')
   return blocked('UNVERIFIED_EVENT_SOURCE');
  const effects=source.verifiedEffects;
  const sourceEffects=Object.keys(effects);
  // No implicit extension from a previously supported effect to a newly
  // added effect or to F3's numeric-only "energyProxy".
  if(sourceEffects.some(k=>!VALID_EFFECTS.has(k)))
   return blocked('UNKNOWN_EVENT_EFFECT',{effectKeys:sourceEffects});
  if(!hasAll(implementedEffects,sourceEffects))
   return blocked('EVENT_EFFECT_NOT_MODELED',
    {unmodeledEffects:sourceEffects.filter(k=>!implementedEffects.includes(k))});
  if(source.id===EVENT_ID){
   // The bundled 11/16 upstream event has only three source fields. Those
   // must match the official special case, or bonus coverage is unsafe.
   if(source.start!=='2026-11-16'||source.sourceKey!=='bountiful banquet week vol1'||
    source.verifiedTarget.specialty!=='Ingredients'||
    Object.entries(SOURCE_EXPECTED).some(([k,v])=>effects[k]!==v))
    return blocked('UPSTREAM_OFFICIAL_CONFLICT');
   if(!hasAll(implementedRules,REQUIRED_SPECIAL))
    return blocked('OFFICIAL_EVENT_RULES_NOT_MODELED',{
     officialURL:OFFICIAL_URL,
     unmodeledRules:REQUIRED_SPECIAL.filter(k=>!implementedRules.includes(k))});
   const codes=input.ingredientCodes,recipes=input.recipes,catalog=input.catalogProvenance;
   if(!Array.isArray(codes)||!codes.includes('nuts')||
    codes.length<20||new Set(codes).size!==codes.length||
    !Array.isArray(recipes)||recipes.length<81)
    return blocked('NEW_INGREDIENT_OR_RECIPES_MISSING');
   if(!['curry','salad','dessert'].every(type=>
    recipes.some(row=>row&&row.type===type&&
     isPlain(row.requirements)&&Number.isSafeInteger(row.requirements.nuts)&&
     row.requirements.nuts>0)))
    return blocked('RECIPE_CATEGORY_GAP');
   if(!isPlain(catalog)||catalog.verifiedAgainstOfficialRelease!==true||
    typeof catalog.sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(catalog.sourceCommit))
    return blocked('RECIPE_PROVENANCE_UNVERIFIED');
   return Object.freeze({status:'BONUS_COVERAGE_DECLARED',
    scope:'EVENT_BONUS_COVERAGE_ONLY',
    eventId:EVENT_ID,officialURL:OFFICIAL_URL,
    verifiedEventSupplement:BOUNTIFUL_BANQUET,
    weeklyOptimizationCertified:false,sourceAuthenticityCertified:false,
    note:'This is an engineering coverage declaration, not verified energy or schedule output.'});
  }
  // Manual or other events are never silently mapped onto the Nov 16 official
  // special case. F4 must apply their own independently verified rules.
  return Object.freeze({status:'UPSTREAM_EFFECT_COVERAGE_DECLARED',
   scope:'EVENT_BONUS_COVERAGE_ONLY',eventId:source.id,
   weeklyOptimizationCertified:false,sourceAuthenticityCertified:false});
 }
 return Object.freeze({EVENT_ID,OFFICIAL_URL,BOUNTIFUL_BANQUET,inspect});
});

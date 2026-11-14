/* F4-C v103: official 11/16 rule arithmetic adapter, NOT event optimization.
 * It is possible to verify KNOWN +1/+nut/+10/pot+30/recipe×1.5 math
 * before the new three recipes or nut unit energy are released.
 * Never convert the verified event to the neutral weekly optimizer.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CBanquetPreviewV103=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=(reason)=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false,
  sourceAuthenticityCertified:false,privateIndividualDataInResult:false});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 function evaluate(input={},deps={}){
  if(!plain(input)||!plain(input.source)||typeof input.instant!=='string'||
   !plain(input.help)||!plain(input.capacity)||
   !plain(input.meal)||!plain(input.pot)||
   typeof deps.officialRules?.active!=='function'||
   typeof deps.officialRules?.ingredientHelp!=='function'||
   typeof deps.officialRules?.carryCapacity!=='function'||
   typeof deps.officialRules?.mealEnergyComponents!=='function'||
   typeof deps.officialRules?.cookingPot!=='function')
   return blocked('EXPLICIT_OFFICIAL_RULE_INPUT_REQUIRED');
  const official=deps.officialRules;
  const active=official.active(input.source,input.instant);
  if(active.status==='BLOCKED')return blocked(active.reason);
  const help=official.ingredientHelp(input.source,input.instant,input.help);
  const held=official.carryCapacity(input.source,input.instant,input.capacity);
  const meal=official.mealEnergyComponents(input.source,input.instant,input.meal);
  const pot=official.cookingPot(input.source,input.instant,input.pot);
  if(help.status==='BLOCKED'||held.status==='BLOCKED'||
   meal.status==='BLOCKED')return blocked(
    [help,held,meal].find(x=>x.status==='BLOCKED').reason);
  // Pot with camp/Sunday stacking remains explicitly unknown in v98 and is
  // NOT inferred from the normal pot+30 rule.
  if(pot.status==='BLOCKED'&&pot.reason!=='POT_STACKING_ORDER_NOT_VERIFIED')
   return blocked(pot.reason);
  return Object.freeze({status:'PARTIAL_OFFICIAL_RULES_ONLY',
   eventId:official.ID,officialURL:official.URL,
   bonusOriginalIngredientCount:help.ingredientCount??null,
   bonusExtraNuts:help.extraNuts,
   carryCapacityAfterBonus:held.capacity,
   ordinaryPotOnly:pot.status==='RULE_APPLIED'?pot.capacity:null,
   potSundayCampStackingVerified:pot.status==='RULE_APPLIED',
   baseRecipeMultiplierApplied:meal.mandatoryNutRecipe?1.5:1,
   recipeEnergyBeforeFieldAndCritical:meal.subtotalBeforeFieldAndCritical,
   eventAllFoodCategories:true,
   missingReleaseData:['nuts_unit_energy','3_recipe_ingredient_quantities',
    '3_recipe_base_energies','release_commit_verification'],
   weeklyEnergyCertified:false,writesSavedData:false,
   sourceAuthenticityCertified:false,privateIndividualDataInResult:false});
 }
 return Object.freeze({evaluate});
});

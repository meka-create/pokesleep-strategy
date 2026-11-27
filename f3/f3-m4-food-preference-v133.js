/* M4 v133: preserve all preparation categories while using only the
 * confirmed event-week cooking category for F4/F5 recipe priorities.
 * Read-only projection: no bag edits, silent target reallocation or storage.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeM4PrepFoodPreferenceV133=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const TYPES=Object.freeze(['curry','salad','dessert']);
 const fail=reason=>Object.freeze({status:'BLOCKED',reason,writesSavedData:false});
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function project(input){
  try{
   const {categories,selectedRecipes,targetCounts,food}=input||{};
   if(!Array.isArray(categories)||categories.length<1||categories.length>3||
    new Set(categories).size!==categories.length||
    categories.some(c=>!TYPES.includes(c))||
    !['curry','salad','dessert','all'].includes(food)||
    !plain(selectedRecipes)||!plain(targetCounts)||
    Object.keys(selectedRecipes).length!==categories.length||
    Object.keys(targetCounts).length!==categories.length||
    categories.some(c=>typeof selectedRecipes[c]!=='string'||!selectedRecipes[c]||
     !Number.isSafeInteger(targetCounts[c])||targetCounts[c]<1||targetCounts[c]>21)||
    Object.keys(selectedRecipes).some(c=>!categories.includes(c))||
    Object.keys(targetCounts).some(c=>!categories.includes(c))||
    (food==='all'&&categories.reduce((n,c)=>n+targetCounts[c],0)>21))
    return fail('M4_PREP_PREFERENCE_INVALID');
   const eligible=categories.filter(c=>food==='all'||c===food);
   const excluded=categories.filter(c=>!eligible.includes(c));
   return Object.freeze({status:'READY',
    selectedRecipes:Object.freeze(Object.fromEntries(eligible.map(c=>[c,selectedRecipes[c]]))),
    targetCounts:Object.freeze(Object.fromEntries(eligible.map(c=>[c,targetCounts[c]]))),
    allCategories:Object.freeze([...categories]),
    excludedCategories:Object.freeze(excluded),
    eventFood:food,
    preparedMealCount:categories.reduce((n,c)=>n+targetCounts[c],0),
    eligibleMealCount:eligible.reduce((n,c)=>n+targetCounts[c],0),
    writesSavedData:false,sourcePreferencePreserved:true});
  }catch(_){return fail('M4_PREP_PREFERENCE_INVALID');}
 }
 return Object.freeze({TYPES,project});
});

/* F4-C v103: fail-closed release catalog staging, BEFORE 2026-11-16.
 *
 * The 11/04 official event announcement CONFIRMS only:
 * - nuts ingredient name, 3 new recipe categories and ingredient NAMES,
 * - each recipe's aggregate required item count (39, 121, 91),
 * - 11/16 04:00 JST event start, all categories and seven bonuses.
 * It DOES NOT publish new recipe names, per-food counts or base strengths.
 *
 * A syntactically valid 20/81 catalog is not verified release data.
 * No release commit can be pinned before independently checking its contents.
 * PINNED_RELEASE_SHA is deliberately null: activation always BLOCKED until
 * a future audited commit changes this file and passes release regressions.
 *
 * Pure functions, no private CSV, persistence, fetch, browser or I/O.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CBanquetCatalogV103=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const LEGACY=Object.freeze(['leek','mushroom','egg','potato','apple','herb',
  'sausage','milk','honey','oil','ginger','tomato','cacao','tail','soy',
  'corn','coffee','pumpkin','avocado']);
 const FOOD=Object.freeze([...LEGACY,'nuts']);
 const FOOD_LABEL='ひとくちナッツ';
 const RELEASE_START='2026-11-16T04:00:00+09:00';
 const RECIPE_SPECS=Object.freeze([
  Object.freeze({type:'curry',codes:Object.freeze(['corn','pumpkin','nuts']),total:39}),
  Object.freeze({type:'salad',codes:Object.freeze(['ginger','tomato','avocado','nuts']),total:121}),
  Object.freeze({type:'dessert',codes:Object.freeze(['egg','tail','soy','nuts']),total:91})
 ]);
 // Deliberately NO synthetic/placeholder/unchecked release commit in
 // this allowlist. A later documented, independently audited change is
 // required before event optimizer integration can even be considered.
 const PINNED_RELEASE_SHA=null;
 const blocked=(reason,extra={})=>Object.freeze({
  status:'BLOCKED',reason,canActivate:false,weeklyEnergyCertified:false,
  sourceAuthenticityCertified:false,writesSavedData:false,
  privateIndividualDataInResult:false,...extra});
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const integer=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
 const validObject=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&
  keys.every(k=>Object.hasOwn(o,k));
 const validRequirements=(requirements,allowed)=>{
  if(!plain(requirements)||!Object.keys(requirements).length||
   Object.keys(requirements).some(k=>!allowed.includes(k)))return false;
  return Object.values(requirements).every(n=>integer(n,1,999));
 };
 const signature=r=>JSON.stringify([r.id,r.type,r.name,r.baseStrength,
  Object.entries(r.requirements).sort((a,b)=>a[0].localeCompare(b[0]))]);
 const cleanRecipe=(r,allowed)=>plain(r)&&
  typeof r.id==='string'&&/^[a-z][a-z0-9_]{1,79}$/.test(r.id)&&
  ['curry','salad','dessert'].includes(r.type)&&
  typeof r.name==='string'&&r.name.trim().length>=2&&r.name.length<=120&&
  integer(r.baseStrength,1,1000000)&&validRequirements(r.requirements,allowed);
 const byId=rows=>new Map(rows.map(r=>[r.id,r]));
 const validIso=t=>typeof t==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(t)&&
  Number.isFinite(Date.parse(t));
 function preflight(input={}){
  if(!plain(input)||!Array.isArray(input.baselineRecipes)||
   !Array.isArray(input.releaseRecipes)||
   input.baselineRecipes.length!==78||input.releaseRecipes.length!==81||
   !plain(input.baselineIngredientNames)||!plain(input.releaseIngredientNames)||
   !plain(input.baselineStrengths)||!plain(input.releaseStrengths))
   return blocked('CATALOG_INPUT_INCOMPLETE');
  if(!validObject(input.baselineIngredientNames,LEGACY)||
   !validObject(input.releaseIngredientNames,FOOD)||
   !validObject(input.baselineStrengths,LEGACY)||
   !validObject(input.releaseStrengths,FOOD))
   return blocked('FOOD_CODE_SET_CHANGED');
  for(const code of LEGACY){
   if(typeof input.baselineIngredientNames[code]!=='string'||
    input.baselineIngredientNames[code]!==input.releaseIngredientNames[code]||
    !integer(input.baselineStrengths[code],1,10000)||
    input.baselineStrengths[code]!==input.releaseStrengths[code])
    return blocked('LEGACY_FOOD_MUTATED',{code});
  }
  if(input.releaseIngredientNames.nuts!==FOOD_LABEL||
   !integer(input.releaseStrengths.nuts,1,10000))
   return blocked('NUT_STRENGTH_NOT_VERIFIED');
  const baseline=input.baselineRecipes,next=input.releaseRecipes;
  if(!baseline.every(r=>cleanRecipe(r,LEGACY))||
   !next.every(r=>cleanRecipe(r,FOOD))||
   byId(baseline).size!==78||byId(next).size!==81)
   return blocked('RECIPES_INVALID');
  const old=byId(baseline),updated=byId(next);
  for(const [id,r] of old){
   if(!updated.has(id)||signature(updated.get(id))!==signature(r))
    return blocked('LEGACY_RECIPE_REGRESSION',{recipeId:id});
  }
  const additions=next.filter(r=>!old.has(r.id));
  if(additions.length!==3)return blocked('THREE_NEW_RECIPES_REQUIRED');
  for(const spec of RECIPE_SPECS){
   const candidates=additions.filter(r=>r.type===spec.type);
   if(candidates.length!==1)return blocked('NEW_RECIPE_CATEGORY_INVALID');
   const r=candidates[0],keys=Object.keys(r.requirements).sort();
   if(JSON.stringify(keys)!==JSON.stringify([...spec.codes].sort()))
    return blocked('NEW_RECIPE_INGREDIENT_SET_MISMATCH',{category:spec.type});
   if(Object.values(r.requirements).reduce((a,b)=>a+b,0)!==spec.total)
    return blocked('NEW_RECIPE_TOTAL_MISMATCH',{category:spec.type});
  }
  const prov=input.provenance;
  if(!plain(prov)||prov.repository!=='nitoyon/pokesleep-tool'||
   !/^[0-9a-f]{40}$/.test(prov.sourceCommit||'')||
   !validIso(prov.releaseObservedAt)||
   Date.parse(prov.releaseObservedAt)<Date.parse(RELEASE_START)||
   prov.verifiedAgainstOfficialRelease!==true)
   return blocked('RELEASE_PROVENANCE_NOT_VERIFIED');
  // This is only structural, even when provenance claims "verified".
  // Such a user/third-party-provided assertion cannot authenticate itself.
  return Object.freeze({status:'STRUCTURE_READY_NOT_AUTHENTICATED',
   newIngredientCode:'nuts',newRecipeCount:3,
   legacyRecipeCount:78,releaseRecipeCount:81,
   ingredientCount:20,sourceCommit:prov.sourceCommit,
   officialRecipeTotals:[39,121,91],
   canActivate:false,sourceAuthenticityCertified:false,
   weeklyEnergyCertified:false,writesSavedData:false,
   privateIndividualDataInResult:false,
   requiresIndependentReleaseCommitPin:true});
 }
 function activate(input={},deps={}){
  const staged=preflight(input);
  if(staged.status!=='STRUCTURE_READY_NOT_AUTHENTICATED')return staged;
  if(PINNED_RELEASE_SHA===null)
   return blocked('RELEASE_COMMIT_NOT_PINNED');
  if(input.provenance.sourceCommit!==PINNED_RELEASE_SHA)
   return blocked('RELEASE_SOURCE_COMMIT_NOT_APPROVED');
  if(typeof deps.officialRules?.coverage!=='function'||
   typeof deps.eventGate?.inspect!=='function')
   return blocked('EVENT_MODEL_DEPS_MISSING');
  const coverage=deps.officialRules.coverage(input.eventSource,{
   ingredientCodes:FOOD,recipes:input.releaseRecipes,
   catalogProvenance:{
    sourceCommit:PINNED_RELEASE_SHA,
    verifiedAgainstOfficialRelease:true
   }
  },{eventGate:deps.eventGate});
  if(coverage.status!=='RULES_AND_CATALOG_DECLARED')
   return blocked(coverage.reason||'EVENT_BONUS_COVERAGE_INCOMPLETE');
  return Object.freeze({status:'RELEASE_CATALOG_PINNED_ONLY',
   recipeCount:81,ingredientCount:20,
   weeklyEnergyCertified:false,writesSavedData:false,
   sourceAuthenticityCertified:true,
   optimizedForEvent:false});
 }
 // Read-only event-owned migration PREVIEW. Do not mutate the old v2 record.
 // E7 v78 currently accepts exactly 19 named foods, so a 20-key snapshot
 // MUST NEVER be automatically saved under that existing schema.
 function inventoryPreview(input={}){
  const t=input.timeline,week=input.weekStart,eventId=input.eventId;
  if(!plain(t)||t.version!==2||typeof week!=='string'||
   !/^\d{4}-\d\d-\d\d$/.test(week)||
   new Date(week+'T12:00:00Z').getUTCDay()!==1||
   t.weekStart!==week||t.eventId!==eventId||
   typeof eventId!=='string'||!eventId.trim()||eventId.length>160||
   !plain(input.baselineIngredientNames)||
   !validObject(input.baselineIngredientNames,LEGACY))
   return blocked('INVENTORY_OWNER_NOT_CONFIRMED');
  const fieldNames=LEGACY.map(k=>input.baselineIngredientNames[k]);
  if(new Set(fieldNames).size!==19||
   input.baselineIngredientNames.nuts!==undefined||
   fieldNames.includes(FOOD_LABEL))
   return blocked('LEGACY_FOOD_NAMES_INVALID');
  const fields=[...fieldNames,FOOD_LABEL];
  const hasSnapshots=['preparationLatest','startInventory','currentInventory'];
  if(hasSnapshots.some(k=>!Object.hasOwn(t,k)))
   return blocked('INVENTORY_TIMELINE_INCOMPLETE');
  if(!plain(t.currentInventory))return blocked('CURRENT_INVENTORY_MISSING');
  const oldStatus={};
  for(const key of hasSnapshots){
   const snapshot=t[key];
   if(snapshot===null){oldStatus[key]=null;continue;}
   if(!plain(snapshot)||snapshot.weekStart!==week||
    typeof snapshot.revision!=='string'||!snapshot.revision||
    !validIso(snapshot.savedAt)||!plain(snapshot.values))
    return blocked('INVENTORY_SNAPSHOT_INVALID');
   const values=snapshot.values;
   if(![19,20].includes(Object.keys(values).length)||
    Object.keys(values).some(k=>!fields.includes(k))||
    fieldNames.some(k=>!integer(values[k],0,10000))||
    (Object.hasOwn(values,FOOD_LABEL)&&!integer(values[FOOD_LABEL],0,10000)))
    return blocked('INVENTORY_FOOD_SET_MISMATCH');
   oldStatus[key]=Object.hasOwn(values,FOOD_LABEL)?20:19;
  }
  if((oldStatus.preparationLatest===null)!==(oldStatus.startInventory===null))
   return blocked('INVENTORY_BASELINE_CONFLICT');
  if(t.preparationLatest&&JSON.stringify(t.preparationLatest)!==
   JSON.stringify(t.startInventory))
   return blocked('INVENTORY_BASELINE_CONFLICT');
  if(oldStatus.currentInventory===20&&
   (oldStatus.preparationLatest===19||oldStatus.startInventory===19))
   return blocked('MIXED_FOOD_TIMELINE_UNSAFE');
  if(oldStatus.currentInventory===20)
   return Object.freeze({status:'ALREADY_20_FOODS_NO_WRITE',
    timeline:{
     ...t,preparationLatest:t.preparationLatest&&{
      ...t.preparationLatest,values:{...t.preparationLatest.values}},
     startInventory:t.startInventory&&{
      ...t.startInventory,values:{...t.startInventory.values}},
     currentInventory:{...t.currentInventory,values:{...t.currentInventory.values}}
    },canActivate:false,requiresExplicitCommit:false,
    weeklyEnergyCertified:false,writesSavedData:false});
  if(oldStatus.currentInventory!==19||
   (oldStatus.preparationLatest===20||oldStatus.startInventory===20))
   return blocked('MIXED_FOOD_TIMELINE_UNSAFE');
  const recorded=Date.parse(t.currentInventory.savedAt);
  // After release the actual count might be nonzero. Never treat omitted
  // user input as zero; require an explicit stock reconciliation.
  const afterRelease=recorded>=Date.parse(RELEASE_START);
  if(afterRelease&&!integer(input.explicitCurrentNuts,0,10000))
   return blocked('POST_RELEASE_NUT_COUNT_REQUIRED');
  if(!afterRelease&&input.explicitCurrentNuts!=null)
   return blocked('PRE_RELEASE_NUT_COUNT_CANNOT_BE_INFERRED');
  function add(snapshot,key){
   if(!snapshot)return null;
   // No nuts existed at the PRE-EVENT baseline; keep it 0 even if
   // the currentInventory is after the release.
   const amount=key==='currentInventory'&&afterRelease?
    input.explicitCurrentNuts:0;
   return {...snapshot,values:{...snapshot.values,[FOOD_LABEL]:amount}};
  }
  return Object.freeze({status:'PREVIEW_REQUIRES_EXPLICIT_COMMIT',
   timeline:{...t,preparationLatest:add(t.preparationLatest,'preparationLatest'),
    startInventory:add(t.startInventory,'startInventory'),
    currentInventory:add(t.currentInventory,'currentInventory')},
   oldFieldCount:19,newFieldCount:20,
   requiresExplicitCommit:true,requiresE7SchemaUpdate:true,
   canActivate:false,weeklyEnergyCertified:false,writesSavedData:false,
   containsLocalInventoryValues:true});
 }
 return Object.freeze({LEGACY,FOOD,FOOD_LABEL,RELEASE_START,
  RECIPE_SPECS,PINNED_RELEASE_SHA,preflight,activate,inventoryPreview});
});

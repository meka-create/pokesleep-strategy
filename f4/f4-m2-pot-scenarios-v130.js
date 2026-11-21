/* M2 v130: advisory Cooking Power-Up S 0/1/2-cast recipe-capacity scenarios.
 * A capacity check is NOT a skill-proc prediction or ingredient guarantee.
 * Reuses v102 skill values, pot reset, Sunday and camp formula. No I/O.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeM2PotScenariosV130=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=reason=>Object.freeze({status:'BLOCKED',reason,
  assumption:'REFERENCE_ONLY',triggerProbabilityModeled:false,
  ingredientInventoryChecked:false,writesSavedData:false});
 const ok=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 const types=new Set(['curry','salad','dessert','all']);
 function evaluate(input={},deps={}){
  try{
   if(!Number.isSafeInteger(input.basePot)||input.basePot<7||input.basePot>5000||
    !Number.isSafeInteger(input.skillLevel)||input.skillLevel<1||input.skillLevel>8||
    !Number.isSafeInteger(input.day)||input.day<0||input.day>6||
    typeof input.camp!=='boolean'||!types.has(input.foodMode)||
    !ok(input.eventPotMultiplier??1,1,20)||
    !Array.isArray(input.recipes)||input.recipes.length<1||
    input.recipes.length>200||
    !deps.cookingSkills?.capacity||!deps.cookingSkills?.cast||
    !deps.cookingSkills?.initial||!deps.skillValues?.skillValue)
    return blocked('M2_POT_SCENARIO_INPUT_INVALID');
   const potFactor=input.eventPotMultiplier??1;
   // Take the lower integer bound for a fractional event pot multiplier.
   // Borderline recipes must not be declared possible on unverified rounding.
   const base=Math.floor(input.basePot*potFactor+1e-9);
   if(base<7||base>5000)return blocked('M2_EVENT_POT_UNVERIFIED');
   const effects=deps.skillValues.skillValue('Cooking Power-Up S',input.skillLevel);
   if(effects.status!=='BASE_VALUE_ONLY'||
    effects.unit!=='POT_CAPACITY_DELTA'||
    !Number.isSafeInteger(effects.value)||effects.value<1||effects.value>200)
    return blocked('M2_POT_SKILL_LEVEL_UNVERIFIED');
   const recipes=input.recipes.filter(r=>r&&
    (input.foodMode==='all'||r.type===input.foodMode));
   if(!recipes.length||recipes.some(r=>!Number.isSafeInteger(r.strength70)||
    r.strength70<=0||r.strength70>5000000||
    !r.requirements||typeof r.requirements!=='object'||
    Array.isArray(r.requirements)||!Object.keys(r.requirements).length||
    Object.values(r.requirements).some(v=>!Number.isSafeInteger(v)||v<1||v>500)))
    return blocked('M2_POT_RECIPES_UNVERIFIED');
   const candidates=recipes.map(r=>({...r,size:Object.values(r.requirements).reduce((a,b)=>a+b,0)}));
   const top=[...candidates].sort((a,b)=>b.strength70-a.strength70||
    a.id.localeCompare(b.id)).slice(0,5);
   let state=deps.cookingSkills.initial({potExtra:0,tastyExtra:0});
   if(state.status!=='STATE_READY')return blocked('M2_POT_STATE_INVALID');
   const rows=[];
   for(let casts=0;casts<=2;casts++){
    if(casts>0){
     const applied=deps.cookingSkills.cast(state,{skill:'Cooking Power-Up S',
      level:input.skillLevel,count:1},{skillValues:deps.skillValues});
     if(applied.status!=='APPLIED')return blocked('M2_POT_APPLY_INVALID');
     state=applied.state;
    }
    const outcome=deps.cookingSkills.capacity(state,{
     basePot:base,sunday:input.day===6,camp:input.camp});
    if(outcome.status!=='CAPACITY_READY')return blocked('M2_POT_CAPACITY_INVALID');
    rows.push({casts,capacity:outcome.capacity,
     available:top.filter(r=>r.size<=outcome.capacity)
      .map(r=>({id:r.id,name:r.name,size:r.size,strength70:r.strength70})),
     unlocked:top.filter(r=>r.size<=outcome.capacity&&
      (casts===0||r.size>rows[casts-1].capacity))
      .map(r=>({id:r.id,name:r.name,size:r.size,strength70:r.strength70}))});
   }
   const changed=rows.some(r=>r.casts>0&&r.unlocked.length>0);
   return Object.freeze({status:'SCENARIOS_READY',model:'M2_V130_POT_CAPACITY_ONLY',
    basePot:input.basePot,skillLevel:input.skillLevel,
    skillBonusPerCast:effects.value,eventPotMultiplier:potFactor,
    fractionalEventPotRoundedDown:potFactor!==1&&base<input.basePot*potFactor,
    topRecipeCount:top.length,rows,changed,
    triggerProbabilityModeled:false,ingredientInventoryChecked:false,
    recipeLevel:70,actualSkillTriggersUnknown:true,
    notes:'0/1/2回発動を仮定した鍋容量と上位5レシピの容量可否のみ。食材在庫・発動確率・実際の時間帯は未検証。追加食材の投入可能個数ではない。',
    writesSavedData:false});
  }catch(_){return blocked('M2_POT_SCENARIO_FAILED');}
 }
 return Object.freeze({evaluate});
});

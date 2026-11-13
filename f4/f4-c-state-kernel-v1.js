/* F4-C v98: pure health and individual carry state primitives.
 * Energy tiers / awake depletion: https://wikiwiki.jp/poke_sleep/おてつだい
 * Deliberately no sleep recovery estimates, proc probabilities, berry
 * snacking, bag transfer, auto-collection or fictitious tap schedule.
 * A timed continuous-help count is a PROXY, not an observed integer draw.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4CStateKernel=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=(reason)=>Object.freeze({status:'BLOCKED',reason,
  weeklyEnergyCertified:false,writesSavedData:false});
 const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const inRange=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 // Source specifies tenths. Values on the undocumented 0.1-1.0 boundary
 // are blocked rather than silently put in the wrong speed tier.
 function tier(energy){
  if(!inRange(energy,0,150))return blocked('ENERGY_INVALID');
  if(energy>80)return Object.freeze({status:'TIER_READY',label:'80+',helpSecondsFactor:0.45});
  if(energy>60)return Object.freeze({status:'TIER_READY',label:'60+',helpSecondsFactor:0.52});
  if(energy>40)return Object.freeze({status:'TIER_READY',label:'40+',helpSecondsFactor:0.58});
  if(energy>1)return Object.freeze({status:'TIER_READY',label:'1+',helpSecondsFactor:0.66});
  if(energy===0)return Object.freeze({status:'TIER_READY',label:'0',helpSecondsFactor:1});
  return blocked('ENERGY_LOW_BOUNDARY_UNVERIFIED');
 }
 // Explicit observed recovery only. Do not infer how often a skill triggers.
 function observedRecovery(energy,points,origin){
  if(!inRange(energy,0,150)||!inRange(points,0,150)||
   !['OBSERVED_SLEEP','OBSERVED_SKILL','OBSERVED_MEAL'].includes(origin))
   return blocked('RECOVERY_SOURCE_REQUIRED');
  const after=Math.min(150,Math.round((energy+points)*100)/100);
  return Object.freeze({status:'OBSERVED_RECOVERY_APPLIED',energy:after,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 // 10-minute awake ticks; evaluate help rate BEFORE that tick's 1-point drop.
 // No wake/sleep transition or daily recovery is assumed. Unknown low
 // boundary blocks the whole run instead of masking it.
 function awakeTicks(input={}){
  if(!plain(input)||!inRange(input.initialEnergy,0,150)||
   !inRange(input.referenceHelpSeconds,120,25000)||
   !integer(input.ticks,0,1008))return blocked('AWAKE_INPUT_INVALID');
  let energy=input.initialEnergy,helpProxy=0;
  const byTier=Object.create(null);
  for(let i=0;i<input.ticks;i++){
   const t=tier(energy);if(t.status!=='TIER_READY')return blocked(t.reason);
   const delta=600/(input.referenceHelpSeconds*t.helpSecondsFactor);
   helpProxy+=delta;byTier[t.label]=(byTier[t.label]||0)+1;
   energy=Math.max(0,Math.round((energy-1)*100)/100);
  }
  return Object.freeze({status:'PROVISIONAL_AWAKE_HELP',
   expectedHelpOpportunities:Math.round(helpProxy*1e6)/1e6,
   endingEnergy:energy,elapsedMinutes:input.ticks*10,
   tickCountByTier:Object.freeze({...byTier}),
   assumesContinuousAwakeHelp:true,
   doesNotModelTimerCarry:true,doesNotModelSkillTrigger:true,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 // This is a hard stop, not a false model of overflow. Actual collection
 // and sneaky snacking need the game state and user taps at known instants.
 function holdItems(input={}){
  if(!plain(input)||!integer(input.capacity,1,2000)||
   !integer(input.held,0,input.capacity)||!integer(input.newItems,0,5000))
   return blocked('CARRY_INPUT_INVALID');
  if(input.held+input.newItems>input.capacity)
   return Object.freeze({status:'NEEDS_COLLECTION_SCHEDULE',
    capacity:input.capacity,held:input.held,
    overflowItems:input.held+input.newItems-input.capacity,
    nextHeldUnverified:true,weeklyEnergyCertified:false,
    writesSavedData:false});
  return Object.freeze({status:'CARRY_WITHIN_LIMIT',
   held:input.held+input.newItems,free:input.capacity-input.held-input.newItems,
   weeklyEnergyCertified:false,writesSavedData:false});
 }
 return Object.freeze({tier,observedRecovery,awakeTicks,holdItems});
});

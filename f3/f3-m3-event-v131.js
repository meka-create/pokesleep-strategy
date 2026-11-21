/* M3 v131: shared read-only event boundary for preparation, aligned to M1/F4/F5. */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF3M3EventV131=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const blocked=reason=>Object.freeze({status:'BLOCKED',reason});
 function resolve(input,lite){
  if(typeof input?.weekStart!=='string'||typeof input?.eventId!=='string'||
   !Number.isSafeInteger(input?.potCapacity)||input.potCapacity<7||
   input.potCapacity>5000||typeof lite?.event!=='function')
   return blocked('M3_PREP_EVENT_OR_POT_REQUIRED');
  const event=lite.event({weekStart:input.weekStart,eventId:input.eventId,
   fields:{source:input.source??null}});
  if(event?.status!=='EVENT_READY')
   return blocked(event?.reason||'M3_EVENT_NOT_VERIFIED');
  const effectivePot=Math.floor(input.potCapacity*event.potSize+1e-9);
  if(!Number.isSafeInteger(effectivePot)||effectivePot<7||effectivePot>5000)
   return blocked('M3_EVENT_POT_UNVERIFIED');
  return Object.freeze({status:'EVENT_READY',event,effectivePot,
   readOnly:true,productionCertified:false});
 }
 function adjust(profiles,event,lite,skillValues){
  if(event?.status!=='EVENT_READY'||!Array.isArray(profiles)||
   typeof lite?.withEvent!=='function'||typeof skillValues?.skillValue!=='function')
   return blocked('M3_PRODUCTION_MODEL_REQUIRED');
  const r=lite.withEvent(profiles,event,skillValues);
  if(r?.status!=='ROSTER_READY')
   return blocked(r?.reason||'M3_PRODUCTION_EFFECT_UNVERIFIED');
  return {status:'ROSTER_READY',profiles:r.profiles,
   readOnly:true,productionCertified:false};
 }
 return Object.freeze({resolve,adjust});
});

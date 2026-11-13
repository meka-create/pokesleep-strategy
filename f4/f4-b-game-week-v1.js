/* F4-B v92: immutable JST game-week window and elapsed-slot boundaries.
 * No I/O, energy calculation, UI mutation, or event ownership assumptions.
 * 04:00 game-week bounds do NOT coincide with F4-A's 07:30 lattice.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF4BGameWeek=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DAY=86400000,HOUR=3600000;
 const OFFSET_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/;
 const fail=(reason)=>Object.freeze({status:'BLOCKED',reason,weeklyEnergyCertified:false});
 const validWeek=(date)=>{
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const t=Date.parse(date+'T12:00:00Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date&&new Date(t).getUTCDay()===1;
 };
 function build(weekStart,asOf){
  if(!validWeek(weekStart))return fail('INVALID_WEEK');
  if(typeof asOf!=='string'||!OFFSET_RE.test(asOf)||!Number.isFinite(Date.parse(asOf)))
   return fail('INVALID_INSTANT');
  const start=Date.parse(weekStart+'T04:00:00+09:00'),end=start+7*DAY,now=Date.parse(asOf);
  const windows=[];
  function add(day,slot,from,to,source){
   if(from<start||to>end||from>=to)throw Error('WINDOW_BOUNDARY');
   const state=now>=to?'PAST':now<=from?'FUTURE':'ACTIVE';
   windows.push(Object.freeze({
    day,slot,source,startsAt:new Date(from).toISOString(),
    endsAt:new Date(to).toISOString(),hours:(to-from)/HOUR,state,
    elapsedHours:Math.max(0,Math.min((now-from)/HOUR,(to-from)/HOUR))
   }));
  }
  // Monday 04:00-07:30 is the tail of PRIOR Sunday's sleep.
  // Never attach Monday's selected night team to this carry-over window.
  add(-1,'sleep',start,start+3.5*HOUR,'PREVIOUS_WEEK_SLEEP');
  for(let day=0;day<7;day++){
   const base=start+day*DAY;
   add(day,'morning',base+3.5*HOUR,base+8*HOUR,'CURRENT_WEEK');
   add(day,'noon',base+8*HOUR,base+14*HOUR,'CURRENT_WEEK');
   add(day,'evening',base+14*HOUR,base+20*HOUR,'CURRENT_WEEK');
   // Sun 00:00-04:00 is the last four hours of the current game week.
   add(day,'sleep',base+20*HOUR,Math.min(base+27.5*HOUR,end),
    day===6?'FINAL_NIGHT_TRUNCATED':'CURRENT_WEEK');
  }
  const hours=windows.reduce((n,x)=>n+x.hours,0);
  if(windows.length!==29||Math.abs(hours-168)>1e-9)throw Error('WEEK_DURATION');
  return Object.freeze({
   status:'TIMELINE_READY',weekStart,startsAt:new Date(start).toISOString(),
   endsAt:new Date(end).toISOString(),asOf:new Date(now).toISOString(),
   phase:now<start?'BEFORE':now>=end?'ENDED':'DURING',
   totalHours:hours,windowCount:windows.length,daytimeWindows:21,
   mealOpportunities:21,currentWeekSleepWindows:7,
   previousWeekCarryHours:3.5,finalNightWithinWeekHours:4,
   requiresPreviousWeekSleep:true,weeklyEnergyCertified:false,
   windows:Object.freeze(windows)
  });
 }
 return Object.freeze({build,validWeek});
});

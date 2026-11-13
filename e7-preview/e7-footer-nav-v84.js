/* E7 v84: shared standalone-preview footer watch/badge/navigation.
 * Same 3-tab navigation for Prep, Strategy and Box. Prep-specific preference
 * ownership and priority rules are preserved in the small mode branch.
 * Unified E7 shell still uses e7-unified-bridge-v51 for persistent navigation. */
(function(root){'use strict';
function attach(mode){
 if(!['prep','plan','box'].includes(mode))throw Error('Invalid E7 footer view');
const sel=q=>document.querySelector(q),target={
 plan:'U3_Strategy_UI_20261109_v50_E7.html',prep:'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 box:'U4_Box_Preview_20261109_v50_E7.html'};
const qs=new URLSearchParams(location.search);
function fromSelected(){
 try{const x=JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')||'null');return x?.weekStart&&x?.id?x:null;}catch(e){return null;}
}
function contextFromLink(){
 const u=sel('a.u2-transfer');
 if(u?.href){try{return new URL(u.href)}catch(e){}}
 return null;
}
// Event/week-locked watch packet for file:// preview tabs. Not a second source of plans.
function watchSelection(){
 const q=new URLSearchParams(location.search),local=fromSelected();
 const week=q.get('eventStart')||local?.weekStart;
 const eventId=q.get('eventId')||local?.id;
 return /^\d{4}-\d{2}-\d{2}$/.test(week||'')&&typeof eventId==='string'&&
  eventId.length>0&&eventId.length<=160?{week,eventId}:null;
}
function watchPacket(){
 const raw=sel('#e6-footer-plan')?.dataset.planWatch||
  new URLSearchParams(location.search).get('pokesleepPlanWatch');
 if(!raw||raw.length>5000)return null;
 try{
  const w=JSON.parse(raw),selected=watchSelection();
  return w?.version===1&&selected&&w.weekStart===selected.week&&
   w.eventId===selected.eventId&&w.adopted===true&&w.hasFuture===true?w:null;
 }catch(e){return null;}
}
function readNewestInventory(w){
 const items=[];
 try{
  const record=PokeE7InventoryScope.read(localStorage,w.weekStart,w.eventId);
  if(record?.eventId===w.eventId&&record.currentInventory)
   items.push({values:record.currentInventory.values,savedAt:record.currentInventory.savedAt});
 }catch(e){}
 const raw=new URLSearchParams(location.search).get('pokesleepStock')||
  contextFromLink()?.searchParams.get('pokesleepStock');
 if(raw&&raw.length<6000){
  try{const obj=JSON.parse(raw);
   if(obj.eventId===w.eventId&&obj.weekStart===w.weekStart&&obj.values)
    items.push({values:obj.values,savedAt:obj.savedAt});
  }catch(e){}
 }
 items.sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
 return items[0]?.values||null;
}
function eventStillActive(week){
 const date=new Date(week+'T12:00:00Z');
 if(!Number.isFinite(date.valueOf()))return false;
 date.setUTCDate(date.getUTCDate()+7);
 const nextWeek=date.toISOString().slice(0,10);
 const preview=new URLSearchParams(location.search).get('previewNow');
 const now=preview&&/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(preview)?
  Date.parse(preview+':00+09:00'):Date.now();
 return now<Date.parse(nextWeek+'T04:00:00+09:00');
}
function refreshReproposalDot(){
 const node=sel('#e6-footer-plan');
 if(!node)return;
 if(node.getAttribute('aria-current')==='page'){
  node.setAttribute('aria-label',node.dataset.reproposal==='true'?'作戦（再提案が必要）':'作戦');
  return;
 }
 const w=watchPacket();
 let needed=false;
 if(w&&w.conditionsReady===true&&w.draftReady!==true&&eventStillActive(w.weekStart)){
  const now=readNewestInventory(w);
  const diff=now&&w.stockConfirmed&&
   JSON.stringify(now)!==JSON.stringify(w.stockConfirmed);
  needed=Boolean(w.nonStockChanged||diff);
 }
 node.dataset.reproposal=String(needed);
 node.setAttribute('aria-label',needed?'作戦（再提案が必要）':'作戦');
}
function goto(which){
 const destination=new URL(target[which],location.href);
 const transfer=contextFromLink();
 const selected=fromSelected();
 const fromExisting=new URLSearchParams(location.search);
 const week=mode==='prep'?(fromExisting.get('eventStart')||selected?.weekStart||transfer?.searchParams.get('eventStart')):(selected?.weekStart||fromExisting.get('eventStart')||transfer?.searchParams.get('eventStart'));
 const eventId=mode==='prep'?(fromExisting.get('eventId')||selected?.id||transfer?.searchParams.get('eventId')):(selected?.id||fromExisting.get('eventId')||transfer?.searchParams.get('eventId'));
 const clock=fromExisting.get('previewNow');
 // Keep the signed-by-context event/week and adopted-plan basis when crossing standalone HTML files.
 const watch=watchPacket();
 if(watch)destination.searchParams.set('pokesleepPlanWatch',JSON.stringify(watch));
 if(week)destination.searchParams.set('eventStart',week);
 if(eventId)destination.searchParams.set('eventId',eventId);
 if(clock)destination.searchParams.set('previewNow',clock);
 // U2 -> U3 -> U4 must not lose the validated inventory snapshot across file:// origins.
 const packet=transfer?.searchParams.get('pokesleepStock')||fromExisting.get('pokesleepStock');
 if(packet&&(which==='plan'||which==='box'))destination.searchParams.set('pokesleepStock',packet);

 if(mode==='prep'){
 // Transfer only the explicitly saved preference for this week and event.
 if(week&&eventId){
  try{
   const key='pokesleep-strategy-u2-e6-prep-v1:'+week+':'+encodeURIComponent(eventId);
   const chosen=JSON.parse(localStorage.getItem(key)||'null');
   const incoming=fromExisting.get('pokesleepPrep')||transfer?.searchParams.get('pokesleepPrep');
   const saved=chosen?.version===1&&chosen.weekStart===week&&chosen.eventId===eventId?JSON.stringify(chosen):incoming;
   if(saved&&(which==='plan'||which==='box'))destination.searchParams.set('pokesleepPrep',saved);
  }catch(e){}
 }
 }else{
 // Preserve the event-scoped stockpile choice when going through separate file:// previews.
 let prepPacket=fromExisting.get('pokesleepPrep')||transfer?.searchParams.get('pokesleepPrep')||null;
 if(!prepPacket&&which==='prep'){
  const u2link=sel('a.u2-nav');
  if(u2link?.href){try{prepPacket=new URL(u2link.href).searchParams.get('pokesleepPrep');}catch(e){}}
 }
 if(prepPacket&&prepPacket.length<1400)destination.searchParams.set('pokesleepPrep',prepPacket);
 }

 if(which==='prep'&&clock){
  const now=Date.parse(clock+':00+09:00'),start=Date.parse((week||'2026-11-09')+'T04:00:00+09:00');
  if(now>=start)destination.searchParams.set('tab','inventory');
 }
 location.assign(destination.href);
}
window.addEventListener('pageshow',refreshReproposalDot);
window.addEventListener('storage',refreshReproposalDot);
sel('#save-inventory')?.addEventListener('click',refreshReproposalDot);
sel('#e6-prep-save')?.addEventListener('click',refreshReproposalDot);
refreshReproposalDot();
for(const [name,id] of [['plan','#e6-footer-plan'],['prep','#e6-footer-prep'],['box','#e6-footer-box']]){
 const a=sel(id);if(!a)continue;
 a.addEventListener('click',event=>{event.preventDefault();goto(name);});
}

}
root.PokeE7FooterNav=Object.freeze({attach});
})(window);

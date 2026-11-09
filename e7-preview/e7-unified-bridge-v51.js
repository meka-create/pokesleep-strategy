/* E7 v50: narrow navigation adapter for the single-origin U5 shell.
 * Standalone U2/U3/U4 continue to navigate normally.
 * Never transfer inventory snapshots through the app-shell navigation URL.
 */
(()=>{
 'use strict';
 if(window.parent===window)return;
 const ROUTES={
  'U3_Strategy_UI_20261109_v50_E7.html':'plan',
  'U2_Prep_Local_Ingredients_20261109_v50_E7.html':'prep',
  'U4_Box_Preview_20261109_v50_E7.html':'box'
 };
 const allowed=['http:','https:','file:'].includes(location.protocol);
 if(!allowed)return;
 if(location.protocol==='file:'){
  // file:// is only for UI preview; the authoritative shared-storage behavior
  // of U5 must be tested on an actual same-origin HTTP(S) deployment.
  document.documentElement.dataset.e7FilePreview='true';
 }
 const style=document.createElement('style');
 style.textContent='#e6-footer{display:none!important} body{padding-bottom:18px!important}';
 document.head.append(style);
 // Restore the exact E6 collapsible developer panel in Strategy and Preparation.
 // Its old standalone listeners used location.assign(), which would desynchronize
 // the parent shell. Intercept only its three clock buttons and scoped reset.
 const dev=document.getElementById('e6-dev');
 if(dev&&new URLSearchParams(location.search).get('devOpen')==='1')dev.open=true;
 document.addEventListener('click',event=>{
  if(!dev||!dev.contains(event.target)||event.defaultPrevented)return;
  const button=event.target?.closest?.('button[data-e6-stage],button#e6-reset');
  if(!button)return;
  const stage=button.dataset.e6Stage;
  if(!(['prep','start','during'].includes(stage)||button.id==='e6-reset'))return;
  event.preventDefault();event.stopImmediatePropagation();
  window.parent.postMessage({protocol:'pokesleep-e7-v51',
   action:button.id==='e6-reset'?'dev-reset':'dev-clock',
   stage:button.id==='e6-reset'?undefined:stage},location.origin);
 },true);
 document.addEventListener('click',event=>{
  if(event.defaultPrevented)return;
  const link=event.target?.closest?.('a[href]');if(!link)return;
  let target;
  try{target=new URL(link.href,location.href)}catch(e){return}
  if(target.origin!==location.origin)return;
  const name=decodeURIComponent(target.pathname.split('/').at(-1)||'');
  const tab=ROUTES[name];if(!tab)return;
  event.preventDefault();event.stopImmediatePropagation();
  window.parent.postMessage({protocol:'pokesleep-e7-v51',action:'navigate',tab},location.protocol==='file:'?'*':location.origin);
 },true);

 // Under U5 all screens share localStorage, so the notification dot must be
 // rebuilt from the adopted plan and current inventory, not from a URL packet.
 const footer=document.getElementById('e6-footer-plan');
 const ownPlan=footer&&footer.getAttribute('aria-current')==='page';
 const parse=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}};
 const signature=value=>{const str=JSON.stringify(value);let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return 'cond-'+(h>>>0).toString(16);
 };
 function clockMs(){
  const value=new URLSearchParams(location.search).get('previewNow');
  if(value&&/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))
   return Date.parse(value+':00+09:00');
  return Date.now();
 }
 function futureSlotExists(week,now){
  const date=day=>{const d=new Date(week+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+day);return d.toISOString().slice(0,10);};
  for(let day=0;day<7;day++)
   for(const slot of [['07:30',day],['12:00',day],['18:00',day],['00:00',day+1]])
    if(now<Date.parse(date(slot[1])+'T'+slot[0]+':00+09:00'))return true;
  return false;
 }
 function refreshSharedDot(){
  if(!footer||ownPlan)return; // Strategy owns the authoritative action on its own tab.
  const selected=parse('pokesleep-strategy-u3-e3-v1:selected');
  let needed=false;
  if(selected&&typeof selected.id==='string'&&selected.id.length<=160&&
    typeof selected.weekStart==='string'&&/^\d{4}-\d\d-\d\d$/.test(selected.weekStart)){
   const week=selected.weekStart,id=selected.id,now=clockMs();
   const plan=parse('pokesleep-strategy-u3-e3-v1:'+week+':'+encodeURIComponent(id)+':plan');
   if(plan&&plan.version===1&&plan.weekStart===week&&plan.hasApplied===true&&
     plan.appliedEventStart===week&&
     (plan.appliedEventInfo?.source?.id||'manual:'+week)===id&&
     futureSlotExists(week,now)){
    const data=parse('pokesleep-strategy-u2-e2-v1:'+week+':timeline');
    const inventory=data?.eventId===id?data.currentInventory:null;
    const stockChanged=!!inventory&&!!plan.stockConfirmed&&
      JSON.stringify(inventory.values)!==JSON.stringify(plan.stockConfirmed);
    const conditionsChanged=JSON.stringify(plan.eventInfo)!==JSON.stringify(plan.appliedEventInfo);
    const sleepChanged=plan.applied?.autoSleep!==plan.autoSleep||
      (!plan.autoSleep&&Array.isArray(plan.manualSleep)&&Array.isArray(plan.applied?.days)&&
       plan.manualSleep.some((team,day)=>{
        const night=new Date(week+'T12:00:00Z');night.setUTCDate(night.getUTCDate()+day+1);
        if(now>=Date.parse(night.toISOString().slice(0,10)+'T00:00:00+09:00'))return false;
        return JSON.stringify(team)!==JSON.stringify(plan.applied.days[day]?.sleep);
       }));
    const basis=plan.draft?.e4Basis;
    const ledger=parse('pokesleep-strategy-u3-e3-v1:'+week+':'+encodeURIComponent(id)+':conditions');
    const draftReady=!!basis&&basis.eventId===id&&basis.weekStart===week&&
      basis.confirmedRevision===ledger?.confirmed?.revision&&
      basis.berrySetupFingerprint===signature(plan.eventInfo?.berrySetup||null)&&
      basis.hasInventory===!!inventory&&
      basis.inventoryAt===inventory?.savedAt&&
      basis.inventoryFingerprint===signature(inventory?.values||null)&&
      basis.autoSleep===plan.autoSleep&&
      basis.manualSleepFingerprint===signature(plan.manualSleep);
    needed=Boolean((stockChanged||conditionsChanged||sleepChanged)&&!draftReady);
   }
  }
  footer.dataset.reproposal=String(needed);
  footer.setAttribute('aria-label',needed?'作戦（再提案が必要）':'作戦');
 }
 // The storage listener also catches updates in sibling same-origin frames.
 window.addEventListener('pageshow',refreshSharedDot);
 window.addEventListener('storage',refreshSharedDot);
 document.getElementById('save-inventory')?.addEventListener('click',refreshSharedDot);
 document.getElementById('auto-sleep')?.addEventListener('click',refreshSharedDot);
 refreshSharedDot();

 // Shared footer is owned by the parent. Child DOM stays intact so the
 // existing v50 proposal, inventory and form logic can be reused unchanged.
 function notifyBadge(){
  const node=document.getElementById('e6-footer-plan');
  if(!node)return;
  window.parent.postMessage({protocol:'pokesleep-e7-v51',action:'badge',
   needed:node.dataset.reproposal==='true'},location.origin);
 }
 const footerNode=document.getElementById('e6-footer-plan');
 if(footerNode){
  new MutationObserver(()=>notifyBadge()).observe(footerNode,{
   attributes:true,attributeFilter:['data-reproposal']
  });
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==window.parent)return;
  if(e.data?.protocol!=='pokesleep-e7-v51'||e.data.action!=='activate')return;
  // The old screens expose a 'pageshow' refresh path for fresh inventory,
  // event clock and proposal state without destroying their DOM.
  if(e.data.refresh||document.querySelector('#event-save')){
   window.dispatchEvent(new Event('pageshow'));
  }
  requestAnimationFrame(notifyBadge);
 });
 window.addEventListener('storage',()=>requestAnimationFrame(notifyBadge));
 window.addEventListener('pageshow',()=>requestAnimationFrame(notifyBadge));
 requestAnimationFrame(notifyBadge);
 // All synchronous screen scripts and saved-state restoration have finished
 // by DOMContentLoaded. The shell may show this screen before images finish.
 function announceInteractive(){
  window.parent.postMessage({protocol:'pokesleep-e7-v51',action:'interactive-ready',
   documentUrl:location.href},location.protocol==='file:'?'*':location.origin);
 }
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',announceInteractive,{once:true});
 else announceInteractive();
})();

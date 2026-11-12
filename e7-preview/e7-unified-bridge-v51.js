/* E7 v69: common two-line header and navigation adapter for the U5 shell.
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
 style.textContent='#e6-footer{display:none!important} body{padding-bottom:18px!important}'+
  '[hidden]{display:none!important}'+
  '.mast .ver,.header .mock-tag{display:none!important}'+
  'header.mast,header.header{position:relative;z-index:35;overflow:visible;box-sizing:border-box;min-height:76px;padding:12px 16px;border-bottom:1px solid #3b5269;display:flex;align-items:center;justify-content:space-between;gap:8px}'+
   '.shell>header.mast,.shell>header.header{width:min(100vw,680px);max-width:none;margin-left:50%;transform:translateX(-50%)}'+
   'header.mast .brand,header.header .brand{font:800 19px/1.32 system-ui,-apple-system,"Noto Sans JP",sans-serif;letter-spacing:0;white-space:nowrap;color:#f2f5fa}'+
   'header.mast .sub,header.mast .subbrand,header.header .smallcap{font:700 9px/1.2 system-ui,-apple-system,"Noto Sans JP",sans-serif;letter-spacing:2px;color:#a5c3da}'+
   '#u2-week-label{display:none!important}'+
  /* Shared two-line identity for all three tabs. Only the subtitle may clip. */
  'header.mast>.e7-header-identity,header.header>.e7-header-identity{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 0}'+
  '.e7-header-icon{display:block;flex:0 0 44px;width:44px;height:44px;object-fit:cover;border-radius:11px}'+
  '.e7-header-copy{display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0;flex:1 1 0}'+
  '.e7-header-subtitle{display:flex;align-items:center;gap:5px;min-width:0;max-width:100%;height:19px;color:#a5c3da;font:700 12px/1.4 system-ui,-apple-system,"Noto Sans JP",sans-serif;letter-spacing:.1px}'+
  '.e7-header-subtitle[data-kind="event"]{color:#f4d58f}'+
  '.e7-header-subtitle-text{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}'+
  '.e7-header-calendar{width:15px;height:15px;flex:0 0 15px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round}'+
  '.e7-header-calendar[hidden]{display:none!important}'+
  '@media(max-width:360px){header.mast .brand,header.header .brand{font-size:17px}.e7-header-icon{flex-basis:40px;width:40px;height:40px}.e7-header-subtitle{font-size:11px}}'+
  '.e7-more-wrap{position:relative;flex:0 0 42px;margin-left:0}'+
  '.e7-more-btn{display:grid;place-items:center;width:42px;height:42px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:#e5edf6;font:900 24px/1 system-ui;cursor:pointer;touch-action:manipulation}'+
  '.e7-more-btn:hover,.e7-more-btn[aria-expanded="true"],.e7-more-btn:active{background:transparent;border-color:transparent;box-shadow:none;color:#fff}'+
  '.e7-more-btn:focus-visible,.e7-more-item:focus-visible{outline:2px solid #ffda8a;outline-offset:2px}'+
  '.e7-more-menu{position:absolute;right:0;top:48px;z-index:1100;width:205px;max-width:calc(100vw - 20px);padding:6px;border:1px solid #58718c;border-radius:13px;background:#21364d;box-shadow:0 14px 40px #06111ecc}'+
  '.e7-more-item{display:block;width:100%;min-height:45px;text-align:left;padding:9px 12px;border:0;border-radius:9px;background:transparent;color:#f1f5fa;font:750 13px/1.45 system-ui;cursor:pointer;touch-action:manipulation}'+
  '.e7-more-item:active,.e7-more-item:hover{background:#38516c}'+
  '#e6-dev>summary::before{content:"🧪 "!important}';
 document.head.append(style);
 // Match the compact vertical-dot menu used by 個体値ぶっこみスキャン.
 // The menu belongs to the visible iframe, while dialogs live in the parent.
 const header=document.querySelector('header.mast,header.header');
 if(header){
  const wrap=document.createElement('div');
  wrap.className='e7-more-wrap';
  const more=document.createElement('button');
  more.type='button';more.id='e7-more-open';more.className='e7-more-btn';
  more.textContent='⋮';more.title='メニュー';
  more.setAttribute('aria-label','メニュー');
  more.setAttribute('aria-haspopup','menu');
  more.setAttribute('aria-expanded','false');
  more.setAttribute('aria-controls','e7-more-menu');
  const menu=document.createElement('div');
  menu.id='e7-more-menu';menu.className='e7-more-menu';
  menu.setAttribute('role','menu');menu.hidden=true;
  function closeMenu(restoreFocus=false){
   if(menu.hidden)return;
   menu.hidden=true;more.setAttribute('aria-expanded','false');
   if(restoreFocus)more.focus();
  }
  more.addEventListener('click',()=>{
   const opening=menu.hidden;
   menu.hidden=!opening;more.setAttribute('aria-expanded',String(opening));
  });
  for(const [section,id,label] of [
   ['player','e7-more-player','プレイヤー情報'],
   ['backup','e7-more-backup','バックアップ・復元']
  ]){
   const item=document.createElement('button');
   item.type='button';item.id=id;item.className='e7-more-item';
   item.setAttribute('role','menuitem');
   item.textContent=label;
   item.addEventListener('click',()=>{
    closeMenu();
    window.parent.postMessage({protocol:'pokesleep-e7-v51',
     action:'open-settings',section},location.origin);
   });
   menu.append(item);
  }
  // The header identity is shared across Strategy, Preparation and Box.
  // Use the user-supplied header asset from the approved PWA icon set.
  const titleNode=header.querySelector('.brand');
  const titleWrap=titleNode?.parentElement;
  if(!titleNode||!titleWrap)throw new Error('E7 header brand is missing');
  titleNode.textContent='ポケスリ作戦室';
  titleWrap.querySelector('.sub,.subbrand,.smallcap')?.remove();
  titleWrap.classList.add('e7-header-identity');
  const icon=document.createElement('img');
  icon.className='e7-header-icon';
  icon.src='icons/icon-header-96.png';
  icon.alt='';
  icon.width=44;icon.height=44;
  icon.setAttribute('aria-hidden','true');
  titleWrap.insertBefore(icon,titleNode);
  const copy=document.createElement('div');
  copy.className='e7-header-copy';
  titleNode.remove();copy.append(titleNode);
  const eventNode=document.createElement('span');
  eventNode.id='e7-header-event-name';
  eventNode.className='e7-header-subtitle';
  eventNode.setAttribute('aria-live','polite');
  eventNode.setAttribute('aria-atomic','true');
  const calendar=document.createElementNS('http://www.w3.org/2000/svg','svg');
  calendar.classList.add('e7-header-calendar');
  calendar.setAttribute('viewBox','0 0 24 24');
  calendar.setAttribute('aria-hidden','true');
  calendar.innerHTML='<rect x="3" y="5" width="18" height="16" rx="2"/>'+
    '<path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>';
  const caption=document.createElement('span');
  caption.className='e7-header-subtitle-text';
  eventNode.append(calendar,caption);
  copy.append(eventNode);
  titleWrap.append(copy);
  // Strategy, Preparation, and Box all share the same selected event subtitle.
  const isEventTab=/^U[234]_/.test(location.pathname.split('/').pop()||'');
  function selectionIdentity(){
   try{
    const x=JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')||'null');
    if(!x||typeof x.id!=='string'||x.id.length<1||x.id.length>160||
      typeof x.weekStart!=='string'||!/^\d{4}-\d\d-\d\d$/.test(x.weekStart))return null;
    const d=new Date(x.weekStart+'T12:00:00Z');
    return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===x.weekStart&&
      d.getUTCDay()===1?x:null;
   }catch(e){return null;}
  }
  function selectedEventHeader(){
   const selected=selectionIdentity();
   if(!selected)return '';
   // U3 already owns the canonical Japanese event-name translations.
   // Reuse its live validated getter from either sibling frame; do not
   // maintain a second translation dictionary or create another saved key.
   try{
    const plan=window.parent.document.getElementById('view-plan')?.contentWindow;
    const result=plan?.__e7CurrentEventHeader?.();
    if(result?.id===selected.id&&result.weekStart===selected.weekStart&&
      typeof result.name==='string')return result.name;
   }catch(e){/* The plan iframe may still be loading. */}
   // The first Preparation or Box paint may precede the lazily prewarmed U3.
   // Only show a Japanese saved source label; U3 will replace it with
   // its canonical localized name as soon as that frame becomes ready.
   try{
    const raw=localStorage.getItem('pokesleep-strategy-u3-e3-v1:'+
      selected.weekStart+':'+encodeURIComponent(selected.id)+':conditions');
    if(!raw||raw.length>32000)return '';
    const ledger=JSON.parse(raw);
    if(ledger?.weekStart!==selected.weekStart||ledger.eventId!==selected.id||
      !ledger.confirmed||ledger.confirmed.weekStart!==selected.weekStart||
      ledger.confirmed.eventId!==selected.id)return '';
    const source=ledger.confirmed.fields?.source;
    if(source?.id===selected.id&&typeof source.name==='string'&&
      /[^\x00-\x7F]/.test(source.name))return source.name;
    if(selected.id==='manual:'+selected.weekStart)
     return '手動設定 · '+selected.weekStart.slice(5).replace('-','/');
   }catch(e){/* Leave the header empty for invalid data. */}
   return '';
  }
  function refreshEventHeader(){
   const name=isEventTab?selectedEventHeader().trim().slice(0,160):'';
   caption.textContent=name||'for Pokémon Sleep';
   calendar.toggleAttribute('hidden',!name);
   eventNode.dataset.kind=name?'event':'default';
   if(name){
    eventNode.title='現在のイベント：'+name;
    eventNode.setAttribute('aria-label','現在のイベント：'+name);
   }else{
    eventNode.removeAttribute('title');
    eventNode.setAttribute('aria-label','for Pokémon Sleep');
   }
  }
  if(eventNode){
   window.addEventListener('pageshow',refreshEventHeader);
   window.addEventListener('storage',e=>{
    if(e.key===null||e.key==='pokesleep-strategy-u3-e3-v1:selected'||
      e.key?.startsWith('pokesleep-strategy-u3-e3-v1:'))refreshEventHeader();
   });
   window.addEventListener('message',e=>{
    if(e.source===window.parent&&e.origin===location.origin&&
      e.data?.protocol==='pokesleep-e7-v51'&&e.data.action==='activate')
      refreshEventHeader();
   });
   // U3 event save is synchronous; the post-click microtask observes the
   // committed ledger, never the draft before its validation.
   document.addEventListener('click',e=>{
    if(e.target.closest?.('#event-save'))queueMicrotask(refreshEventHeader);
   });
   if(/^U[24]_/.test(location.pathname.split('/').pop()||'')){
    try{
     const sibling=window.parent.document.getElementById('view-plan');
     sibling?.addEventListener('load',refreshEventHeader);
    }catch(e){}
   }
   refreshEventHeader();
  }
  wrap.append(more,menu);header.append(wrap);
  document.addEventListener('click',event=>{
   if(!wrap.contains(event.target))closeMenu();
  });
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&!menu.hidden){
    closeMenu(true);event.preventDefault();
   }else if(event.key==='ArrowDown'&&document.activeElement===more&&!menu.hidden){
    menu.querySelector('button')?.focus();event.preventDefault();
   }
  });
  window.addEventListener('message',event=>{
   if(event.origin===location.origin&&event.source===window.parent&&
    event.data?.protocol==='pokesleep-e7-v51'&&['activate','dismiss-menu'].includes(event.data.action)){
    closeMenu();
   }
  });
 }
 // Keep the old player editor intact for standalone compatibility only.
 // In the unified app, the player editor lives in the parent Settings dialog.
 const playerCard=document.getElementById('player-title')?.closest('section.card');
 if(playerCard)playerCard.hidden=true;
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
    const data=(()=>{try{return PokeE7InventoryScope.read(localStorage,week,id);}catch(e){return null;}})();
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

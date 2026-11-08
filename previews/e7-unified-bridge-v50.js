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
 const style=document.createElement('style');style.textContent='#e6-dev{display:none!important}';
 document.head.append(style);
 document.addEventListener('click',event=>{
  if(event.defaultPrevented)return;
  const link=event.target?.closest?.('a[href]');if(!link)return;
  let target;
  try{target=new URL(link.href,location.href)}catch(e){return}
  if(target.origin!==location.origin)return;
  const name=decodeURIComponent(target.pathname.split('/').at(-1)||'');
  const tab=ROUTES[name];if(!tab)return;
  event.preventDefault();event.stopImmediatePropagation();
  window.parent.postMessage({protocol:'pokesleep-e7-v50',action:'navigate',tab},location.protocol==='file:'?'*':location.origin);
 },true);
})();

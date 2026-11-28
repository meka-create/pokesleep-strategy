/* E7 v50 preview-only offline cache / persistent v52 tabs; this is NOT the production root service worker. */
const CACHE='pokesleep-strategy-e7-v84-shared-e1-footer-20261113-v86-f2-event-catalog-20261113-v88-f3-prep-20261113-v89-f3-b-20261113-v90-f4-audit-20261113-v105-box-detail-20261114-v110-box-proposal-20261114-v112-integrated-real-plan-20261114-v114-real-sleep-stats-carry-20261115-v116-shared-sprites-modal-20261115-v117-compact-dialog-20261115-v118-f5-prestart-save-guard-20261115-v119-f5-midweek-20261115-v120-stockpile-20261115-v121-compact-prep-20261119-v122-nut81-20261119-online-nuts-icon-256-v123-nut-size-parity-v124-adopted-stock-goals-v125-diverse-candidates-v126-persistent-sleep-v127-healer-skill-quality-v128-m1-event-aware-v129-future-meal-reserves-v130-pot-scenarios-v131-m3-event-alignment-v132-m3-plan-alignment-v133-m4-prep-food-fix-v134-contextual-skill-level-v135-exclusive-food-max-v136-no-prior-sunday-input-v137-full-sleep-box-v138-balanced-search-v139-shard-mew';
const IMAGE_FILES=Array.from({length:20},(_,i)=>
 'assets/ingredients/ingredient-'+String(i+1).padStart(2,'0')+'.png');
const imageUrls=new Set(IMAGE_FILES.map(x=>new URL(x,self.registration.scope).href));
// Versioned, immutable common modules: once installed, avoid a network round-trip
// for each frame. Rotating the E7 SW cache or file version refreshes them.
const sharedRuntimeUrls=new Set(['e7-e1-core-v84.js','e7-footer-nav-v84.js']
 .map(x=>new URL(x,self.registration.scope).href));
const FILES=[
 'index.html','U5_Integrated_20261109_v50_E7.html',
 'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html',
 'U4_Box_Preview_20261109_v50_E7.html',
 'e7-feedback-v66.js','e7-feedback-v66.css','e7-event-delete-v71.js','e7-inventory-scope-v78.js',
 'e7-e1-core-v84.js','e7-footer-nav-v84.js','e7-f2-event-catalog-v1.js',
 '../src/master.js','../src/recipes.js','e7-master-v122.js','e7-recipes-v122.js','../f3/f3-prep-optimizer-v1.js','../f3/f3-stockpile-v120.js','../f3/f3-adopted-opening-v124.js','../f3/f3-m3-event-v131.js','e7-prep-settings-v120.js','e7-f3-prep-goals-v88.js',
 '../f1/f1-b-legal-build-v2.js','../f1/f1-b-base-rates-v1.js',
 '../f1/f1-b-target-source-v1.json','../f1/f1-b-help-traits-v1.json',
 '../f3/f3-b-production-scenario-v1.js',
 '../f4/f4-chronological-core-v1.js','../f4/f4-f1b-roster-adapter-v1.js',
 '../f4/f4-b-game-week-v1.js','../f4/f4-b-e7-readonly-v1.js',
 '../f4/f4-c-healer-policy-v100.js','../f4/f4-c-diverse-candidates-v125.js','../f4/f4-c-healer-search-v100.js',
 '../f1/f1-c-skill-values-v1.js','../f4/f4-c-cooking-skills-v102.js','../f4/f4-m1-lite-energy-v128.js',
  '../f4/f4-c-item-aware-rank-v101.js',
 '../f4/f4-c-stable-box-ids-v1.js','../f4/f4-c-auto-v112.js',
 '../f4/f4-c-real-storage-v112.js','../f5/f5-midweek-v119.js','../f4/f4-m2-meal-reserves-v129.js','../f4/f4-m2-pot-scenarios-v130.js','../f4/f4-m3-plan-alignment-v132.js','../f3/f3-m4-food-preference-v133.js','e7-f4c-integrated-v112.js',
 'e7-box-csv-v50.js','e7-ingredient-quantities-v79.js','e7-species-v59.js','e7-sprites-v59.js','e7-pokemon-detail-shared-v81.js','e7-pokemon-detail-shared-v81.css','e7-ingredient-size-v123.css','e7-m2-meal-reserves-v129.css','e7-box-individual-stats-v105.js','e7-box-detail-v60.js','e7-box-detail-v60.css','e7-unified-bridge-v51.js','icons/apple-touch-icon.png','icons/favicon-16.png','icons/favicon-32.png','icons/favicon.ico','icons/icon-192.png','icons/icon-512.png','icons/icon-header-96.png','icons/icon-maskable-192.png','icons/icon-maskable-512.png','e7-settings-v56.js','e7-settings-v56.css',
 'e7-manifest-v50.webmanifest','e7-icon-v50.svg',
 ...IMAGE_FILES
];
const allowed=new Set(FILES.map(x=>new URL(x,self.registration.scope).href));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...allowed])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pokesleep-strategy-e7-')&&key!==CACHE)
  .map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const canonical=new URL(event.request.url);canonical.search='';canonical.hash='';
 // PWA start_url './' is a directory navigation, not '/index.html'.
 // Normalize it to the same precached shell; otherwise offline relaunch fails.
 if(canonical.href===self.registration.scope)
  canonical.href=new URL('index.html',self.registration.scope).href;
 if(!allowed.has(canonical.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Prefer the network so a newly reviewed v54 build cannot be masked by a
  // previous v50 cache. Offline only, fall back to the last valid response.
  try{
   // Versioned ingredient PNGs and the v84 common runtime are stable and
   // cache-first after install. HTML and mutable JS remain network-first.
   if(imageUrls.has(canonical.href)||sharedRuntimeUrls.has(canonical.href)){
    const stable=await cache.match(canonical.href);
    if(stable)return stable;
   }
   const response=await fetch(event.request,{cache:'no-store'});
   if(response.ok)await cache.put(canonical.href,response.clone());
   return response;
  }catch(e){
   return await cache.match(canonical.href)||Response.error();
  }
 })());
});

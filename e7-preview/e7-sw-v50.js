/* E7 v50 preview-only offline cache / persistent v52 tabs; this is NOT the production root service worker. */
const CACHE='pokesleep-strategy-e7-v84-shared-e1-footer-20261113-v86-f2-event-catalog-20261113';
const IMAGE_FILES=Array.from({length:19},(_,i)=>
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
 'e7-box-csv-v50.js','e7-ingredient-quantities-v79.js','e7-species-v59.js','e7-sprites-v59.js','e7-pokemon-detail-shared-v81.js','e7-pokemon-detail-shared-v81.css','e7-box-detail-v60.js','e7-box-detail-v60.css','e7-unified-bridge-v51.js','icons/apple-touch-icon.png','icons/favicon-16.png','icons/favicon-32.png','icons/favicon.ico','icons/icon-192.png','icons/icon-512.png','icons/icon-header-96.png','icons/icon-maskable-192.png','icons/icon-maskable-512.png','e7-settings-v56.js','e7-settings-v56.css',
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

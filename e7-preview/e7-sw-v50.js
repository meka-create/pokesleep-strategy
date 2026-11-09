/* E7 v50 preview-only offline cache / persistent v52 tabs; this is NOT the production root service worker. */
const CACHE='pokesleep-strategy-e7-v53-audit-20261109';
const FILES=[
 'index.html','U5_Integrated_20261109_v50_E7.html',
 'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'U3_Strategy_UI_20261109_v50_E7.html',
 'U4_Box_Preview_20261109_v50_E7.html',
 'e7-box-csv-v50.js','e7-unified-bridge-v51.js','e7-manifest-v50.webmanifest','e7-icon-v50.svg'
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
 if(!allowed.has(canonical.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Prefer the network so a newly reviewed v52 build cannot be masked by a
  // previous v50 cache. Offline only, fall back to the last valid response.
  try{
   const response=await fetch(event.request,{cache:'no-store'});
   if(response.ok)await cache.put(canonical.href,response.clone());
   return response;
  }catch(e){
   return await cache.match(canonical.href)||Response.error();
  }
 })());
});

(function spriteLibrary(root){
 'use strict';
 // Use verified local IDs; never guess special-form artwork from a national Pokédex number.
 const SPRITES='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
 const VARIANTS=new Map([['ロコン (アローラ)',10103],['キュウコン (アローラ)',10104],['ウパー (パルデア)',10253]]);
 const species=new Map((root.PokeMaster?.species||[]).map(p=>[p.name,p.id]));
 const CACHE='pokesleep-strategy-sprites-v1';
 const MAX_ACTIVE=3,GAP_MS=150,MAX_RETRIES=2;
 const loaded=new Map(),pending=new Map(),waiting=[];
 let active=0,lastStarted=0,timer=null;
 const observer=typeof root.IntersectionObserver==='function'
  ?new root.IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);enqueue(entry.target);}
   },{rootMargin:'220px 0px'}):null;
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function spriteUrl(p){
  const name=String(p?.pokemon||'');
  const id=/[(（]/.test(name)?VARIANTS.get(name):species.get(name);
  if(!Number.isInteger(id)||id<1)return '';
  return SPRITES+(p.shiny?'shiny/':'')+id+'.png';
 }
 function icon(p){
  const url=spriteUrl(p),fallback=safe(String(p?.pokemon||'?').slice(0,1));
  return '<span class="poke-art'+(url?'':' is-fallback')+'">'+
    (url?'<img data-sprite-url="'+url+'" alt="" decoding="async" referrerpolicy="no-referrer">':'')+
    '<span class="poke-art-fallback" aria-hidden="true">'+fallback+'</span></span>';
 }
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function retryDelay(response,attempt){
  const header=response?.headers?.get('Retry-After');
  let ms=NaN;
  if(header){const secs=Number(header);ms=Number.isFinite(secs)?secs*1000:Date.parse(header)-Date.now();}
  return Number.isFinite(ms)&&ms>=0?Math.min(60000,Math.max(1000,ms)):1000*2**attempt;
 }
 async function load(url){
  if(loaded.has(url))return loaded.get(url);
  if(pending.has(url))return pending.get(url);
  const job=(async()=>{
   let cached=null;
   if(typeof root.caches!=='undefined'){
    try{
     cached=await root.caches.open(CACHE);const hit=await cached.match(url);
     if(hit?.ok){const blob=await hit.blob();if(blob.size&&blob.type.startsWith('image/')){
       const value=URL.createObjectURL(blob);loaded.set(url,value);return value;
     }await cached.delete(url);}
    }catch{cached=null;}
   }
   for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
    try{
     const response=await fetch(url,{mode:'cors',cache:'force-cache'});
     if(response.ok){
      const type=response.headers?.get('Content-Type')||'';
      if(!type.toLowerCase().startsWith('image/'))return null;
      const blob=await response.blob();
      if(!blob.size||blob.size>2*1024*1024)return null;
      if(cached)try{await cached.put(url,new Response(blob,{status:200,headers:{'Content-Type':blob.type}}));}catch{}
      const value=URL.createObjectURL(blob);loaded.set(url,value);return value;
     }
     if(response.status===404||response.status===400||response.status===403)return null;
     if(response.status!==429&&response.status<500)return null;
     if(attempt===MAX_RETRIES)return null;
     await pause(retryDelay(response,attempt));
    }catch{
     if(attempt===MAX_RETRIES)return null;
     await pause(1000*2**attempt);
    }
   }
   return null;
  })().finally(()=>pending.delete(url));
  pending.set(url,job);return job;
 }
 function apply(img,url){
  if(!img.isConnected)return;
  if(!url){img.dataset.spriteState='failed';return;}
  img.onload=()=>img.closest('.poke-art')?.classList.add('is-loaded');
  img.onerror=()=>{img.closest('.poke-art')?.classList.remove('is-loaded');img.dataset.spriteState='failed';};
  img.src=url;img.dataset.spriteState='loaded';
 }
 function pump(){
  if(timer||active>=MAX_ACTIVE)return;
  while(waiting.length&&!waiting[0].isConnected)waiting.shift();
  if(!waiting.length)return;
  const delay=Math.max(0,lastStarted+GAP_MS-Date.now());
  timer=setTimeout(()=>{
   timer=null;
   if(active>=MAX_ACTIVE){pump();return;}
   const img=waiting.shift();
   if(!img?.isConnected){pump();return;}
   active++;lastStarted=Date.now();
   const url=img.dataset.spriteUrl;
   Promise.resolve().then(()=>load(url)).then(res=>apply(img,res),()=>apply(img,null)).finally(()=>{active--;pump();});
   pump();
  },delay);
 }
 function enqueue(img){
  if(!img?.isConnected||img.dataset.spriteState)return;
  img.dataset.spriteState='queued';waiting.push(img);pump();
 }
 function enhance(container){
  if(!container||typeof fetch!=='function'||typeof URL.createObjectURL!=='function')return;
  for(const img of container.querySelectorAll('img[data-sprite-url]')){
   if(img.dataset.spriteState)continue;
   const cached=loaded.get(img.dataset.spriteUrl);
   if(cached){apply(img,cached);continue;}
   if(observer)observer.observe(img);else enqueue(img);
  }
 }
 root.PokeSprite={icon,enhance,spriteUrl};
})(window);

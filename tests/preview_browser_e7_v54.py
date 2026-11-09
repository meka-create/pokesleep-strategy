"""E7 v54: first interactive paint, image dedup/lazy load, persistent tabs, offline icons."""
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto(BASE+'?tab=prep&previewNow=2026-11-15T16:00',wait_until='domcontentloaded')
        def interactive(tab):
            page.wait_for_function("""(tab)=>{
              const f=document.getElementById('view-'+tab);
              return document.documentElement.dataset.activeTab===tab && !f.hidden &&
                f.contentDocument?.readyState!=='loading' &&
                document.getElementById('status').hidden;
            }""",arg=tab,timeout=20000)
        interactive('prep')
        assert page.evaluate('document.documentElement.dataset.e7ReadyVia')=='interactive', 'first screen still waits for load'
        first_ms=int(page.evaluate('document.documentElement.dataset.e7FirstInteractiveMs'))
        assert 0<=first_ms<20000,first_ms
        prep=page.frame_locator('#view-prep')
        icons=prep.locator('img.pic')
        assert icons.count()==38,'Both ingredient sections must retain their icons'
        srcs=icons.evaluate_all('(imgs)=>imgs.map(x=>x.getAttribute("src"))')
        assert len(set(srcs))==19,'Ingredient art must be shared across grids'
        assert all(s.startswith('assets/ingredients/') for s in srcs),srcs
        assert all(icons.nth(i).get_attribute('loading')=='lazy' for i in range(38))
        page.wait_for_function("""()=>{
          const img=document.getElementById('view-prep').contentDocument.querySelector('img.pic');
          return img.complete&&img.naturalWidth>0;
        }""",timeout=20000)
        # Keep the same DOM when swapping tabs; no transient full-screen loader.
        page.locator('#tab-plan').click()
        interactive('plan')
        page.locator('#tab-prep').click()
        assert page.locator('#status').is_hidden(),'Warm tab unnecessarily reloaded'
        assert prep.locator('img.pic').count()==38
        # Core files and all ingredient images must survive an offline PWA launch.
        page.wait_for_function("""async()=>{
          if(!('serviceWorker' in navigator))return false;
          const reg=await navigator.serviceWorker.ready;
          if(!reg.active)return false;
          const cache=await caches.open('pokesleep-strategy-e7-v54-first-paint-20261109');
          const base=new URL('assets/ingredients/',reg.scope);
          const hits=await Promise.all(Array.from({length:19},(_,i)=>
            cache.match(new URL('ingredient-'+String(i+1).padStart(2,'0')+'.png',base))));
          return hits.every(Boolean);
        }""",timeout=30000)
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        interactive('prep')
        assert page.evaluate('document.documentElement.dataset.e7ReadyVia')=='interactive'
        page.wait_for_function("""()=>{
          const f=document.getElementById('view-prep');
          const img=f.contentDocument?.querySelector('img.pic');
          return img&&img.complete&&img.naturalWidth>0;
        }""",timeout=20000)
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('E7 v54 startup + 38 icons / 19 assets + offline + persistent tabs: PASS')

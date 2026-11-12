"""E7 v78 Chromium: same-week inventory must persist independently per event."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools, threading

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
WEEK='2026-11-09'
A='manual:'+WEEK
B='official-same-week'
from urllib.parse import quote

def key(id):
    return 'pokesleep-strategy-u2-e2-v1:'+WEEK+':'+quote(id,safe="~!*'()-._")+':timeline'

def open_event(page,id):
    url=BASE+'U2_Prep_Local_Ingredients_20261109_v50_E7.html?eventStart='+WEEK+\
       '&eventId='+quote(id,safe='')+'&previewNow=2026-11-10T09:00'
    page.goto(url,wait_until='domcontentloaded')
    page.locator('#btn-inventory').click()
    page.locator('#inventory-panel input[data-key]').first.wait_for()
    return page.locator('#inventory-panel input[data-key]').first

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        field=open_event(page,A)
        field.fill('21')
        page.locator('#save-inventory').click()
        assert page.evaluate('(k)=>localStorage.getItem(k)!==null',key(A)), 'A scoped stock missing'
        field=open_event(page,B)
        assert field.input_value()=='0', 'B must not inherit A inventory'
        field.fill('47')
        page.locator('#save-inventory').click()
        assert page.evaluate('(k)=>localStorage.getItem(k)!==null',key(B)), 'B scoped stock missing'
        assert page.evaluate("""args=>JSON.parse(localStorage.getItem(args[0])).currentInventory.values
            !==JSON.parse(localStorage.getItem(args[1])).currentInventory.values""",[key(A),key(B)])
        field=open_event(page,A)
        diagnostic=page.evaluate("""({a,b,legacy})=>{
          const own=localStorage.getItem(a),other=localStorage.getItem(b);
          return {url:location.href,own:own?JSON.parse(own):null,
            other:other?JSON.parse(other):null,legacy:localStorage.getItem(legacy),
            fields:[...document.querySelectorAll('#inventory-panel [data-key]')].slice(0,3).map(el=>({
              name:el.closest('.food')?.querySelector('.name')?.textContent,value:el.value
            })),error:document.querySelector('#error')?.textContent,
            errorHidden:document.querySelector('#error')?.hidden,
            result:document.querySelector('#preview-result')?.textContent};
        }""",{'a':key(A),'b':key(B),'legacy':'pokesleep-strategy-u2-e2-v1:'+WEEK+':timeline'})
        assert field.input_value()=='21','A stock lost after saving B: '+str(diagnostic)
        field=open_event(page,B)
        assert field.input_value()=='47','B stock lost after returning from A'
        # Existing week-only stock of A remains readable for A, not B.
        page.evaluate("""({legacy,scoped,owner})=>{
          localStorage.setItem(legacy,localStorage.getItem(scoped));
          localStorage.removeItem(scoped);
        }""",{'legacy':'pokesleep-strategy-u2-e2-v1:'+WEEK+':timeline','scoped':key(A),'owner':A})
        field=open_event(page,A)
        assert field.input_value()=='21','legacy A stock must still load'
        field.fill('31')
        page.locator('#save-inventory').click()
        assert page.evaluate('(k)=>localStorage.getItem(k)!==null',key(A))
        assert page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).currentInventory.values',key(A))!=\
               page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).currentInventory.values','pokesleep-strategy-u2-e2-v1:'+WEEK+':timeline')
        field=open_event(page,B)
        assert field.input_value()=='47', 'B must remain intact after A legacy migration'
        assert not errors,'Page errors: '+str(errors)
        print('E7 v78 Chromium: A/B same-week inventory isolation, migration and reload PASS')
        browser.close()
finally:
    server.shutdown()

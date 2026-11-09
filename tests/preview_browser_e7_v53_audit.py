"""E7 audit: explicit event edits must not be silently overridden by previously saved week."""
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
URL=f'http://127.0.0.1:{server.server_port}/e7-preview/'
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        page.on('dialog',lambda dialog: dialog.accept())
        problems=[]
        page.on('pageerror',lambda error: problems.append(str(error)))
        page.goto(URL+'?previewNow=2026-11-08T16:00&tab=plan',wait_until='domcontentloaded')
        def select(frame,id,value):
            frame.locator('#'+id).evaluate("""(el,value)=>{
                el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
            }""",value)
        def ready():
            page.wait_for_function("""()=> {
                const f=document.getElementById('view-plan');
                return !f.hidden && f.contentDocument?.readyState==='complete'
                    && document.getElementById('status').hidden;
            }""",timeout=20000)
            return page.frame_locator('#view-plan')
        def save(week,field,food):
            frame=ready()
            select(frame,'event-start',week)
            select(frame,'event-field',field)
            select(frame,'event-food',food)
            frame.locator('#event-save').click()
            key='pokesleep-strategy-u3-e3-v1:'+week+':manual%3A'+week+':plan'
            record=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)||"null")',key)
            assert record,('plan not saved',week)
            return record
        a=save('2026-11-09','シアンの砂浜','curry')
        assert a['eventInfo']['field']=='シアンの砂浜'
        b=save('2026-11-16','トープ洞窟','salad')
        assert b['eventInfo']['field']=='トープ洞窟'
        c=save('2026-11-09','ラピスラズリ湖畔','dessert')
        assert c['eventInfo']['field']=='ラピスラズリ湖畔',('old field silently restored',c['eventInfo'])
        assert c['eventInfo']['food']=='dessert',('old food silently restored',c['eventInfo'])
        page.reload(wait_until='domcontentloaded')
        ready()
        stored=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)||"null")',
            'pokesleep-strategy-u3-e3-v1:2026-11-09:manual%3A2026-11-09:plan')
        assert stored['eventInfo']['field']=='ラピスラズリ湖畔'
        assert stored['eventInfo']['food']=='dessert'
        # Reset from PREPARATION, not only from STRATEGY. All currently loaded
        # same-week child state must be revoked; other weeks must survive.
        page.locator('#tab-prep').click()
        page.wait_for_function("""()=>{
            const f=document.getElementById('view-prep');
            return !f.hidden && f.contentDocument?.readyState==='complete'
                && document.getElementById('status').hidden;
        }""",timeout=20000)
        prep=page.frame_locator('#view-prep')
        prep.locator('#e6-dev summary').click()
        prep.locator('#e6-reset').click()
        page.wait_for_function("""()=>{
            const f=document.getElementById('view-plan');
            return !f.hidden && f.contentDocument?.readyState==='complete'
                && document.getElementById('status').hidden
                && localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')===null;
        }""",timeout=20000)
        akey='pokesleep-strategy-u3-e3-v1:2026-11-09:manual%3A2026-11-09:plan'
        bkey='pokesleep-strategy-u3-e3-v1:2026-11-16:manual%3A2026-11-16:plan'
        assert page.evaluate('(k)=>localStorage.getItem(k)',akey) is None,'old event resurrected from prep reset'
        preserved=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)||"null")',bkey)
        assert preserved and preserved['eventInfo']['field']=='トープ洞窟','unrelated event was erased'
        assert not problems,problems
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('E7 midterm explicit event edits: PASS')

"""E7 v51 persistent tabs: actual Chromium, same-origin storage, history, retained DOM."""
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass
server=ThreadingHTTPServer(('127.0.0.1',0),
    functools.partial(Quiet,directory=str(ROOT)))
thread=threading.Thread(target=server.serve_forever,daemon=True)
thread.start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
errors=[]
def select(frame,id,value):
    frame.locator('#'+id).evaluate(
        """(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}""",value)
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,
            args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},
            timezone_id='Asia/Tokyo')
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda dialog:dialog.accept())
        def ready(tab):
            page.wait_for_function("""(tab)=>{
               const f=document.querySelector('#view-'+tab);
               try{
                return document.documentElement.dataset.activeTab===tab
                    && !f.hidden && f.contentDocument?.readyState==='complete'
                    && f.contentWindow.location.href.includes(
                        tab==='plan'?'U3_Strategy_UI':tab==='prep'?'U2_Prep_Local':'U4_Box_Preview');
               }catch(e){return false}
            }""",arg=tab,timeout=20000)
            return page.frame_locator('#view-'+tab)
        def tab(tab):
            page.locator('#tab-'+tab).click()
            return ready(tab)
        def marker(tab,value):
            page.locator('#view-'+tab).evaluate(
                '(f,val)=>{f.contentWindow.__v51_marker=val}',value)
        def get_marker(tab):
            return page.locator('#view-'+tab).evaluate(
                '(f)=>f.contentWindow.__v51_marker||null')
        page.goto(BASE+'?previewNow=2026-11-08T16:00',
            wait_until='domcontentloaded')
        plan=ready('plan')
        assert page.locator('#tab-plan').get_attribute('aria-current')=='page'
        assert page.locator('#view-prep').is_hidden()
        assert page.locator('#view-box').is_hidden()
        assert page.locator('#e7-frame').count()==0,'old single iframe returned'
        assert plan.locator('#e6-footer').is_hidden(),'old footer still visible'
        marker('plan','keep-plan')
        select(plan,'event-start','2026-11-09')
        select(plan,'event-field','シアンの砂浜')
        select(plan,'event-food','all')
        plan.locator('#event-save').click()
        selection=page.evaluate(
            "()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected'))")
        assert selection=={'id':'manual:2026-11-09','weekStart':'2026-11-09'},selection

        prep=tab('prep')
        assert 'eventId=manual%3A2026-11-09' in page.locator('#view-prep').evaluate(
            '(f)=>f.contentWindow.location.href')
        assert 'pokesleepStock=' not in page.locator('#view-prep').evaluate(
            '(f)=>f.contentWindow.location.href')
        assert prep.locator('#e6-footer').is_hidden()
        marker('prep','keep-prep')
        prep.locator('#btn-inventory').click()
        cells=prep.locator('#inventory-panel [data-key]')
        assert cells.count()==19
        cells.first.fill('13')
        prep.locator('#save-inventory').click()
        data=page.evaluate("""()=>JSON.parse(
            localStorage.getItem('pokesleep-strategy-u2-e2-v1:2026-11-09:timeline'))""")
        assert data['eventId']=='manual:2026-11-09'
        assert 13 in data['currentInventory']['values'].values()

        plan=tab('plan')
        assert get_marker('plan')=='keep-plan','plan was unnecessarily reconstructed after stock update'
        assert page.locator('#tab-plan').get_attribute('aria-current')=='page'
        plan.locator('#e3-next').click()
        assert plan.locator('#review-dialog').evaluate('(e)=>e.open')
        plan.locator('#review-adopt').click()
        prep=tab('prep')
        assert get_marker('prep')=='keep-prep','prep was unnecessarily reconstructed after proposal save'
        prep.locator('#btn-inventory').click()
        prep.locator('#inventory-panel [data-key]').first.fill('14')
        prep.locator('#save-inventory').click()
        page.wait_for_function(
            "()=>document.getElementById('tab-plan').dataset.reproposal==='true'",
            timeout=12000)
        plan=tab('plan')
        assert get_marker('plan')=='keep-plan'
        assert plan.locator('#e3-next').inner_text()=='作戦を再提案'
        plan.locator('#e3-next').click()
        plan.locator('#review-adopt').click()
        page.wait_for_function(
            "()=>document.getElementById('tab-plan').dataset.reproposal==='false'",
            timeout=12000)

        box=tab('box')
        assert box.locator('#e6-footer').is_hidden()
        marker('box','keep-box')
        box.locator('#player-pot').fill('57') # intentionally not saved
        plan=tab('plan')
        box=tab('box')
        assert get_marker('box')=='keep-box','box was reconstructed on ordinary navigation'
        assert box.locator('#player-pot').input_value()=='57','unsaved input was lost'
        box.locator('#player-bag').fill('700')
        box.locator('#player-save').click()
        saved=page.evaluate(
            "()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-player-v1'))")
        assert saved['pot']==57 and saved['bag']==700

        # Repeated navigation: maintain the 3 documents and scroll position.
        for n in range(6):
            tab('prep')
            tab('plan')
            tab('box')
        assert get_marker('box')=='keep-box'
        assert get_marker('plan')=='keep-plan'
        assert get_marker('prep')=='keep-prep'
        assert page.locator('#view-plan').count()==1
        assert page.locator('#view-prep').count()==1
        assert page.locator('#view-box').count()==1
        page.evaluate('history.back()')
        ready('plan')
        assert get_marker('plan')=='keep-plan','history.back reloaded or misrouted the document'
        page.evaluate('history.back()')
        ready('prep')
        assert get_marker('prep')=='keep-prep'

        # New week invalidates only event-scoped views.
        plan=tab('plan')
        select(plan,'event-start','2026-11-16')
        select(plan,'event-field','シアンの砂浜')
        select(plan,'event-food','all')
        plan.locator('#event-save').click()
        selected=page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected'))")
        assert selected['weekStart']=='2026-11-16',selected
        prep=tab('prep')
        src=page.locator('#view-prep').evaluate('(f)=>f.contentWindow.location.href')
        assert 'eventStart=2026-11-16' in src,src
        assert 'eventId=manual%3A2026-11-16' in src,src
        assert not errors,errors

        page.goto(BASE+'?previewNow=2026-11-16T03:59',wait_until='domcontentloaded')
        ready('prep')
        page.goto(BASE+'?previewNow=2026-11-16T04:00',wait_until='domcontentloaded')
        ready('plan')
        # Old installed/bookmarked entry should redirect into the persistent app.
        page.goto(BASE+'U5_Integrated_20261109_v50_E7.html?tab=box',
            wait_until='domcontentloaded')
        page.wait_for_url('**/e7-preview/?tab=box',timeout=12000)
        ready('box')
        for width in (320,393,430):
            page.set_viewport_size({'width':width,'height':852})
            page.wait_for_timeout(30)
            docwidth=page.evaluate('document.documentElement.scrollWidth')
            assert docwidth<=width+2,(width,docwidth)
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('E7 v51 persistent three tabs / scroll-ready / state sync / history: PASS')

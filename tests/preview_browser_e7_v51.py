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
        browser=pw.chromium.launch(headless=True,
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
                    && document.getElementById('status').hidden
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
        page.wait_for_function("""()=>{
            const f=document.getElementById('view-plan');
            return f.contentDocument?.getElementById('e3-next')?.innerText==='作戦を再提案';
        }""",timeout=15000)
        plan.locator('#e3-next').click()
        plan.locator('#review-adopt').click()
        page.wait_for_function(
            "()=>document.getElementById('tab-plan').dataset.reproposal==='false'",
            timeout=12000)

        box=tab('box')
        assert box.locator('#e6-footer').is_hidden()
        marker('box','keep-box')
        assert box.locator('#player-title').is_hidden(), 'Player card should live in Settings'
        box.locator('#e7-more-open').click()
        box.locator('#e7-more-player').click()
        page.wait_for_function("""()=>document.getElementById('e7-settings-dialog')?.open &&
          document.getElementById('e7-settings-title').textContent==='プレイヤー情報'""",
          timeout=10000)
        page.locator('#e7-settings-pot').fill('57')
        page.locator('#e7-settings-bag').fill('700')
        page.locator('#e7-settings-player-save').click()
        saved=page.evaluate(
            "()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-player-v1'))")
        assert saved['pot']==57 and saved['bag']==700
        page.locator('#e7-settings-close').click()
        box.locator('#box-query').fill('未保存の検索')
        plan=tab('plan')
        box=tab('box')
        assert get_marker('box')=='keep-box','box was reconstructed on ordinary navigation'
        assert box.locator('#box-query').input_value()=='未保存の検索', 'Unsaved box search was lost'

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
        box=tab('box')
        marker('box','keep-box-across-event')
        box.locator('#box-query').fill('週をまたぐ検索') # unsaved global Box filter
        plan=tab('plan')
        select(plan,'event-start','2026-11-16')
        select(plan,'event-field','シアンの砂浜')
        select(plan,'event-food','all')
        plan.locator('#event-save').click()
        selected=page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected'))")
        assert selected['weekStart']=='2026-11-16',selected
        prep=tab('prep')
        # Parent tab activation is synchronous; child location.replace is async.
        # Do not accept the already-loaded previous event's prep document.
        page.wait_for_function("""()=>{
            const f=document.getElementById('view-prep');
            try{return !f.hidden &&
              f.contentWindow.location.search.includes('eventStart=2026-11-16') &&
              f.contentDocument.readyState==='complete' &&
              document.getElementById('status').hidden;}
            catch(e){return false;}
        }""",timeout=15000)
        src=page.locator('#view-prep').evaluate('(f)=>f.contentWindow.location.href')
        assert 'eventStart=2026-11-16' in src,src
        assert 'eventId=manual%3A2026-11-16' in src,src
        box=tab('box')
        assert get_marker('box')=='keep-box-across-event','global box reloaded after event change'
        assert box.locator('#box-query').input_value()=='週をまたぐ検索','unsaved Box filter lost'
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
        # Original E6 developer controls are restored, but remain an
        # expandable panel INSIDE U2/U3. The footer/icons stay three tabs.
        marker('box','dev-global-box')
        plan=tab('plan')
        assert plan.locator('#e6-dev').is_visible()
        assert '開発用・日時切替' in plan.locator('#e6-dev summary').inner_text()
        assert plan.locator('#e6-dev [data-e6-stage]').count()==3
        plan.locator('#e6-dev summary').click()
        plan.locator('#e6-dev [data-e6-stage="start"]').click()
        page.wait_for_function("""()=>{
            const f=document.getElementById('view-plan');
            return new URL(location.href).searchParams.get('previewNow')==='2026-11-16T06:00'
                && new URL(f.contentWindow.location.href).searchParams.get('previewNow')==='2026-11-16T06:00'
                && f.contentDocument?.readyState==='complete'
                && document.getElementById('status').hidden;
        }""",timeout=15000)
        assert page.locator('#tab-plan').get_attribute('aria-current')=='page'
        assert page.frame_locator('#view-plan').locator('#e6-dev').evaluate('(d)=>d.open')
        box=tab('box')
        assert get_marker('box')=='dev-global-box','developer clock needlessly reloaded Box'
        prep=tab('prep')
        assert prep.locator('#e6-dev').is_visible()
        prep.locator('#e6-dev summary').click()
        prep.locator('#e6-dev [data-e6-stage="prep"]').click()
        page.wait_for_function("""()=>{
            const f=document.getElementById('view-prep');
            return new URL(location.href).searchParams.get('previewNow')==='2026-11-15T16:00'
                && new URL(f.contentWindow.location.href).searchParams.get('previewNow')==='2026-11-15T16:00'
                && f.contentDocument?.readyState==='complete'
                && document.getElementById('status').hidden;
        }""",timeout=15000)
        assert page.locator('#tab-prep').get_attribute('aria-current')=='page'
        assert page.frame_locator('#view-prep').locator('#e6-dev').evaluate('(d)=>d.open')
        plan=tab('plan')
        assert plan.locator('#e6-dev').is_visible()
        page.evaluate("""()=>{
            localStorage.setItem('pokesleep-strategy-e7-dev-test-keep','keep-me');
            localStorage.setItem('pokesleep-strategy-u2-e2-v1:2026-11-09:sentinel','unrelated-week');
        }""")
        plan.locator('#e6-dev #e6-reset').click()
        page.locator('#e7-feedback-dialog').wait_for(state='visible',timeout=15000)
        assert page.locator('#e7-feedback-title').inner_text()=='検証データを初期化'
        page.locator('#e7-feedback-ok').click()
        page.wait_for_function("""()=>{
            const plan=document.getElementById('view-plan');
            return localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')===null
              && new URL(location.href).searchParams.get('previewNow')==='2026-11-15T16:00'
              && !plan.hidden && plan.contentDocument?.readyState==='complete'
              && document.getElementById('status').hidden;
        }""",timeout=15000)
        assert page.evaluate("localStorage.getItem('pokesleep-strategy-u2-e2-v1:2026-11-09:sentinel')")=='unrelated-week'
        assert page.evaluate("localStorage.getItem('pokesleep-strategy-e7-dev-test-keep')")=='keep-me'
        assert page.evaluate("JSON.parse(localStorage.getItem('pokesleep-strategy-e7-player-v1')).pot")==57
        assert page.locator('#tab-plan').get_attribute('aria-current')=='page'
        # Regression: the discarded plan must NOT be restored by old iframe's
        # beforeunload autosave. v51 silently resurrected it after reset.
        old_plan_key='pokesleep-strategy-u3-e3-v1:2026-11-16:manual%3A2026-11-16:plan'
        old_ledger_key='pokesleep-strategy-u3-e3-v1:2026-11-16:manual%3A2026-11-16:conditions'
        assert page.evaluate('(key)=>localStorage.getItem(key)',old_plan_key) is None, 'old plan resurrected after reset'
        assert page.evaluate('(key)=>localStorage.getItem(key)',old_ledger_key) is None, 'old conditions survived reset'
        assert page.evaluate("localStorage.getItem('pokesleep-strategy-u2-e2-v1:2026-11-16:timeline')") is None
        # Enter a DIFFERENT event setup for the same week/id, then reload.
        # The just-entered values, never any pre-reset values, must win.
        plan=ready('plan')
        select(plan,'event-start','2026-11-16')
        select(plan,'event-field','トープ洞窟')
        select(plan,'event-food','salad')
        plan.locator('#event-save').click()
        saved_plan=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',old_plan_key)
        assert saved_plan is not None and saved_plan['eventInfo']['field']=='トープ洞窟', saved_plan
        assert saved_plan['eventInfo']['food']=='salad',saved_plan
        selected=page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected'))")
        assert selected=={'weekStart':'2026-11-16','id':'manual:2026-11-16'},selected
        page.reload(wait_until='domcontentloaded')
        plan=ready('plan')  # reset explicitly keeps tab=plan in the shell URL
        assert plan.locator('#event-field').input_value()=='トープ洞窟','old event field returned after reload'
        assert plan.locator('#event-food').input_value()=='salad','old food category returned after reload'
        assert not errors,errors
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

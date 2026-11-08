"""E7 v50 U4 -> U5 integration and strict CSV import, HTTP same-origin Chromium test."""
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass
handler=functools.partial(Quiet,directory=str(ROOT))
server=ThreadingHTTPServer(('127.0.0.1',0),handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
BASE=f'http://127.0.0.1:{server.server_port}/previews/U5_Integrated_20261109_v50_E7.html'
JP=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3',
    'メインスキル','せいかく','まっしろミント','Lv10','Lv25','Lv50','Lv70','Lv80',
    '一緒に眠った時間','色違い','お気に入り']
ROW=['ぴかちゅう','ピカチュウ','50','5','とくせんリンゴ','あったかジンジャー','とくせんリンゴ',
    'メインスキル','いじっぱり','1','きのみの数S','おてつだいボーナス','','','','500','0','💛']
CSV=','.join(JP)+'\n'+','.join(ROW)
errors=[]
def select(frame,id,value):
    frame.locator('#'+id).evaluate("""(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}""",value)
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda dialog:dialog.accept())
        page.goto(BASE+'?previewNow=2026-11-08T16:00',wait_until='domcontentloaded')
        frame=page.frame_locator('#e7-frame')
        assert 'U3_Strategy_UI' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        # Select an event in the ONE event-conditions screen; U5 must not invent one.
        select(frame,'event-start','2026-11-09')
        select(frame,'event-field','シアンの砂浜')
        select(frame,'event-food','all')
        frame.locator('#event-save').click()
        chosen=page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected'))")
        assert chosen=={'id':'manual:2026-11-09','weekStart':'2026-11-09'},chosen
        # Footer navigation is controlled by the shell, with browser history.
        frame.locator('#e6-footer-prep').click()
        page.wait_for_url('**tab=prep')
        assert 'U2_Prep_Local' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        assert 'pokesleepStock=' not in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        assert 'eventId=manual%3A2026-11-09' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        frame.locator('#btn-inventory').click()
        values=frame.locator('#inventory-panel [data-key]')
        assert values.count()==19,values.count()
        values.first.fill('13')
        frame.locator('#save-inventory').click()
        stock=page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u2-e2-v1:2026-11-09:timeline'))""")
        assert stock['currentInventory'] and 13 in stock['currentInventory']['values'].values(),stock
        assert stock['eventId']=='manual:2026-11-09'
        # Real box registration and player parameters, with explicit confirmation.
        frame.locator('#e6-footer-box').click()
        page.wait_for_url('**tab=box')
        assert 'U4_Box_Preview' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        frame.locator('#player-pot').fill('57')
        frame.locator('#player-bag').fill('700')
        frame.locator('#e7-bonuses summary').click()
        frame.locator('#bonus-0').fill('10')
        frame.locator('#player-save').click()
        player=page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-player-v1'))")
        assert player['pot']==57 and player['bag']==700 and player['bonuses']['ワカクサ本島']==10,player
        frame.locator('#e7-import-panel summary').click()
        frame.locator('#upload').set_input_files({'name':'box.csv','mimeType':'text/csv','buffer':CSV.encode('utf-8')})
        frame.locator('#box-commit').click()
        assert frame.locator('#box-count').inner_text().strip()=='1匹'
        box=page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1'))")
        assert box['items'][0]['mint'] is True,box
        assert box['items'][0]['ribbon']==500
        assert box['items'][0]['lv70']=='' and box['items'][0]['lv80']==''
        frame.locator('#e6-footer-plan').click()
        page.wait_for_url('**tab=plan')
        assert 'U3_Strategy_UI' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        assert page.evaluate("()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u2-e2-v1:2026-11-09:timeline')).currentInventory") is not None
        # SPA pushState/popstate is same-document navigation: do not wait for a full load.
        page.evaluate("history.back()")
        page.wait_for_url('**tab=box',wait_until='commit')
        assert 'U4_Box_Preview' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        assert frame.locator('#box-count').inner_text().strip()=='1匹'
        # Adopt the illustrative plan, then change stock: the cross-tab dot must survive
        # without any pokesleepStock/pokesleepPlanWatch URL packet.
        frame.locator('#e6-footer-plan').click()
        page.wait_for_url('**tab=plan')
        frame.locator('#e3-next').click()
        assert frame.locator('#review-dialog').evaluate('(e)=>e.open')
        frame.locator('#review-adopt').click()
        frame.locator('#e6-footer-prep').click()
        page.wait_for_url('**tab=prep')
        frame.locator('#btn-inventory').click()
        frame.locator('#inventory-panel [data-key]').first.fill('14')
        frame.locator('#save-inventory').click()
        assert frame.locator('#e6-footer-plan').get_attribute('data-reproposal')=='true', 'U2 dot lost'
        frame.locator('#e6-footer-box').click()
        page.wait_for_url('**tab=box')
        assert frame.locator('#e6-footer-plan').get_attribute('data-reproposal')=='true', 'U4 dot lost'
        frame.locator('#e6-footer-plan').click()
        page.wait_for_url('**tab=plan')
        assert frame.locator('#e3-next').inner_text()=='作戦を再提案'
        frame.locator('#e3-next').click()
        frame.locator('#review-adopt').click()
        frame.locator('#e6-footer-box').click()
        page.wait_for_url('**tab=box')
        assert frame.locator('#e6-footer-plan').get_attribute('data-reproposal')=='false', 'dot did not clear after adoption'
        # NEW launch (no tab query) derives screen from 04:00 JST, not from prior tab browsing.
        page.goto(BASE+'?previewNow=2026-11-08T16:00',wait_until='domcontentloaded')
        assert 'U2_Prep_Local' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        page.goto(BASE+'?previewNow=2026-11-09T03:59',wait_until='domcontentloaded')
        assert 'U2_Prep_Local' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        page.goto(BASE+'?previewNow=2026-11-09T04:00',wait_until='domcontentloaded')
        assert 'U3_Strategy_UI' in page.locator('#e7-frame').evaluate('(e)=>e.contentWindow.location.href')
        # U6: U4 must stay within the narrow Pixel viewport.
        for width in (320,393,430):
            page.set_viewport_size({'width':width,'height':852})
            page.goto(BASE+'?tab=box&previewNow=2026-11-08T16:00',wait_until='domcontentloaded')
            docwidth=frame.locator('html').evaluate('(e)=>e.scrollWidth')
            assert docwidth<=width+2,(width,docwidth)
        # New upstream columns cannot silently be shifted or discarded.
        frame.locator('#e7-import-panel summary').click()
        bad=CSV.split('\n')[0]+',新しい列\n'+CSV.split('\n')[1]+',abc'
        frame.locator('#upload').set_input_files({'name':'changed.csv','mimeType':'text/csv','buffer':bad.encode('utf-8')})
        assert frame.locator('#box-commit').is_disabled()
        assert frame.locator('#box-count').inner_text().strip()=='1匹'
        # Corrupt existing box content must lock edits rather than overwrite it.
        page.evaluate("()=>localStorage.setItem('pokesleep-strategy-e7-box-v1','{broken')")
        page.reload(wait_until='domcontentloaded')
        assert frame.locator('#e7-blocked').is_visible()
        assert frame.locator('#player-save').is_disabled()
        assert not errors,errors
        browser.close()
finally:
    server.shutdown();server.server_close()
print('E7 U4->U5 shared origin/CSV/04:00/browser history: PASS')

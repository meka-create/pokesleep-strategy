"""E7 v56: settings entry in every header, player move, safe full backup/restore."""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},
          timezone_id='Asia/Tokyo',accept_downloads=True)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda dialog:dialog.accept())
        page.goto(BASE+'?tab=box',wait_until='domcontentloaded')
        def open_tab(tab):
            page.locator('#tab-'+tab).click()
            page.wait_for_function("""(tab)=>document.documentElement.dataset.activeTab===tab
              && document.getElementById('status').hidden
              && document.getElementById('view-'+tab).contentDocument?.readyState!=='loading'""",
              arg=tab,timeout=20000)
            return page.frame_locator('#view-'+tab)
        box=open_tab('box')
        assert box.locator('#player-title').is_hidden(),'Player editor must be outside unified Box'
        assert box.locator('#e7-settings-open').is_visible()
        assert page.locator('#e7-settings-dialog').is_hidden()
        box.locator('#e7-settings-open').click()
        assert page.locator('#e7-settings-dialog').is_visible()
        assert page.locator('#e7-player-settings').is_visible()
        assert page.locator('#e7-backup-settings').is_visible()
        page.locator('#e7-player-settings > summary').click()
        page.locator('#e7-settings-pot').fill('57')
        page.locator('#e7-settings-bag').fill('700')
        page.locator('#e7-settings-bonus-0').fill('15')
        page.locator('#e7-settings-player-save').click()
        player=page.evaluate("""()=>JSON.parse(
          localStorage.getItem('pokesleep-strategy-e7-player-v1'))""")
        assert player['pot']==57 and player['bag']==700
        assert player['bonuses']['ワカクサ本島']==15
        page.locator('#e7-settings-close').click()
        assert page.locator('#e7-settings-dialog').is_hidden()
        for tab in ('prep','plan','box'):
            child=open_tab(tab)
            assert child.locator('#e7-settings-open').is_visible(), tab
            assert child.locator('#e7-settings-open').get_attribute('aria-label')=='設定'
        assert page.locator('#tabbar button').count()==3,'Settings must not become a fourth tab'
        # The new header gear must not overlap the title or the week pill,
        # especially on the smallest supported phone viewport.
        for width in (320,393,430):
            page.set_viewport_size({'width':width,'height':852})
            for tab in ('plan','prep','box'):
                child=open_tab(tab)
                shape=child.locator('#e7-settings-open').evaluate("""(gear)=>{
                  const header=gear.closest('header');
                  const brand=header.querySelector('.brand');
                  const week=header.querySelector('#u2-week-label');
                  const r=gear.getBoundingClientRect(),b=brand.getBoundingClientRect();
                  const w=week?.getBoundingClientRect();
                  return {left:r.left,right:r.right,brandRight:b.right,
                    weekRight:w?.right ?? 0, viewport:document.documentElement.clientWidth};
                }""")
                assert shape['left']>shape['brandRight']-2,(tab,width,shape)
                assert shape['right']<=shape['viewport']+2,(tab,width,shape)
                if tab=='prep':
                    assert shape['left']>=shape['weekRight']-2,(tab,width,shape)
        page.set_viewport_size({'width':393,'height':852})

        # A backup must include only this app's keys; never another PWA's data.
        page.evaluate("""()=>{
          localStorage.setItem('pokesleep-strategy-e7-v56-sentinel','{"ok":true}');
          localStorage.setItem('pokesleep-strategy-u2-e2-v1:2026-11-09:sentinel','{"amount":27}');
          localStorage.setItem('unrelated-pwa-token','must-not-export-or-delete');
        }""")
        box=open_tab('box')
        box.locator('#e7-settings-open').click()
        page.locator('#e7-backup-settings > summary').click()
        with page.expect_download() as download_event:
            page.locator('#e7-settings-export').click()
        download=download_event.value
        assert download.suggested_filename.startswith('pokesleep-strategy-backup-')
        original=json.loads(Path(download.path()).read_text(encoding='utf-8'))
        assert original['format']=='pokesleep-strategy-backup' and original['version']==1
        records={r['key']:r['value'] for r in original['records']}
        assert records['pokesleep-strategy-e7-v56-sentinel']=='{"ok":true}'
        assert 'pokesleep-strategy-e7-player-v1' in records
        assert 'unrelated-pwa-token' not in records

        # Invalid file must not enable restore or mutate existing records.
        corrupt=dict(original)
        corrupt['records']=[{'key':'unrelated-pwa-token','value':'stolen'}]
        page.locator('#e7-settings-import-file').set_input_files({
          'name':'invalid.json','mimeType':'application/json',
          'buffer':json.dumps(corrupt,ensure_ascii=False).encode('utf-8')})
        assert page.locator('#e7-settings-restore').is_disabled()
        assert page.evaluate("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-e7-player-v1')).pot""")==57

        # Change settings, then recover the precise previous snapshot.
        page.locator('#e7-settings-pot').fill('92')
        page.locator('#e7-settings-player-save').click()
        assert page.evaluate("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-e7-player-v1')).pot""")==92
        page.evaluate("""()=>localStorage.setItem(
          'pokesleep-strategy-e7-v56-after-export','{"new":true}')""")
        page.locator('#e7-settings-import-file').set_input_files({
          'name':'original.json','mimeType':'application/json',
          'buffer':json.dumps(original,ensure_ascii=False).encode('utf-8')})
        assert page.locator('#e7-settings-restore').is_enabled()
        assert '件の保存データ' in page.locator('#e7-settings-import-summary').inner_text()
        page.locator('#e7-settings-restore').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-e7-player-v1'))?.pot===57""",timeout=15000)
        page.wait_for_function("""()=>document.getElementById('status').hidden
          && document.getElementById('view-box').contentDocument?.readyState!=='loading'""",
          timeout=20000)
        assert page.evaluate("""()=>localStorage.getItem(
          'pokesleep-strategy-e7-v56-after-export')""") is None
        assert page.evaluate("""()=>localStorage.getItem(
          'pokesleep-strategy-e7-v56-sentinel')""")=='{"ok":true}'
        assert page.evaluate("""()=>localStorage.getItem(
          'unrelated-pwa-token')""")=='must-not-export-or-delete'
        box=page.frame_locator('#view-box')
        assert box.locator('#player-title').is_hidden()
        box.locator('#e7-settings-open').click()
        page.locator('#e7-player-settings > summary').click()
        assert page.locator('#e7-settings-pot').input_value()=='57'
        assert page.locator('#e7-settings-bag').input_value()=='700'
        page.locator('#e7-settings-close').click()
        # A malformed current player record must not block recovery from a
        # previously exported valid backup; it must disable ordinary editing.
        page.evaluate("""()=>localStorage.setItem(
          'pokesleep-strategy-e7-player-v1','{damaged')""")
        box=page.frame_locator('#view-box')
        box.locator('#e7-settings-open').click()
        assert page.locator('#e7-settings-player-save').is_disabled()
        page.locator('#e7-backup-settings > summary').click()
        with page.expect_download() as damaged_download:
            page.locator('#e7-settings-export').click()
        damaged=json.loads(Path(damaged_download.value.path()).read_text(encoding='utf-8'))
        assert any(r['key']=='pokesleep-strategy-e7-player-v1'
          and r['value']=='{damaged' for r in damaged['records'])
        page.locator('#e7-settings-import-file').set_input_files({
          'name':'recover.json','mimeType':'application/json',
          'buffer':json.dumps(original,ensure_ascii=False).encode('utf-8')})
        assert page.locator('#e7-settings-restore').is_enabled()
        page.locator('#e7-settings-restore').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-e7-player-v1'))?.pot===57""",timeout=15000)
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('E7 v56 settings + player + validated backup / restore + 3 tabs: PASS')

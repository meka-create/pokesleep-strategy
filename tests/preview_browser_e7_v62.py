"""E7 v62: verify descending sort, exact delete, sprites, actions and strategy roster Lv."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools, threading, json
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
def specimen(pokemon,nickname,level):
    return dict(nickname=nickname,pokemon=pokemon,level=level,skillLevel=4,
        ing1='とくせんリンゴ',ing2='モーモーミルク',ing3='リラックスカカオ',
        mainSkill='げんきチャージS',nature='おだやか',mint=False,
        lv10='おてつだいボーナス',lv25='スキル確率アップM',lv50=None,
        lv70=None,lv80=None,ribbon=0,shiny=False,favorite=None)
# Deliberately not sorted in CSV order. Duplicate nicknames and equal levels matter.
items=[specimen('バケッチャ（こだましゅ）','かぼ',20),
       specimen('パンプジン（ギガだましゅ）','かぼ',60),
       specimen('パンプジン（おおだましゅ）','大',45),
       specimen('バケッチャ（ちゅうだましゅ）','中',50),
       specimen('バケッチャ（ギガだましゅ）','ギガ',45),
       specimen('パンプジン（こだましゅ）','小',32),
       specimen('パンプジン（ちゅうだましゅ）','中パン',25),
       specimen('バケッチャ（おおだましゅ）','大バケ',40)]
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=ctx.new_page()
        problems=[]
        page.on('pageerror',lambda e:problems.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        page.goto(BASE+'?tab=box',wait_until='domcontentloaded')
        page.evaluate("""items=>localStorage.setItem('pokesleep-strategy-e7-box-v1',
         JSON.stringify({version:1,source:'pokesleep-tool-header-mapped',items}))""",items)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("""()=>document.documentElement.dataset.activeTab==='box'&&
          document.getElementById('view-box').contentDocument?.querySelectorAll('.box-entry').length===8""")
        box=page.frame_locator('#view-box')
        levels=box.locator('.box-level').all_inner_texts()
        assert levels==['Lv. 60','Lv. 50','Lv. 45','Lv. 45','Lv. 40','Lv. 32','Lv. 25','Lv. 20'],levels
        assert [box.locator('.box-nickname').nth(i).inner_text() for i in (2,3)]==['大','ギガ']
        assert box.locator('#box-query').get_attribute('placeholder')=='検索'
        assert box.locator('#box-query').get_attribute('aria-label')=='検索'
        assert box.locator('#box-query').evaluate('el=>el.closest("label")===null')
        urls={'かぼ':None}
        expected={'かぼ':'/10032.png','大':'/10031.png','中':'/710.png',
            'ギガ':'/10029.png','小':'/10030.png','中パン':'/711.png','大バケ':'/10028.png'}
        # Nickname かぼ appears twice: verify each sprite by species and level.
        by_lv={int(box.locator('.box-level').nth(i).inner_text()[4:]):box.locator('.box-avatar img').nth(i) for i in range(8)}
        assert by_lv[60].get_attribute('data-sprite-url').endswith('/10032.png')
        assert by_lv[20].get_attribute('data-sprite-url').endswith('/10027.png')
        for idx,id in [(1,710),(2,10031),(3,10029),(4,10028),(5,10030),(6,711)]:
            assert box.locator('.box-entry').nth(idx).locator('img[data-sprite-url]').get_attribute('data-sprite-url').endswith(f'/{id}.png'),idx
        assert box.locator('#box-detail-dismiss').count()==0
        assert box.locator('#box-detail-close').count()==1
        box.locator('.box-entry').first.locator('.box-avatar').click()
        assert box.locator('#box-detail-level').inner_text()=='Lv.60'
        assert box.locator('#box-delete').is_visible()
        button_sizes=box.locator('#box-detail-dialog').evaluate("""el=>{
          const top=el.querySelector('#box-detail-close').getBoundingClientRect();
          const bottom=el.querySelector('#box-delete').getBoundingClientRect();
          return {top:top.height,bottom:bottom.height,x:bottom.x};
        }""")
        assert abs(button_sizes['top']-button_sizes['bottom'])<1,button_sizes
        box.locator('#box-delete').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items.length===7""")
        saved=page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items""")
        assert [x['level'] for x in saved]==[20,45,50,45,32,25,40],'Original CSV order changed by display sort'
        box.locator('#e7-import-panel > summary').click()
        assert box.locator('#box-clear').is_visible()
        css=box.locator('.import-actions').evaluate("""el=>{
          const a=el.querySelector('#box-commit').getBoundingClientRect();
          const b=el.querySelector('#box-clear').getBoundingClientRect();
          return {aTop:a.top,bTop:b.top,aHeight:a.height,bHeight:b.height,aRight:a.right,bLeft:b.left};
        }""")
        assert abs(css['aTop']-css['bTop'])<1 and abs(css['aHeight']-css['bHeight'])<1,css
        assert css['aRight']<css['bLeft'],css
        box.locator('#e7-import-panel > summary').click()
        assert box.locator('#box-clear').is_hidden()
        # Strategy sleep-roster uses the same avatar() as the weekly layout.
        page.locator('#tab-plan').click()
        page.wait_for_function("""()=>document.documentElement.dataset.activeTab==='plan'&&
          document.getElementById('status').hidden&&
          document.getElementById('view-plan').contentDocument?.querySelector('#sleep-open')""")
        plan=page.frame_locator('#view-plan')
        assert plan.locator('#sleep-open').is_enabled()
        plan.locator('#sleep-open').click()
        assert plan.locator('#sleep-dialog').is_visible()
        assert plan.locator('#sleep-team-preview .mon-level').count()==5
        for width in (320,393,430):
            page.set_viewport_size({'width':width,'height':852})
            geometry=plan.locator('#sleep-team-preview .mon').first.evaluate("""el=>{
              const level=el.querySelector('.mon-level'),av=el.querySelector('.avatar'),name=el.querySelector('.mon-name');
              const a=av.getBoundingClientRect(), l=level.getBoundingClientRect(),n=name.getBoundingClientRect();
              return {above:a.top-l.bottom,below:n.top-a.bottom,width:a.width,height:a.height,lvFont:getComputedStyle(level).fontSize};
            }""")
            assert abs(geometry['above']-1)<.7 and abs(geometry['below']-2)<.7,(width,geometry)
            assert abs(geometry['width']-42)<.7 and abs(geometry['height']-42)<.7,(width,geometry)
            assert geometry['lvFont']==('9px' if width<=385 else '10px'),(width,geometry)
        assert not problems,problems
        browser.close()
finally:
    server.shutdown()
print('E7 v62: descending Box levels, stable identity, eight pumpkin sizes, controls and strategy Lv PASS')

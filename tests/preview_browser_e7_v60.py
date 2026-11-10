"""E7 v60: compact import, type-tone tiles, exact costume fallback, U3-style status."""
import functools, threading, json
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
def mon(pokemon,nickname,level):
    return dict(nickname=nickname,pokemon=pokemon,level=level,skillLevel=4,
     ing1='とくせんリンゴ',ing2='モーモーミルク',ing3='リラックスカカオ',
     mainSkill='げんきチャージS',nature='おだやか',mint=False,
     lv10='おてつだいボーナス',lv25='スキル確率アップM',lv50='おてつだいスピードS',
     lv70=None,lv80=None,ribbon=100,shiny=False,favorite=None)
group=[mon('タマザラシ（ホリデー）','たま',57),mon('ピカチュウ','ピカ',45),
       mon('フシギダネ','フシ',60),mon('ロコン（アローラ）','こおり',20),
       mon('タマザラシ（未知）','なぞ',22)]
try:
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.dismiss())
    page.goto(BASE+'?tab=box',wait_until='domcontentloaded')
    page.evaluate("""items=>localStorage.setItem('pokesleep-strategy-e7-box-v1',
      JSON.stringify({version:1,source:'pokesleep-tool-header-mapped',items}))""",group)
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("""()=>document.documentElement.dataset.activeTab==='box'&&
      document.getElementById('status').hidden&&
      document.getElementById('view-box').contentDocument?.querySelectorAll('.box-entry').length===5""",timeout=15000)
    box=page.frame_locator('#view-box')
    assert box.locator('#e7-import-panel > summary').inner_text()=='CSV・TSVから登録'
    assert not box.locator('#e7-import-panel').evaluate('(x)=>x.open')
    assert box.locator('#box-clear').is_hidden()
    assert box.locator('#box-registration').evaluate('(x)=>x.getBoundingClientRect().height')<90
    assert box.locator('.box-entry').count()==5
    assert box.locator('.box-entry').first.locator('img[data-sprite-url]').get_attribute('data-sprite-url').endswith('/363.png')
    assert box.locator('.box-entry').nth(3).locator('img[data-sprite-url]').get_attribute('data-sprite-url').endswith('/10103.png')
    assert box.locator('.box-entry').nth(4).locator('img[data-sprite-url]').count()==0
    assert box.locator('.box-entry').nth(4).locator('.poke-art-fallback').is_visible()
    tones=[box.locator('.box-entry').nth(i).locator('.box-avatar').evaluate(
      '(el)=>({tone:el.style.getPropertyValue("--tone"),background:getComputedStyle(el).backgroundColor})') for i in range(3)]
    assert len(set(x['tone'] for x in tones))==3,tones
    assert len(set(x['background'] for x in tones))==3,tones
    # Type colors are subtle and preserve the compact visual density.
    for width in (320,393,430):
      page.set_viewport_size({'width':width,'height':852})
      assert box.locator('#box-list').evaluate('(x)=>getComputedStyle(x).gridTemplateColumns.split(" ").length')==4
      spacing=box.locator('.box-entry').first.evaluate("""el=>{
        const lv=el.querySelector('.box-level').getBoundingClientRect();
        const icon=el.querySelector('.box-avatar').getBoundingClientRect();
        const name=el.querySelector('.box-nickname').getBoundingClientRect();
        return {top:icon.top-lv.bottom,bottom:name.top-icon.bottom};
      }""")
      assert abs(spacing['top']-spacing['bottom'])<.6,(width,spacing)
      assert spacing['top']<=3,(width,spacing)
      assert box.locator('#box-registration').evaluate('(x)=>x.getBoundingClientRect().height')<90
    page.set_viewport_size({'width':393,'height':852})
    box.locator('.box-entry').first.locator('.box-avatar').click()
    assert box.locator('#box-detail-dialog').is_visible()
    assert box.locator('#box-detail-dialog .iv-hero').count()==1
    assert box.locator('#box-detail-dialog .iv-section-title').count()==2
    assert box.locator('#box-detail-main-skill em').inner_text()=='Lv.4'
    assert box.locator('#box-detail-subskills .iv-skill').count()==5
    assert box.locator('#box-detail-subskills .iv-skill.gold').count()==1
    assert box.locator('#box-detail-subskills .iv-skill.blue').count()==1
    assert box.locator('#box-detail-nature .iv-nature-pill').inner_text()=='おだやか'
    assert box.locator('#box-detail-fields img[src*="ingredient-"]').count()==3
    assert box.locator('#box-detail-fields').inner_text().count('—')>=2
    assert box.locator('#box-delete').is_visible()
    assert box.locator('#box-detail-title').is_hidden()
    box.locator('#box-detail-close').click()
    assert box.locator('#box-detail-dialog').is_hidden()
    # Clear must not leak outside an expanded import section.
    box.locator('#e7-import-panel > summary').click()
    assert box.locator('#box-clear').is_visible()
    assert box.locator('#box-clear').evaluate('(x)=>x.closest(".import-content")!==null')
    assert box.locator('#box-clear').evaluate("""x=>{
      const b=x.getBoundingClientRect(),form=document.getElementById('box-commit').getBoundingClientRect();
      return b.top>form.bottom
    }""")
    box.locator('#e7-import-panel > summary').click()
    assert box.locator('#box-clear').is_hidden()
    assert box.locator('.box-entry').count()==5
    assert not errors,errors
    browser.close()
finally:
  server.shutdown()
print('E7 v60: compact import, hidden delete, costume sprite, type tones, equal gaps, strategy status PASS')

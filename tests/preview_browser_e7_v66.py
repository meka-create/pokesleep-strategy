"""E7 v66: one custom modal/toast experience across shell, Box, Prep and settings."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import threading, functools

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
specimen=dict(nickname='ぴか',pokemon='ピカチュウ',level=37,skillLevel=4,
  ing1='とくせんリンゴ',ing2='モーモーミルク',ing3='リラックスカカオ',
  mainSkill='げんきチャージS',nature='おだやか',mint=False,
  lv10='おてつだいボーナス',lv25='スキル確率アップM',
  lv50=None,lv70=None,lv80=None,ribbon=0,shiny=False,favorite=None)

try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
  page=ctx.new_page(); native=[];errors=[]
  page.on('dialog',lambda d:(native.append(d.message),d.dismiss()))
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'?tab=box&previewNow=2026-11-08T16:00',wait_until='domcontentloaded')
  page.evaluate("""v=>{
    localStorage.setItem('pokesleep-strategy-e7-box-v1',
      JSON.stringify({version:1,source:'pokesleep-tool-header-mapped',items:[v]}));
    localStorage.setItem('pokesleep-strategy-u3-e3-v1:selected',
      JSON.stringify({id:'manual:2026-11-09',weekStart:'2026-11-09'}));
  }""",specimen)
  page.reload(wait_until='domcontentloaded')
  def tab(name):
   page.locator('#tab-'+name).click()
   page.wait_for_function("""t=>{
    const f=document.getElementById('view-'+t);
    return f&&!f.hidden&&f.contentDocument?.readyState==='complete'&&
      document.getElementById('status').hidden;
   }""",arg=name,timeout=20000)
   return page.frame_locator('#view-'+name)
  box=tab('box')
  box.locator('.box-avatar').first.click()
  assert box.locator('#box-detail-dialog').is_visible()
  box.locator('#box-delete').click()
  modal=box.locator('#e7-feedback-dialog')
  modal.wait_for(state='visible')
  assert box.locator('#e7-feedback-title').inner_text()=='個体を削除'
  assert box.locator('#e7-feedback-message').inner_text().find('Lv.37')>=0
  assert box.locator('#e7-feedback-cancel').is_visible()
  assert box.locator('#e7-feedback-ok').get_attribute('data-danger')=='true'
  for width in (320,393,430):
   page.set_viewport_size({'width':width,'height':852})
   info=modal.evaluate("""el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,width:r.width,view:document.documentElement.clientWidth,
      cancel:el.querySelector('#e7-feedback-cancel').getBoundingClientRect().height};
   }""")
   assert info['left']>=8 and info['right']<=info['view']-8,(width,info)
   assert info['cancel']>=44,(width,info)
  page.set_viewport_size({'width':393,'height':852})
  box.locator('#e7-feedback-cancel').click()
  assert box.locator('#box-detail-dialog').is_visible()
  assert page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items.length""")==1
  box.locator('#box-delete').click()
  modal.wait_for(state='visible')
  box.locator('#e7-feedback-ok').click()
  page.wait_for_function("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items.length===0""")
  box.locator('#e7-feedback-toast').wait_for(state='visible')
  assert '個体を削除しました' in box.locator('#e7-feedback-toast').inner_text()
  assert not box.locator('#box-detail-dialog').is_visible()

  # Player success is temporary, invalid numeric values remain visible next to the inputs.
  box.locator('#e7-more-open').click()
  box.locator('#e7-more-player').click()
  page.locator('#e7-settings-dialog').wait_for(state='visible')
  page.locator('#e7-settings-pot').fill('57')
  page.locator('#e7-settings-player-save').click()
  shown=page.locator('#e7-settings-dialog #e7-feedback-toast')
  shown.wait_for(state='visible')
  assert 'プレイヤー情報を保存しました' in shown.inner_text()
  page.locator('#e7-settings-pot').fill('-1')
  page.locator('#e7-settings-player-save').click()
  assert '数値を確認してください' in page.locator('#e7-player-status').inner_text()
  assert page.locator('#e7-settings-pot').get_attribute('aria-invalid')=='true'
  page.locator('#e7-settings-close').click()

  # Unified modal supports keyboard escape and safe default focus without a browser popup.
  page.evaluate("""()=>{
    window.__customDecision='pending';
    window.PokeUI.confirm('元に戻せますか？',{title:'確認試験',danger:true})
      .then(v=>{window.__customDecision=v});
  }""")
  page.locator('#e7-feedback-dialog').wait_for(state='visible')
  assert page.evaluate("()=>document.activeElement?.id")=='e7-feedback-cancel'
  page.keyboard.press('Escape')
  page.wait_for_function("()=>window.__customDecision===false")
  assert page.locator('#e7-feedback-dialog').is_hidden()

  # Preparation save emits the same toast component instead of an in-card result.
  prep=tab('prep')
  prep.locator('#btn-inventory').click()
  prep.locator('#inventory-panel [data-key]').first.fill('13')
  prep.locator('#save-inventory').click()
  prep.locator('#e7-feedback-toast').wait_for(state='visible')
  assert '食材在庫を保存しました' in prep.locator('#e7-feedback-toast').inner_text()

  # Invalid developer-reset URLs show a custom warning, never a browser alert.
  second=ctx.new_page()
  second.on('dialog',lambda d:(native.append(d.message),d.dismiss()))
  second.goto(BASE+'U2_Prep_Local_Ingredients_20261109_v50_E7.html?e6Reset=u2&eventStart=invalid',
    wait_until='domcontentloaded')
  second.locator('#e7-feedback-dialog').wait_for(state='visible')
  assert '検証週が不明' in second.locator('#e7-feedback-message').inner_text()
  second.locator('#e7-feedback-ok').click()
  assert second.locator('#e7-feedback-dialog').is_hidden()
  second.close()

  assert not native,('Browser native alert/confirm detected',native)
  assert not errors,errors
  browser.close()
finally:
 server.shutdown()
 server.server_close()
print('E7 v66 shared modals/toast: 320/393/430, delete cancel/approve, settings, Esc, Prep, alert PASS')

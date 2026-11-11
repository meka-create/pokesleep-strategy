"""E7 v67: actual 1px toast-to-visible-footer geometry at all three widths."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools,threading

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
FILES={
 'plan':'U3_Strategy_UI_20261109_v50_E7.html',
 'prep':'U2_Prep_Local_Ingredients_20261109_v50_E7.html',
 'box':'U4_Box_Preview_20261109_v50_E7.html'
}
def near_one(gap,where):
 assert abs(gap-1)<=0.65,(where,gap)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':393,'height':850},timezone_id='Asia/Tokyo')
  page=context.new_page()
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
  for width in (320,393,430):
   page.set_viewport_size({'width':width,'height':850})
   for name in ('plan','prep','box'):
    page.locator('#tab-'+name).click()
    page.wait_for_function("""name=>{
      const f=document.getElementById('view-'+name),d=f?.contentDocument;
      return f&&!f.hidden&&d?.readyState==='complete'&&
        document.getElementById('status').hidden&&
        !!f.contentWindow?.PokeUI &&
        getComputedStyle(d.getElementById('e6-footer')).display==='none';
    }""",arg=name,timeout=20000)
    rect=page.locator('#view-'+name).evaluate("""frame=>{
      frame.contentWindow.PokeUI.toast('位置試験');
      const doc=frame.contentDocument,toast=doc.getElementById('e7-feedback-toast');
      const t=toast.getBoundingClientRect(),f=frame.getBoundingClientRect();
      const nav=document.getElementById('tabbar').getBoundingClientRect();
      return {toFrame:frame.contentWindow.innerHeight-t.bottom,
       toParentFooter:nav.top-(f.top+t.bottom),
       computed:getComputedStyle(toast).bottom,visible:!toast.hidden};
    }""")
    assert rect['visible'],(name,width,rect)
    near_one(rect['toFrame'],('embedded-frame',name,width))
    near_one(rect['toParentFooter'],('embedded-footer',name,width))
    assert abs(float(rect['computed'].replace('px',''))-1)<0.1,rect

   page.evaluate("window.PokeUI.toast('シェル通知')")
   rect=page.evaluate("""()=>{
     const t=document.getElementById('e7-feedback-toast');
     return {gap:document.getElementById('tabbar').getBoundingClientRect().top-
       t.getBoundingClientRect().bottom,bottom:getComputedStyle(t).bottom};
   }""")
   near_one(rect['gap'],('parent-shell',width))

  # A toast hosted inside the top-layer confirmation dialog keeps its old
  # position. This change must not move its position relative to the dialog.
  page.evaluate("""()=>{
    window.PokeUI.confirm('変更を確認',{title:'位置確認'}).then(()=>{});
  }""")
  page.locator('#e7-feedback-dialog').wait_for(state='visible')
  page.evaluate("window.PokeUI.toast('モーダル内の通知')")
  dlg=page.locator('#e7-feedback-dialog #e7-feedback-toast')
  dlg.wait_for(state='visible')
  assert dlg.evaluate("(t)=>getComputedStyle(t).bottom")=='12px'
  page.locator('#e7-feedback-cancel').click()
  assert page.locator('#e7-feedback-dialog').is_hidden()

  # On standalone U2/U3/U4 the local bottom footer remains visible and
  # varies with browser safe-area. Measure it rather than assuming 68px.
  for width in (320,393,430):
   for name,file in FILES.items():
    standalone=context.new_page()
    standalone.set_viewport_size({'width':width,'height':850})
    standalone.on('pageerror',lambda error:errors.append(str(error)))
    standalone.goto(BASE+file,wait_until='domcontentloaded')
    standalone.wait_for_function("""()=>{
      const f=document.getElementById('e6-footer');
      return document.readyState==='complete'&&window.PokeUI&&f&&
        getComputedStyle(f).display!=='none'&&f.getBoundingClientRect().height>0;
    }""",timeout=20000)
    rect=standalone.evaluate("""()=>{
      window.PokeUI.toast('単独画面の位置');
      const f=document.getElementById('e6-footer').getBoundingClientRect();
      const t=document.getElementById('e7-feedback-toast').getBoundingClientRect();
      return {gap:f.top-t.bottom,visibleFooterHeight:f.height};
    }""")
    near_one(rect['gap'],('standalone',name,width))
    assert rect['visibleFooterHeight']>40,(name,width,rect)
    standalone.close()
  assert not errors,errors
  browser.close()
finally:
 server.shutdown()
 server.server_close()
print('E7 v67: embedded plan/prep/box + parent shell + standalone 320/393/430 + modal 1px PASS')

"""E7 v63: calendar footer parity, collapsed card geometry, picker Lv, U2 ingredient alignment."""
import functools, threading
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
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
  ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
  page=ctx.new_page(); errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
  def tab(name):
    page.locator('#tab-'+name).click()
    page.wait_for_function("""t=>{
      const view=document.getElementById('view-'+t);
      return document.documentElement.dataset.activeTab===t&&
        !view.hidden&&document.getElementById('status').hidden&&
        view.contentDocument?.readyState!=='loading';
    }""",arg=name,timeout=20000)
    return page.frame_locator('#view-'+name)
  for width in (320,393,430):
    page.set_viewport_size({'width':width,'height':852})
    plan=tab('plan')
    # The event form intentionally keeps itself open until a proposal exists.
    # Temporarily simulate the closed UI state without saving app data.
    plan.locator('#event-details').evaluate("""el=>{
      el.closest('main').dataset.hasProposed='true';el.open=false;
    }""")
    plan.locator('.sleep-settings').evaluate('(el)=>{el.hidden=false;el.open=false;}')
    event=plan.locator('#event-details')
    sleep=plan.locator('.sleep-settings')
    assert event.locator('summary').is_visible()
    assert sleep.locator('summary').is_visible()
    assert sleep.locator('#auto-sleep').is_hidden()
    assert sleep.locator('#sleep-open').is_hidden()
    a=event.evaluate('(el)=>el.getBoundingClientRect().height')
    b=sleep.evaluate('(el)=>el.getBoundingClientRect().height')
    box=tab('box')
    c=box.locator('#box-registration').evaluate('(el)=>el.getBoundingClientRect().height')
    assert abs(a-c)<1 and abs(b-c)<1,(width,a,b,c)
    plan=tab('plan')
    # Header buttons stay usable after expanding sleep settings.
    plan.locator('.sleep-settings > summary').click()
    assert plan.locator('#auto-sleep').is_visible()
    assert plan.locator('#sleep-open').is_visible()
    plan.locator('.sleep-settings > summary').click()
    assert plan.locator('#sleep-open').is_hidden()
    # Ingredient tiles must preserve *all* positions during goal / stock tab switch.
    prep=tab('prep')
    prep.locator('#btn-goal').click()
    assert prep.locator('#goal-panel .goal-grid .food').count()==19
    goal=prep.locator('#goal-panel .goal-grid').evaluate("""grid=>[...grid.children].map(el=>{
      const box=el.getBoundingClientRect(),img=el.querySelector('.food-media').getBoundingClientRect();
      return {x:box.left,y:box.top,imgx:img.left,imgy:img.top};
    })""")
    goalHeading=prep.locator('#goal-panel > .card .card-heading h2').evaluate(
      '(el)=>({font:getComputedStyle(el).fontSize,height:el.parentNode.getBoundingClientRect().height})')
    prep.locator('#btn-inventory').click()
    assert prep.locator('#inventory-panel .actual-grid .food').count()==19
    stock=prep.locator('#inventory-panel .actual-grid').evaluate("""grid=>[...grid.children].map(el=>{
      const box=el.getBoundingClientRect(),img=el.querySelector('.food-media').getBoundingClientRect();
      return {x:box.left,y:box.top,imgx:img.left,imgy:img.top};
    })""")
    inventoryHeading=prep.locator('#inventory-panel > .card .card-heading h2').evaluate(
      '(el)=>({font:getComputedStyle(el).fontSize,height:el.parentNode.getBoundingClientRect().height})')
    assert goalHeading==inventoryHeading, (width,goalHeading,inventoryHeading)
    assert goalHeading['font']=='15px'
    for i,(g,s) in enumerate(zip(goal,stock)):
      assert all(abs(g[k]-s[k])<1 for k in ('x','y','imgx','imgy')),(width,i,g,s)
  # Exercise the actual edit modal, not just an inert DOM mock.
  page.set_viewport_size({'width':393,'height':852})
  plan=tab('plan')
  plan.locator('#sleep-open').evaluate('(el)=>el.click()')
  assert plan.locator('#sleep-dialog').is_visible()
  plan.locator('#sleep-change').click()
  assert plan.locator('#edit-dialog').is_visible()
  assert ' · 睡眠編成' in plan.locator('#edit-title').inner_text()
  assert plan.locator('#pick-grid .pick').count()>0
  for i in range(min(8,plan.locator('#pick-grid .pick').count())):
    pick=plan.locator('#pick-grid .pick').nth(i)
    level=pick.locator('.pick-level')
    name=pick.locator('.pick-name')
    assert level.inner_text().startswith('Lv.'),i
    measurement=pick.locator('.pick-meta').evaluate("""el=>{
      const a=el.querySelector('.pick-level').getBoundingClientRect();
      const b=el.querySelector('.pick-name').getBoundingClientRect();
      return {above:a.bottom<=b.top,leftDiff:Math.abs(a.left-b.left)};
    }""")
    assert measurement['above'] and measurement['leftDiff']<.6,(i,measurement)
  assert not errors,errors
  browser.close()
finally:
 server.shutdown()
print('E7 v63 browser: compact cards, 19 aligned prep tiles, picker Lv left alignment PASS')

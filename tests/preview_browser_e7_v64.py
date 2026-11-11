"""E7 v64: event panel divider parity and six full-width sleep nicknames."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools, threading
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
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
     const frame=document.getElementById('view-'+t);
     return document.documentElement.dataset.activeTab===t&&!frame.hidden&&
       document.getElementById('status').hidden&&frame.contentDocument?.readyState!=='loading';
   }""",arg=name,timeout=20000)
   return page.frame_locator('#view-'+name)
  for width in (320,393,430):
   page.set_viewport_size({'width':width,'height':852})
   plan=tab('plan')
   plan.locator('#event-details').evaluate("""el=>{
     el.closest('main').dataset.hasProposed='true';el.open=true;
   }""")
   plan.locator('.sleep-settings').evaluate('(el)=>{el.hidden=false;}')
   event=plan.locator('#event-details')
   geometry=event.evaluate("""el=>{
     const heading=el.querySelector(':scope>summary').getBoundingClientRect();
     const content=el.querySelector(':scope>.event-fields').getBoundingClientRect();
     const label=el.querySelector('.e6-event-selector>span').getBoundingClientRect();
     return {before:content.top-heading.bottom,after:label.top-content.top,
             width:el.getBoundingClientRect().width};
   }""")
   box=tab('box')
   box.locator('#e7-import-panel > summary').click()
   reference=box.locator('#e7-import-panel').evaluate("""el=>{
     const heading=el.querySelector('summary').getBoundingClientRect();
     const content=el.querySelector('.import-content').getBoundingClientRect();
     const first=el.querySelector('.import-content>.muted').getBoundingClientRect();
     return {before:content.top-heading.bottom,after:first.top-content.top};
   }""")
   assert abs(geometry['before']-reference['before'])<.7,(width,geometry,reference)
   assert abs(geometry['after']-reference['after'])<.7,(width,geometry,reference)
   arrow_box=box.locator('#e7-import-panel > summary').evaluate("""el=>{
     const p=getComputedStyle(el,'::after');return {border:p.borderRightWidth,style:p.borderRightStyle,transform:p.transform};
   }""")
   assert arrow_box['border']=='2px' and arrow_box['style']=='solid',(width,arrow_box)
   box.locator('#e7-import-panel > summary').click()
   plan=tab('plan')
   # Phase-gated settings are intentionally hidden without a selected event;
   # restore the test-only visibility when comparing card dimensions.
   plan.locator('.sleep-settings').evaluate('(el)=>{el.hidden=false;}')
   divider=plan.locator('#event-details').evaluate("""el=>{
     const c=el.querySelector('.event-fields').getBoundingClientRect();
     const a=getComputedStyle(el.querySelector('summary'),'::after');
     return {top:c.top,arrowBorder:a.borderRightWidth,arrowTransform:a.transform};
   }""")
   plan.locator('#event-details').evaluate('(el)=>{el.open=false;}')
   collapsed=plan.locator('#event-details').evaluate("""el=>{
     const b=el.getBoundingClientRect();return {width:b.width,height:b.height,bottom:b.bottom};
   }""")
   always=plan.locator('.sleep-settings').evaluate("""el=>{
     const b=el.getBoundingClientRect();return {width:b.width,height:b.height};
   }""")
   assert abs(collapsed['width']-always['width'])<.7,(width,collapsed,always)
   assert abs(collapsed['height']-always['height'])<.7,(width,collapsed,always)
   assert abs(divider['top']-collapsed['bottom'])<=1.1,(width,divider,collapsed)
   assert divider['arrowBorder']=='2px' and divider['arrowTransform']!='none',(width,divider)
   after=plan.locator('#event-details > summary').evaluate("""el=>getComputedStyle(el,'::after').transform""")
   assert after!=divider['arrowTransform'],(width,after,divider)
   # Full 6-character nickname must fit in actual 2-column picker at phone width,
   # whether the specimen is selected or not. Checkmark lives above right, never
   # consuming nickname line width.
   plan.locator('#sleep-open').evaluate('(el)=>el.click()')
   assert plan.locator('#sleep-dialog').is_visible()
   plan.locator('#sleep-change').click()
   assert plan.locator('#edit-dialog').is_visible()
   grid=plan.locator('#pick-grid')
   assert grid.evaluate("el=>getComputedStyle(el).gridTemplateColumns.split(' ').length")==2
   assert grid.locator('.pick').count()>=2
   first=grid.locator('.pick').nth(0)
   second=grid.locator('.pick').nth(1)
   first.evaluate("""el=>{
    el.querySelector('.pick-name').textContent='あいうえおか';
    el.dataset.selected='true';
    el.querySelector('.selected-check').textContent='✓';
   }""")
   second.evaluate("""el=>{
    el.querySelector('.pick-name').textContent='かきくけこさ';
    el.dataset.selected='false';
    el.querySelector('.selected-check').textContent='';
   }""")
   for tile in (first,second):
    info=tile.evaluate("""el=>{
      const name=el.querySelector('.pick-name');
      const level=el.querySelector('.pick-level');
      const mark=el.querySelector('.selected-check');
      const box=name.getBoundingClientRect();
      const lr=level.getBoundingClientRect();
      const range=document.createRange();range.selectNodeContents(name);
      const text=range.getBoundingClientRect();
      const m=mark.getBoundingClientRect();
      const selected=Boolean(mark.textContent.trim());
      return {visibleWidth:name.clientWidth,textWidth:text.width,
        nameLeft:box.left,levelLeft:lr.left,
        selected,checkVisible:getComputedStyle(mark).display!=='none',
        markTop:m.top,markBottom:m.bottom,nameTop:box.top,
        checkRight:m.right,tileRight:el.getBoundingClientRect().right};
    }""")
    assert info['textWidth']<=info['visibleWidth']+.6,(width,info)
    assert abs(info['nameLeft']-info['levelLeft'])<.7,(width,info)
    if info['selected']:
     assert info['checkVisible'] and info['markBottom']<=info['nameTop']+.7,(width,info)
     assert info['tileRight']-info['checkRight']<8,(width,info)
    else:
     assert not info['checkVisible'],(width,info)
   plan.locator('#edit-close').click()
   plan.locator('#sleep-close').click()
  assert not errors,errors
  browser.close()
finally:
 server.shutdown()
print('E7 v64: event/CSV divider gap, equal card widths, six characters, corner check PASS')

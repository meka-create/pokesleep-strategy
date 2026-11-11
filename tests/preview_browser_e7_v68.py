"""E7 v70: selected event name shared in Strategy, Preparation and Box."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools,threading,urllib.parse

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
S='pokesleep-strategy-u3-e3-v1:'
DAY=['dedenne','blastoise','magnezone','dragonite','gardevoir']
SLEEP=['dragonite','dedenne','blastoise','sylveon','gardevoir']

def fixture(week,event_id,name=None):
 source={'id':event_id,'name':name,'start':week,'end':'2026-11-16'} if name else None
 info={'start':week,'field':'シアンの砂浜','food':'curry','camp':True,
  'source':source,'prep':None,'berrySetup':None}
 fields={k:info[k] for k in ('field','food','camp','source')}
 conditions={'version':1,'weekStart':week,'eventId':event_id,'candidate':None,
   'editing':None,'confirmed':{'weekStart':week,'eventId':event_id,
   'status':'CONFIRMED','fields':fields,'revision':'hdr-v68-'+event_id,
   'savedAt':'2026-11-11T03:00:00Z','missingFields':[]}}
 applied={'days':[{'morning':DAY,'noon':DAY,'evening':DAY,
  'sleep':SLEEP,'recipes':[0,0,0]} for _ in range(7)],
  'edited':[],'foodMode':'curry','autoSleep':False}
 plan={'version':1,'weekStart':week,'eventInfo':info,'hasApplied':True,
   'hasProposed':True,'applied':applied,'appliedEventStart':week,
   'appliedEventInfo':info,'draft':None,
   'manualSleep':[SLEEP for _ in range(7)],'autoSleep':False,
   'stockConfirmed':None,'stockPending':None,'appliedInventoryAt':None,
   'selectedDay':0,'reviewDay':0}
 key=S+week+':'+urllib.parse.quote(event_id,safe="~!*'()-._")
 return {key+':conditions':conditions,key+':plan':plan}

try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
  page=ctx.new_page()
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
  data={}
  data.update(fixture('2026-11-09','source-halloween','halloween 2026'))
  data.update(fixture('2026-11-09','manual:2026-11-09'))
  data.update(fixture('2026-11-09','long-holiday','なんでもペロリ！ごちそうウィーク vol.6'))
  page.evaluate("""data=>{
    for(const [k,v] of Object.entries(data))localStorage.setItem(k,JSON.stringify(v));
    localStorage.setItem('pokesleep-strategy-u3-e3-v1:selected',
     JSON.stringify({id:'source-halloween',weekStart:'2026-11-09'}));
  }""",data)
  page.reload(wait_until='domcontentloaded')
  def select_tab(name):
   page.locator('#tab-'+name).click()
   page.wait_for_function("""tab=>{
      const f=document.getElementById('view-'+tab);
      return f&&!f.hidden&&f.contentDocument?.readyState==='complete'&&
       document.getElementById('status').hidden;
   }""",arg=name,timeout=25000)
   return page.frame_locator('#view-'+name)
  name='ハロウィン2026'
  plan=select_tab('plan')
  plan.locator('#e7-header-event-name').wait_for(state='visible',timeout=20000)
  assert plan.locator('#e7-header-event-name').inner_text()==name
  assert plan.locator('#e7-header-event-name').get_attribute('title')=='現在のイベント：'+name
  assert plan.locator('#e7-more-open').is_visible()
  for width in (320,393,430):
   page.set_viewport_size({'width':width,'height':852})
   for tab in ('plan','prep','box'):
    f=select_tab(tab)
    f.locator('.e7-header-icon').evaluate('(img)=>img.decode()')
    event=f.locator('#e7-header-event-name')
    event.wait_for(state='visible',timeout=20000)
    assert event.inner_text()==name,(tab,width,event.inner_text())
    sizes=f.locator('header.mast,header.header').evaluate("""header=>{
      const t=header.querySelector('.brand').getBoundingClientRect();
      const e=header.querySelector('#e7-header-event-name');
      const n=e.getBoundingClientRect();
      const img=header.querySelector('.e7-header-icon');
      const icon=img.getBoundingClientRect();
      const b=header.querySelector('#e7-more-open').getBoundingClientRect();
      const r=header.getBoundingClientRect();
      const label=e.querySelector('.e7-header-subtitle-text');
      return {titleL:t.left,titleR:t.right,eventL:n.left,eventR:n.right,iconR:icon.right,
        bL:b.left,menuR:b.right,avail:innerWidth,headerR:r.right,menuWidth:b.width,
        iconLoaded:img.complete&&img.naturalWidth>0,subtitle:label.textContent,
        clipped:label.scrollWidth>label.clientWidth, brand:header.querySelector('.brand').textContent};
    }""")
    assert sizes['iconLoaded'],(tab,width,'temporary icon not loaded')
    assert sizes['iconR']<sizes['titleL'],(tab,width,sizes)
    assert abs(sizes['titleL']-sizes['eventL'])<=0.5,(tab,width,sizes)
    assert sizes['eventR']<=sizes['bL']+0.5,(tab,width,sizes)
    assert sizes['menuR']<=sizes['headerR']+0.5,(tab,width,sizes)
    assert sizes['headerR']<=width+0.5,(tab,width,sizes)
    assert sizes['menuWidth']==42,(tab,width,sizes)
    assert sizes['brand']=='ポケスリ作戦室',(tab,width,sizes)
    f.locator('#e7-more-open').click()
    assert f.locator('#e7-more-menu').is_visible(),(tab,width)
    f.locator('#e7-more-open').click()
    assert f.locator('#e7-more-menu').is_hidden(),(tab,width)
  box=select_tab('box')
  assert box.locator('#e7-header-event-name').inner_text()==name
  assert box.locator('#e7-header-event-name').get_attribute('title')=='現在のイベント：'+name
  assert box.locator('.e7-header-calendar').is_visible()

  # Tap an existing saved event, rather than manipulating the header:
  # both tabs must show the new selection and the previously saved plan.
  plan=select_tab('plan')
  plan.locator('.e7-cal-event[data-event-id="manual:2026-11-09"]').click()
  page.wait_for_function("""()=>{
   const f=document.getElementById('view-plan');
   const title=f?.contentDocument?.querySelector('#e7-header-event-name');
   return title?.textContent==='手動設定 · 11/09';
  }""",timeout=20000)
  plan=select_tab('plan')
  assert plan.locator('#e7-header-event-name').inner_text()=='手動設定 · 11/09'
  prep=select_tab('prep')
  prep.locator('#e7-header-event-name').wait_for(state='visible',timeout=20000)
  assert prep.locator('#e7-header-event-name').inner_text()=='手動設定 · 11/09'
  box=select_tab('box')
  assert box.locator('#e7-header-event-name').inner_text()=='手動設定 · 11/09'
  assert box.locator('.e7-header-calendar').is_visible()
  assert page.evaluate("""()=>JSON.parse(localStorage.getItem(
    'pokesleep-strategy-u3-e3-v1:selected')).id""")=='manual:2026-11-09'
  # Very long saved names truncate only when necessary; font metrics differ
  # by runner and OS. Verify CSS ellipsis capability and zero menu overlap.
  # The complete event name must remain accessible in title.
  plan=select_tab('plan')
  plan.locator('.e7-cal-event[data-event-id="long-holiday"]').click()
  page.wait_for_function("""()=>{
    const f=document.getElementById('view-plan');
    const n=f?.contentDocument?.querySelector('#e7-header-event-name');
    return n?.title.includes('なんでもペロリ！ごちそうウィーク');
  }""",timeout=20000)
  page.set_viewport_size({'width':320,'height':852})
  plan=select_tab('plan')
  subtitle=plan.locator('.e7-header-subtitle-text')
  assert subtitle.evaluate("""e=>{
    const style=getComputedStyle(e),box=e.getBoundingClientRect();
    const menu=e.closest('header').querySelector('#e7-more-open').getBoundingClientRect();
    return style.textOverflow==='ellipsis'&&style.whiteSpace==='nowrap'&&
      box.right<=menu.left+0.5;
  }"""),'Long subtitle must be ellipsis-capable and not overlap the menu'
  assert 'なんでもペロリ！ごちそうウィーク' in plan.locator('#e7-header-event-name').get_attribute('title')
  prep=select_tab('prep')
  assert 'なんでもペロリ！ごちそうウィーク' in prep.locator('#e7-header-event-name').get_attribute('title')
  assert prep.locator('.brand').inner_text()=='ポケスリ作戦室'
  box=select_tab('box')
  assert 'なんでもペロリ！ごちそうウィーク' in box.locator('#e7-header-event-name').get_attribute('title')
  assert box.locator('.e7-header-subtitle-text').evaluate("""e=>{
    const style=getComputedStyle(e),box=e.getBoundingClientRect();
    const menu=e.closest('header').querySelector('#e7-more-open').getBoundingClientRect();
    return style.textOverflow==='ellipsis'&&style.whiteSpace==='nowrap'&&
      box.right<=menu.left+0.5;
  }"""),'Box subtitle must not overlap menu'
  assert box.locator('.e7-header-calendar').is_visible()
  page.set_viewport_size({'width':393,'height':852})
  # No selected event: all tabs show the compact English subtitle.
  page.evaluate("localStorage.removeItem('pokesleep-strategy-u3-e3-v1:selected')")
  page.reload(wait_until='domcontentloaded')
  for tab in ('plan','prep','box'):
   f=select_tab(tab)
   assert f.locator('#e7-header-event-name').inner_text()=='for Pokémon Sleep',(tab,'missing default')
   assert f.locator('.e7-header-calendar').is_hidden(),(tab,'calendar with no event')
  assert not errors,errors
  browser.close()
finally:
 server.shutdown()
 server.server_close()
print('E7 v70 shared event header: 320/393/430, three tabs, localization, calendar switch, empty selection PASS')

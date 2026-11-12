"""E7 v71: Chromium acceptance for event-ID-scoped calendar deletion."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools, json, threading

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
WEEK='2026-11-09'
PREFIX='pokesleep-strategy-u3-e3-v1:'
POINTER=PREFIX+'selected'

def record(event_id, name=None):
    source={'id':event_id,'name':name,'start':WEEK,'end':'2026-11-16'} if name else None
    info={'start':WEEK,'field':'シアンの砂浜','food':'all','camp':True,
          'source':source,'prep':None,'berrySetup':None}
    fields={k:info[k] for k in ('field','food','camp','source')}
    ledger={'version':1,'weekStart':WEEK,'eventId':event_id,
      'candidate':None,'editing':None,'confirmed':{'weekStart':WEEK,'eventId':event_id,
      'status':'CONFIRMED','fields':fields,'revision':'r1','savedAt':'2026-11-11T00:00:00Z',
      'missingFields':[]}}
    DAY=['dedenne','blastoise','magnezone','dragonite','gardevoir']
    applied={'days':[{'morning':DAY,'noon':DAY,'evening':DAY,
              'sleep':DAY,'recipes':[0,0,0]} for _ in range(7)],
              'edited':[],'foodMode':'all','autoSleep':False}
    plan={'version':1,'weekStart':WEEK,'eventInfo':info,'hasApplied':True,
      'hasProposed':True,'applied':applied,'appliedEventStart':WEEK,
      'appliedEventInfo':info,'draft':None,'manualSleep':[DAY for _ in range(7)],
      'autoSleep':False,'stockConfirmed':None,'stockPending':None,
      'appliedInventoryAt':None,'selectedDay':0,'reviewDay':0}
    from urllib.parse import quote
    suffix=WEEK+':'+quote(event_id,safe="~!*'()-._")+':'
    return {PREFIX+suffix+'conditions':ledger,PREFIX+suffix+'plan':plan}

def exists(page,event_id):
    return page.evaluate("""id=>{
      const base='pokesleep-strategy-u3-e3-v1:2026-11-09:'+encodeURIComponent(id)+':';
      return localStorage.getItem(base+'conditions')!==null&&
        localStorage.getItem(base+'plan')!==null;
    }""",event_id)

def plan(page):
    page.wait_for_function("""()=>{
      const el=document.getElementById('view-plan');
      return el&&!el.hidden&&el.contentDocument?.querySelector('#e7-cal-month')
        ?.textContent==='2026年11月';
    }""",timeout=20000)
    return page.frame_locator('#view-plan')

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
        manual='manual:'+WEEK
        official='official-nov-event'
        another='official-same-week'
        records={**record(manual),**record(official,'公式イベントA'),**record(another,'公式イベントB')}
        timeline='pokesleep-strategy-u2-e2-v1:'+WEEK+':timeline'
        records[timeline]={'version':1,'weekStart':WEEK,'eventId':official}
        page.evaluate("""({records,manual})=>{
          for(const [key,val] of Object.entries(records))
            localStorage.setItem(key,JSON.stringify(val));
          localStorage.setItem('pokesleep-strategy-u3-e3-v1:selected',
            JSON.stringify({weekStart:'2026-11-09',id:manual}));
        }""",{'records':records,'manual':manual})
        page.reload(wait_until='domcontentloaded')
        f=plan(page)
        assert f.locator('.e7-cal-event').count()==3
        f.locator('#event-details').evaluate('(el)=>el.open=true')
        f.locator('#e7-event-delete').wait_for(state='visible')
        # A new event is often made by editing an existing saved event.
        # The delete button must hide as soon as that saved event is dirty.
        f.locator('#event-start').evaluate("""el=>{
          el.value='2026-11-16';
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }""")
        assert not f.locator('#e7-event-delete').is_visible(), 'Changed week must hide deletion'
        assert not f.locator('#e7-event-delete-row').is_visible(), 'No empty delete row while editing'
        # Even a scripted/stale click cannot delete the previously selected event.
        f.locator('#e7-event-delete').dispatch_event('click')
        assert exists(page,manual) and exists(page,official) and exists(page,another)
        f.locator('#event-start').evaluate("""el=>{
          el.value='2026-11-09';
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }""")
        f.locator('#e7-event-delete').wait_for(state='visible')
        f.locator('#event-field').evaluate("""(el,value)=>{
          el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
        }""",'トープ洞窟')
        assert not f.locator('#e7-event-delete').is_visible(), 'Edited field must hide deletion'
        assert exists(page,manual)
        f.locator('#event-field').evaluate("""(el,value)=>{
          el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
        }""",'シアンの砂浜')
        f.locator('#e7-event-delete').wait_for(state='visible')
        for width in [320,393,430]:
            page.set_viewport_size({'width':width,'height':852})
            assert f.locator('#e7-event-delete').is_visible(),width
            assert f.locator('#e7-event-delete-row').is_visible(),width
            geometry=f.locator('#e7-event-delete').evaluate("""el=>{
              const button=el.getBoundingClientRect();
              const row=el.closest('#e7-event-delete-row').getBoundingClientRect();
              return {height:button.height,width:button.width,rightGap:row.right-button.right};
            }""")
            assert 31<=geometry['height']<=33,(width,geometry)
            assert geometry['width']<75,(width,geometry)
            assert abs(geometry['rightGap'])<=1,(width,geometry)
        f.locator('#e7-event-delete').click()
        f.locator('#e7-feedback-dialog').wait_for(state='visible')
        assert f.locator('#e7-feedback-title').inner_text()=='イベントを削除'
        f.locator('#e7-feedback-cancel').click()
        assert exists(page,manual) and exists(page,official) and exists(page,another)
        f.locator('#e7-event-delete').click()
        f.locator('#e7-feedback-dialog').wait_for(state='visible')
        f.locator('#e7-feedback-ok').click()
        page.wait_for_function("""()=>{
          const selected=localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected');
          const plan=document.getElementById('view-plan').contentDocument;
          return selected===null&&plan?.querySelectorAll('.e7-cal-event').length===2;
        }""",timeout=20000)
        assert not exists(page,manual)
        assert exists(page,official) and exists(page,another)
        assert page.evaluate('(k)=>localStorage.getItem(k)!==null',timeline)
        f=plan(page)
        assert not f.locator('#e7-event-delete').is_visible()
        f.locator('.e7-cal-event[data-event-id="official-nov-event"]').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-u3-e3-v1:selected')||'null')?.id==='official-nov-event'""",timeout=20000)
        f=plan(page)
        f.locator('#event-details').evaluate('(el)=>el.open=true')
        f.locator('#e7-event-delete').wait_for(state='visible')
        f.locator('#event-source-select').evaluate("""(el,value)=>{
          el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
        }""",'')
        assert not f.locator('#e7-event-delete').is_visible(), 'Unsaved manual switch must hide deletion'
        assert exists(page,official)
        f.locator('#event-source-select').evaluate("""(el,value)=>{
          el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
        }""",official)
        f.locator('#e7-event-delete').wait_for(state='visible')
        f.locator('#e6-dev').evaluate('(el)=>el.open=true')
        f.locator('#e6-reset').click()
        page.locator('#e7-feedback-dialog').wait_for(state='visible')
        page.locator('#e7-feedback-ok').click()
        page.wait_for_function("""()=>localStorage.getItem(
          'pokesleep-strategy-u3-e3-v1:selected')===null""",timeout=20000)
        page.wait_for_function("""()=>document.getElementById('view-plan').contentDocument
          ?.querySelectorAll('.e7-cal-event').length===1""",timeout=20000)
        assert not exists(page,official)
        assert exists(page,another)
        assert not page.evaluate('(k)=>localStorage.getItem(k)!==null',timeline)
        assert not errors,errors
        context.close()
        browser.close()
finally:
    server.shutdown()
print('E7 v72 calendar: dirty-form guard, stale click, cancel, exact-ID delete, same-week isolation, dev reset and 320/393/430 PASS')

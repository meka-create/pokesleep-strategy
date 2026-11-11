"""E7 v65: real Chromium navigation between validated saved events."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools, threading

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
S='pokesleep-strategy-u3-e3-v1:'
SELECTED=S+'selected'
DAY=['dedenne','blastoise','magnezone','dragonite','gardevoir']
SLEEP=['dragonite','dedenne','blastoise','sylveon','gardevoir']

def fixture(week,event_id,name=None,food='curry',has_plan=True,missing=False):
    source={'id':event_id,'name':name,'start':week,'end':'2026-11-16'} if name else None
    info={'start':week,'field':'シアンの砂浜','food':food,'camp':True,'source':source,'prep':None,'berrySetup':None}
    fields={k:info[k] for k in ('field','food','camp','source')}
    condition={'version':1,'weekStart':week,'eventId':event_id,'candidate':None,
      'editing':None,'confirmed':{'weekStart':week,'eventId':event_id,
      'status':'MISSING' if missing else 'CONFIRMED','fields':fields,
      'revision':'cond-v65-'+week,'savedAt':'2026-11-11T01:00:00Z',
      'missingFields':['料理カテゴリ'] if missing else []}}
    applied={'days':[{'morning':DAY,'noon':DAY,'evening':DAY,
      'sleep':SLEEP,'recipes':[0,0,0]} for _ in range(7)],
      'edited':[],'foodMode':'curry','autoSleep':False}
    plan={'version':1,'weekStart':week,'eventInfo':info,'hasApplied':has_plan,
      'hasProposed':has_plan,'applied':applied if has_plan else None,
      'appliedEventStart':week if has_plan else None,
      'appliedEventInfo':info if has_plan else None,
      'draft':None,'manualSleep':[SLEEP for _ in range(7)],
      'autoSleep':False,'stockConfirmed':None,'stockPending':None,
      'appliedInventoryAt':None,'selectedDay':0,'reviewDay':0}
    import urllib.parse
    encoded=urllib.parse.quote(event_id,safe="~!*'()-._")
    return {S+week+':'+encoded+':conditions':condition,
       **({S+week+':'+encoded+':plan':plan} if plan else {})}

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
        data={}
        data.update(fixture('2026-10-26','manual:2026-10-26',has_plan=True))
        data.update(fixture('2026-11-09','saved-nov-event',name='保存済みイベントA',has_plan=True))
        data.update(fixture('2026-11-09','manual:2026-11-09',food='',has_plan=False,missing=True))
        # A condition ledger without a valid paired plan must never be selected.
        isolated=fixture('2026-11-16','orphan-conditions',name='保存未完了')
        data.update({key:value for key,value in isolated.items() if key.endswith(':conditions')})
        page.evaluate("""data=>{
          for(const [key,val] of Object.entries(data))localStorage.setItem(key,JSON.stringify(val));
          localStorage.setItem('pokesleep-strategy-u3-e3-v1:selected',
            JSON.stringify({id:'saved-nov-event',weekStart:'2026-11-09'}));
        }""",data)
        page.reload(wait_until='domcontentloaded')
        def plan():
            page.wait_for_function("""()=>{
               let f=document.getElementById('view-plan');
               return f&&!f.hidden&&f.contentDocument?.readyState!=='loading' &&
                 !!f.contentDocument?.querySelector('#e7-cal-weeks .e7-cal-week');
            }""",timeout=20000)
            return page.frame_locator('#view-plan')
        f=plan()
        assert f.locator('#e7-cal-month').inner_text()=='2026年11月'
        assert f.locator('.e7-cal-week').count()==6
        assert f.locator('.e7-cal-event').count()==3
        assert not f.locator('.e7-cal-event[data-event-id="orphan-conditions"]').count()
        assert f.locator('.e7-cal-event[data-week-start="2026-11-09"]').count()==2
        assert f.locator('.e7-cal-event[data-event-id="saved-nov-event"]').get_attribute('aria-pressed')=='true'
        assert f.locator('#week-content').is_visible()

        for width in (320,393,430):
            page.set_viewport_size({'width':width,'height':852})
            f=plan()
            metrics=f.locator('#e7-cal-board').evaluate("""el=>({
              client:el.clientWidth,scroll:el.scrollWidth,
              card:el.closest('#e7-event-calendar').getBoundingClientRect().width
            })""")
            assert metrics['scroll']<=metrics['client']+1,(width,metrics)
            assert metrics['card']<=width,(width,metrics)
            assert f.locator('.e7-cal-event').count()==3

        # Dirty form cancellation must preserve the current selection and input.
        f=plan()
        f.locator('#event-details').evaluate('(e)=>e.open=true')
        f.locator('#event-food').evaluate("""e=>{
          e.value='dessert';e.dispatchEvent(new Event('change',{bubbles:true}));
        }""")
        page.once('dialog',lambda dialog:dialog.dismiss())
        f.locator('.e7-cal-event[data-week-start="2026-10-26"]').click()
        assert page.evaluate("""()=>JSON.parse(localStorage.getItem(
           'pokesleep-strategy-u3-e3-v1:selected')).id""")=='saved-nov-event'
        assert f.locator('#event-food').input_value()=='dessert'

        # Confirm discarding the unsaved form; the validated old saved plan survives.
        page.once('dialog',lambda dialog:dialog.accept())
        f.locator('.e7-cal-event[data-week-start="2026-10-26"]').click()
        f=plan()
        f.locator('#event-start').wait_for(state='attached')
        page.wait_for_function("""()=>document.getElementById('view-plan').contentDocument
          ?.querySelector('#event-start')?.value==='2026-10-26'""",timeout=20000)
        assert f.locator('#event-field').input_value()=='シアンの砂浜'
        assert f.locator('#week-content').is_visible()
        assert f.locator('.e7-cal-event[data-week-start="2026-10-26"]').get_attribute('aria-pressed')=='true'
        assert page.evaluate("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-u3-e3-v1:2026-11-09:saved-nov-event:plan'))
          .eventInfo.food""")=='curry'
        # Another week returns the complete plan, not the current week's team.
        # The month follows the newly selected event week after navigation.
        f.locator('#e7-cal-next').click()
        assert f.locator('#e7-cal-month').inner_text()=='2026年11月'
        f.locator('.e7-cal-event[data-event-id="saved-nov-event"]').click()
        page.wait_for_function("""()=>document.getElementById('view-plan').contentDocument
          ?.querySelector('#event-start')?.value==='2026-11-09'""",timeout=20000)
        f=plan()
        assert f.locator('#week-content').is_visible()
        assert f.locator('#event-field').input_value()=='シアンの砂浜'
        # Same-week different event ID is a separate record, not an alias.
        f.locator('.e7-cal-event[data-event-id="manual:2026-11-09"]').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-u3-e3-v1:selected')).id==='manual:2026-11-09'""",timeout=20000)
        f=plan()
        assert f.locator('#event-food').input_value()==''
        assert not f.locator('#week-content').is_visible()
        f.locator('#e7-cal-next').click()
        assert f.locator('#e7-cal-month').inner_text()=='2026年12月'
        f.locator('#e7-cal-prev').click()
        assert f.locator('#e7-cal-month').inner_text()=='2026年11月'
        # Returning through the shared tabs retains the selection.
        page.locator('#tab-box').click()
        page.locator('#tab-plan').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-u3-e3-v1:selected')).id==='manual:2026-11-09'""")
        f=plan()
        assert f.locator('#event-food').input_value()==''

        # A first-run form with no selection is intentionally blank, not dirty.
        fresh=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        fresh_page=fresh.new_page()
        fresh_page.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
        fresh_page.evaluate("""data=>{
          for(const [key,val] of Object.entries(data))localStorage.setItem(key,JSON.stringify(val));
        }""",data)
        fresh_page.reload(wait_until='domcontentloaded')
        dialogs=[]
        fresh_page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.dismiss()))
        fresh_page.frame_locator('#view-plan').locator(
          '.e7-cal-event[data-event-id="saved-nov-event"]').click()
        fresh_page.wait_for_function("""()=>JSON.parse(localStorage.getItem(
          'pokesleep-strategy-u3-e3-v1:selected')||'null')?.id==='saved-nov-event'""",timeout=20000)
        assert not dialogs,'Untouched first-run form must not show a discard dialog'
        fresh.close()

        empty=browser.new_context(viewport={'width':320,'height':800},timezone_id='Asia/Tokyo')
        other=empty.new_page()
        other.goto(BASE+'?tab=plan',wait_until='domcontentloaded')
        other.frame_locator('#view-plan').locator('#e7-cal-empty').wait_for(state='visible',timeout=20000)
        assert not other.frame_locator('#view-plan').locator('.e7-cal-event').count()
        empty.close()
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()
print('E7 v65 calendar: 320/393/430, switch, dirty reject, week-ID isolation, saved plans PASS')

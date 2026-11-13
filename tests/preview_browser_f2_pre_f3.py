"""F2 pre-F3 independent Chromium: pinned fetch, explicit saved condition update, LKG offline."""
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
STATE={'sha':'a'*40,'rename':False,'offline':False}
KEY='pokesleep-strategy-f2-upstream-catalog-v1'
WEEK='2026-11-16'
EVENT_ID='pokesleep-tool:bountiful banquet week vol1:'+WEEK
CONDITION='pokesleep-strategy-u3-e3-v1:'+WEEK+':'+EVENT_ID.replace(' ','%20').replace(':','%3A')+':conditions'
POINTER='pokesleep-strategy-u3-e3-v1:selected'

def remote(route):
    if STATE['offline']:
        route.fulfill(status=503,body='offline',
                      headers={'access-control-allow-origin':'*'})
        return
    url=route.request.url
    if url.endswith('/commits/main'):
        payload={'sha':STATE['sha']}
    elif url.endswith('/src/data/event.json'):
        payload={'bonus':[
          {'name':'bountiful banquet week vol1','start':'2026-11-16T04:00:00',
           'end':'2026-11-23T04:00:00','target':{'specialty':'Ingredients'},
           'effects':{'extraIng':'nuts','ingredient':1,'carryLimitAdd':10}},
          {'name':'dream shard week 3','start':'2026-11-23T04:00:00',
           'end':'2026-11-30T04:00:00','target':{},
           'effects':{'skillTrigger':1.25,'dreamShard':1.5}}
        ],'drowsy':[{'name':'GSD','day':'2026-11-23','bonus':1.5}]}
    elif url.endswith('/src/i18n/ja/events.json'):
        payload={'events':{
          'bountiful banquet week vol1':'ごちそうウィーク・更新版' if STATE['rename']
            else 'なんでもペロリ！ごちそうウィーク vol.1',
          'dream shard week 3':'ゆめのかけらGETウィーク vol.3'}}
    else:
        raise AssertionError('Unexpected upstream URL '+url)
    route.fulfill(status=200,content_type='application/json',
                  body=json.dumps(payload,ensure_ascii=False),
                  headers={'access-control-allow-origin':'*'})

def selection(page,event_id):
    page.locator('#event-source-select').evaluate(
      """(el,value)=>{
        el.value=value;
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }""",event_id)

def record(page):
    return page.evaluate("""key=>{
        const raw=localStorage.getItem(key);
        return raw?JSON.parse(raw):null;
    }""",CONDITION)

def stored_catalog(page):
    return page.evaluate("""key=>JSON.parse(localStorage.getItem(key)||'null')""",KEY)

def set_value(page,sel,value):
    page.locator(sel).evaluate(
      """(el,value)=>{
        el.value=value;
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }""",value)

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},
                                    timezone_id='Asia/Tokyo')
        context.route('https://api.github.com/repos/nitoyon/pokesleep-tool/commits/main',remote)
        context.route('https://raw.githubusercontent.com/nitoyon/pokesleep-tool/**',remote)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto(BASE+'U3_Strategy_UI_20261109_v50_E7.html?previewNow=2026-11-14T12:00',
                  wait_until='domcontentloaded')
        page.wait_for_function("""key=>{
          try{return JSON.parse(localStorage.getItem(key)||'null')?.revision==='a'.repeat(40)}
          catch(e){return false}
        }""",arg=KEY,timeout=20000)
        assert page.locator('#event-source-select option').count()>=3
        assert record(page) is None and page.evaluate(
          """key=>localStorage.getItem(key)""",POINTER) is None
        selection(page,EVENT_ID)
        set_value(page,'#event-field','シアンの砂浜')
        assert page.locator('#event-food').input_value()=='all'
        assert page.locator('#event-save').is_visible(),'Explicit Save must be offered'
        assert record(page) is None,'Picking a candidate must not write conditions'
        page.locator('#event-save').click()
        chosen=record(page)
        assert chosen and chosen['confirmed']['status']=='CONFIRMED'
        saved_source=chosen['confirmed']['fields']['source']
        assert saved_source['upstreamRevision']=='a'*40
        assert saved_source['verifiedEffects']['ingredient']==1
        assert page.evaluate("""key=>JSON.parse(localStorage.getItem(key)).id""",
                            POINTER)==EVENT_ID
        initial_json=page.evaluate("""key=>localStorage.getItem(key)""",CONDITION)

        STATE['sha']='b'*40
        STATE['rename']=True
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("""key=>{
          try{return JSON.parse(localStorage.getItem(key)||'null')?.revision==='b'.repeat(40)}
          catch(e){return false}
        }""",arg=KEY,timeout=20000)
        assert page.evaluate("""key=>localStorage.getItem(key)""",CONDITION)==initial_json,\
          'Upstream refresh silently replaced confirmed event fields'
        page.locator('#event-details').evaluate('(el)=>el.open=true')
        page.locator('#f2-update-source').wait_for(state='visible',timeout=15000)
        assert page.locator('#e7-event-delete').is_visible() is True
        page.locator('#f2-update-source').click()
        assert page.locator('#event-save').is_visible()
        assert page.evaluate("""key=>localStorage.getItem(key)""",CONDITION)==initial_json,\
          'Clicking updated metadata must still require explicit Save'
        page.locator('#event-save').click()
        updated=record(page)
        assert updated['confirmed']['fields']['source']['name']=='ごちそうウィーク・更新版'
        assert updated['confirmed']['fields']['source']['upstreamRevision']=='b'*40
        assert updated['confirmed']['fields']['source']['verifiedEffects']['ingredient']==1

        STATE['offline']=True
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("""()=>document.querySelector('#event-source-select option')
          &&document.querySelector('#event-source-select').options.length>=3""",timeout=15000)
        assert stored_catalog(page)['revision']=='b'*40,'LKG lost after offline load'
        assert record(page)['confirmed']['fields']['source']['name']=='ごちそうウィーク・更新版'
        assert page.locator('#event-source-select').input_value()==EVENT_ID
        assert page.locator('#f2-update-source').is_hidden()
        assert not errors,errors
        context.close()
        browser.close()
finally:
    server.shutdown()

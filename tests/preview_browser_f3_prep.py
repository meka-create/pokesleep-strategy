"""F3 v88: real Chromium check of U2 computed targets and event-owned persistence."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import functools,threading,json
from urllib.parse import quote

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
WEEK='2026-11-16'
ID1='manual:'+WEEK
ID2='manual:'+WEEK+'-2'
INV='pokesleep-strategy-u2-e2-v1:'
PREF='pokesleep-strategy-u3-e3-v1:'
PREP='pokesleep-strategy-u2-e6-prep-v1:'
PLAYER='pokesleep-strategy-e7-player-v1'
FOODS=['ふといながねぎ','あじわいキノコ','とくせんエッグ','ほっこりポテト','とくせんリンゴ',
 'げきからハーブ','マメミート','モーモーミルク','あまいミツ','ピュアなオイル',
 'あったかジンジャー','あんみんトマト','リラックスカカオ','おいしいシッポ',
 'ワカクサ大豆','ワカクサコーン','めざましコーヒー','ずっしりカボチャ','つやつやアボカド']
def records(event_id,categories):
    fields={'field':'シアンの砂浜','food':'all','camp':True,'source':None}
    chosen={'version':1,'weekStart':WEEK,'eventId':event_id,'candidate':None,'editing':None,
      'confirmed':{'weekStart':WEEK,'eventId':event_id,'status':'CONFIRMED','fields':fields,
       'revision':'f3-v88-'+event_id,'savedAt':'2026-11-13T10:00:00Z','missingFields':[]}}
    prep={'version':1,'weekStart':WEEK,'eventId':event_id,
      'prep':{'count':len(categories),'categories':categories},
      'savedAt':'2026-11-13T10:00:00Z'}
    suf=WEEK+':'+quote(event_id,safe="~!*'()-._")
    return {PREF+suf+':conditions':chosen,PREP+suf:prep}
def url(event_id):
    return BASE+'U2_Prep_Local_Ingredients_20261109_v50_E7.html?eventStart='+WEEK+\
       '&eventId='+quote(event_id,safe='')+'&previewNow=2026-11-15T10:00'
def check_goals(page):
    chips=page.locator('#inventory-panel .target-chip').count()
    targets=page.locator('#goal-panel .food.needed').count()
    assert targets==chips and targets>0,(chips,targets)
    values=page.locator('#goal-panel .food.needed .goal-value b').all_text_contents()
    n=sum(map(int,values))
    assert n>0
    assert page.locator('#goal-panel .row.total strong').inner_text()==f'{n:,}個',(n,values)
    assert page.locator('#f3-prep-status').get_attribute('data-state')=='ready'
    assert page.locator('#f3-prep-breakdown').count()==1
    assert page.locator('#f3-prep-status').inner_text().startswith('F3暫定目標')
    return n
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=ctx.new_page()
        failures=[]
        page.on('pageerror',lambda e:failures.append(str(e)))
        page.goto(url(ID1),wait_until='domcontentloaded')
        assert '備蓄する料理カテゴリ' in page.locator('#f3-prep-status').inner_text()
        data={**records(ID1,['curry','salad','dessert']),
              **records(ID2,['dessert']),
              PLAYER:{'version':1,'pot':57,'bag':120,'bonuses':{}}}
        page.evaluate("""entries=>{
          for(const [key,value] of Object.entries(entries))localStorage.setItem(key,JSON.stringify(value));
        }""",data)
        before=page.evaluate("""()=>Object.fromEntries(
          Object.keys(localStorage).filter(k=>k.startsWith('pokesleep-strategy-'))
            .map(k=>[k,localStorage.getItem(k)]))""")
        page.reload(wait_until='domcontentloaded')
        page.locator('#f3-prep-status[data-state="ready"]').wait_for(timeout=15000)
        a=check_goals(page)
        assert a<=120,(a,120)
        after=page.evaluate("""()=>Object.fromEntries(
          Object.keys(localStorage).filter(k=>k.startsWith('pokesleep-strategy-'))
            .map(k=>[k,localStorage.getItem(k)]))""")
        assert before==after,'F3 read-only load changed saved event data'

        # Category edits do nothing to goals until the existing explicit Save.
        page.locator('[data-stock-count="1"]').click()
        page.locator('[data-stock-type="curry"]').click()
        assert before==page.evaluate("""()=>Object.fromEntries(
          Object.keys(localStorage).filter(k=>k.startsWith('pokesleep-strategy-'))
            .map(k=>[k,localStorage.getItem(k)]))""")
        page.locator('#e6-prep-save').click()
        page.locator('#f3-prep-status[data-state="ready"]').wait_for(timeout=15000)
        page.locator('#f3-prep-breakdown').evaluate("(el)=>el.open=true")
        text=page.locator('#f3-prep-dishes').inner_text()
        assert 'カレー' in text and 'サラダ' not in text and 'デザート' not in text,text
        check_goals(page)
        assert json.loads(page.evaluate("""key=>localStorage.getItem(key)""",
                   PREP+WEEK+':'+quote(ID1,safe="~!*'()-._")))['prep']['categories']==['curry']

        # Actual inventory is saved only by U2; cannot be read as another event.
        page.locator('#btn-inventory').click()
        apple=page.locator('input[data-key="apple"]')
        apple.fill('25')
        page.locator('#save-inventory').click()
        page.reload(wait_until='domcontentloaded')
        page.locator('#btn-inventory').click()
        assert page.locator('input[data-key="apple"]').input_value()=='25'
        page.locator('#btn-goal').click()
        check_goals(page)
        assert page.evaluate("""key=>localStorage.getItem(key)""",
          INV+WEEK+':'+quote(ID2,safe="~!*'()-._")+':timeline') is None

        # Same-week separate event: its own prep and zero stock, not A's inventory.
        page.goto(url(ID2),wait_until='domcontentloaded')
        page.locator('#f3-prep-status[data-state="ready"]').wait_for(timeout=15000)
        page.locator('#f3-prep-breakdown').evaluate('(el)=>el.open=true')
        result=page.locator('#f3-prep-dishes').inner_text()
        assert 'デザート' in result and 'カレー' not in result,result
        check_goals(page)
        page.locator('#btn-inventory').click()
        assert page.locator('input[data-key="apple"]').input_value()=='0'

        # Missing bag size is a block, not made-up 600 capacity.
        page.evaluate("""key=>{
          const v=JSON.parse(localStorage.getItem(key));v.bag=null;
          localStorage.setItem(key,JSON.stringify(v));
        }""",PLAYER)
        page.reload(wait_until='domcontentloaded')
        page.locator('#f3-prep-status[data-state="blocked"]').wait_for(timeout=15000)
        assert 'バッグ容量' in page.locator('#f3-prep-status').inner_text()
        assert page.locator('#goal-panel .food.needed').count()==0
        assert not page.locator('#f3-prep-breakdown').is_visible()
        assert not failures,failures
        ctx.close()
        browser.close()
finally:
    server.shutdown()

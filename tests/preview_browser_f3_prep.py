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
ID3='manual:'+WEEK+'-3'
INV='pokesleep-strategy-u2-e2-v1:'
PREF='pokesleep-strategy-u3-e3-v1:'
PREP='pokesleep-strategy-u2-e6-prep-v1:'
PLAYER='pokesleep-strategy-e7-player-v1'
BOX='pokesleep-strategy-e7-box-v1'
PINNED=json.loads((ROOT/'f1/f1-b-target-source-v1.json').read_text())
FOODS=['ふといながねぎ','あじわいキノコ','とくせんエッグ','ほっこりポテト','とくせんリンゴ',
 'げきからハーブ','マメミート','モーモーミルク','あまいミツ','ピュアなオイル',
 'あったかジンジャー','あんみんトマト','リラックスカカオ','おいしいシッポ',
 'ワカクサ大豆','ワカクサコーン','めざましコーヒー','ずっしりカボチャ','つやつやアボカド']
def synthetic_roster():
    # Public pinned species profiles only, never the user's 69-row CSV.
    lookup={t['name']:t for t in PINNED['targets']}
    output=[]
    for name in ['リザードン','ゲンガー','エーフィ','サーナイト','カメックス','フシギバナ']:
        t=lookup[name]
        def food(slot):
            for candidate in [t['sourceProfile']['ing1'],t['sourceProfile']['ing2'],
                              t['sourceProfile']['ing3']][:slot]:
                if candidate['name']!='unknown' and candidate['c'+str(slot)]>0:
                    return PINNED['dictionaries']['ingredients'][candidate['name']]
            raise AssertionError('no food slot '+name+' '+str(slot))
        output.append({'pokemon':name,'nickname':'SENTINEL_PRIVATE_NICKNAME',
          'level':60,'skillLevel':3,'ing1':food(1),'ing2':food(2),'ing3':food(3),
          'nature':'てれや','mainSkill':t['sourceProfile']['mainSkillJa'],
          'mint':None,'ribbon':None,'shiny':False,
          'lv10':'きのみの数S','lv25':'おてつだいボーナス',
          'lv50':'おてつだいスピードS','lv70':'リサーチEXPボーナス',
          'lv80':'げんき回復ボーナス'})
    return {'version':1,'source':'pokesleep-tool-header-mapped','items':output}

def records(event_id,categories,unknown_food=False):
    fields={'field':'シアンの砂浜','food':'' if unknown_food else 'all','camp':True,'source':None}
    chosen={'version':1,'weekStart':WEEK,'eventId':event_id,'candidate':None,'editing':None,
      'confirmed':{'weekStart':WEEK,'eventId':event_id,
       'status':'MISSING' if unknown_food else 'CONFIRMED','fields':fields,
       'revision':'f3-v88-'+event_id,'savedAt':'2026-11-13T10:00:00Z',
       'missingFields':['料理カテゴリ'] if unknown_food else []}}
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
        model_requests=[]
        page.on('pageerror',lambda e:failures.append(str(e)))
        page.on('request',lambda req:model_requests.append(req.url)
           if '/f1/f1-b-target-source-v1.json' in req.url else None)
        page.goto(url(ID1),wait_until='domcontentloaded')
        assert '備蓄する料理カテゴリ' in page.locator('#f3-prep-status').inner_text()
        data={**records(ID1,['curry','salad','dessert']),
              **records(ID2,['dessert']),
              **records(ID3,['curry','salad','dessert'],True),
              PLAYER:{'version':1,'pot':57,'bag':120,'bonuses':{}},
              BOX:synthetic_roster()}
        page.evaluate("""entries=>{
          for(const [key,value] of Object.entries(entries))localStorage.setItem(key,JSON.stringify(value));
        }""",data)
        before_model_requests=len(model_requests)
        before=page.evaluate("""()=>Object.fromEntries(
          Object.keys(localStorage).filter(k=>k.startsWith('pokesleep-strategy-'))
            .map(k=>[k,localStorage.getItem(k)]))""")
        page.reload(wait_until='domcontentloaded')
        page.locator('#f3-prep-status[data-state="ready"]').wait_for(timeout=15000)
        a=check_goals(page)
        assert a<=120,(a,120)
        # No expensive real-box scan / F1 JSON request just by opening U2.
        assert len(model_requests)==before_model_requests,'Collapsed reference fetched source unnecessarily'
        assert page.locator('#f3-b-production-content').text_content()==''
        page.locator('#f3-prep-breakdown').evaluate('(el)=>el.open=true')
        page.locator('#f3-b-production').evaluate('(el)=>el.open=true')
        page.wait_for_function("""()=>document.querySelector('#f3-b-production-content')?.textContent.includes('仮の5匹')""",timeout=25000)
        assert len(model_requests)>before_model_requests,'Reference did not load after explicit expansion'
        scenario_text=page.locator('#f3-b-production-content').text_content()
        assert '168時間' in scenario_text and '準備目標から自動控除しません' in scenario_text
        assert 'SENTINEL_PRIVATE_NICKNAME' not in scenario_text
        assert page.locator('#f3-b-production').count()==1
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

        # Preparation may proceed on a saved MISSING recipe week; only
        # adoption/reproposal (not F3 preparation) requires full confirmation.
        page.goto(url(ID3),wait_until='domcontentloaded')
        page.locator('#f3-prep-status[data-state="ready"]').wait_for(timeout=15000)
        assert '料理未確定' in page.locator('#f3-prep-status').inner_text()
        check_goals(page)
        assert page.evaluate("""key=>JSON.parse(localStorage.getItem(key)).confirmed.status""",
          PREF+WEEK+':'+quote(ID3,safe="~!*'()-._")+':conditions')=='MISSING'

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

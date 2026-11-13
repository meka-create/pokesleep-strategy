"""F1-D mobile Chromium smoke: real Box read, event-owned stock, UI mount and no E7 writes."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import functools, json, threading

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/f1d-preview/'
snapshot=json.loads((ROOT/'f1/f1-b-target-source-v1.json').read_text())
targets={t['name']:t for t in snapshot['targets']}
ingredients=snapshot['dictionaries']['ingredients']
pokemon=['エーフィ','リザードン','ゲンガー','ライチュウ','サーナイト']
week='2026-11-16'; event='manual:'+week

def chosen_food(t,slot):
    sp=t['sourceProfile']
    for key in ['ing1','ing2','ing3'][:slot]:
        ref=sp.get(key)
        if ref and ref['name']!='unknown' and ref.get('c'+str(slot),0)>0:
            return ingredients[ref['name']]
    raise ValueError((t['name'],slot))

def individual(name):
    t=targets[name]
    return dict(pokemon=name,nickname='同名個体',level=50,skillLevel=3,
        ing1=chosen_food(t,1),ing2=chosen_food(t,2),ing3=chosen_food(t,3),
        mainSkill=t['sourceProfile']['mainSkillJa'],nature='てれや',
        mint=False,ribbon=0,shiny=False,favorite='',
        lv10='きのみの数S',lv25='おてつだいボーナス',
        lv50='おてつだいスピードS',lv70='リサーチEXPボーナス',
        lv80='げんき回復ボーナス')
box={'version':1,'source':'pokesleep-tool-header-mapped',
     'items':[individual(name) for name in pokemon]}
conditions={'version':1,'weekStart':week,'eventId':event,'confirmed':{
    'weekStart':week,'eventId':event,'status':'CONFIRMED',
    'revision':'test-conditions','missingFields':[],
    'fields':{'field':'シアンの砂浜','food':'curry','camp':True,'source':None}}}
stocks={name:0 for name in ingredients.values()}
stocks['とくせんリンゴ']=60
stock={'version':2,'weekStart':week,'eventId':event,
       'preparationLatest':None,'startInventory':None,'currentInventory':{
       'weekStart':week,'savedAt':'2026-11-16T01:00:00Z',
       'revision':'test-stock','values':stocks}}
player={'version':1,'pot':57,'bag':600,'bonuses':{'シアンの砂浜':50}}
prefix='pokesleep-strategy-u3-e3-v1:'
seed={
 'pokesleep-strategy-u3-e3-v1:selected':json.dumps({'weekStart':week,'id':event}),
 prefix+week+':'+quote(event,safe="~!*'()-._")+':conditions':json.dumps(conditions),
 'pokesleep-strategy-u2-e2-v1:'+week+':'+quote(event,safe="~!*'()-._")+':timeline':json.dumps(stock),
 'pokesleep-strategy-e7-box-v1':json.dumps(box),
 'pokesleep-strategy-e7-player-v1':json.dumps(player),
}

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='domcontentloaded')
        page.evaluate('(data)=>{for(const [k,v] of Object.entries(data))localStorage.setItem(k,v)}',seed)
        page.reload(wait_until='domcontentloaded')
        shell=page.frame_locator('#e7-shell')
        shell.locator('#tab-plan').click()
        plan=shell.frame_locator('#view-plan')
        card=plan.locator('#f1d-card')
        card.wait_for(timeout=30000)
        assert card.locator('h2').inner_text()=='週間参考試算'
        assert 'シアンの砂浜' in card.inner_text()
        editor=plan.locator('#f1d-picker')
        editor.locator('summary').click()
        for k in range(5):
            plan.locator(f'#f1d-form select[data-f1d-index="{k}"]').select_option(str(k))
        assert '5/5' in plan.locator('#f1d-picker-title').inner_text()
        before=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        plan.locator('#f1d-run').click()
        plan.locator('#f1d-result .f1d-big').wait_for(timeout=80000)
        assert 'エナジー' in plan.locator('#f1d-result .f1d-big').inner_text()
        assert plan.locator('#f1d-result .f1d-part').count()==3
        after=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        assert before==after, 'F1-D must not write approved E7 box/event/player/stock'
        shell.locator('#tab-box').click()
        shell.locator('#tab-plan').click()
        card.wait_for(timeout=20000)
        assert card.locator('h2').inner_text()=='週間参考試算'
        assert not errors,'page errors: '+str(errors)
        print('F1-D Chromium: embedded card, real Box 5, provisional result, event storage and tab navigation PASS')
        browser.close()
finally:
    server.shutdown()

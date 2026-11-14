"""F4-B v93: mobile browser 29-window real box integration, no storage writes."""
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
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/U3_Strategy_UI_20261109_v50_E7.html'
snapshot=json.loads((ROOT/'f1/f1-b-target-source-v1.json').read_text())
targets={t['name']:t for t in snapshot['targets']}
ingredient_map=snapshot['dictionaries']['ingredients']
mons=['エーフィ','リザードン','ゲンガー','ライチュウ','サーナイト','カメックス','ニンフィア']
week='2026-11-16'; event='manual:'+week
def chosen_food(t,slot):
    sp=t['sourceProfile']
    for key in ['ing1','ing2','ing3'][:slot]:
        ref=sp.get(key)
        if ref and ref['name']!='unknown' and ref.get('c'+str(slot),0)>0:
            return ingredient_map[ref['name']]
    raise ValueError((t['name'],slot))
def individual(name):
    t=targets[name]
    return dict(pokemon=name,nickname='非公開'+name,level=50,skillLevel=3,
        ing1=chosen_food(t,1),ing2=chosen_food(t,2),ing3=chosen_food(t,3),
        mainSkill=t['sourceProfile']['mainSkillJa'],nature='てれや',
        mint=False,ribbon=0,shiny=False,favorite='',
        lv10='きのみの数S',lv25='おてつだいボーナス',
        lv50='おてつだいスピードS',lv70='リサーチEXPボーナス',
        lv80='げんき回復ボーナス')
items=[individual(m) for m in mons]
box={'version':1,'source':'pokesleep-tool-header-mapped','items':items}
def key(kind,id=event):
    return 'pokesleep-strategy-u3-e3-v1:'+week+':'+quote(id,safe="~!*'()-._")+':'+kind
def record(id,source):
    return {'version':1,'weekStart':week,'eventId':id,'confirmed':{
       'weekStart':week,'eventId':id,'status':'CONFIRMED',
       'revision':'f4b-conditions','savedAt':'2026-11-12T01:00:00+09:00','missingFields':[],
       'fields':{'field':'シアンの砂浜','food':'curry','camp':True,'source':source}}}
stocks={label:0 for code,label in ingredient_map.items() if code!='nuts'}
assert len(stocks)==19
stocks['とくせんリンゴ']=60
def inventory(id):
    return {'version':2,'weekStart':week,'eventId':id,
      'preparationLatest':None,'startInventory':None,'currentInventory':{
      'weekStart':week,'savedAt':'2026-11-12T02:00:00+09:00',
      'revision':'f4b-stock','values':stocks}}
fields=['ワカクサ本島','シアンの砂浜','トープ洞窟','ウノハナ雪原',
 'ラピスラズリ湖畔','ゴールド旧発電所','アンバー渓谷',
 'ワカクサ本島EX','シアンの砂浜EX']
player={'version':1,'pot':57,'bag':600,'bonuses':{
 f:(50 if f=='シアンの砂浜' else None) for f in fields}}
def plan(id,source):
    mock=['dragonite','dedenne','blastoise','sylveon','gardevoir']
    return {'version':1,'weekStart':week,'eventInfo':{
        'start':week,'field':'シアンの砂浜','food':'curry','camp':True,
        'source':source},
        'hasApplied':False,'manualSleep':[mock for _ in range(7)],'autoSleep':False}
seed={
 'pokesleep-strategy-u3-e3-v1:selected':json.dumps({'weekStart':week,'id':event}),
 key('conditions'):json.dumps(record(event,None)),
 key('plan'):json.dumps(plan(event,None)),
 'pokesleep-strategy-u2-e2-v1:'+week+':'+quote(event,safe="~!*'()-._")+':timeline':
 json.dumps(inventory(event)),
 'pokesleep-strategy-e7-box-v1':json.dumps(box),
 'pokesleep-strategy-e7-player-v1':json.dumps(player),
}
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.goto(BASE,wait_until='domcontentloaded')
        page.evaluate('(data)=>{for(const [key,val] of Object.entries(data))localStorage.setItem(key,val)}',seed)
        page.reload(wait_until='domcontentloaded')
        page.locator('#f4c-real-card').wait_for(state='visible',timeout=25000)
        def fill():
            page.locator('#f4c-real-healers select').nth(0).select_option('4') # Gardevoir
            page.locator('#f4c-real-healers select').nth(1).select_option('6') # Sylveon
            for i,ix in enumerate([0,2,3,4,5]):
                page.locator('#f4c-real-night select').nth(i).select_option(str(ix))
                page.locator('#f4c-real-previous select').nth(i).select_option(str(ix))
            for i,berry in enumerate(['water','fire','grass']):
                page.locator('#f4c-real-favorites select').nth(i).select_option(berry)
        fill()
        before=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        page.locator('#f4c-real-run').click()
        try:
            page.locator('#f4c-real-result details').first.wait_for(timeout=60000)
        except Exception as exc:
            detail={'status':page.locator('#f4c-real-status').inner_text(),
                'errors':errors[-6:]}
            raise AssertionError('F4-C baseline browser run blocked '+repr(detail)) from exc
        assert page.locator('#f4c-real-result details').count()==7
        assert 'サーナイト' in page.locator('#f4c-real-result').inner_text()
        assert 'ニンフィア' in page.locator('#f4c-real-result').inner_text()
        assert '未採用' in page.locator('#f4c-real-result').inner_text()
        after=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        assert before==after,'F4-C read-only proposal must not mutate saved E7 state'
        assert not errors,'Page errors: '+repr(errors)
        print('F4-C v110 E7 Chromium: 29 windows, real 7-individual Box, no E7 writes PASS')
        browser.close()
finally:
    server.shutdown()

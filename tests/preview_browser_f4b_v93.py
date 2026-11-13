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
BASE=f'http://127.0.0.1:{server.server_port}/f4b-preview/'
snapshot=json.loads((ROOT/'f1/f1-b-target-source-v1.json').read_text())
targets={t['name']:t for t in snapshot['targets']}
ingredient_map=snapshot['dictionaries']['ingredients']
mons=['エーフィ','リザードン','ゲンガー','ライチュウ','サーナイト','カメックス']
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
        page.get_by_text('イベントと実ボックスを照合しました').wait_for(timeout=20000)
        assert page.locator('#team-list .team-row').count()==8
        def edit(index):
            page.locator('#team-list .team-row').nth(index).locator('button').first.click()
            page.locator('#team-dialog').wait_for(state='visible')
            for slot in range(5):
                page.locator(f'#team-form select[data-member="{slot}"]').select_option(str(slot))
            page.locator('#dialog-apply').click()
            page.locator('#team-dialog').wait_for(state='hidden')
        edit(0)  # prior Sunday's carry is explicit
        edit(1)
        page.get_by_role('button',name='月曜の睡眠編成を7晩すべてへコピー').click()
        for i in range(8):
            assert '実個体5匹を設定' not in page.locator('#team-list .team-row').nth(i).inner_text()
        for i,berry in enumerate(['water','fire','grass']):
            page.locator(f'#favorites select[data-favorite="{i}"]').select_option(berry)
        before=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        page.locator('#run').click()
        try:
            page.locator('#calc-result .metrics b').first.wait_for(timeout=30000)
        except Exception as exc:
            detail={'status':page.locator('#calc-status').inner_text(),
                'ctx':page.locator('#status').inner_text(),
                'errors':errors[-4:]}
            raise AssertionError('F4-B calculation blocked: '+repr(detail)) from exc
        assert page.locator('#calc-result .metrics b').count()==3
        assert '29時間帯' in page.locator('#calc-result').inner_text()
        assert '正式作戦には未反映' in page.locator('#calc-status').inner_text()
        after=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        assert before==after, 'F4-B must not update accepted E7 records'
        # Official event remains BLOCKED; even explicit neutral opt-in cannot bypass.
        official='pokesleep-tool:bountiful banquet week vol1:'+week
        source={'id':official,'sourceKey':'bountiful banquet week vol1',
                'start':week,'verifiedEffects':{
                 'extraIng':'nuts','ingredient':1,'carryLimitAdd':10}}
        official_seed={
         'pokesleep-strategy-u3-e3-v1:selected':json.dumps({'weekStart':week,'id':official}),
         key('conditions',official):json.dumps(record(official,source)),
         key('plan',official):json.dumps(plan(official,source)),
         'pokesleep-strategy-u2-e2-v1:'+week+':'+quote(official,safe="~!*'()-._")+':timeline':
            json.dumps(inventory(official)),
        }
        page.evaluate('(data)=>{for(const [key,val] of Object.entries(data))localStorage.setItem(key,val)}',official_seed)
        page.locator('#refresh').click()
        assert '公式イベント' in page.locator('#context-message').inner_text()
        page.locator('#run').click()
        assert '停止' in page.locator('#calc-status').inner_text()
        assert page.locator('#calc-result .metrics b').count()==0
        assert not errors,'Browser page errors: '+repr(errors)
        print('F4-B Chromium: 8 real nights, copy, 29 windows, 0 E7 writes, official BLOCKED PASS')
        browser.close()
finally:
    server.shutdown()

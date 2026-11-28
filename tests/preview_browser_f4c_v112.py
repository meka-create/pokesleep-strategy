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
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/U3_Strategy_UI_20261109_v50_E7.html?previewNow=2026-11-16T00:10&eventStart=2026-11-16'
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
    return dict(pokemon=name,nickname='非公開'+name,level=50,
        skillLevel=6 if name in ('サーナイト','ニンフィア') else 3,
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
        'hasApplied':False,'manualSleep':[mock for _ in range(7)],'autoSleep':True}
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
        def assert_mobile_geometry(check_page, sprite_selector, sheet_selector=None):
            """Catch the original PokeSprite 96px-in-42px overflow on real CSS."""
            for width in (320,393,430):
                check_page.set_viewport_size({'width':width,'height':852})
                info=check_page.evaluate("""({spriteSelector,dialogSelector})=>{
                  const box=document.querySelector(spriteSelector);
                  const art=box?.querySelector(':scope > .poke-art');
                  const img=art?.querySelector(':scope > img[data-sprite-url]');
                  const dialog=dialogSelector?document.querySelector(dialogSelector):null;
                  const rect=el=>{
                    const r=el.getBoundingClientRect();
                    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,
                      width:r.width,height:r.height};
                  };
                  return {
                    viewport:innerWidth,
                    box:box?rect(box):null,art:art?rect(art):null,img:img?rect(img):null,
                    fit:img?getComputedStyle(img).objectFit:null,
                    imgPosition:img?getComputedStyle(img).position:null,
                    dialog:dialog?.open?rect(dialog):null,
                    dialogOpen:dialog?dialog.open:null
                  };
                }""",{'spriteSelector':sprite_selector,'dialogSelector':sheet_selector})
                assert info['box'] and info['art'] and info['img'],(
                    f'missing canonical sprite in {sprite_selector} at {width}: {info}')
                outer,art,img=info['box'],info['art'],info['img']
                for child in (art,img):
                    assert child['width']>0 and child['height']>0
                    assert child['left']>=outer['left']-1.5 and child['right']<=outer['right']+1.5,info
                    assert child['top']>=outer['top']-1.5 and child['bottom']<=outer['bottom']+1.5,info
                assert info['fit']=='contain' and info['imgPosition']=='absolute',info
                if sheet_selector:
                    assert info['dialogOpen'] and info['dialog'],info
                    d=info['dialog']
                    assert abs((d['left']+d['right'])/2-width/2)<1.6,info
                    # v117: recover compact 12px minimum gutters instead of
                    # v116 full-viewport-width sheets, for all dialog families.
                    target_width=min(540,width-24)
                    assert abs(d['width']-target_width)<1.6,info
                    assert d['left']>=11.5 and d['right']<=width-11.5,info
            check_page.set_viewport_size({'width':393,'height':852})
        page.goto(BASE,wait_until='domcontentloaded')
        page.evaluate('(data)=>{for(const [key,val] of Object.entries(data))localStorage.setItem(key,val)}',seed)
        page.reload(wait_until='domcontentloaded')
        # M4 v136: legacy prior-Sunday records may exist (or even be
        # malformed) but the lightweight planner must NEVER read, edit,
        # delete, or apply them. The seven-night editor remains intact.
        legacy='pokesleep-strategy-f4c-v112:carry:2026-11-16:manual%3A2026-11-16'
        page.evaluate("(k)=>localStorage.setItem(k,'{legacy-invalid-json')",legacy)
        page.reload(wait_until='domcontentloaded')
        page.locator('#e3-next[data-action="F4C_PROPOSE"]:not([disabled])').wait_for(
          state='visible',timeout=20000)
        assert page.locator('#f4c-carry-trigger').count()==0
        assert page.locator('#f4c-carry-entry').count()==0
        assert page.locator('#f4c-carry-edit').count()==0
        assert page.locator('#sleep-day-nav').count()==1
        assert page.locator('#sleep-copy').count()==1
        assert page.evaluate('k=>localStorage.getItem(k)',legacy)=='{legacy-invalid-json'
        assert page.locator('#f4c-real-card').count()==0
        assert page.locator('#f4c-real-consent').count()==0
        before=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        page.locator('#e3-next').click()
        try:
            page.locator('#review-dialog').wait_for(state='visible',timeout=90000)
            page.get_by_role('button',name='この作戦を採用').wait_for(timeout=10000)
        except Exception as exc:
            detail={
                'warning':page.locator('#e3-warning').inner_text(),
                'errors':errors[-6:],
                'action':page.locator('#e3-next').get_attribute('data-action')
            }
            raise AssertionError('F4-C v112 real propose unavailable: '+repr(detail)) from exc
        assert_mobile_geometry(page,'#review-slots .avatar','#review-dialog')
        shown=page.locator('#review-slots').inner_text()
        assert 'サーナイト' in shown or 'ニンフィア' in shown,shown[:500]
        # The actual individual detail uses the identical pinned F1-B engine as Box.
        page.locator('#review-slots .avatar-tap').first.click()
        assert_mobile_geometry(page,'#pokemon-dialog .status-portrait','#pokemon-dialog')
        page.wait_for_function("""() => [...document.querySelectorAll('#pokemon-base-rows .iv-key')]
            .filter(e => ['おてつだい時間：','最大所持数：'].includes(e.textContent))
            .length === 2 && [...document.querySelectorAll('#pokemon-base-rows .iv-key')]
            .filter(e => ['おてつだい時間：','最大所持数：'].includes(e.textContent))
            .every(e => !['—','算出中…','原典未確認'].includes(e.nextElementSibling?.textContent))""",timeout=15000)
        page.locator('#pokemon-dialog').evaluate('(el)=>el.close()')
        mid=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        assert mid==before,'Proposal should never write legacy E7 event/box/inventory'
        page.locator('#review-adopt').click()
        page.locator('#week-content').wait_for(state='visible',timeout=30000)
        assert_mobile_geometry(page,'#slots .avatar')
        details=page.locator('#slots details.meal-details').filter(has=page.locator('.m2-reserve')).first
        details.wait_for(state='visible')
        summary=details.locator('summary')
        assert summary.inner_text().strip()
        assert not details.locator('.m2-reserve').is_visible()
        summary.click()
        assert details.locator('.m2-reserve-count').first.is_visible()
        summary.click()
        assert not details.locator('.m2-reserve').is_visible()
        adopted=page.locator('#slots').inner_text()
        assert 'サーナイト' in adopted or 'ニンフィア' in adopted,adopted[:500]
        saved=page.evaluate('''() => {
          const k='pokesleep-strategy-f4c-v112:plan:2026-11-16:manual%3A2026-11-16';
          const v=JSON.parse(localStorage.getItem(k)||'null');
          return {exists:!!v,kind:v?.kind,slots:v?.slots?.length,
            keys:Object.keys(localStorage).filter(x=>x.startsWith('pokesleep-strategy-f4c-v112:'))};
        }''')
        assert saved['kind']=='REAL_BOX_PLAN_V112' and saved['slots']==29,saved
        actual=page.evaluate('''() => JSON.parse(localStorage.getItem(
         'pokesleep-strategy-f4c-v112:plan:2026-11-16:manual%3A2026-11-16'))''')
        assert len(actual['slots'][0]['teamIds'])==0,'prior Sunday must stay unobserved'
        assert actual['previousWeekCarryUnknown'] is True
        assert page.evaluate('k=>localStorage.getItem(k)',legacy)=='{legacy-invalid-json'
        after=page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(seed))
        assert before==after,'Adoption must not mutate legacy mock plan or Box'
        page.reload(wait_until='domcontentloaded')
        page.locator('#week-content').wait_for(state='visible',timeout=30000)
        assert 'Lv.' in page.locator('#slots').inner_text()
        # F4-C: a newer saved inventory must not erase the LAST adopted
        # lineup. It becomes visibly stale, with a re-propose action.
        page.evaluate('''() => {
          const k='pokesleep-strategy-u2-e2-v1:2026-11-16:manual%3A2026-11-16:timeline';
          const p=JSON.parse(localStorage.getItem(k));
          p.currentInventory.revision='f4b-stock-updated';
          p.currentInventory.values['とくせんリンゴ']=55;
          localStorage.setItem(k,JSON.stringify(p));
        }''')
        page.reload(wait_until='domcontentloaded')
        page.locator('#week-content').wait_for(state='visible',timeout=30000)
        page.locator('#e3-next[data-action="F4C_REPROPOSE"]').wait_for(state='visible',timeout=15000)
        assert 'Lv.' in page.locator('#slots').inner_text()
        assert page.locator('#e4-changed').is_visible()
        page.locator('#e3-next').click()
        page.locator('#review-dialog').wait_for(state='visible',timeout=90000)
        page.locator('#review-cancel').click()
        assert not errors,'Browser errors: '+repr(errors[-8:])
        # The Box is the accepted reference: it must retain its original geometry.
        box_page=context.new_page()
        box_page.goto(BASE.split('/U3_Strategy_UI_')[0]+'/U4_Box_Preview_20261109_v50_E7.html',
                      wait_until='domcontentloaded')
        box_page.locator('#box-list .box-avatar').first.wait_for(state='visible',timeout=20000)
        assert_mobile_geometry(box_page,'#box-list .box-avatar')
        box_page.locator('#box-list .box-avatar').first.click()
        box_page.locator('#box-detail-dialog').wait_for(state='visible',timeout=10000)
        assert_mobile_geometry(box_page,'#box-detail-dialog .status-portrait','#box-detail-dialog')
        box_page.close()
        print('F4-C v116 Chromium: real 29-window plan + sprite containment/sheet center at 320/393/430px PASS')
        # Use a separate Box to exercise display order independently of F1 eligibility.
        picker_context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        picker=picker_context.new_page()
        picker.goto(BASE,wait_until='domcontentloaded')
        picker_items=[dict(row) for row in items]
        picker_items[1]['level']=65
        picker_items.append(dict(items[0],pokemon='ミュウ',nickname='テストミュウ',level=60))
        picker_seed={**seed,key('plan'):json.dumps({**plan(event,None),'autoSleep':False}),
                     'pokesleep-strategy-e7-box-v1':json.dumps({**box,'items':picker_items})}
        picker.evaluate('(entries)=>Object.entries(entries).forEach(([k,v])=>localStorage.setItem(k,v))',picker_seed)
        picker.reload(wait_until='domcontentloaded')
        def open_picker():
            picker.locator('#e3-next[data-action="F4C_PROPOSE"]:not([disabled])').wait_for()
            picker.locator('#sleep-open').click()
            picker.locator('#sleep-change').click()
        open_picker()
        buttons=picker.locator('#pick-grid .pick-select')
        expected=sorted(range(len(picker_items)),key=lambda i:-picker_items[i]['level'])
        assert buttons.evaluate_all('(els)=>els.map(e=>Number(e.dataset.id))')==expected
        for index in range(5):
            buttons.nth(index).click()
        picker.locator('#edit-save').click()
        assert 'テストミュウ' in picker.locator('#sleep-team-preview').inner_text()
        picker.reload(wait_until='domcontentloaded')
        open_picker()
        assert buttons.evaluate_all('(els)=>els.filter(e=>e.getAttribute("aria-pressed")==="true").map(e=>Number(e.dataset.id))')==expected[:5]
        assert picker.evaluate("()=>localStorage.getItem('pokesleep-strategy-e7-box-v1')")==picker_seed['pokesleep-strategy-e7-box-v1']
        picker_context.close()
        browser.close()
finally:
    server.shutdown()

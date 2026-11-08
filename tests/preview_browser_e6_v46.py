"""E6 v46: reject duplicate berries on SAVE while allowing ordinary partial saves."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]/'previews'
U3=(base/'U3_Strategy_UI_20261108_v46_E6.html').resolve().as_uri()
U2=(base/'U2_Prep_Local_Ingredients_20261108_v46_E6.html').resolve().as_uri()
U4=(base/'U4_Box_Preview_20261108_v46_E6.html').resolve().as_uri()
events={'bonus':[{'name':'meal prep week vol1','start':'2026-11-09T04:00:00','end':'2026-11-16T04:00:00','effects':{'dish':1.25}}]}
def setval(p,id,value):
    p.evaluate("""([id,value])=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}))}""",[id,value])
def selected(p):
    return p.evaluate("""()=>localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')""")
def snapshot(p):
    return p.evaluate("""()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('pokesleep-strategy-u3-e3-v1:')).sort().map(k=>[k,localStorage.getItem(k)]))""")
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    ctx.route('**/src/data/event.json',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(events)))
    p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart=2026-11-16',wait_until='domcontentloaded')
    setval(p,'event-start','2026-11-16')
    setval(p,'event-field','ワカクサ本島')
    setval(p,'event-food','all')
    assert p.locator('#e6-berry-settings').is_visible()
    for id,v in [('e6-berry-main','ほのお'),('e6-berry-sub1','ほのお'),('e6-berry-sub2','みず')]:setval(p,id,v)
    assert selected(p) is None
    p.locator('#event-save').click()
    assert selected(p) is None,'duplicate save must not create a selected event'
    assert '同じきのみは選択できません' in p.locator('#ui-toast').inner_text()
    assert p.locator('#e6-berry-main + .custom-select .custom-trigger').get_attribute('aria-invalid')=='true'
    assert p.locator('#e6-berry-sub1 + .custom-select .custom-trigger').get_attribute('aria-invalid')=='true'
    assert p.locator('#e6-berry-sub2 + .custom-select .custom-trigger').get_attribute('aria-invalid') is None
    assert not p.locator('#e3-primary').is_visible()
    # Duplicates across first and third slot are equally invalid, including 3/3.
    setval(p,'e6-berry-sub2','ほのお')
    for id in ['e6-berry-main','e6-berry-sub1','e6-berry-sub2']:
        assert p.locator('#'+id+' + .custom-select .custom-trigger').get_attribute('aria-invalid')=='true'
    setval(p,'e6-berry-sub1','くさ')
    assert p.locator('#e6-berry-sub1 + .custom-select .custom-trigger').get_attribute('aria-invalid') is None
    assert p.locator('#e6-berry-main + .custom-select .custom-trigger').get_attribute('aria-invalid')=='true'
    setval(p,'e6-berry-sub2','みず')
    for id in ['e6-berry-main','e6-berry-sub1','e6-berry-sub2']:
        assert p.locator('#'+id+' + .custom-select .custom-trigger').get_attribute('aria-invalid') is None
    p.locator('#event-save').click()
    assert '入力済みのイベント条件を保存しました' in p.locator('#ui-toast').inner_text()
    assert selected(p) is not None
    saved=snapshot(p)
    assert len(saved)>=2
    assert p.locator('#e3-next').inner_text()=='作戦を提案'
    # Saving a new duplicate cannot overwrite conditions or a saved plan.
    setval(p,'e6-berry-sub2','ほのお')
    p.locator('#event-save').click()
    assert snapshot(p)==saved,'failed duplicate save changed persisted state'
    assert '同じきのみは選択できません' in p.locator('#ui-toast').inner_text()
    setval(p,'e6-berry-sub2','みず')
    # Missing food is still a valid partial save; only duplicated berry values are forbidden.
    setval(p,'event-food','')
    p.locator('#event-save').click()
    assert '入力済みのイベント条件を保存しました' in p.locator('#ui-toast').inner_text()
    assert not p.locator('#e3-primary').is_visible()
    # The event bonus is a passive left-ruled info strip, not a button.
    eid='pokesleep-tool:meal prep week vol1:2026-11-09'
    p.wait_for_function("""id=>[...document.querySelector('#event-source-select').options].some(x=>x.value===id)""",arg=eid)
    setval(p,'event-source-select',eid)
    assert p.locator('#e6-bonus-panel').is_visible()
    assert p.locator('#e6-bonus-list li').all_text_contents()==['料理エナジー ×1.25']
    style=p.locator('#e6-bonus-panel').evaluate("""e=>{const s=getComputedStyle(e);return {left:s.borderLeftWidth,top:s.borderTopWidth,shadow:s.boxShadow,cursor:s.cursor,bg:s.backgroundImage}}""")
    assert style['left']=='3px' and style['top']=='0px',style
    assert style['shadow']=='none' and style['cursor']=='default',style
    assert 'gradient' in style['bg'],style
    assert p.locator('#e6-bonus-panel').evaluate('(e)=>e.tagName')=='DIV'
    for url in [U2,U4]:
        p.goto(url,wait_until='domcontentloaded')
        assert p.locator('#e6-footer-prep path[fill="currentColor"]').count()==1
    assert not errors,errors
    browser.close()
print('E6 v46 browser acceptance: PASS')

"""E6 v45 mobile regression: immediate event-bonus placement and field-art cleanup."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'previews'
U2=(root/'U2_Prep_Local_Ingredients_20261108_v45_E6.html').resolve().as_uri()
U3=(root/'U3_Strategy_UI_20261108_v45_E6.html').resolve().as_uri()
U4=(root/'U4_Box_Preview_20261108_v45_E6.html').resolve().as_uri()
events={'bonus':[
    {'name':'meal prep week vol1','start':'2026-11-09T04:00:00','end':'2026-11-16T04:00:00','effects':{'dish':1.25}},
    {'name':'bountiful banquet week vol1','start':'2026-11-16T04:00:00','end':'2026-11-23T04:00:00','effects':{'extraIng':'nuts','carryLimitAdd':10}}
]}
def choose(p,id,value):
    p.evaluate("""([id,value])=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}))}""",[id,value])
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(timezone_id='Asia/Tokyo',viewport={'width':393,'height':852})
    ctx.route('**/src/data/event.json',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(events)))
    p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(U3+'?previewNow=2026-11-08T16:00',wait_until='domcontentloaded')
    eid='pokesleep-tool:meal prep week vol1:2026-11-09'
    p.wait_for_function("(id)=>[...document.querySelector('#event-source-select').options].some(x=>x.value===id)",arg=eid)
    choose(p,'event-source-select',eid)
    assert p.locator('#e6-bonus-panel').is_visible()
    assert p.locator('#e6-bonus-list li').all_text_contents()==['料理エナジー ×1.25']
    assert p.locator('#e6-event-heading').count()==0
    # The accessible custom dropdown trigger is visible; its native select is hidden.
    bounds=p.evaluate("""()=>{
      const source=document.querySelector('#event-source-select + .custom-select .custom-trigger');
      return [source,document.querySelector('#e6-bonus-panel'),document.querySelector('#event-start')]
        .map(node=>node.getBoundingClientRect().top);
    }""")
    assert bounds[0]<bounds[1]<bounds[2],bounds
    style=p.locator('#e6-bonus-panel').evaluate("""e=>({radius:getComputedStyle(e).borderRadius,background:getComputedStyle(e).backgroundColor,display:getComputedStyle(e).display})""")
    assert style['radius']=='12px',style
    assert style['background']=='rgb(38, 60, 81)',style
    assert style['display']!='none',style
    choose(p,'event-field','シアンの砂浜')
    assert p.locator('#e6-field-art').is_visible()
    assert p.locator('#e6-field-art').inner_text()==''
    assert 'field-cyan.png' in p.locator('#e6-field-art').evaluate('(e)=>e.style.backgroundImage')
    choose(p,'event-field','シアンの砂浜EX')
    assert 'field-cyan-ex.jpg' in p.locator('#e6-field-art').evaluate('(e)=>e.style.backgroundImage')
    # Switching to another week must not retain the prior map's illustration.
    new_id='pokesleep-tool:bountiful banquet week vol1:2026-11-16'
    choose(p,'event-source-select',new_id)
    assert p.locator('#event-field').input_value()==''
    assert p.locator('#e6-field-art').is_hidden()
    assert p.locator('#e6-bonus-panel').is_visible()
    assert len(p.locator('#e6-bonus-list li').all_text_contents())>=1
    choose(p,'event-source-select','')
    assert p.locator('#e6-bonus-panel').is_hidden(),'no empty bonus box for manual event'
    for target in [U3,U2,U4]:
        p.goto(target+'?previewNow=2026-11-08T16:00',wait_until='domcontentloaded')
        assert p.locator('#e6-footer-prep path[fill="currentColor"]').count()==1
        assert p.locator('#e6-footer-prep path[stroke-width="2.05"]').count()==1
        assert not errors,errors
    browser.close()
print('E6 v45 browser acceptance: PASS')

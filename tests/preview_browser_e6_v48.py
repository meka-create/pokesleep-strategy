"""E6 v48: exercise sleep editing through the real UI at JST midnight boundaries."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]/'previews'
U3=(root/'U3_Strategy_UI_20261109_v48_E6.html').resolve().as_uri()
week='2026-11-09'

def select(p,id,value):
    p.evaluate("""([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}""",[id,value])

def sample(p,when,day):
    # No test-only global APIs: the application's functions are encapsulated.
    # Navigate to the desired preview time, then inspect sleep editing availability.
    p.goto(U3+'?previewNow='+when+'&eventStart='+week,wait_until='domcontentloaded')
    assert p.locator('#event-start').input_value()==week
    stage=p.locator('.shell > main').get_attribute('data-phase-stage')
    p.locator('#sleep-open').click()
    assert p.locator('#sleep-dialog').evaluate('(e)=>e.open')
    p.locator('#sleep-day-nav .daybtn').nth(day).click()
    past=p.locator('#sleep-change').is_disabled()
    all_past=p.locator('#sleep-copy').is_disabled()
    p.locator('#sleep-close').click()
    return {'past':past,'allPast':all_past,'stage':stage}

errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart='+week,wait_until='domcontentloaded')
    select(p,'event-start',week)
    select(p,'event-field','シアンの砂浜')
    select(p,'event-food','all')
    p.locator('#event-save').click()
    assert p.locator('#e3-next').inner_text()=='作戦を提案'
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    titles=p.locator('#review-slots .slot-title')
    assert titles.all_text_contents()==['7:30–12:00','12:00–18:00','18:00–0:00','睡眠枠']
    styles=titles.evaluate_all("""els=>els.map(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.color]})""")
    assert all(s==styles[0] for s in styles),styles
    p.locator('#review-close').click()

    assert sample(p,'2026-11-09T00:00',0)['past'] is False
    assert sample(p,'2026-11-09T23:59',0)['past'] is False
    assert sample(p,'2026-11-10T00:00',0)['past'] is True
    assert sample(p,'2026-11-10T00:00',1)['past'] is False
    assert sample(p,'2026-11-15T23:59',6)['past'] is False
    midnight=sample(p,'2026-11-16T00:00',6)
    assert midnight['past'] is True and midnight['allPast'] is True,midnight
    assert midnight['stage']!='ended','event week ends at 04:00, not 00:00'
    minus=sample(p,'2026-11-16T03:59',6)
    assert minus['past'] is True and minus['stage']!='ended',minus
    end=sample(p,'2026-11-16T04:00',6)
    assert end['past'] is True and end['stage']=='ended',end
    assert not errors,errors
    browser.close()
print('E6 v48 midnight sleep edit gate and week rollover: PASS')

"""v47 Android sized browser check of four time headers in a proposed weekly plan."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'previews'
U3=(root/'U3_Strategy_UI_20261109_v47_E6.html').resolve().as_uri()
def choose(p,id,value):
    p.evaluate("""([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}""",[id,value])
issues=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    p=ctx.new_page()
    p.on('pageerror',lambda e:issues.append(str(e)))
    p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart=2026-11-16',wait_until='domcontentloaded')
    choose(p,'event-start','2026-11-16')
    choose(p,'event-field','シアンの砂浜')
    choose(p,'event-food','all')
    p.locator('#event-save').click()
    assert p.locator('#e3-next').inner_text()=='作戦を提案'
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    heads=p.locator('#review-slots .slot-title')
    assert heads.all_text_contents()==['7:30–12:00','12:00–18:00','18:00–0:00','睡眠中']
    styles=heads.evaluate_all("""els=>els.map(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.color,s.lineHeight]})""")
    assert all(x==styles[0] for x in styles),styles
    assert not issues,issues
    browser.close()
print('E6 v47 Android Chromium slot label acceptance: PASS')

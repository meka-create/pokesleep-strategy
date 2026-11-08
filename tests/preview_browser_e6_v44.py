"""E6 v44: partial-save copy, action consolidation, field art and navigation."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'previews'
u2=(root/'U2_Prep_Local_Ingredients_20261108_v44_E6.html').resolve().as_uri()
u3=(root/'U3_Strategy_UI_20261108_v44_E6.html').resolve().as_uri()
u4=(root/'U4_Box_Preview_20261108_v44_E6.html').resolve().as_uri()
def setval(page,id,value):
    page.evaluate("""([id,value])=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}))}""",[id,value])
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(u3+'?previewNow=2026-11-08T16:00&eventStart=2026-11-16',wait_until='domcontentloaded')
    assert not p.locator('#e3-primary').is_visible(),'no event-selection action card'
    assert p.locator('#event-details').evaluate('(e)=>e.open')
    setval(p,'event-start','2026-11-16')
    p.locator('#event-save').click()
    assert p.locator('#ui-toast').inner_text()=='入力済みのイベント条件を保存しました'
    assert not p.locator('#ui-toast').evaluate('(e)=>e.classList.contains("is-error")')
    assert not p.locator('#event-save').evaluate('(e)=>e.dataset.attention==="true"')
    assert not p.locator('#e3-primary').is_visible(),'partial conditions must not permit proposing'
    assert p.locator('#event-details').evaluate('(e)=>e.open')
    # The same field artwork is swapped immediately when selection changes.
    setval(p,'event-field','シアンの砂浜')
    assert p.locator('#e6-field-art').is_visible()
    assert 'field-cyan.png' in p.locator('#e6-field-art').evaluate('(e)=>e.style.backgroundImage')
    setval(p,'event-field','シアンの砂浜EX')
    assert 'field-cyan-ex.jpg' in p.locator('#e6-field-art').evaluate('(e)=>e.style.backgroundImage')
    assert p.locator('#e6-field-art').get_attribute('data-ex')=='true'
    setval(p,'event-field','シアンの砂浜')
    setval(p,'event-food','all')
    p.locator('#event-save').click()
    assert p.locator('#e3-next').inner_text()=='作戦を提案'
    assert p.locator('#e3-warning').is_hidden()
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    p.locator('#review-close').click()
    assert p.locator('#e3-next').inner_text()=='作戦を提案','draft resume uses same action'
    assert p.locator('#e3-next').get_attribute('data-action')=='RESUME_DRAFT'
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    p.locator('#review-cancel').click()
    for url in [u2,u4]:
        p.goto(url,wait_until='domcontentloaded')
        assert p.locator('#e6-footer-prep ellipse').count()==1
        assert not errors,errors
    browser.close()
print('v44 Chromium UI acceptance: PASS')

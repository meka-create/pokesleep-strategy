"""E6 v48: midnight is next calendar day, never the same-day midnight."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'previews'
U3=(root/'U3_Strategy_UI_20261109_v48_E6.html').resolve().as_uri()
def select(p,id,value):
    p.evaluate("""([id,v])=>{const node=document.getElementById(id);node.value=v;node.dispatchEvent(new Event('change',{bubbles:true}));}""",[id,value])
def sample(p,when):
    return p.evaluate("""time=>{
      const url=new URL(location.href);
      url.searchParams.set('previewNow',time);
      history.replaceState(null,'',url);
      return {monSleep:isPastSlot(0,'sleep'),tueSleep:isPastSlot(1,'sleep'),
        sunSleep:isPastSlot(6,'sleep'),monEvening:isPastSlot(0,'evening'),
        phase:eventPhase(),gameDay:currentEventGameDayIndex(),
        remaining:remainingSlots()};
    }""",when)
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    p=ctx.new_page()
    p.on('pageerror',lambda err:errors.append(str(err)))
    p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart=2026-11-09',wait_until='domcontentloaded')
    select(p,'event-start','2026-11-09')
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
    before=sample(p,'2026-11-09T00:00')
    assert not before['monSleep'],'Monday 00:00 must NOT mark Monday night past'
    late=sample(p,'2026-11-09T23:59')
    assert not late['monSleep'] and late['monEvening'],'Monday night is editable until Tuesday midnight'
    midnight=sample(p,'2026-11-10T00:00')
    assert midnight['monSleep'] and not midnight['tueSleep'],'Tuesday 00:00 should close Monday night only'
    beforeLast=sample(p,'2026-11-15T23:59')
    assert not beforeLast['sunSleep'],'Sunday 23:59 is not past'
    nextMon=sample(p,'2026-11-16T00:00')
    assert nextMon['sunSleep'] and nextMon['phase']=='during','Sunday night closes before the weekly 04:00 rollover'
    assert nextMon['remaining']==0,'all 28 slots elapsed after final Sunday midnight'
    endMinus=sample(p,'2026-11-16T03:59')
    assert endMinus['phase']=='during' and endMinus['sunSleep']
    ended=sample(p,'2026-11-16T04:00')
    assert ended['phase']=='ended' and ended['sunSleep']
    assert not errors,errors
    browser.close()
print('E6 v48 midnight and slot display: PASS')

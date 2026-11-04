"""U3-C deep Chromium acceptance: pre-event gate, sleep draft race, delayed adoption."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]/"previews"
U3=(ROOT/"U3_Strategy_UI_20261104_v29.html").resolve().as_uri()
errors=[]
names=re.findall(r'"([^"]+)":"data:image/png;base64,',(ROOT/"U3_Strategy_UI_20261104_v29.html").read_text(encoding="utf8"))
assert len(names)==19
def choose(page,key,val):
 page.evaluate("""([key,val])=>{const e=document.querySelector(key);e.value=val;
  e.dispatchEvent(new Event('change',{bubbles:true}));}""",[key,val])
def seed(page):
 r={"version":3,"weekStart":"2026-11-09","source":"inventory",
    "savedAt":"2026-11-09T06:00:00+09:00","values":{k:0 for k in names}}
 page.evaluate("""r=>localStorage.setItem('pokesleep-strategy-u2-v3:2026-11-09:inventory',JSON.stringify(r))""",r)
def configure(page):
 if page.locator("#event-details").get_attribute("open") is None:
  page.locator("#event-details>summary").click()
 choose(page,"#event-field","シアンの砂浜")
 choose(page,"#event-food","curry")
 page.locator("#event-save").click()
def state(page):
 return page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-v1:2026-11-09'))""")
def at(page,when):
 page.goto(U3+"?eventStart=2026-11-09&previewNow="+when,wait_until="domcontentloaded")
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":390,"height":844})
 page=ctx.new_page()
 page.on("pageerror",lambda e:errors.append(str(e)))
 # PREPARATION: even valid event+saved inventory must not allow a weekly plan.
 at(page,"2026-11-08T14:00")
 configure(page);seed(page)
 page.reload(wait_until="domcontentloaded")
 assert page.locator("main").get_attribute("data-phase-stage")=="preparation"
 assert page.locator("#phase-intro-u2").is_visible()
 assert page.locator("#generate").is_disabled()
 assert "イベント開始後" in page.locator("#event-gate").inner_text()
 # EVENT BEGINS: interlock automatically releases, saved zero counts as valid.
 at(page,"2026-11-09T06:00")
 assert page.locator("#generate").is_enabled()
 page.locator("#generate").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 assert page.locator("#week-content").is_hidden()
 # An unadopted draft survived page reload. Sleep auto changes must make it stale.
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#resume-draft").is_visible()
 assert page.locator("#auto-sleep").get_attribute("aria-checked")=="false"
 manual_before=state(page)["manualSleep"]
 page.locator("#auto-sleep").click()
 assert page.locator("#auto-sleep").get_attribute("aria-checked")=="true"
 assert state(page)["manualSleep"]==manual_before
 page.locator("#resume-draft").click()
 assert not page.locator("#review-dialog").evaluate("(e)=>e.open")
 assert "睡眠編成が変更されています" in page.locator("#ui-toast").inner_text()
 assert page.locator("#week-content").is_hidden()
 # A fresh auto-sleep proposal can be adopted. Switching it off preserves 7 manual nights.
 page.locator("#generate").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert state(page)["applied"]["autoSleep"]==True
 page.locator("#auto-sleep").click()
 assert state(page)["manualSleep"]==manual_before
 assert page.locator("#sleep-open").is_enabled()
 # Generate a manual proposal, then alter just one of 7 sleep nights while stored draft remains.
 page.locator("#repropose").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#resume-draft").is_visible()
 page.locator("#sleep-open").click()
 assert page.locator("#sleep-dialog").evaluate("(e)=>e.open")
 page.locator("#sleep-day-nav button").nth(0).click()
 page.locator("#sleep-change").click()
 assert page.locator("#edit-dialog").evaluate("(e)=>e.open")
 assert not page.locator("#recipe-editor").count()  # abolished daytime recipe editor removed
 page.locator('#pick-grid .pick-select[data-id="dragonite"]').click()
 page.locator('#pick-grid .pick-select[data-id="raichu"]').click()
 assert page.locator("#edit-save").is_enabled()
 page.locator("#edit-save").click()
 assert not page.locator("#edit-dialog").evaluate("(e)=>e.open")
 page.locator("#sleep-close").click()
 assert "raichu" in state(page)["manualSleep"][0]
 for d in range(1,7):
  assert state(page)["manualSleep"][d]==manual_before[d]
 page.locator("#resume-draft").click()
 assert not page.locator("#review-dialog").evaluate("(e)=>e.open")
 assert "睡眠編成が変更されています" in page.locator("#ui-toast").inner_text()
 # The current adopted plan must survive rejection; fresh proposal adopts the edited night.
 assert state(page)["applied"]["autoSleep"]==True
 page.locator("#repropose").click()
 page.locator("#review-adopt").click()
 assert "raichu" in state(page)["applied"]["days"][0]["sleep"]
 assert state(page)["manualSleep"][1:]==manual_before[1:]
 assert state(page)["applied"]["autoSleep"]==False
 # Separate case: first proposal was generated before the morning slot,
 # but accepted afterwards. A made-up past team/meal must never be shown as history.
 ctx2=browser.new_context(viewport={"width":390,"height":844})
 page2=ctx2.new_page()
 page2.on("pageerror",lambda e:errors.append(str(e)))
 at(page2,"2026-11-09T06:00")
 configure(page2);seed(page2)
 page2.reload(wait_until="domcontentloaded")
 assert page2.locator("#generate").is_enabled()
 page2.locator("#generate").click()
 assert page2.locator("#review-dialog").evaluate("(e)=>e.open")
 assert "実施済み（記録なし）" not in page2.locator("#review-slots .slot[data-slot='morning']").inner_text()
 page2.evaluate("""()=>{const url=new URL(location.href);
  url.searchParams.set('previewNow','2026-11-09T08:00');
  history.replaceState(history.state,'',url.href);}""")
 page2.locator("#review-adopt").click()
 assert not page2.locator("#review-dialog").evaluate("(e)=>e.open")
 assert page2.locator("#week-content").is_visible()
 assert "実施済み（記録なし）" in page2.locator("#slots .slot[data-slot='morning']").inner_text()
 assert "実施済み（記録なし）" not in page2.locator("#slots .slot[data-slot='noon']").inner_text()
 assert {"day":0,"slot":"morning"} in state(page2)["applied"]["unknownPast"]
 page2.reload(wait_until="domcontentloaded")
 assert "実施済み（記録なし）" in page2.locator("#slots .slot[data-slot='morning']").inner_text()
 assert not errors,errors
 print("PASS U3-C: pre-event hard gate with confirmed data; stale auto/manual sleep draft rejected; seven manual nights preserved; delayed adoption masks elapsed slots; day editor absent.")
 ctx2.close();ctx.close();browser.close()

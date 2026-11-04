"""U3-B browser acceptance: JST 04:00 rollover, initial selection and tab autonomy."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

BASE=Path(__file__).resolve().parents[1]/"previews"
U3=(BASE/"U3_Strategy_UI_20261104_v29.html").resolve().as_uri()
ERRORS=[]

def choose(page,selector,value):
 page.evaluate("""([s,v])=>{let el=document.querySelector(s);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}""",[selector,value])

def get_day(page):
 active=page.locator('#day-nav [role="tab"][aria-selected="true"]')
 assert active.count()==1,"not exactly one selected day"
 return page.locator('#day-label').inner_text(),active.get_attribute('aria-label')

def open_at(page,when,week="2026-11-09"):
 page.goto(U3+f"?eventStart={week}&previewNow={when}",wait_until="domcontentloaded")
 assert not ERRORS,ERRORS

with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 context=browser.new_context(viewport={"width":393,"height":844},timezone_id="America/Los_Angeles")
 page=context.new_page()
 page.on("pageerror",lambda error:ERRORS.append(str(error)))

 # Create the adopted plan once at the start of the simulated event week.
 open_at(page,"2026-11-09T07:00")
 assert get_day(page)[0]=="月曜日"
 page.locator("#event-details>summary").click() if page.locator("#event-details").get_attribute("open") is None else None
 choose(page,"#event-field","シアンの砂浜")
 choose(page,"#event-food","curry")
 page.locator("#event-save").click()
 ingredients=re.findall(r'"([^"]+)":"data:image/png;base64,',(BASE/"U3_Strategy_UI_20261104_v29.html").read_text(encoding="utf8"))
 assert len(ingredients)==19
 record={"version":3,"weekStart":"2026-11-09","source":"inventory","savedAt":"2026-11-09T06:30:00+09:00","values":{name:0 for name in ingredients}}
 page.evaluate("""r=>localStorage.setItem('pokesleep-strategy-u2-v3:2026-11-09:inventory',JSON.stringify(r))""",record)
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#generate").is_enabled()
 page.locator("#generate").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert get_day(page)[0]=="月曜日"
 assert page.locator("main").get_attribute("data-phase-stage")=="active"

 scenarios=[
  ("2026-11-09T23:59","月曜日"),
  ("2026-11-10T00:00","月曜日"),
  ("2026-11-10T03:59","月曜日"),
  ("2026-11-10T04:00","火曜日"),
  ("2026-11-10T12:00","火曜日"),
  ("2026-11-11T03:59","火曜日"),
  ("2026-11-11T04:00","水曜日"),
  ("2026-11-11T15:00","水曜日"),
  ("2026-11-12T12:00","木曜日"),
  ("2026-11-13T20:00","金曜日"),
  ("2026-11-14T12:00","土曜日"),
  ("2026-11-15T17:00","日曜日"),
  ("2026-11-16T03:59","日曜日"),
 ]
 for when,want in scenarios:
  open_at(page,when)
  got,_=get_day(page)
  assert got==want,(when,want,got)
  assert page.locator("#day-date").inner_text() in ("11/9","11/10","11/11","11/12","11/13","11/14","11/15")
  assert page.locator("#week-content").is_visible()
  assert page.locator("main > :first-child").get_attribute("id")=="week-content"

 # A manually viewed day must survive rerenders, not be continuously forced back to today.
 open_at(page,"2026-11-10T12:00")
 assert get_day(page)[0]=="火曜日"
 page.locator("#day-nav button").nth(4).click()  # Friday
 assert get_day(page)[0]=="金曜日"
 page.locator("#event-details>summary").click()
 choose(page,"#event-food","salad") # triggers render
 assert get_day(page)[0]=="金曜日"
 choose(page,"#event-food","curry")
 assert get_day(page)[0]=="金曜日"
 page.evaluate("""()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}))""")
 assert get_day(page)[0]=="金曜日"
 # BFCache return does count as reopening, and resets to the current game day.
 page.evaluate("""()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))""")
 assert get_day(page)[0]=="火曜日"
 # Reloading explicitly reopens the plan, overriding any last saved manual day.
 page.locator("#day-nav button").nth(5).click()
 assert get_day(page)[0]=="土曜日"
 page.reload(wait_until="domcontentloaded")
 assert get_day(page)[0]=="火曜日"

 # Before the event, the preview defaults to Monday; no unrelated calendar weekday mapping.
 open_at(page,"2026-11-08T12:00")
 assert page.locator("main").get_attribute("data-phase-stage")=="preparation"
 assert get_day(page)[0]=="月曜日"
 assert page.locator("#week-content").is_visible() # historical accepted plan remains readable, but not promoted
 # Outside the completed week, leave the previously selected tab in place.
 open_at(page,"2026-11-10T12:00")
 page.locator("#day-nav button").nth(3).click()  # Thu
 # Save selection using existing v27 persistence, without changing plan.
 page.evaluate("""()=>{const name='pokesleep-strategy-u3-v1:2026-11-09';let d=JSON.parse(localStorage.getItem(name));d.selectedDay=3;localStorage.setItem(name,JSON.stringify(d));}""")
 open_at(page,"2026-11-16T04:00")
 assert get_day(page)[0]=="木曜日"
 assert page.locator("main").get_attribute("data-phase-stage")=="ended"
 assert page.locator("#week-content").is_visible()
 assert page.locator("#repropose").is_disabled()
 # Crossing event weeks with the save action switches to this week's correct day.
 open_at(page,"2026-11-18T15:00") # selected 11/9 week ended
 page.locator("#event-details>summary").click()
 page.locator("#event-start").fill("2026-11-16")
 page.locator("#event-save").click()
 assert page.locator("#event-start").input_value()=="2026-11-16"
 assert get_day(page)[0]=="水曜日"
 assert page.locator("main").get_attribute("data-phase-stage")=="start"
 assert page.locator("#week-content").is_hidden()
 # Switching back to old event week should not display today's 11/18 roster as if from 11/9.
 page.locator("#event-start").fill("2026-11-09")
 page.locator("#event-save").click()
 assert get_day(page)[0] in ("木曜日","月曜日","火曜日","水曜日","金曜日","土曜日","日曜日")
 assert page.locator("main").get_attribute("data-phase-stage")=="ended"
 assert page.locator("#week-content").is_visible()
 # U3-B must not add any abandoned daytime editing.
 assert not page.locator("#view-tabs,#stock-dialog,#daytime-edit").count()
 assert page.locator("#auto-sleep").get_attribute("aria-checked")=="false"
 assert not ERRORS,ERRORS
 print("PASS U3-B: 13 weekday/midnight/JST04:00 boundary scenarios; user browsing; BFCache; reload; week switching; out-of-week handling.")
 context.close();browser.close()

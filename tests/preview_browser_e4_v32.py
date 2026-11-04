"""E4 v32 real Chromium acceptance: today-first, sleep edits, reruns, clocks and transactional adoption."""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U3=(ROOT/"U3_Strategy_UI_20261105_v32.html").resolve().as_uri()
U2=(ROOT/"U2_Prep_Local_Ingredients_20261105_v32.html").resolve().as_uri()
WEEK="2026-11-09"
STOCK_KEY="pokesleep-strategy-u2-e2-v1:"+WEEK+":timeline"
PLAN_KEY="pokesleep-strategy-u3-e3-v1:"+WEEK+":"+ "manual%3A"+WEEK+":plan"
# encodeURIComponent('manual:2026-11-09') actually leaves '-' but percent-encodes ':'.
def date_url(clock):
 return U3+"?previewNow="+clock
def select_source(page):
 page.locator("#e3-next").click()
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{
  for(const [id,value] of [['event-field','シアンの砂浜'],['event-food','curry']]){
   const el=document.getElementById(id);el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }""")
 page.locator("#event-save").click()
 assert page.locator("#e3-next").inner_text()=="食材在庫を登録"
def adopt_initial(page):
 page.locator("#e3-next").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261105_v32.html?*")
 assert parse_qs(urlsplit(page.url).query)["eventId"]==["manual:"+WEEK]
 page.locator("#save-inventory").click()
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261105_v32.html?*")
 assert page.locator("#e3-next").inner_text()=="7日間の作戦を提案"
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
def saved(page):
 return page.evaluate("(k)=>JSON.parse(localStorage.getItem(k)||'null')",PLAN_KEY)
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 context=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=context.new_page()
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(date_url("2026-11-11T15:00"),wait_until="domcontentloaded")
 select_source(page)
 adopt_initial(page)
 assert page.locator(".shell > main").evaluate("""main=>[...main.children].filter(x=>!x.hidden).map(x=>x.id||x.className)[0]""")=="week-content"
 assert page.locator("#day-label").inner_text()=="水曜日"
 assert page.locator("#current-state-title").inner_text()=="今日の作戦"
 assert page.locator("#e4-result-energy").is_hidden(), "Sample energy must not look calculated"
 assert page.locator("#slots>.slot").count()==4
 assert page.locator("#slots>.slot[data-slot='sleep']").count()==1
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#e3-update-stock").is_visible()
 assert page.locator("#auto-sleep").get_attribute("aria-checked")=="false"
 assert page.locator("#slots .slot[data-slot='morning'] .muted").inner_text()=="実施済み（記録なし）"
 assert page.locator("#slots .slot[data-slot='noon'] .muted").inner_text()=="実施済み（記録なし）"
 assert page.locator("#slots .slot[data-slot='evening'] .mini-roster .mon").count()==5
 # Changing weekday is browsing only. Rerenders and sleep-auto toggles must not steal selection.
 page.locator("#day-nav button").nth(4).click()
 assert page.locator("#day-label").inner_text()=="金曜日"
 assert page.locator("#current-state-title").inner_text()=="週間編成"
 page.locator("#auto-sleep").click()
 assert page.locator("#day-label").inner_text()=="金曜日"
 assert page.locator("#e3-next").inner_text()=="残り期間を再提案"
 page.locator("#auto-sleep").click()
 assert page.locator("#day-label").inner_text()=="金曜日"
 assert page.locator("#e3-primary").is_hidden()
 # Return to today's day when opening afresh.
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#day-label").inner_text()=="水曜日"
 # Manual future sleep edits must count as a change while the adopted plan stays intact.
 original=saved(page)["applied"]
 page.locator("#sleep-open").click()
 assert page.locator("#sleep-dialog").evaluate("(e)=>e.open")
 page.locator("#sleep-change").click()
 assert page.locator("#edit-dialog").evaluate("(e)=>e.open")
 grid=page.locator("#pick-grid .pick-select")
 selected=page.locator("#pick-grid .pick-select[aria-pressed='true']")
 selected.first.click()
 page.locator("#pick-grid .pick-select[aria-pressed='false']:not(:disabled)").last.click()
 page.locator("#edit-save").click()
 assert page.locator("#e3-next").inner_text()=="残り期間を再提案"
 assert saved(page)["applied"]==original, "Manual sleep settings must not silently adopt."
 # Reproposal must preserve previous already-started team and meals.
 page.locator("#sleep-close").click()
 page.locator("#e3-update-stock").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261105_v32.html?*")
 page.locator("[data-key]").first.fill("11")
 page.locator("#save-inventory").click()
 assert page.evaluate("(k)=>JSON.parse(localStorage.getItem(k)).startInventory",STOCK_KEY)==None
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261105_v32.html?*")
 assert page.locator("#e3-next").inner_text()=="残り期間を再提案"
 assert saved(page)["applied"]==original
 assert page.locator("#week-content").is_visible()
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 # Fail the single plan write, but retain adopted plan and the open draft.
 page.evaluate("""()=>{Storage.prototype.__e4Original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(k.includes(':plan')&&k.startsWith('pokesleep-strategy-u3-e3-v1:'))
     throw new DOMException('Quota exceeded','QuotaExceededError');
    return Storage.prototype.__e4Original.call(this,k,v);};}""")
 page.locator("#review-adopt").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open"),"Failed save must not close the review."
 assert saved(page)["applied"]==original
 page.evaluate("""()=>{Storage.prototype.setItem=Storage.prototype.__e4Original;delete Storage.prototype.__e4Original;}""")
 # Accept with writable storage; elapsed slots/recipes remain untouched.
 page.locator("#review-adopt").click()
 assert not page.locator("#review-dialog").evaluate("(e)=>e.open")
 after=saved(page)["applied"]
 assert after!=original
 for d in range(2):
  assert after["days"][d]==original["days"][d]
 for slot in ("morning","noon"):
  assert after["days"][2][slot]==original["days"][2][slot]
 for i in (0,1):
  assert after["days"][2]["recipes"][i]==original["days"][2]["recipes"][i]
 assert after["days"][2]["evening"]!=original["days"][2]["evening"],"Future party should reflect stock."
 assert page.locator("#e3-primary").is_hidden()
 # No automatic weekday jumping during redraw, but 04:00 is the fresh-open boundary.
 page.goto(date_url("2026-11-10T03:59"),wait_until="domcontentloaded")
 assert page.locator("#day-label").inner_text()=="月曜日"
 page.goto(date_url("2026-11-10T04:00"),wait_until="domcontentloaded")
 assert page.locator("#day-label").inner_text()=="火曜日"
 page.goto(date_url("2026-11-11T15:00"),wait_until="domcontentloaded")
 assert page.locator("#day-label").inner_text()=="水曜日"
 # Final sleep slot starts Sunday 22:00 but the event does not end until Monday 04:00.
 page.goto(date_url("2026-11-16T03:59"),wait_until="domcontentloaded")
 assert page.locator(".shell > main").get_attribute("data-phase-stage")=="active"
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#e3-update-stock").is_hidden()
 page.goto(date_url("2026-11-16T04:00"),wait_until="domcontentloaded")
 assert page.locator(".shell > main").get_attribute("data-phase-stage")=="ended"
 assert page.locator("#week-content").is_visible()
 assert page.locator(".sleep-settings").is_hidden()
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#event-save").is_disabled()
 assert not errors,errors
 print("PASS E4 v32: today-first 4 slots, manual sleep dirty, transactional adoption, future-only replan, weekday 04:00 and ended read-only.")
 context.close();browser.close()

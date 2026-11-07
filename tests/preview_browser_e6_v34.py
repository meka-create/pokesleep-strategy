"""E6 v34: mobile stage switch controls and time-travel plan visibility; real Chromium interactions."""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261107_v34_E6.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261107_v34_E6.html").resolve().as_uri()
WEEK="2026-11-09"
def open_u3(clock): return U3+"?previewNow="+clock
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=ctx.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(open_u3("2026-11-08T16:00"),wait_until="domcontentloaded")
 assert page.locator("#e6-dev").is_visible()
 assert page.locator("#e3-next").inner_text()=="イベントを選択"
 assert page.locator("#e6-current").inner_text().startswith("現在：準備週")
 assert page.locator("#week-content").is_hidden()
 page.locator("#e3-next").click()
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{for(const [id,val] of [['event-field','シアンの砂浜'],['event-food','curry']]){
 const el=document.getElementById(id);el.value=val;el.dispatchEvent(new Event('change',{bubbles:true}));}}""")
 page.locator("#event-save").click()
 assert page.locator("#phase-intro").is_visible()
 page.locator("#phase-intro-u2").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v34_E6.html?*")
 assert page.locator("#e6-dev").is_visible()
 page.locator("#btn-inventory").click()
 page.locator("[data-key]").first.fill("10")
 page.locator("#save-inventory").click()
 page.locator("[data-key]").first.fill("23")
 page.locator("#save-inventory").click()
 assert page.locator(".u2-transfer").is_visible()
 # One click switches stage AND goes to the appropriate page (no browser Back).
 page.locator("#e6-dev [data-e6-stage='start']").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v34_E6.html?*")
 assert page.locator("#e6-current").inner_text().startswith("現在：イベント開始")
 assert page.locator("#e3-next").inner_text()=="7日間の作戦を提案"
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(d)=>d.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 # PREP rewind after adoption must never show the saved current plan as a prep-week plan.
 page.locator("#e6-dev [data-e6-stage='prep']").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v34_E6.html?*")
 assert page.locator("#e6-current").inner_text().startswith("現在：準備週")
 page.locator("#e6-dev [data-e6-page='u3']").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v34_E6.html?*")
 assert page.locator("#phase-intro").is_visible()
 assert page.locator("#week-content").is_hidden(),"A future adopted plan appeared in simulated prep week."
 assert page.locator(".sleep-settings").is_hidden()
 assert page.locator("#e3-primary").is_hidden()
 # In-event switch shows saved week again, with Wednesday selected.
 page.locator("#e6-dev [data-e6-stage='during']").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v34_E6.html?*")
 assert page.locator("#e6-current").inner_text().startswith("現在：イベント中")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#day-label").inner_text()=="水曜日"
 assert page.locator("#slots>.slot").count()==4
 # U2↔U3 direct dev links keep test stage and do not require going back to launcher.
 page.locator("#e6-dev [data-e6-page='u2']").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v34_E6.html?*")
 assert page.locator("#e6-current").inner_text().startswith("現在：イベント中")
 page.locator("#e6-dev [data-e6-page='u3']").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v34_E6.html?*")
 assert page.locator("#week-content").is_visible()
 # Explicit reset must clear test-week selection and plan through both file origins.
 page.on("dialog",lambda dialog:dialog.accept())
 page.locator("#e6-dev #e6-reset").click()
 page.wait_for_function("""()=>document.querySelector('#e3-next')?.textContent==='イベントを選択' &&
 !new URL(location.href).searchParams.has('e6Reset')""",timeout=15000)
 assert page.locator("#week-content").is_hidden()
 assert page.locator("#e6-current").inner_text().startswith("現在：準備週")
 assert not errors,errors
 print("PASS E6 v34: in-page stage/page switches, prep hides future adopted plan, dated event stock, explicit reset, Android-like 393px.")
 ctx.close();browser.close()

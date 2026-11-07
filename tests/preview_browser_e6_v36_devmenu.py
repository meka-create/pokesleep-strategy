"""E6 v36: developer datetime buttons stay on current footer tab, with data safely retained."""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261107_v36_E6.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261107_v36_E6.html").resolve().as_uri()
U4=(ROOT/"U4_Box_Preview_20261107_v36_E6.html").resolve().as_uri()
WEEK="2026-11-09"
errors=[]
def clock(page):
 return parse_qs(urlsplit(page.url).query).get('previewNow',[""])[0]
def switch(page,stage,value,filename):
 assert page.locator("#e6-dev").count()==1
 assert page.locator("#e6-dev [data-e6-page]").count()==0
 if not page.locator("#e6-dev").evaluate("(e)=>e.open"):
  page.locator("#e6-dev > summary").click()
 assert page.locator("#e6-dev").evaluate("(e)=>e.open")
 old_url=page.url
 page.locator("#e6-dev [data-e6-stage='"+stage+"']").click()
 page.wait_for_function("(clock)=>new URL(location.href).searchParams.get('previewNow')===clock",arg=value)
 page.wait_for_load_state("domcontentloaded")
 assert page.url.split("?")[0].endswith(filename),(old_url,page.url)
 assert clock(page)==value
 assert page.locator("#e6-dev [data-e6-stage='"+stage+"']").get_attribute("aria-pressed")=="true"
 assert page.locator('#e6-dev [data-e6-stage="prep"]').count()==1
 assert page.locator('#e6-dev [data-e6-stage="start"]').count()==1
 assert page.locator('#e6-dev [data-e6-stage="during"]').count()==1
with sync_playwright() as pw:
 browser= pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=ctx.new_page()
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(U3+"?previewNow=2026-11-08T16:00&eventStart="+WEEK,wait_until="domcontentloaded")
 assert page.locator("#e6-dev").evaluate("(e)=>!e.open")
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#e6-footer-plan").get_attribute("aria-current")=="page"
 assert page.locator("#e6-dev [data-e6-page]").count()==0
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{for(const [id,value] of [['event-field','シアンの砂浜'],['event-food','curry']]){
  const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}}""")
 page.locator("#event-save").click()
 page.locator("#e6-footer-prep").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v36_E6.html?*")
 assert page.locator("#e6-footer-prep").get_attribute("aria-current")=="page"
 page.locator("#btn-inventory").click()
 page.locator("[data-key]").first.fill("23")
 page.locator("#save-inventory").click()
 assert "食材在庫を保存しました" in page.locator("#ui-toast").inner_text()
 # Switching a stage on U2 stays on U2, even when event begins.
 switch(page,"start","2026-11-09T06:00","U2_Prep_Local_Ingredients_20261107_v36_E6.html")
 assert page.locator("#e6-footer-prep").get_attribute("aria-current")=="page"
 switch(page,"during","2026-11-11T15:00","U2_Prep_Local_Ingredients_20261107_v36_E6.html")
 # Footer alone changes the page; date selection is retained.
 page.locator("#e6-footer-plan").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v36_E6.html?*")
 assert clock(page)=="2026-11-11T15:00"
 assert page.locator("#e3-next").inner_text()=="7日間の作戦を提案"
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert page.locator("#day-label").inner_text()=="水曜日"
 # Clock goes back without switching from U3 to U2 or erasing plan.
 switch(page,"prep","2026-11-08T16:00","U3_Strategy_UI_20261107_v36_E6.html")
 assert page.locator("#e6-footer-plan").get_attribute("aria-current")=="page"
 assert page.locator("#week-content").is_hidden()
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 switch(page,"start","2026-11-09T06:00","U3_Strategy_UI_20261107_v36_E6.html")
 assert page.locator("#week-content").is_visible()
 switch(page,"during","2026-11-11T15:00","U3_Strategy_UI_20261107_v36_E6.html")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#slots>.slot").count()==4
 # Box remains an honest placeholder; footer still navigates.
 page.locator("#e6-footer-box").click()
 page.wait_for_url("**/U4_Box_Preview_20261107_v36_E6.html?*")
 assert page.locator('#e6-footer a[aria-current="page"]').count()==1
 page.locator("#e6-footer-plan").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v36_E6.html?*")
 assert page.locator("#week-content").is_visible()
 assert clock(page)=="2026-11-11T15:00"
 # Explicit reset can still clear the test scenario.
 page.on("dialog",lambda dialog: dialog.accept())
 page.locator("#e6-dev > summary").click()
 page.locator("#e6-reset").click()
 page.wait_for_function("""()=>document.querySelector('#e3-primary')!==null &&
 new URL(location.href).searchParams.get('previewNow')==='2026-11-08T16:00' &&
 !new URL(location.href).searchParams.has('e6Reset') &&
 document.querySelector('#event-start')?.value!==null""",timeout=15000)
 assert page.url.split("?")[0].endswith("U3_Strategy_UI_20261107_v36_E6.html")
 assert page.locator("#week-content").is_hidden()
 assert not errors, errors
 print("PASS E6 v36: dev menu 3 clocks only; same-tab switches on U2 and U3; footer-only page navigation; adopted plan kept; reset.")
 ctx.close()
 browser.close()

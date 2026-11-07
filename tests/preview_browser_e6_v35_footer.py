"""E6 v35: footer navigation, prep form, U2/U3 real state roundtrip, clear E7 placeholder."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261107_v35_E6.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261107_v35_E6.html").resolve().as_uri()
U4=(ROOT/"U4_Box_Preview_20261107_v35_E6.html").resolve().as_uri()
WEEK="2026-11-09"
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(timezone_id="Asia/Tokyo",viewport={"width":393,"height":852})
 page=ctx.new_page()
 page.on("pageerror",lambda exc:errors.append(str(exc)))
 page.goto(U3+"?previewNow=2026-11-08T16:00&eventStart=2026-11-09",wait_until="domcontentloaded")
 assert page.locator("#e3-primary").is_hidden(),"An explicit 'select event' button must not be shown in prep."
 assert page.locator("#event-details").evaluate("(e)=>e.open"),"Event conditions must open in prep."
 assert page.locator("#phase-intro-u2").is_hidden(),"Old duplicate prep link must be hidden."
 assert page.locator("#e6-footer a").count()==3
 assert page.locator("#e6-footer-plan").get_attribute("aria-current")=="page"
 assert page.locator("#e6-dev").evaluate("(e)=>!e.open"),"Development controls should not dominate primary UX."
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{for(const [id,value] of [['event-field','シアンの砂浜'],['event-food','curry']]){
 const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}}""")
 page.locator("#event-save").click()
 assert page.locator("#event-details").evaluate("(e)=>e.open"),"Conditions must be immediately visible in prep."
 page.locator("#e6-footer-prep").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v35_E6.html?*")
 assert page.locator("#e6-footer-prep").get_attribute("aria-current")=="page"
 assert page.locator(".u2-transfer").is_hidden(),"Redundant U2 return button should not show when footer exists."
 page.locator("#btn-inventory").click()
 page.locator("[data-key]").first.fill("10")
 page.locator("#save-inventory").click()
 assert "食材在庫を保存しました" in page.locator("#ui-toast").inner_text()
 page.locator("#e6-footer-plan").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v35_E6.html?*")
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 assert page.locator("#week-content").is_hidden()
 # Development switch remains accessible, but only if explicitly opened.
 page.locator("#e6-dev > summary").click()
 page.locator("#e6-dev [data-e6-stage='start']").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v35_E6.html?*")
 assert page.locator("#e3-next").inner_text()=="7日間の作戦を提案"
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e6-footer-plan").get_attribute("aria-current")=="page"
 # "Box" is actually clickable but cannot falsely imply actual U4 is connected.
 page.locator("#e6-footer-box").click()
 page.wait_for_url("**/U4_Box_Preview_20261107_v35_E6.html?*")
 assert page.locator("#e6-footer-box").get_attribute("aria-current")=="page"
 assert page.locator("main").get_by_text("個体管理はまだ実装していません。",exact=False).is_visible()
 assert page.locator('#e6-footer a[aria-current="page"]').count()==1
 page.locator("#e6-footer-plan").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v35_E6.html?*")
 assert page.locator("#week-content").is_visible(),"Navigation via Box lost adopted plan."
 # Prep rewind after adopted plan: older future plan must stay hidden, no cache illusion.
 page.locator("#e6-dev > summary").click()
 page.locator("#e6-dev [data-e6-stage='prep']").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v35_E6.html?*")
 page.locator("#e6-footer-plan").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v35_E6.html?*")
 assert page.locator("#week-content").is_hidden(),"Future adopted plan reappeared on prep week."
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 assert page.locator("#e6-footer-plan").get_attribute("aria-current")=="page"
 # Switching back to event week restores adopted data.
 page.locator("#e6-dev > summary").click()
 page.locator("#e6-dev [data-e6-stage='during']").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v35_E6.html?*")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#day-label").inner_text()=="水曜日"
 assert page.locator("#slots>.slot").count()==4
 for width in [320,360,393,430]:
  page.set_viewport_size({"width":width,"height":852})
  metrics=page.evaluate("""()=>({w:innerWidth,doc:document.documentElement.scrollWidth,
    foot:document.querySelector('#e6-footer').getBoundingClientRect().width,
    button:[...document.querySelectorAll('#e6-footer a')].every(x=>x.getBoundingClientRect().height>=44)})""")
  assert metrics["doc"]<=metrics["w"]+1,metrics
  assert metrics["foot"]<=metrics["w"]+1 and metrics["button"],metrics
 assert not errors,errors
 print("PASS E6 v35: prep conditions exposed, select CTA removed, U2/U3 footer stock roundtrip, U4 placeholder honest, adopted persistence, 4 mobile widths.")
 ctx.close();browser.close()

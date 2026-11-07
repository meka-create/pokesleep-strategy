"""E6 v37: immediate prep conditions, no fetch/apply, camp defaults ON, honest bonus, food prep semantics, legacy preservation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261107_v37_E6.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261107_v37_E6.html").resolve().as_uri()
U4=(ROOT/"U4_Box_Preview_20261107_v37_E6.html").resolve().as_uri()
OLD=(ROOT/"U3_Strategy_UI_20261107_v36_E6.html").resolve().as_uri()
WEEK="2026-11-09"
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=ctx.new_page()
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(U3+"?previewNow=2026-11-08T16:00&eventStart="+WEEK,wait_until="domcontentloaded")
 # Prep cannot hide the sole event-conditions form.
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 assert page.locator("#event-details>summary").evaluate("(e)=>getComputedStyle(e).display")=="none"
 assert page.locator(".e6-conditions-label").is_visible()
 assert page.locator("#event-source-fetch").count()==0
 assert page.locator("#event-source-apply").count()==0
 assert page.locator("#event-source-select").count()==0
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#e6-bonus-status").inner_text()=="未確認"
 assert page.locator("#e6-bonus-value").inner_text()=="補正情報なし"
 assert page.locator("#event-camp").get_attribute("aria-checked")=="true","First-time default must be ON."
 assert page.locator("#event-food").input_value()=="","Unknown meal type is permitted until confirmed."
 assert page.locator(".e6-stock-categories span").all_inner_texts()==["カレー","サラダ","デザート"]
 assert "3カテゴリ" in page.locator("#e6-stock-message").inner_text()
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{const el=document.getElementById('event-field');el.value='シアンの砂浜';
 el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-save").click()
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 assert page.locator("#event-camp").get_attribute("aria-checked")=="true"
 # Footer navigation must not lose unconfirmed meal / default ON.
 page.locator("#e6-footer-prep").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v37_E6.html?*")
 assert page.locator("#e6-footer-prep").get_attribute("aria-current")=="page"
 page.locator("#e6-footer-plan").click()
 page.wait_for_url("**/U3_Strategy_UI_20261107_v37_E6.html?*")
 assert page.locator("#event-camp").get_attribute("aria-checked")=="true"
 assert page.locator("#event-food").input_value()==""
 # Existing explicit OFF is not overwritten by the new ON default.
 page.evaluate("""()=>{const el=document.getElementById('event-food');el.value='curry';
 el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-camp").click()
 assert page.locator("#event-camp").get_attribute("aria-checked")=="false"
 page.locator("#event-save").click()
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#event-camp").get_attribute("aria-checked")=="false","Previously saved OFF must remain OFF."
 assert page.locator("#event-food").input_value()=="curry"
 assert page.locator("#event-details").evaluate("(e)=>e.open")
 # Distinct old event source with saved bonus must survive removal of demo fetch UI.
 legacy=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 p=legacy.new_page();p.on("pageerror",lambda e:errors.append(str(e)))
 p.goto(OLD+"?previewNow=2026-11-08T16:00",wait_until="domcontentloaded")
 p.locator("#event-source-fetch").click()
 p.evaluate("""()=>{const el=document.getElementById('event-source-select');
 el.value='meal-prep-20261109';el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 p.locator("#event-source-apply").click()
 p.evaluate("""()=>{for(const [id,value] of [['event-field','シアンの砂浜'],['event-food','curry']]){
 const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}}""")
 p.locator("#event-save").click()
 assert p.locator("#event-start").input_value()==WEEK
 p.goto(U3+"?previewNow=2026-11-08T16:00&eventStart="+WEEK,wait_until="domcontentloaded")
 assert p.locator("#e6-bonus-value").inner_text()=="料理エナジー ×1.25"
 assert p.locator("#e6-bonus-status").inner_text()=="保存済み"
 assert p.locator("#event-source-fetch").count()==0
 assert p.locator("#event-camp").get_attribute("aria-checked")=="false","Legacy explicit OFF must remain."
 for width in (320,360,393,430):
  page.set_viewport_size({"width":width,"height":852})
  info=page.evaluate("""()=>({w:innerWidth,scroll:document.documentElement.scrollWidth})""")
  assert info["scroll"]<=info["w"]+1,info
 assert not errors,errors
 print("PASS E6 v37: no fetch/apply controls; expanded non-collapsible prep; bonus prominent; camp ON default/off persistence; unknown meal safe; legacy source preserved.")
 legacy.close();ctx.close();browser.close()

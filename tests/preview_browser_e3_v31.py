"""E3 real click-through in offline Chromium. Demo energy remains intentionally unverified."""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U3=(ROOT/"U3_Strategy_UI_20261105_v31.html").resolve().as_uri()
U2=(ROOT/"U2_Prep_Local_Ingredients_20261105_v31.html").resolve().as_uri()
WEEK="2026-11-09"
NOW="2026-11-11T15:00"
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=ctx.new_page()
 page.on("pageerror",lambda error:errors.append(str(error)))
 page.goto(U3+"?previewNow="+NOW,wait_until="domcontentloaded")
 assert page.locator("#e3-next").inner_text()=="イベントを選択"
 assert page.locator("#week-content").is_hidden()
 assert page.locator("#generate").is_hidden() or page.locator(".plan-actions").is_hidden()
 assert page.locator("#event-start").input_value()==""  # A demo Monday is not selected.
 page.locator("#e3-next").click()
 assert page.locator("#event-details").get_attribute("open") is not None
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{
  for (const [id,value] of [['event-field','シアンの砂浜'],['event-food','curry']]){
   const el=document.getElementById(id);el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }""")
 page.locator("#event-save").click()
 assert page.locator("#e3-next").inner_text()=="食材在庫を登録",page.locator("#e3-next").inner_text()
 info=page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected'))""")
 assert info=={"weekStart":WEEK,"id":"manual:"+WEEK},info
 assert not page.locator("#week-content").is_visible()
 # Click through to U2 and explicitly save all-zero inventory.
 page.locator("#e3-next").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261105_v31.html?*")
 assert page.locator("#inventory-panel").is_visible()
 assert "eventId" in parse_qs(urlsplit(page.url).query)
 page.locator("#save-inventory").click()
 assert "食材在庫を保存しました" in page.locator("#ui-toast").inner_text()
 event=page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u2-e2-v1:2026-11-09:timeline'))""")
 assert event["eventId"]=="manual:"+WEEK
 assert event["currentInventory"] is not None
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261105_v31.html?*")
 assert page.locator("#e3-next").inner_text()=="7日間の作戦を提案",page.locator("#e3-next").inner_text()
 assert page.locator("#event-details").count()==1
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(x)=>x.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert page.locator("#day-label").inner_text()=="水曜日"
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#e3-update-stock").is_visible()
 # A refresh must preserve the adopted plan; no repeated proposal action.
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-primary").is_hidden()
 # Updating inventory must not silently replace the adopted team.
 before=page.locator("#slots").inner_text()
 page.locator("#e3-update-stock").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261105_v31.html?*")
 page.locator("[data-key]").first.fill("11")
 page.locator("#save-inventory").click()
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261105_v31.html?*")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#slots").inner_text()==before
 assert page.locator("#e3-next").inner_text()=="残り期間を再提案",page.locator("#e3-next").inner_text()
 assert not errors,errors
 print("PASS E3 v31 offline roundtrip: explicit selection, single CTA, zero stock, review/adopt, 04:00 day, unchanged plan before re-proposal.")
 # Corrupt E2 stock cannot be silently replaced by a valid-looking URL snapshot.
 page.evaluate("()=>localStorage.setItem('pokesleep-strategy-u2-e2-v1:2026-11-09:timeline','{broken')")
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-next").inner_text()=="食材在庫を登録"
 assert not errors,errors
 ctx.close()
 # Fresh context: old week-only localStorage never selects an event, and unknown EX stays locked.
 ctx=browser.new_context(viewport={"width":360,"height":800},timezone_id="Asia/Tokyo")
 page=ctx.new_page()
 page.on("pageerror",lambda error:errors.append(str(error)))
 page.goto(U3+"?previewNow="+NOW,wait_until="domcontentloaded")
 page.evaluate("()=>localStorage.setItem('pokesleep-strategy-event-start-v2','2026-11-09')")
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#e3-next").inner_text()=="イベントを選択"
 page.locator("#e3-next").click()
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{
  for (const [id,value] of [['event-field','ワカクサ本島EX'],['event-food','curry']]){
   const el=document.getElementById(id);el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }""")
 page.locator("#event-save").click()
 assert page.locator("#e3-next").inner_text()=="イベント条件を設定"
 assert not page.locator("#week-content").is_visible()
 # Complete non-EX conditions become eligible for stock registration, never immediate adoption.
 page.locator("#e3-next").click()
 page.evaluate("""()=>{const el=document.getElementById('event-field');el.value='シアンの砂浜';
  el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-save").click()
 assert page.locator("#e3-next").inner_text()=="食材在庫を登録"
 assert not errors,errors
 ctx.close()
 print("PASS E3 v31 safeguards: no old implicit week, EX fail-closed, corrupted E2 stock blocks adoption.")
 browser.close()

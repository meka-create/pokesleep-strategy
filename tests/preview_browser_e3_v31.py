"""E3 v31 offline U3/U2 cross-page interaction regression (JST mock clock)."""
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, urlencode, urlunsplit, quote
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261104_v31.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261104_v31.html").resolve().as_uri()
WEEK="2026-11-09"
errors=[]
def clock_url(url,clock):
 p=urlsplit(url)
 args=parse_qs(p.query)
 args["previewNow"]=[clock]
 return urlunsplit((p.scheme,p.netloc,p.path,urlencode(args,doseq=True),""))
def set_select(page,field,value):
 page.locator(field).evaluate("""(node,value)=>{
  node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));
 }""",value)
def save(page):
 page.locator("#event-save").click()
 assert "保存" in page.locator("#ui-toast").inner_text(),page.locator("#ui-toast").inner_text()
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 context=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=context.new_page()
 page.on("pageerror",lambda err:errors.append(str(err)))
 page.goto(U3+"?eventStart="+WEEK+"&previewNow=2026-11-08T12:00",wait_until="domcontentloaded")
 assert page.locator("#e3-primary").inner_text()=="イベントを選択"
 assert page.locator("#week-content").is_hidden()
 assert not page.locator("#generate").is_visible()
 assert not page.locator("#repropose").is_visible()
 # Explicit manual event selection; URL week alone does NOT select it.
 page.locator("#e3-primary").click()
 page.locator("#event-manual-name").fill("E3検証イベントA")
 page.locator("#event-start").fill(WEEK)
 set_select(page,"#event-field","トープ洞窟")
 set_select(page,"#event-food","curry")
 save(page)
 chosen=page.url
 args=parse_qs(urlsplit(chosen).query)
 assert args["eventStart"]==[WEEK]
 event_id=args["eventId"][0]
 assert event_id.startswith("manual:")
 assert page.locator("#e3-primary").is_hidden(),page.locator("#e3-primary").inner_text()
 # Before Monday 04:00 no proposal is allowed even with confirmed conditions.
 page.goto(clock_url(chosen,"2026-11-09T04:01"),wait_until="domcontentloaded")
 assert page.locator("#e3-primary").inner_text()=="食材在庫を登録"
 page.locator("#e3-primary").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261104_v31.html?*")
 assert page.locator("#inventory-panel").is_visible()
 assert page.locator("#save-inventory").is_enabled()
 page.locator("#save-inventory").click() # all zero is a deliberate save
 assert "食材在庫を保存しました" in page.locator("#ui-toast").inner_text()
 assert page.locator(".u2-transfer").inner_text()=="作戦へ戻る"
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261104_v31.html?*")
 assert page.locator("#e3-primary").inner_text()=="7日間の作戦を提案",page.locator("#event-gate").inner_text()
 page.locator("#e3-primary").click()
 assert page.locator("#review-dialog").is_visible()
 assert "仮提案" in page.locator("#review-dialog").inner_text()
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator("#day-label").inner_text()=="月曜日"
 assert page.locator("#slots .slot").count()==4
 assert page.locator("#slots [data-slot='noon']").count()==1
 assert not page.locator("#slots [data-slot='noon'] button[aria-label*='編集']").count()
 # A new browser opening on Wednesday selects Wednesday, without a manual phase toggle.
 page.goto(clock_url(page.url,"2026-11-11T15:00"),wait_until="domcontentloaded")
 assert page.locator("#day-label").inner_text()=="水曜日"
 page.locator("#day-nav [role='tab']").nth(4).click()
 assert page.locator("#day-label").inner_text()=="金曜日"
 page.locator("#day-nav [role='tab']").nth(4).click()
 assert page.locator("#day-label").inner_text()=="金曜日"
 # U3 -> U2 midweek: update current stock, not start baseline.
 link=page.locator(".plan-actions>a.u2-nav").get_attribute("href")
 page.goto(link,wait_until="domcontentloaded")
 assert page.locator("#inventory-panel").is_visible()
 first=page.locator("[data-key]").first
 first.fill("37")
 page.locator("#save-inventory").click()
 stock_key=f"pokesleep-strategy-u2-e3-v1:{WEEK}:{quote(event_id,safe='')}:timeline"
 timeline=page.evaluate("(key)=>JSON.parse(localStorage.getItem(key))",stock_key)
 assert timeline["currentInventory"]["values"]["ふといながねぎ"]==37
 assert timeline["startInventory"] is None
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261104_v31.html?*")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-primary").inner_text()=="残り期間を再提案"
 page.locator("#e3-primary").click()
 assert page.locator("#review-dialog").is_visible()
 page.locator("#review-cancel").click()
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-primary").inner_text()=="残り期間を再提案"
 # Stored A cannot be borrowed by a different event ID in the SAME week.
 page.locator("#event-details > summary").click()
 page.locator("#event-manual-name").fill("E3検証イベントB")
 page.locator("#event-save").click()
 print("E3 switch diagnostic",{
  "toast":page.locator("#ui-toast").inner_text(),
  "url":page.url,
  "manual":page.locator("#event-manual-name").input_value(),
  "primary":page.locator("#e3-primary").inner_text(),
  "week_hidden":page.locator("#week-content").is_hidden(),
  "page_errors":errors,
 },flush=True)
 assert page.locator("#week-content").is_hidden()
 assert page.locator("#e3-primary").inner_text()=="イベント条件を設定"
 new_args=parse_qs(urlsplit(page.url).query)
 assert new_args["eventId"][0]!=event_id
 assert not errors,errors
 print("PASS E3 v31: explicit event; condition save; no pre-event proposal; event-scoped zero stock; adopted plan; weekday; midweek stock update; same-week event isolation.")
 context.close();browser.close()

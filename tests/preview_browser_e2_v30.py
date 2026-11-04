"""E2 browser workflows using the exact offline v30 files; all timestamps are JST."""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261104_v30.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261104_v30.html").resolve().as_uri()
WEEK="2026-11-09"
V4=f"pokesleep-strategy-u2-e2-v1:{WEEK}:timeline"
V3=f"pokesleep-strategy-u2-v3:{WEEK}:inventory"
def browse(page,clock="2026-11-08T12:00",extra=""):
 page.goto(U2+f"?eventStart={WEEK}&previewNow={clock}"+extra,wait_until="domcontentloaded")
def stock(page):
 return page.evaluate("(k)=>JSON.parse(localStorage.getItem(k)||'null')",V4)
def values(page,apple="0"):
 inputs=page.locator("[data-key]")
 assert inputs.count()==19
 inputs.first.fill(apple)
def click_save(page):
 page.locator("#save-inventory").click()
 assert "食材在庫を保存しました" in page.locator("#ui-toast").inner_text(),page.locator("#ui-toast").inner_text()
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=ctx.new_page();page.on("pageerror",lambda err:errors.append(str(err)))
 page.goto(U2,wait_until="domcontentloaded")
 assert page.locator("#u2-week-label").inner_text()=="未選択"
 assert page.locator("#save-inventory").is_disabled()
 assert page.locator("#goal-panel").is_visible()
 assert not page.locator(".u2-transfer").count()
 # Event week must be explicitly routed: never assume a past sample date.
 browse(page)
 assert page.locator("#goal-panel").is_visible()
 assert page.locator("#u2-week-label").inner_text()=="11/9週"
 assert page.locator(".u2-transfer").count()==0
 page.locator("#btn-inventory").click()
 assert page.locator("#inventory-panel").is_visible()
 assert page.locator("#goal-panel").is_hidden()
 values(page,"100")
 click_save(page)
 first=stock(page)
 assert first["version"]==2
 assert first["startInventory"]["values"]["ふといながねぎ"]==100
 assert first["currentInventory"]["values"]["ふといながねぎ"]==100
 assert page.evaluate("(k)=>localStorage.getItem(k)",V3)==None
 assert page.locator(".u2-transfer").inner_text()=="作戦へ"
 assert "提案" not in page.locator("#inventory-panel").inner_text()
 # Last correction before event, not first, must determine start snapshot.
 values(page,"150")
 click_save(page)
 updated=stock(page)
 assert updated["startInventory"]["values"]["ふといながねぎ"]==150
 assert updated["preparationLatest"]["values"]["ふといながねぎ"]==150
 assert updated["currentInventory"]["revision"]!=first["currentInventory"]["revision"]
 assert first["startInventory"]["values"]["ふといながねぎ"]==100
 # The target is U3 v30 and carries fully validated v29 compatible stock.
 url=page.locator(".u2-transfer").get_attribute("href")
 p=urlsplit(url);params=parse_qs(p.query)
 assert p.path.endswith("U3_Strategy_UI_20261104_v30.html")
 assert params["eventStart"]==[WEEK]
 assert params["previewNow"]==["2026-11-08T12:00"]
 assert len(params["pokesleepStock"][0])<10000
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261104_v30.html?*")
 assert page.locator("#stock-gate").is_hidden(),page.locator("#stock-gate").inner_text()
 assert not errors,errors
 # Navigation back into inventory from an active U3 plan preserves same week/clock.
 page.goto(U3+"?eventStart="+WEEK+"&previewNow=2026-11-11T15:00",wait_until="domcontentloaded")
 back=page.locator(".u2-nav").first.get_attribute("href")
 parms=parse_qs(urlsplit(back).query)
 assert back.split("?")[0].endswith("U2_Prep_Local_Ingredients_20261104_v30.html")
 assert parms["return"]==["plan"]
 assert parms["tab"]==["inventory"]
 assert parms["previewNow"]==["2026-11-11T15:00"]
 page.goto(back,wait_until="domcontentloaded")
 assert page.locator("#inventory-panel").is_visible()
 assert page.locator("#goal-panel").is_hidden()
 assert page.locator(".u2-transfer").inner_text()=="作戦へ戻る"
 values(page,"220")
 click_save(page)
 during=stock(page)
 assert during["currentInventory"]["values"]["ふといながねぎ"]==220
 assert during["startInventory"]["values"]["ふといながねぎ"]==150
 assert during["preparationLatest"]["values"]["ふといながねぎ"]==150
 assert during["currentInventory"]["revision"]!=updated["currentInventory"]["revision"]
 assert page.locator(".u2-transfer").inner_text()=="作戦へ戻る"
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#inventory-panel").is_visible()
 assert page.locator("[data-key]").first.input_value()=="220"
 assert page.locator(".u2-transfer").is_visible()
 # Stale invalid or oversized quantity must not mutate persisted state.
 page.locator("[data-key]").first.fill("-1")
 page.locator("#save-inventory").click()
 assert stock(page)==during
 page.locator("[data-key]").first.fill("0")
 # Zero is a deliberate saved count, not an unsaved input.
 click_save(page)
 zero=stock(page)
 assert zero["currentInventory"]["values"]["ふといながねぎ"]==0
 assert zero["startInventory"]["values"]["ふといながねぎ"]==150
 # A different event week must not borrow an earlier plan/stock record.
 page.goto(U2+"?eventStart=2026-11-16&previewNow=2026-11-18T15:00&tab=inventory",wait_until="domcontentloaded")
 assert page.locator("#inventory-panel").is_visible()
 assert page.locator("[data-key]").first.input_value()=="0"
 assert not page.locator(".u2-transfer").count()
 # Ended event is read-only.
 browse(page,"2026-11-16T04:00")
 assert page.locator("#save-inventory").is_disabled()
 assert "終了" in page.locator("#preview-result").inner_text()
 # Corrupt E2 data must be kept intact and block overwrite, no legacy fallback.
 browse(page,"2026-11-11T15:00","&tab=inventory")
 page.evaluate("([k,v])=>localStorage.setItem(k,v)",[V4,'{invalid-json'])
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#save-inventory").is_disabled()
 assert "上書きせず" in page.locator("#error").inner_text()
 assert page.evaluate("(k)=>localStorage.getItem(k)",V4)=='{invalid-json'
 # A legacy demo week in shared old state must NOT become an explicitly selected event.
 page.evaluate("()=>localStorage.setItem('pokesleep-strategy-event-start-v2','2026-11-09')")
 page.goto(U2,wait_until="domcontentloaded")
 assert page.locator("#u2-week-label").inner_text()=="未選択"
 assert page.locator("#save-inventory").is_disabled()
 assert not errors,errors
 print("PASS E2 v30: no implicit event; 19 ingredient UI; latest preweek baseline; event stock updates; U3 return; valid URL transfer; corrupt-storage fail-closed.")
 ctx.close()
 # Separate isolated browser context: prove old v3 is read without mutating and save creates independent E2 record.
 ctx=browser.new_context(viewport={"width":360,"height":800},timezone_id="Asia/Tokyo")
 page=ctx.new_page();page.on("pageerror",lambda err:errors.append(str(err)))
 browse(page)
 oldValues=page.evaluate("""()=>{
  const names=[...document.querySelectorAll('#inventory-panel .food .name')].map(x=>x.textContent.trim());
  return Object.fromEntries(names.map(k=>[k,0]));}""")
 oldValues["ふといながねぎ"]=81
 old={"version":3,"weekStart":WEEK,"source":"inventory","savedAt":"2026-11-08T10:00:00+09:00",
      "initialValues":{**oldValues,"ふといながねぎ":21},"values":oldValues}
 import json
 oldText=json.dumps(old,ensure_ascii=False)
 page.evaluate("([k,v])=>localStorage.setItem(k,v)",[V3,oldText])
 page.reload(wait_until="domcontentloaded")
 assert page.locator("[data-key]").first.input_value()=="81"
 assert stock(page)==None
 assert page.evaluate("(k)=>localStorage.getItem(k)",V3)==oldText
 page.locator("#btn-inventory").click()
 values(page,"96")
 click_save(page)
 assert stock(page)["startInventory"]["values"]["ふといながねぎ"]==96
 assert page.evaluate("(k)=>localStorage.getItem(k)",V3)==oldText
 # Storage write failures must never claim success or corrupt the last committed snapshot.
 original=stock(page)
 page.evaluate("""()=>{Storage.prototype.__e2Original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   if(key.startsWith('pokesleep-strategy-u2-e2-v1:'))throw new DOMException('Quota','QuotaExceededError');
   return Storage.prototype.__e2Original.call(this,key,value);
  };}""")
 page.locator("[data-key]").first.fill("97")
 page.locator("#save-inventory").click()
 assert "保存できませんでした" in page.locator("#ui-toast").inner_text()
 assert stock(page)==original
 page.evaluate("""()=>{Storage.prototype.setItem=Storage.prototype.__e2Original;
  delete Storage.prototype.__e2Original;}""")
 assert not errors,errors
 print("PASS E2 v30: legacy v3 read-only, first-save initialValues ignored, explicit v2 timeline commit, storage-failure rollback.")
 ctx.close();browser.close()

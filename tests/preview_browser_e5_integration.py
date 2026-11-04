"""E5 independent end-to-end audit of E4's U2⇄U3 journey.
All sample clocks are Asia/Tokyo game times. This script treats data loss as a failure.
"""
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/"previews"
U2=(ROOT/"U2_Prep_Local_Ingredients_20261105_v33.html").resolve().as_uri()
U3=(ROOT/"U3_Strategy_UI_20261105_v33.html").resolve().as_uri()
WEEK="2026-11-09"
ID="manual:"+WEEK
KSTOCK=f"pokesleep-strategy-u2-e2-v1:{WEEK}:timeline"
def url(clock):
 return U3+"?previewNow="+clock
def chosen_state(page):
 return page.evaluate("""()=>{
   const s=JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')||'null');
   if(!s)return null;
   const k='pokesleep-strategy-u3-e3-v1:'+s.weekStart+':'+encodeURIComponent(s.id)+':plan';
   return JSON.parse(localStorage.getItem(k)||'null');
 }""")
def choose_event(page):
 assert page.locator("#e3-next").inner_text()=="イベントを選択"
 page.locator("#e3-next").click()
 page.locator("#event-start").fill(WEEK)
 page.evaluate("""()=>{
  for(const [id,value] of [['event-field','シアンの砂浜'],['event-food','curry']]){
   const e=document.getElementById(id);e.value=value;
   e.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }""")
 page.locator("#event-save").click()
 # Before start the preparation-link is primary; after start the stock CTA is primary.
 if page.locator("#phase-intro-u2").is_visible():
  assert page.locator("#e3-primary").is_hidden()
 else:
  assert page.locator("#e3-next").inner_text()=="食材在庫を登録"
def save_u2(page,count):
 page.locator("[data-key]").first.fill(str(count))
 page.locator("#save-inventory").click()
 assert "食材在庫を保存しました" in page.locator("#ui-toast").inner_text(),page.locator("#ui-toast").inner_text()
def adopt(page):
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
def assert_narrow(page):
 for width in [320,360,393,430]:
  page.set_viewport_size({"width":width,"height":852})
  values=page.evaluate("""()=>({scroll:document.documentElement.scrollWidth,
      width:window.innerWidth,week:document.querySelector('#week-content')?.getBoundingClientRect().width})""")
  assert values["scroll"]<=values["width"]+1,values
 page.set_viewport_size({"width":393,"height":852})
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 # A: preparation week -> final corrected baseline -> during-event proposal.
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=ctx.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(url("2026-11-08T16:00"),wait_until="domcontentloaded")
 choose_event(page)
 assert page.locator("#phase-intro-u2").is_visible()
 page.locator("#phase-intro-u2").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261105_v33.html?*")
 assert page.locator("#u2-week-label").inner_text()=="11/9週"
 page.locator("#btn-inventory").click()
 save_u2(page,10)
 baseline1=page.evaluate("(k)=>JSON.parse(localStorage.getItem(k))",KSTOCK)
 save_u2(page,23)
 baseline2=page.evaluate("(k)=>JSON.parse(localStorage.getItem(k))",KSTOCK)
 assert baseline1["startInventory"]["values"]["ふといながねぎ"]==10
 assert baseline2["startInventory"]["values"]["ふといながねぎ"]==23
 assert baseline2["startInventory"]["revision"]!=baseline1["startInventory"]["revision"]
 assert baseline2["currentInventory"]["values"]==baseline2["startInventory"]["values"]
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261105_v33.html?*")
 assert page.locator("#week-content").is_hidden()
 assert page.locator("#e3-primary").is_hidden(),"Pre-event week must not propose prematurely."
 assert page.locator("#event-details").count()==1
 page.goto(url("2026-11-11T15:00"),wait_until="domcontentloaded")
 assert page.locator("#e3-next").inner_text()=="7日間の作戦を提案"
 # A1: storage failure while making a draft must not open a nonpersistent review.
 page.evaluate("""()=>{Storage.prototype.__e5original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
   if(k.startsWith('pokesleep-strategy-u3-e3-v1:')&&k.endsWith(':plan'))
    throw new DOMException('Quota exceeded','QuotaExceededError');
   return Storage.prototype.__e5original.call(this,k,v);
  };}""")
 page.locator("#e3-next").click()
 assert not page.locator("#review-dialog").evaluate("(e)=>e.open")
 assert chosen_state(page)["draft"] is None
 assert "保存できません" in page.locator("#ui-toast").inner_text()
 page.evaluate("""()=>{Storage.prototype.setItem=Storage.prototype.__e5original;
  delete Storage.prototype.__e5original;}""")
 # B: An unadopted saved draft must remain accessible on reload for review/adoption.
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 staged=chosen_state(page)
 assert staged["draft"] and not staged["hasApplied"]
 page.reload(wait_until="domcontentloaded")
 assert chosen_state(page)["draft"]==staged["draft"],"Reload lost saved review draft."
 assert page.locator("#e3-next").inner_text()=="未採用の提案を確認",(
   "Saved pending review must be reachable, not silently replaced by a new proposal.")
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 assert chosen_state(page)["hasApplied"]
 assert page.locator("#day-label").inner_text()=="水曜日"
 assert page.locator("#slots>.slot").count()==4
 assert page.locator("#e3-primary").is_hidden()
 # Unsaved controls are not eligible to re-propose: Save Conditions is the sole action.
 page.evaluate("""()=>{const e=document.getElementById('event-food');
  e.value='salad';e.dispatchEvent(new Event('change',{bubbles:true}));}""")
 observed=page.evaluate("""()=>{
  const select=document.getElementById('event-food');
  const btn=document.getElementById('e3-next');
  const ledger=JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:2026-11-09:manual%3A2026-11-09:conditions')||'null');
  return {food:select.value,button:btn.textContent,action:btn.dataset.action,
   visible:!btn.hidden,confirmedFood:ledger?.confirmed?.fields?.food,
   currentPhase:document.querySelector('main')?.dataset.phaseStage};
 }""")
 assert observed["action"]=="SET_EVENT" and observed["visible"],observed
 assert page.locator("#e3-next").inner_text()=="イベント条件を設定",observed
 page.evaluate("""()=>{const e=document.getElementById('event-food');
  e.value='curry';e.dispatchEvent(new Event('change',{bubbles:true}));}""")
 assert page.locator("#e3-primary").is_hidden()
 assert_narrow(page)
 # C0: failed storage for manual night editing and automatic toggle must roll back.
 sleep_before=chosen_state(page)["manualSleep"]
 page.locator("#sleep-open").click()
 page.locator("#sleep-change").click()
 assert page.locator("#edit-dialog").evaluate("(x)=>x.open")
 page.locator("#pick-grid .pick-select[aria-pressed='true']").first.click()
 page.locator("#pick-grid .pick-select[aria-pressed='false']:not(:disabled)").last.click()
 page.evaluate("""()=>{Storage.prototype.__e5original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
   if(k.startsWith('pokesleep-strategy-u3-e3-v1:')&&k.endsWith(':plan'))
    throw new DOMException('Quota exceeded','QuotaExceededError');
   return Storage.prototype.__e5original.call(this,k,v);
  };}""")
 page.locator("#edit-save").click()
 assert page.locator("#edit-dialog").evaluate("(x)=>x.open")
 assert "保存できません" in page.locator("#edit-error").inner_text()
 assert chosen_state(page)["manualSleep"]==sleep_before
 page.locator("#edit-cancel").click()
 page.locator("#sleep-close").click()
 assert page.locator("#auto-sleep").get_attribute("aria-checked")=="false"
 page.locator("#auto-sleep").click()
 assert page.locator("#auto-sleep").get_attribute("aria-checked")=="false"
 assert "保存できません" in page.locator("#ui-toast").inner_text()
 assert chosen_state(page)["manualSleep"]==sleep_before
 page.evaluate("""()=>{Storage.prototype.setItem=Storage.prototype.__e5original;
  delete Storage.prototype.__e5original;}""")
 assert page.locator("#e3-primary").is_hidden()
 # C: updating U2 should preserve the adopted plan and protect Sunday baseline.
 prev=chosen_state(page)["applied"]
 page.locator("#e3-update-stock").click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261105_v33.html?*")
 save_u2(page,9)
 later=page.evaluate("(k)=>JSON.parse(localStorage.getItem(k))",KSTOCK)
 assert later["startInventory"]==baseline2["startInventory"]
 assert later["currentInventory"]["values"]["ふといながねぎ"]==9
 page.locator(".u2-transfer").click()
 page.wait_for_url("**/U3_Strategy_UI_20261105_v33.html?*")
 assert chosen_state(page)["applied"]==prev
 assert page.locator("#e3-next").inner_text()=="残り期間を再提案"
 # D: independent tab changes stock while review is open. Adoption must refuse stale draft.
 page.locator("#e3-next").click()
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 other=ctx.new_page();other.on("pageerror",lambda e:errors.append(str(e)))
 origin=page.locator("#e3-update-stock").get_attribute("href")
 other.goto(origin,wait_until="domcontentloaded")
 save_u2(other,15)
 page.locator("#review-adopt").click()
 assert chosen_state(page)["applied"]==prev
 assert page.locator("#review-dialog").evaluate("(e)=>e.open")
 assert ("更新" in page.locator("#ui-toast").inner_text() or
   "変更" in page.locator("#ui-toast").inner_text())
 page.locator("#review-close").click()
 assert page.locator("#e3-next").inner_text()=="残り期間を再提案"
 # E: a fresh retry with latest stock can adopt, past/current slots and meals unchanged.
 page.locator("#e3-next").click()
 page.locator("#review-adopt").click()
 updated=chosen_state(page)["applied"]
 assert updated!=prev
 for day in [0,1]:
  assert updated["days"][day]==prev["days"][day]
 for slot in ["morning","noon"]:
  assert updated["days"][2][slot]==prev["days"][2][slot]
 for i in [0,1]:
  assert updated["days"][2]["recipes"][i]==prev["days"][2]["recipes"][i]
 assert page.locator("#e3-primary").is_hidden()
 # F: exiting event is read-only and retain selected week's plan/stock.
 page.goto(url("2026-11-16T04:00"),wait_until="domcontentloaded")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#e3-primary").is_hidden()
 assert page.locator(".sleep-settings").is_hidden()
 assert page.locator("#event-save").is_disabled()
 assert chosen_state(page)["applied"]==updated
 assert not errors,errors
 print("PASS E5 core: Sunday final snapshot; protected proposal resume; U2/U3 event-week roundtrip; stale second-tab stock; future-only replan; finished read-only; mobile widths.")
 ctx.close()
 # G: old legacy data never autoselects; corrupted selected event fails closed.
 ctx=browser.new_context(viewport={"width":320,"height":760},timezone_id="Asia/Tokyo")
 page=ctx.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(url("2026-11-11T15:00"),wait_until="domcontentloaded")
 page.evaluate("""()=>{
  localStorage.setItem('pokesleep-strategy-event-start-v2','2026-11-09');
  localStorage.setItem('pokesleep-strategy-u3-e3-v1:selected','{bad-json');
 }""")
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#e3-next").inner_text()=="イベントを選択"
 assert page.locator("#week-content").is_hidden()
 assert not errors,errors
 print("PASS E5 fail-closed: legacy sample, corrupt selection, no implicit plan.")
 ctx.close();browser.close()

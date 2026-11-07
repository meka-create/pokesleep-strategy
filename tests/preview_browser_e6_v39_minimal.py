"""E6 v39: no finished events, per-event stockpile 3/2/1 choices, compact bonuses, Save-only commit."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]/"previews"
U3=(ROOT/"U3_Strategy_UI_20261107_v39_E6.html").resolve().as_uri()
U2=(ROOT/"U2_Prep_Local_Ingredients_20261107_v39_E6.html").resolve().as_uri()
FIX={"bonus":[
 {"name":"halloween 2026","start":"2026-10-26T04:00:00","end":"2026-11-02T04:00:00","effects":{"dish":1.5}},
 {"name":"meal prep week vol1","start":"2026-11-09T04:00:00","end":"2026-11-16T04:00:00","effects":{"dish":1.25}},
 {"name":"bountiful banquet week vol1","start":"2026-11-16T04:00:00","end":"2026-11-23T04:00:00","effects":{"skillTrigger":1.5,"dish":1.5}}
]}
def pick(page,event_id):
 page.evaluate("""id=>{const sel=document.getElementById('event-source-select');
 if(![...sel.options].some(e=>e.value===id))throw Error('No option '+id);
 sel.value=id;sel.dispatchEvent(new Event('change',{bubbles:true}));}""",event_id)
def select(page,id,value):
 page.evaluate("""([id,v])=>{const x=document.getElementById(id);x.value=v;
 x.dispatchEvent(new Event('change',{bubbles:true}));}""",[id,value])
def ls(page):
 return page.evaluate("""()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.includes('pokesleep-strategy')).sort().map(k=>[k,localStorage.getItem(k)]))""")
def stored_prep(page,event_name,start):
 return page.evaluate("""([id,week])=>{
  const key='pokesleep-strategy-u3-e3-v1:'+week+':'+encodeURIComponent(id)+':plan';
  return JSON.parse(localStorage.getItem(key)||'null')?.eventInfo?.prep??null;
 }""",[event_name,start])
def chosen(page):
 return page.locator('[data-stock-type][aria-pressed="true"]').evaluate_all("(xs)=>xs.map(x=>x.dataset.stockType)")
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 ctx.route("**/src/data/event.json",lambda r:r.fulfill(status=200,content_type="application/json",body=json.dumps(FIX)))
 p=ctx.new_page();p.on("pageerror",lambda e:errors.append(str(e)))
 p.goto(U3+"?previewNow=2026-11-08T16:00&eventStart=2026-11-09",wait_until="domcontentloaded")
 p.wait_for_function("document.querySelector('#event-source-select').options.length>=3")
 # Ended 11/02 Halloween must not be offered, as of JST 11/08. No acquisition chatter.
 opts=p.locator("#event-source-select option").evaluate_all("(xs)=>xs.map(x=>x.value)")
 assert len(opts)==3,opts
 assert not any('halloween' in x for x in opts),opts
 assert p.locator("#event-source-status").count()==0
 assert p.locator("#e6-bonus-status").count()==0
 assert p.locator("#e6-bonus-value").count()==0
 assert p.locator("#e6-bonus-source").count()==0
 assert p.locator("#e6-bonus-panel").is_hidden()
 assert p.locator("#e6-stock-types").is_hidden()
 assert not p.locator('[data-stock-count][aria-pressed="true"]').count(),"No imposed default stockpile strategy"
 assert p.locator("#event-details").evaluate("(e)=>e.open")
 # Select an event: bonus immediately updates, but no Save means no storage writes.
 before=ls(p)
 pick(p,"pokesleep-tool:meal prep week vol1:2026-11-09")
 assert p.locator("#e6-event-heading").inner_text()=="したごしらえウィーク vol.1"
 assert p.locator("#e6-bonus-list li").all_inner_texts()==["料理エナジー ×1.25"]
 assert "未保存" not in p.locator("#event-details").inner_text()
 assert "保存済み" not in p.locator("#event-details").inner_text()
 assert ls(p)==before
 # Mode 2 -> explicitly choose the 2 categories, and block partial selection.
 p.locator('[data-stock-count="2"]').click()
 assert p.locator("#e6-stock-types").is_visible()
 p.locator('[data-stock-type="curry"]').click()
 assert chosen(p)==["curry"]
 p.locator("#event-start").fill("2026-11-09")
 select(p,"event-field","シアンの砂浜")
 select(p,"event-food","curry")
 p.locator("#event-save").click()
 assert ls(p)==before,"Incomplete 2-of-3 stockpile choices must not be persisted"
 p.locator('[data-stock-type="dessert"]').click()
 assert chosen(p)==["curry","dessert"],chosen(p)
 p.locator("#event-save").click()
 selected=json.loads(ls(p)["pokesleep-strategy-u3-e3-v1:selected"])
 assert selected["id"]=="pokesleep-tool:meal prep week vol1:2026-11-09",selected
 assert stored_prep(p,selected["id"],"2026-11-09")=={"count":2,"categories":["curry","dessert"]}
 p.reload(wait_until="domcontentloaded")
 assert p.locator('[data-stock-count="2"]').get_attribute("aria-pressed")=="true"
 assert chosen(p)==["curry","dessert"]
 # Switch to second upcoming event; do NOT inherit event #1's stockpile setting.
 before=ls(p)
 pick(p,"pokesleep-tool:bountiful banquet week vol1:2026-11-16")
 assert not p.locator('[data-stock-count][aria-pressed="true"]').count()
 assert p.locator("#e6-event-heading").inner_text()=="なんでもペロリ！ごちそうウィーク vol.1"
 assert p.locator("#e6-bonus-list li").all_inner_texts()==["料理エナジー ×1.5","スキル発生率 ×1.5"] or sorted(p.locator("#e6-bonus-list li").all_inner_texts())==sorted(["料理エナジー ×1.5","スキル発生率 ×1.5"])
 assert ls(p)==before
 p.locator('[data-stock-count="1"]').click()
 p.locator('[data-stock-type="salad"]').click()
 assert chosen(p)==["salad"]
 select(p,"event-field","シアンの砂浜")
 select(p,"event-food","salad")
 p.locator("#event-save").click()
 new_id=json.loads(ls(p)["pokesleep-strategy-u3-e3-v1:selected"])["id"]
 assert new_id=="pokesleep-tool:bountiful banquet week vol1:2026-11-16"
 assert stored_prep(p,new_id,"2026-11-16")=={"count":1,"categories":["salad"]}
 p.reload(wait_until="domcontentloaded")
 assert p.locator('[data-stock-count="1"]').get_attribute("aria-pressed")=="true"
 assert chosen(p)==["salad"]
 # Switching back to the first event restores only its own two-category choice.
 pick(p,"pokesleep-tool:meal prep week vol1:2026-11-09")
 assert p.locator('[data-stock-count="2"]').get_attribute("aria-pressed")=="true"
 assert chosen(p)==["curry","dessert"]
 # Three categories means precisely all three without a default.
 p.locator('[data-stock-count="3"]').click()
 assert p.locator("#e6-stock-types").is_hidden()
 assert ls(p)["pokesleep-strategy-u3-e3-v1:selected"]==json.dumps({"id":new_id,"weekStart":"2026-11-16"},ensure_ascii=False,separators=(',',':')) or json.loads(ls(p)["pokesleep-strategy-u3-e3-v1:selected"])["id"]==new_id
 select(p,"event-field","シアンの砂浜")
 select(p,"event-food","curry")
 p.locator("#event-save").click()
 assert stored_prep(p,"pokesleep-tool:meal prep week vol1:2026-11-09","2026-11-09")=={"count":3,"categories":["curry","salad","dessert"]}
 # Exact game 04:00 cutoff, not just calendar date: after 11/16 04:00 the prep event disappears.
 p.goto(U3+"?previewNow=2026-11-16T04:01&eventStart=2026-11-16",wait_until="domcontentloaded")
 p.wait_for_function("document.querySelector('#event-source-select').options.length>1")
 opts=p.locator("#event-source-select option").evaluate_all("(xs)=>xs.map(x=>x.value)")
 assert "pokesleep-tool:meal prep week vol1:2026-11-09" not in opts,opts
 assert "pokesleep-tool:bountiful banquet week vol1:2026-11-16" in opts
 # Footer still transitions to the related v39 U2 file.
 p.locator("#e6-footer-prep").click()
 p.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v39_E6.html?*")
 assert p.locator("#e6-footer-prep").get_attribute("aria-current")=="page"
 # Offline fallback still honors the ended-event filter.
 off=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 off.route("**/src/data/event.json",lambda r:r.abort())
 q=off.new_page();q.on("pageerror",lambda e:errors.append(str(e)))
 q.goto(U3+"?previewNow=2026-11-08T16:00",wait_until="domcontentloaded")
 q.wait_for_function("document.querySelector('#event-source-select').options.length>=3")
 opt=q.locator("#event-source-select option").evaluate_all("(xs)=>xs.map(x=>x.value)")
 assert not any('halloween' in x for x in opt),opt
 for width in (320,360,393,430):
  q.set_viewport_size({"width":width,"height":852})
  dims=q.evaluate("()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})")
  assert dims["scroll"]<=dims["width"]+1,dims
 assert not errors,errors
 print("PASS E6 v39: hidden finished events at JST04:00; no extra status; bonus bullets; 3/2/1 explicit user choice; per-event Save only; offline fallback; footer & mobile sizes.")
 off.close();ctx.close();browser.close()

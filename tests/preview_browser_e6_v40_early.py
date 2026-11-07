"""E6 v40: confirmed conditions permit prestart strategy; all categories and EX remain separate."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/"previews"
U3=(root/"U3_Strategy_UI_20261107_v40_E6.html").resolve().as_uri()
U2=(root/"U2_Prep_Local_Ingredients_20261107_v40_E6.html").resolve().as_uri()
events={"bonus":[
 {"name":"meal prep week vol1","start":"2026-11-09T04:00:00","end":"2026-11-16T04:00:00","effects":{"dish":1.25}},
 {"name":"bountiful banquet week vol1","start":"2026-11-16T04:00:00","end":"2026-11-23T04:00:00","effects":{"extraIng":"nuts","carryLimitAdd":10}},
 {"name":"halloween 2026","start":"2026-11-23T04:00:00","end":"2026-11-30T04:00:00",
  "effects":{"fixedBerries":["fire",None,None],"dish":1.5}}
]}
def setval(p,id,val):
 p.evaluate("""([id,val])=>{const el=document.querySelector('#'+id);el.value=val;
 el.dispatchEvent(new Event('change',{bubbles:true}));}""",[id,val])
def event(p,name,week):
 id='pokesleep-tool:'+name+':'+week
 p.wait_for_function("""id=>[...document.getElementById('event-source-select').options].some(e=>e.value===id)""",arg=id)
 setval(p,'event-source-select',id)
def fillberries(p,ex=False):
 setval(p,'e6-berry-main','ほのお')
 setval(p,'e6-berry-sub1','みず')
 setval(p,'e6-berry-sub2','くさ')
 if ex:setval(p,'e6-ex-effect','skill')
def storage(p):
 return p.evaluate("""()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.includes('pokesleep-strategy')).sort().map(k=>[k,localStorage.getItem(k)]))""")
errs=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 ctx=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 ctx.route("**/src/data/event.json",lambda route:route.fulfill(status=200,content_type="application/json",body=json.dumps(events)))
 p=ctx.new_page()
 p.on("pageerror",lambda e:errs.append(str(e)))
 p.goto(U3+"?previewNow=2026-11-08T16:00&eventStart=2026-11-16",wait_until="domcontentloaded")
 event(p,'bountiful banquet week vol1','2026-11-16')
 assert p.locator('#event-start').input_value()=='2026-11-16'
 assert p.locator('#event-food').input_value()=='all',"11/16 source must auto-select all"
 assert 'すべての料理カテゴリで調理可能' in p.locator('#e6-bonus-list').inner_text()
 setval(p,'event-field','シアンの砂浜')
 assert p.locator('#e6-berry-settings').is_hidden(),"A fixed normal field with no berry override must not ask for random weekly berries."
 p.locator('#event-save').click()
 assert p.locator('#e3-next').is_visible(),"Should permit a preview prior to 04:00"
 assert p.locator('#e3-next').inner_text()=='事前作戦を試す'
 assert p.locator('#week-content').is_hidden()
 p.locator('#e3-next').click()
 assert p.locator('#review-dialog').evaluate('(e)=>e.open')
 assert p.locator('#review-adopt').is_disabled(),"Without inventory prestart draft cannot be adopted as if final"
 assert p.locator('#review-slots>.slot').count()==4,"All-category draft must display meals and all slots"
 p.locator('#review-close').click()
 assert p.locator('#review-dialog').evaluate('(e)=>!e.open')
 assert p.locator('#e3-next').is_visible()
 assert p.locator('#e3-next').inner_text()=='未採用の提案を確認',"Early preview must remain resumeable."
 # A genuine saved stock snapshot changes the draft basis and permits early adoption after new proposal.
 p.locator('#e6-footer-prep').click()
 p.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v40_E6.html?*")
 p.locator('#btn-inventory').click()
 p.locator('#save-inventory').click()
 p.locator('#e6-footer-plan').click()
 p.wait_for_url("**/U3_Strategy_UI_20261107_v40_E6.html?*")
 assert p.locator('#e3-next').is_visible()
 p.locator('#e3-next').click()
 assert p.locator('#review-dialog').evaluate('(e)=>e.open')
 assert not p.locator('#review-adopt').is_disabled()
 p.locator('#review-adopt').click()
 assert p.locator('#week-content').is_visible(),"Early adopted plan should be viewable in preparation week"
 assert p.locator('#slots>.slot').count()==4
 assert p.locator('#event-food').input_value()=='all'
 # Developer clock buttons must use the selected Nov16 event, not the old Nov9 test week.
 p.locator('#e6-dev > summary').click()
 p.locator('[data-e6-stage="start"]').click()
 p.wait_for_function("""()=>new URL(location.href).searchParams.get('previewNow')==='2026-11-16T06:00'""")
 assert p.url.split("?")[0]==U3
 assert 'eventStart=2026-11-16' in p.url
 assert p.locator('#week-content').is_visible(),"Plan must persist across 04:00 transition"
 assert p.locator('#day-label').inner_text()=='月曜日'
 p.locator('#e6-dev > summary').click()
 p.locator('[data-e6-stage="during"]').click()
 p.wait_for_function("""()=>new URL(location.href).searchParams.get('previewNow')==='2026-11-18T15:00'""")
 assert p.url.split("?")[0]==U3
 p.locator('#e6-footer-prep').click()
 p.wait_for_url("**/U2_Prep_Local_Ingredients_20261107_v40_E6.html?*")
 p.locator('#e6-dev > summary').click()
 p.locator('[data-e6-stage="prep"]').click()
 p.wait_for_function("""()=>new URL(location.href).searchParams.get('previewNow')==='2026-11-15T16:00'""")
 assert p.url.split("?")[0]==U2
 assert 'eventStart=2026-11-16' in p.url
 p.locator('#e6-footer-plan').click()
 p.wait_for_url("**/U3_Strategy_UI_20261107_v40_E6.html?*")
 assert p.locator('#week-content').is_visible(),"Same adopted plan remains visible before 04:00"
 # Reset is scoped to the current Nov16 event. The other week is never erased.
 p.evaluate("""()=>localStorage.setItem('pokesleep-strategy-u3-e3-v1:2026-11-09:other-week','untouched')""")
 p.on('dialog',lambda dialog:dialog.accept())
 p.locator('#e6-dev > summary').click()
 p.locator('#e6-reset').click()
 p.wait_for_function("""()=>new URL(location.href).pathname.endsWith('U3_Strategy_UI_20261107_v40_E6.html') &&
  new URL(location.href).searchParams.get('eventStart')==='2026-11-16' &&
  new URL(location.href).searchParams.get('previewNow')==='2026-11-15T16:00' &&
  !new URL(location.href).searchParams.has('e6Reset')""",timeout=20000)
 assert p.evaluate("""()=>localStorage.getItem('pokesleep-strategy-u3-e3-v1:2026-11-09:other-week')""")=='untouched'
 assert p.evaluate("""()=>localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')""") is None
 assert p.locator('#week-content').is_hidden(),"Only the selected event was reset"
 # Use a clean browser for random berry and event override gates.
 ctx2=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 ctx2.route("**/src/data/event.json",lambda route:route.fulfill(status=200,content_type="application/json",body=json.dumps(events)))
 q=ctx2.new_page();q.on("pageerror",lambda e:errs.append(str(e)))
 q.goto(U3+"?previewNow=2026-11-15T16:00",wait_until="domcontentloaded")
 event(q,'bountiful banquet week vol1','2026-11-16')
 setval(q,'event-field','ワカクサ本島EX')
 assert q.locator('#e6-berry-settings').is_visible()
 assert q.locator('#e6-ex-effect-field').is_visible()
 q.locator('#event-save').click()
 assert q.locator('#e3-next').is_hidden(),"EX before random bonuses known must block"
 fillberries(q,False)
 q.locator('#event-save').click()
 assert q.locator('#e3-next').is_hidden(),"3 berries alone are not sufficient without EX random bonus"
 fillberries(q,True)
 q.locator('#event-save').click()
 assert q.locator('#e3-next').is_visible(),"All EX specifics now verified => allow early proposal"
 assert q.locator('#e3-next').inner_text()=='事前作戦を試す'
 # Change to an event whose bonus overrides even a usually fixed berry field:
 event(q,'halloween 2026','2026-11-23')
 setval(q,'event-field','シアンの砂浜')
 setval(q,'event-food','curry')
 assert q.locator('#e6-berry-settings').is_visible(),"Event berry override requires explicit confirmation even on fixed field"
 assert q.locator('#e6-ex-effect-field').is_hidden()
 q.locator('#event-save').click()
 assert q.locator('#e3-next').is_hidden()
 fillberries(q,False)
 q.locator('#event-save').click()
 assert q.locator('#e3-next').is_visible()
 # Ordinary Greengrass random berries also require explicit type confirmation.
 event(q,'meal prep week vol1','2026-11-09')
 setval(q,'event-field','ワカクサ本島')
 setval(q,'event-food','salad')
 q.locator('#event-save').click()
 assert q.locator('#e3-next').inner_text()=='イベント条件を設定',"During event: incomplete berries require condition setup"
 fillberries(q,False)
 q.locator('#event-save').click()
 assert q.locator('#e3-next').inner_text()=='食材在庫を登録',"During event: known conditions but missing stock require inventory"
 # Replay the same confirmed settings on the preceding Sunday: this must allow a preview.
 q.goto(U3+"?previewNow=2026-11-08T16:00&eventStart=2026-11-09",wait_until="domcontentloaded")
 assert q.locator('#e3-next').is_visible(),"The same known conditions allow pre-event planning."
 for width in (320,360,393,430):
  q.set_viewport_size({'width':width,'height':852})
  m=q.evaluate("()=>({w:innerWidth,scroll:document.documentElement.scrollWidth})")
  assert m['scroll']<=m['w']+1,m
 assert not errs,errs
 print("PASS E6 v40: 11/16 all cooking, fixed field early draft without inventory, adoption after stock, 04:00 persistence, EX separate week effect, random and event-override berry locks.")
 ctx2.close();ctx.close();browser.close()

"""E6 v38: event catalog is auto-loaded; selecting previews immediately, only Save commits. Offline fallback."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]/'previews'
U3=(ROOT/'U3_Strategy_UI_20261107_v38_E6.html').resolve().as_uri()
U2=(ROOT/'U2_Prep_Local_Ingredients_20261107_v38_E6.html').resolve().as_uri()
WEEK='2026-11-09'
EVENTS={'bonus':[
 {'name':'meal prep week vol1','start':'2026-11-09T04:00:00','end':'2026-11-16T04:00:00','target':{},'effects':{'dish':1.25}},
 {'name':'bountiful banquet week vol1','start':'2026-11-16T04:00:00','end':'2026-11-23T04:00:00','target':{'specialty':'Ingredients'},'effects':{'carryLimitAdd':10}}
 ],'drowsy':[]}
def choose(page,event_id):
 page.evaluate("""(id)=>{const select=document.querySelector('#event-source-select');
 if(![...select.options].some(x=>x.value===id))throw Error('event option missing: '+id);
 select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}""",event_id)
def select_value(page,name,value):
 page.evaluate("""([id,val])=>{const x=document.querySelector('#'+id);x.value=val;
 x.dispatchEvent(new Event('change',{bubbles:true}));}""",[name,value])
def saved(page):
 return page.evaluate("""()=>Object.fromEntries(Object.keys(localStorage).sort().filter(k=>k.includes('pokesleep-strategy')).map(k=>[k,localStorage.getItem(k)]))""")
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(timezone_id='Asia/Tokyo',viewport={'width':393,'height':852})
 ctx.add_init_script("""window.fetch=async(url)=>{if(String(url).includes('/nitoyon/pokesleep-tool/main/src/data/event.json')){
  return {ok:true, json:async()=>JSON.parse('@@EVENTS@@')};}
  throw Error('Unexpected URL: '+url);};""".replace('@@EVENTS@@',json.dumps(EVENTS).replace('\\','\\\\').replace("'","\\'")))
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(U3+'?previewNow=2026-11-08T16:00&eventStart='+WEEK,wait_until='domcontentloaded')
 page.wait_for_function("document.querySelector('#event-source-status').textContent.includes('最新の公開データを取得')")
 assert page.locator('#event-source-select').count()==1
 assert page.locator('#event-source-fetch').count()==0
 assert page.locator('#event-source-apply').count()==0
 assert page.locator('#event-details').evaluate('(e)=>e.open')
 assert page.locator('#event-details>summary').evaluate('(e)=>getComputedStyle(e).display')=='none'
 assert page.locator('#event-camp').get_attribute('aria-checked')=='true'
 assert page.locator('#event-source-select option').count()==3
 assert page.locator('#event-source-select').input_value()==''
 before=saved(page)
 choose(page,'pokesleep-tool:meal prep week vol1:2026-11-09')
 assert page.locator('#event-start').input_value()==WEEK
 assert page.locator('#e6-bonus-value').inner_text()=='料理エナジー ×1.25'
 assert page.locator('#e6-bonus-status').inner_text()=='未保存'
 assert page.locator('#event-source-select').input_value().startswith('pokesleep-tool:')
 assert saved(page)==before,'A dropdown change must not commit event selection, inventory or strategy.'
 select_value(page,'event-field','シアンの砂浜')
 select_value(page,'event-food','curry')
 assert saved(page)==before,'Editing preview settings must not write saved data.'
 page.locator('#event-save').click()
 after=saved(page)
 assert after!=before
 assert after['pokesleep-strategy-u3-e3-v1:selected'] and 'pokesleep-tool:meal prep' in after['pokesleep-strategy-u3-e3-v1:selected']
 assert page.locator('#e6-bonus-status').inner_text()=='保存済み'
 assert page.locator('#event-camp').get_attribute('aria-checked')=='true'
 page.reload(wait_until='domcontentloaded')
 assert page.locator('#event-source-select').input_value()=='pokesleep-tool:meal prep week vol1:2026-11-09'
 assert page.locator('#e6-bonus-value').inner_text()=='料理エナジー ×1.25'
 assert page.locator('#event-food').input_value()=='curry'
 assert page.locator('#event-field').input_value()=='シアンの砂浜'
 # Changed selection previews a new event and clears old event-specific meal/field, but does not commit.
 original=saved(page)
 choose(page,'pokesleep-tool:bountiful banquet week vol1:2026-11-16')
 assert page.locator('#event-start').input_value()=='2026-11-16'
 assert page.locator('#event-field').input_value()==''
 assert page.locator('#event-food').input_value()==''
 assert page.locator('#e6-bonus-status').inner_text()=='未保存'
 assert saved(page)==original
 # A mismatched manually changed date is rejected, keeping stored records intact.
 page.locator('#event-start').fill('2026-11-23')
 page.locator('#event-save').click()
 assert saved(page)==original
 page.reload(wait_until='domcontentloaded')
 assert page.locator('#event-start').input_value()==WEEK
 assert page.locator('#e6-bonus-status').inner_text()=='保存済み'
 # Save explicit manual selection only after user click, not while dropdown is changed.
 choose(page,'')
 assert page.locator('#e6-bonus-status').inner_text()=='未保存'
 assert saved(page)==original
 page.locator('#event-save').click()
 assert json.loads(saved(page)['pokesleep-strategy-u3-e3-v1:selected'])['id']=='manual:2026-11-09'
 # Footer still works and keeps event context.
 page.locator('#e6-footer-prep').click()
 page.wait_for_url('**/U2_Prep_Local_Ingredients_20261107_v38_E6.html?*')
 assert page.locator('#e6-footer-prep').get_attribute('aria-current')=='page'
 # Offline: fallback is explicit; do not claim live refresh, but candidate selection still works.
 offline=browser.new_context(timezone_id='Asia/Tokyo',viewport={'width':393,'height':852})
 offline.add_init_script("window.fetch=async()=>{throw Error('offline')};")
 p=offline.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart='+WEEK,wait_until='domcontentloaded')
 p.wait_for_function("document.querySelector('#event-source-status').textContent.includes('同梱データ')")
 assert p.locator('#event-source-select option').count()>1
 choose(p,'pokesleep-tool:meal prep week vol1:2026-11-09')
 assert p.locator('#e6-bonus-value').inner_text()=='料理エナジー ×1.25'
 assert p.locator('#e6-bonus-status').inner_text()=='未保存'
 for width in (320,360,393,430):
  p.set_viewport_size({'width':width,'height':852})
  info=p.evaluate("""()=>({w:innerWidth,doc:document.documentElement.scrollWidth})""")
  assert info['doc']<=info['w']+1,info
 assert not errors,errors
 print('PASS E6 v38: online fetch mocked, offline fallback, dropdown preview without save, commit only on Save, original data preserved, source switching, resize.')
 offline.close();ctx.close();browser.close()

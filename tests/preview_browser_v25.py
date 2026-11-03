"""Browser acceptance tests: week states, U2/U3 navigation, interlocks, late adoption."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=Path(__file__).resolve().parents[1]/'previews'
U2=(BASE/'U2_Prep_Local_Ingredients_20261104_v25.html').resolve().as_uri()
U3=(BASE/'U3_Strategy_UI_20261104_v25.html').resolve().as_uri()
errors=[]

def choose(page, name, value):
 page.evaluate("""([name,value])=>{const e=document.querySelector(name);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}""",[name,value])

def save_event(page,food=None,field=None,start=None):
 if not page.locator('#event-details').get_attribute('open') is not None:
  page.locator('#event-details>summary').click()
 if food is not None:choose(page,'#event-food',food)
 if field is not None:choose(page,'#event-field',field)
 if start is not None:page.locator('#event-start').fill(start)
 page.locator('#event-save').click()

with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=browser.new_context(viewport={'width':390,'height':844})
 page=c.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(U3+'?previewNow=2026-11-08T12:00')
 assert page.locator('#generate').is_disabled()
 assert 'フィールド' in page.locator('#event-gate').inner_text()
 assert '料理カテゴリ' in page.locator('#event-gate').inner_text()
 assert page.locator('#event-field').input_value()==''
 assert page.locator('#event-food').input_value()==''
 assert not page.locator('#stock-dialog').count()
 # Sample load only; selection must be applied before event save.
 page.locator('#event-details>summary').click()
 page.locator('#event-source-fetch').click()
 choose(page,'#event-source-select','meal-prep-20261109')
 page.locator('#event-save').click()
 assert page.locator('#event-source-apply').is_visible()
 assert page.locator('#generate').is_disabled()
 page.locator('#event-source-apply').click()
 assert page.locator('#generate').is_disabled()
 page.locator('#event-save').click()
 assert page.locator('#generate').is_disabled()
 # v25 bridge link: user saves U2 inventory and returns directly to v25, never v23.
 page.goto(U2)
 assert page.locator('#btn-goal').is_visible()
 page.locator('#prep-skill-open').click()
 assert page.locator('#prep-skill-popover').is_visible()
 page.locator('#prep-skill-open').click()
 page.locator('#btn-inventory').click()
 assert page.locator('#inventory-panel [data-key]').count()==19
 page.locator('#save-inventory').click()
 link=page.locator('a.u2-transfer')
 assert link.is_visible()
 assert 'U3_Strategy_UI_20261104_v25.html' in link.get_attribute('href')
 link.click()
 assert 'U3_Strategy_UI_20261104_v25.html' in page.url
 assert page.locator('#generate').is_disabled()
 # After source selection, all U2 current inventory may be zero and still counts as saved.
 assert page.evaluate("JSON.parse(localStorage.getItem('pokesleep-strategy-u2-v3:2026-11-09:inventory')).values")
 # Wild-type favorite berries are a required energy condition (U4 not yet connected).
 save_event(page,food='curry',field='ワカクサ本島')
 assert page.locator('#generate').is_disabled()
 assert 'きのみ条件' in page.locator('#event-gate').inner_text()
 save_event(page,field='シアンの砂浜')
 assert not page.locator('#generate').is_disabled()
 # A proposal based on stale inventory cannot be adopted after U2 overwrote its stock.
 page.locator('#generate').click()
 assert page.locator('#review-dialog').evaluate('(x)=>x.open')
 page.evaluate("""()=>{const k='pokesleep-strategy-u2-v3:2026-11-09:inventory';
  const old=JSON.parse(localStorage.getItem(k));const name=Object.keys(old.values)[0];
  old.values[name]=1;old.savedAt='2026-11-08T21:00:00+09:00';localStorage.setItem(k,JSON.stringify(old));}""")
 page.locator('#review-adopt').click()
 assert page.locator('#review-dialog').evaluate('(x)=>x.open')
 assert page.locator('#week-content').is_hidden()
 page.locator('#review-cancel').click()
 page.locator('#generate').click()
 page.locator('#review-adopt').click()
 assert page.locator('#week-content').is_visible()
 page.reload()
 assert page.locator('#week-content').is_visible()
 assert page.locator('#event-field').input_value()=='シアンの砂浜'
 assert page.locator('#event-food').input_value()=='curry'
 # A different week is not allowed to inherit previous week's fixed field and meal choice.
 save_event(page,start='2026-11-16')
 assert page.locator('#event-field').input_value()==''
 assert page.locator('#event-food').input_value()==''
 assert page.locator('#week-content').is_hidden()
 assert page.locator('#generate').is_disabled()
 # Returning to prior week restores its independently saved plan and event settings.
 save_event(page,start='2026-11-09')
 assert page.locator('#event-field').input_value()=='シアンの砂浜'
 assert page.locator('#event-food').input_value()=='curry'
 assert page.locator('#week-content').is_visible()
 # Current segment and completed meals stay fixed during midweek replanning.
 page.goto(U3+'?previewNow=2026-11-11T15:00&eventStart=2026-11-09')
 assert page.locator('#repropose').is_enabled()
 page.locator('#day-nav button').nth(2).click()
 before=page.locator('#slots .slot[data-slot="noon"]').inner_text()
 page.locator('#repropose').click()
 page.locator('#review-day-nav button').nth(2).click()
 after=page.locator('#review-slots .slot[data-slot="noon"]').inner_text()
 assert before==after,(before,after)
 page.locator('#review-cancel').click()
 # Existing v23 status modal remains operable.
 page.locator('#slots .avatar-tap').first.click()
 assert page.locator('#pokemon-dialog').evaluate('(x)=>x.open')
 page.locator('#pokemon-close').click()
 assert not page.locator('#pokemon-dialog').evaluate('(x)=>x.open')
 assert not errors,errors
 for width in (320,360,390,430):
  page.set_viewport_size({'width':width,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),width
 print('PASS: v23 source preservation; zero inventory; U2<->U3 routing; unknown category and berries; stale adoption; week histories; midweek locked meals; UI 320-430px; modal')
 c.close();browser.close()

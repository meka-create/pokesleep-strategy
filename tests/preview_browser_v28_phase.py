"""Chromium U3-A acceptance: prepare/setup/adopted/end screen priorities.

Tests only U3-A. Game-day automatic weekday selection is intentionally U3-B.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

PREVIEWS=Path(__file__).resolve().parents[1]/'previews'
U3=(PREVIEWS/'U3_Strategy_UI_20261104_v28.html').resolve().as_uri()
U2=(PREVIEWS/'U2_Prep_Local_Ingredients_20261104_v28.html').resolve().as_uri()
errors=[]

def choose(page,element,value):
 page.evaluate("""([selector,value])=>{const e=document.querySelector(selector);e.value=value;
  e.dispatchEvent(new Event('change',{bubbles:true}));}""",[element,value])

def first_child(page):
 return page.locator('.shell > main > :first-child').get_attribute('id') or page.locator('.shell > main > :first-child').get_attribute('class')

with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':390,'height':844})
 page=context.new_page()
 page.on('pageerror',lambda exc:errors.append(str(exc)))

 # Phase: preparation week. A short link to the 19-ingredient goal takes priority.
 page.goto(U3+'?previewNow=2026-11-08T12:00&eventStart=2026-11-09',wait_until='domcontentloaded')
 assert page.locator('main').get_attribute('data-phase-stage')=='preparation'
 assert first_child(page)=='phase-intro'
 assert page.locator('#phase-intro-title').inner_text()=='準備週'
 assert page.locator('#phase-intro-u2').is_visible()
 assert 'U2_Prep_Local_Ingredients_20261104_v28.html' in page.locator('#phase-intro-u2').get_attribute('href')
 assert page.locator('.shell > main > :nth-child(2)').get_attribute('id')=='event-details'
 assert page.locator('#event-details').get_attribute('open') is None
 assert page.locator('#week-content').is_hidden()
 assert page.locator('#auto-sleep').get_attribute('aria-checked')=='false'
 assert page.locator('#generate').is_disabled()
 assert page.locator('main').locator('button').count() > 0

 # Phase: event starts at Monday 04:00, with no adopted plan.
 page.goto(U3+'?previewNow=2026-11-09T07:00&eventStart=2026-11-09',wait_until='domcontentloaded')
 assert page.locator('main').get_attribute('data-phase-stage')=='start'
 assert first_child(page)=='event-details'
 assert page.locator('.shell > main > :nth-child(2)').get_attribute('class').startswith('card plan-actions')
 assert page.locator('#phase-intro').is_hidden()
 assert page.locator('#event-details').get_attribute('open') is not None
 assert 'フィールド' in page.locator('#event-gate').inner_text()
 assert '料理カテゴリ' in page.locator('#event-gate').inner_text()
 # The user can collapse it without render() immediately reopening it.
 page.locator('#event-details>summary').click()
 assert page.locator('#event-details').get_attribute('open') is None
 choose(page,'#event-food','curry')
 assert page.locator('#event-details').get_attribute('open') is None
 page.locator('#event-details>summary').click()
 choose(page,'#event-field','シアンの砂浜')
 page.locator('#event-save').click()
 assert page.locator('#event-details').get_attribute('open') is None
 assert page.locator('#generate').is_disabled() # stock not saved

 # Save a valid 0-inventory record, which must be distinct from "not saved".
 names=re.findall(r'"([^"]+)":"data:image/png;base64,',(PREVIEWS/'U3_Strategy_UI_20261104_v28.html').read_text(encoding='utf8'))
 assert len(names)==19
 record={'version':3,'weekStart':'2026-11-09','source':'inventory','savedAt':'2026-11-09T07:01:00+09:00','values':{name:0 for name in names}}
 page.evaluate("""data=>localStorage.setItem('pokesleep-strategy-u2-v3:2026-11-09:inventory',JSON.stringify(data))""",record)
 page.reload(wait_until='domcontentloaded')
 assert page.locator('main').get_attribute('data-phase-stage')=='start'
 assert page.locator('#generate').is_enabled()
 page.locator('#generate').click()
 assert page.locator('#review-dialog').evaluate('(e)=>e.open')
 assert page.locator('main').get_attribute('data-phase-stage')=='start'
 assert page.locator('#week-content').is_hidden()
 page.locator('#review-adopt').click()

 # Active phase: the adopted weekly plan is the very first main element.
 assert page.locator('main').get_attribute('data-phase-stage')=='active'
 assert first_child(page)=='week-content'
 assert page.locator('#week-content').is_visible()
 assert page.locator('#phase-intro').is_hidden()
 assert page.locator('.shell > main > :nth-child(2)').get_attribute('class').startswith('card sleep-settings')
 assert page.locator('.shell > main > :nth-child(3)').get_attribute('class').startswith('card plan-actions')
 assert page.locator('.shell > main > :nth-child(4)').get_attribute('id')=='event-details'
 assert page.locator('#event-details').get_attribute('open') is None
 assert page.locator('#repropose').is_visible()
 assert page.locator('#generate').is_hidden()
 assert 'U2_Prep_Local_Ingredients_20261104_v28.html' in page.locator('.plan-actions a.u2-nav').first.get_attribute('href')

 # Opening the secondary event settings must not be undone by normal rerenders.
 page.locator('#event-details>summary').click()
 assert page.locator('#event-details').get_attribute('open') is not None
 choose(page,'#event-food','salad')
 assert page.locator('#event-details').get_attribute('open') is not None
 assert first_child(page)=='week-content'
 # Restore the original event food before leaving.
 choose(page,'#event-food','curry')
 page.locator('#event-details>summary').click()

 # Reload still starts at the adopted plan, but weekday auto-selection is NOT implemented by U3-A.
 page.reload(wait_until='domcontentloaded')
 assert page.locator('main').get_attribute('data-phase-stage')=='active'
 assert first_child(page)=='week-content'
 assert page.locator('#week-content').is_visible()

 # Screens are viewport safe; popup and keyboard-accessible links are retained.
 for width in (320,360,390,430):
  page.set_viewport_size({'width':width,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'overflow at {width}'

 # When event is over, keep the adopted plan to view, but disallow new proposals.
 page.goto(U3+'?previewNow=2026-11-16T05:00&eventStart=2026-11-09',wait_until='domcontentloaded')
 assert page.locator('main').get_attribute('data-phase-stage')=='ended'
 assert first_child(page)=='week-content'
 assert page.locator('#week-content').is_visible()
 assert page.locator('#repropose').is_disabled()

 # No plan at the end of a week: show a simple ended status instead.
 ctx2=browser.new_context(viewport={'width':390,'height':844})
 page2=ctx2.new_page()
 page2.on('pageerror',lambda exc:errors.append(str(exc)))
 page2.goto(U3+'?previewNow=2026-11-16T05:00&eventStart=2026-11-09')
 assert page2.locator('main').get_attribute('data-phase-stage')=='ended'
 assert first_child(page2)=='phase-intro'
 assert page2.locator('#phase-intro-title').inner_text()=='イベント終了'
 assert page2.locator('#phase-intro-u2').is_hidden()
 assert not errors,errors
 print('PASS U3-A phase priorities: preparation -> setup -> adopted first -> ended; no forced event reopening; 0-stock accepted; no overflow at 320-430px.')
 ctx2.close()
 context.close();browser.close()

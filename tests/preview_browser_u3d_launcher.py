"""Chromium smoke test for mobile offline acceptance scenario links."""
from pathlib import Path
from playwright.sync_api import sync_playwright
PREVIEWS=Path(__file__).resolve().parents[1]/"previews"
START=(PREVIEWS/"U3D_Android_Acceptance_Launcher_20261104.html").resolve().as_uri()
cases=[
 ("preparation","preparation",None),
 ("start","start",None),
 ("tuesday_before","start","月曜日"),
 ("tuesday_after","start","火曜日"),
 ("wednesday","start","水曜日"),
 ("ended","ended",None)
]
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 context=browser.new_context(viewport={"width":393,"height":852},timezone_id="Asia/Tokyo")
 page=context.new_page();errors=[]
 page.on("pageerror",lambda exc:errors.append(str(exc)))
 for link,phase,day in cases:
  page.goto(START,wait_until="domcontentloaded")
  assert page.locator('a[data-test]').count()==7
  page.locator(f'a[data-test="{link}"]').click()
  page.wait_for_url("**/U3_Strategy_UI_20261104_v29.html?*")
  assert page.locator("main").get_attribute("data-phase-stage")==phase,(link,"phase")
  if day is not None:
   assert page.locator("#day-label").text_content()==day,(link,"day")
  assert not errors,errors
 page.goto(START,wait_until="domcontentloaded")
 page.locator('a[data-test="u2"]').click()
 page.wait_for_url("**/U2_Prep_Local_Ingredients_20261104_v29.html?*")
 assert page.locator("#btn-inventory").is_visible()
 assert page.locator("#save-inventory").count()==1
 assert not errors,errors
 print("PASS U3-D Android launcher: all 7 offline links resolve to frozen v29 preview with correct phase/day.")
 context.close();browser.close()

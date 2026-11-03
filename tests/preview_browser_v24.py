"""Chromium smoke and interlock tests for U3 v24, executed on GitHub runner."""
from pathlib import Path
import json
import os
import re
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
src=(root/"previews/U3_Strategy_UI_20261104_v24.html").read_text(encoding="utf-8")
names=re.findall(r'"([^"]+)":"data:image/png;base64,',src)
assert len(names)==19,(len(names),names[:3])
path=(root/"previews/U3_Strategy_UI_20261104_v24.html").resolve().as_uri()
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 context=browser.new_context(viewport={"width":390,"height":844})
 page=context.new_page()
 page.on("pageerror",lambda err:errors.append(str(err)))
 page.goto(path+"?previewNow=2026-11-08T12:00",wait_until="domcontentloaded")
 page.wait_for_timeout(180)
 assert page.locator("#generate").is_disabled(), "U2 inventory must be saved first"
 assert not page.locator("#stock-dialog").count()
 assert page.locator("#event-gate").is_hidden()
 page.locator("#event-details>summary").click()
 page.locator("#event-source-fetch").click()
 assert page.locator("#event-source-select option").count()==2
 page.evaluate("""() => {let el=document.querySelector('#event-source-select');el.value='meal-prep-20261109';el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-source-apply").click()
 assert "イベント条件の保存" in page.locator("#event-gate").inner_text()
 page.locator("#event-save").click()
 assert page.locator("#generate").is_disabled()
 # Confirm an unknown food blocks proposals even when all 19 on-hand ingredients are explicitly zero.
 page.locator("#event-details>summary").click()
 page.evaluate("""() => {let el=document.querySelector('#event-food');el.value='';el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-save").click()
 assert "料理カテゴリ" in page.locator("#event-gate").inner_text()
 record={"version":3,"weekStart":"2026-11-09","source":"inventory",
         "savedAt":"2026-11-08T20:00:00+09:00","values":{name:0 for name in names}}
 page.evaluate("""data=>localStorage.setItem('pokesleep-strategy-u2-v3:2026-11-09:inventory',JSON.stringify(data))""",record)
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#generate").is_disabled()
 assert "料理カテゴリ" in page.locator("#event-gate").inner_text()
 page.locator("#event-details>summary").click()
 page.evaluate("""() => {let el=document.querySelector('#event-food');el.value='curry';el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-save").click()
 assert not page.locator("#generate").is_disabled()
 page.locator("#generate").click()
 assert page.locator("#review-dialog").evaluate("(el)=>el.open")
 page.locator("#review-cancel").click()
 assert page.locator("#week-content").is_hidden()
 page.locator("#generate").click()
 page.locator("#review-adopt").click()
 assert page.locator("#week-content").is_visible()
 # Approved team remains displayed when a required input is subsequently cleared.
 page.locator("#event-details>summary").click()
 page.evaluate("""() => {let el=document.querySelector('#event-food');el.value='';el.dispatchEvent(new Event('change',{bubbles:true}));}""")
 page.locator("#event-save").click()
 assert page.locator("#week-content").is_visible()
 assert page.locator("#repropose").is_disabled()
 assert "料理カテゴリ" in page.locator("#event-gate").inner_text()
 # Preserved across reload.
 page.reload(wait_until="domcontentloaded")
 assert page.locator("#week-content").is_visible()
 assert page.locator("#repropose").is_disabled()
 assert not errors,errors
 print(json.dumps({"checks":"PASS","ingredients":len(names),
  "regression":"v23 plan preserved","event_gate":"PASS","errors":errors},ensure_ascii=False))
 context.close();browser.close()

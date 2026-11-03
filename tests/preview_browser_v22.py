"""Optional U2/U3 Playwright smoke test (requires local Chromium and playwright).
Intentionally excluded from the default workflow to avoid browser downloads.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
from shutil import which
BASE=Path(__file__).resolve().parents[1]/"previews"
U2=(BASE/"U2_Prep_Local_Ingredients_20261103.html").read_text(encoding="utf-8")
U3=(BASE/"U3_Strategy_UI_20261103.html").read_text(encoding="utf-8")
def render(p,html):
    prefix="""<script>(()=>{window.__db={};window.__query='?eventStart=2026-11-09';
    window.__virtualUrl='https://preview.invalid/screen.html'+window.__query;
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>window.__db[k]??null,setItem:(k,v)=>window.__db[k]=String(v)}});
    const Native=window.URLSearchParams;
    window.URLSearchParams=class extends Native{constructor(v){super(v===''?window.__query:v)}};
    window.history.replaceState=(_a,_b,url)=>{window.__query=new URL(url).search;window.__virtualUrl=String(url)};
    })();</script>"""
    html=html.replace("new URL(location.href)","new URL(window.__virtualUrl)")
    p.set_content(html.replace("<script>\n(()=>{",prefix+"<script>\n(()=>{",1),wait_until="domcontentloaded")
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,**({'executable_path':which('chromium')} if which('chromium') else {}))
    for w in (320,360,390,430):
        p=browser.new_page(viewport={"width":w,"height":740})
        render(p,U2);p.locator("#btn-current").click()
        p.locator("#current-panel input").nth(4).fill("27")
        p.locator("#save-current").click()
        assert p.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        record=json.loads(p.evaluate("localStorage.getItem('pokesleep-strategy-u2-v2:2026-11-09:current')"))
        assert len(record["values"])==19 and sum(record["values"].values())==27
        p.close()
    p=browser.new_page()
    render(p,U3);p.locator("#generate").click();p.locator("#review-adopt").click()
    before=p.locator('#slots [data-slot="sleep"] .mon-name').all_inner_texts()
    p.locator("#sleep-open").click();p.locator("#sleep-change").click()
    p.locator('.pick-select[data-id="dragonite"]').click()
    p.locator('.pick-select[data-id="espeon"]').click()
    p.locator("#edit-save").click();p.locator("#sleep-close").click()
    assert p.locator('#slots [data-slot="sleep"] .mon-name').all_inner_texts()==before
    p.locator("#repropose").click();p.locator("#review-adopt").click()
    assert "エーフィ" in p.locator('#slots [data-slot="sleep"] .mon-name').all_inner_texts()
    p.locator("#event-details summary").click()
    p.locator("#event-start").fill("2026-11-16")
    p.locator("#event-save").click()
    assert p.locator("#generate").is_visible() and not p.locator("#week-content").is_visible()
    assert "2026-11-16" in p.evaluate("window.__query")
    browser.close()
print("Browser smoke test PASS")

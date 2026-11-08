"""Independent E6 pre-E7 audit: event save must be safe on storage faults and event switching."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'previews'
url=(root/'U3_Strategy_UI_20261109_v49_E6.html').resolve().as_uri()
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    p=context.new_page()
    p.on('pageerror',lambda e: errors.append(str(e)))
    p.goto(url+'?previewNow=2026-11-08T16:00&eventStart=2026-11-09&eventId=manual:2026-11-02',wait_until='domcontentloaded')
    def select(id,value):
        p.evaluate("""([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}""",[id,value])
    def read(key):
        return p.evaluate("(k)=>localStorage.getItem(k)",key)
    def choose_week(week):
        select('event-start',week)
    def inject(suffix):
        p.evaluate("""(suffix)=>{
            Storage.prototype.__auditOriginal=Storage.prototype.setItem;
            Storage.prototype.setItem=function(k,v){
                if(k.includes(suffix))throw new Error('Simulated storage rejection');
                return Storage.prototype.__auditOriginal.call(this,k,v);
            };
        }""",suffix)
    def clear_inject():
        p.evaluate("()=>{Storage.prototype.setItem=Storage.prototype.__auditOriginal;}")
    selected_key='pokesleep-strategy-u3-e3-v1:selected'
    select('event-start','2026-11-09')
    select('event-field','シアンの砂浜')
    select('event-food','all')
    p.locator('#event-save').click()
    old=read(selected_key)
    assert old and 'manual:2026-11-09' in old,old
    assert 'eventId=manual%3A2026-11-09' in p.url,p.url
    assert 'pokesleepStock=' not in p.url
    old_plan_key='pokesleep-strategy-u3-e3-v1:2026-11-09:manual%3A2026-11-09:plan'
    old_plan=read(old_plan_key)
    assert old_plan

    # Reject the ledger write after the new plan was staged; roll both back.
    choose_week('2026-11-16')
    target='pokesleep-strategy-u3-e3-v1:2026-11-16:manual%3A2026-11-16'
    inject(target+':conditions')
    p.locator('#event-save').click()
    assert read(selected_key)==old, 'selected event changed despite a rejected condition write'
    assert read(target+':plan') is None, 'half-written new event plan left behind'
    assert read(target+':conditions') is None
    assert read(old_plan_key)==old_plan
    clear_inject()

    # A subsequent successful save should advance both the pointer and URL.
    p.locator('#event-save').click()
    current=read(selected_key)
    assert current and 'manual:2026-11-16' in current,current
    assert 'eventId=manual%3A2026-11-16' in p.url,p.url
    assert 'eventStart=2026-11-16' in p.url,p.url

    # A failure to write the plan must leave the previous event selected.
    choose_week('2026-11-23')
    plan23='pokesleep-strategy-u3-e3-v1:2026-11-23:manual%3A2026-11-23:plan'
    inject(plan23)
    p.locator('#event-save').click()
    assert read(selected_key)==current
    assert read(plan23) is None
    clear_inject()

    # A corrupt target is protected, not discarded or overwritten by selecting it.
    choose_week('2026-11-30')
    bad='pokesleep-strategy-u3-e3-v1:2026-11-30:manual%3A2026-11-30:plan'
    p.evaluate("([k,v])=>localStorage.setItem(k,v)",[bad,'{unreadable'])
    p.locator('#event-save').click()
    assert read(bad)=='{unreadable'
    assert read(selected_key)==current
    assert 'eventStart=2026-11-16' in p.url
    assert not errors,errors
    browser.close()
print('E6 v49 event-save failpoints, corrupt-target protection and URL identity: PASS')

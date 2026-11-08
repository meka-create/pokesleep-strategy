"""E6 v42: goal-bottom stockpile choice, two-way save, top roster, shared type-color picker."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]/'previews'
U2=(root/'U2_Prep_Local_Ingredients_20261108_v42_E6.html').resolve().as_uri()
U3=(root/'U3_Strategy_UI_20261108_v42_E6.html').resolve().as_uri()
U4=(root/'U4_Box_Preview_20261108_v42_E6.html').resolve().as_uri()
week='2026-11-16'
event_name='bountiful banquet week vol1'
event_id=f'pokesleep-tool:{event_name}:{week}'
events={'bonus':[{'name':event_name,'start':week+'T04:00:00','end':'2026-11-23T04:00:00','effects':{'extraIng':'nuts','carryLimitAdd':10}}]}

def setval(p, id, value):
    p.evaluate("""([id,value])=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}))}""",[id,value])

def get_saved_prep(p):
    return p.evaluate("""(v)=>{const key='pokesleep-strategy-u2-e6-prep-v1:'+v.week+':'+encodeURIComponent(v.id);
       return JSON.parse(localStorage.getItem(key)||'null');}""",{'week':week,'id':event_id})

errs=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    ctx.route('**/src/data/event.json',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(events)))
    p=ctx.new_page()
    p.on('pageerror',lambda e:errs.append(str(e)))
    p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart='+week,wait_until='domcontentloaded')
    p.wait_for_function("""id=>[...document.getElementById('event-source-select').options].some(x=>x.value===id)""",arg=event_id)
    setval(p,'event-source-select',event_id)
    setval(p,'event-field','シアンの砂浜')
    assert p.locator('#event-food').input_value()=='all'
    p.locator('#event-save').click()
    assert p.locator('#event-details').evaluate('(e)=>e.open'), 'conditions stay open before first proposal'
    assert not p.locator('#event-details > summary').is_visible(), 'condition card not collapsible before proposal'
    assert p.locator('#e3-next').inner_text()=='事前作戦を試す'
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    p.locator('#review-close').click()
    p.wait_for_function("""()=>document.querySelector('main').dataset.hasProposed==='true'""")
    assert p.locator('#event-details > summary').is_visible(), 'first proposal unlocks collapse'
    p.locator('#event-details > summary').click()
    assert not p.locator('#event-details').evaluate('(e)=>e.open')
    # U2 receives the event context while preserving the selected date.
    p.locator('#e6-footer-prep').click()
    p.wait_for_url('**/U2_Prep_Local_Ingredients_20261108_v42_E6.html?*')
    goal_top=p.locator('.goal-grid').evaluate('(e)=>e.getBoundingClientRect().top')
    assert p.locator('#e6-prep-category-card').is_visible()
    assert not p.locator('#e6-prep-save').is_enabled(), 'no implicit 3-category default'
    p.locator('#btn-inventory').click()
    stock_top=p.locator('.actual-grid').evaluate('(e)=>e.getBoundingClientRect().top')
    assert abs(goal_top-stock_top)<=4, f'ingredient grid starts differ: {goal_top}, {stock_top}'
    p.locator('#btn-goal').click()
    p.locator('[data-stock-count="2"]').click()
    assert p.locator('#e6-prep-types').is_visible()
    assert not p.locator('#e6-prep-save').is_enabled()
    p.locator('[data-stock-type="curry"]').click()
    p.locator('[data-stock-type="dessert"]').click()
    assert p.locator('#e6-prep-save').is_enabled()
    p.locator('#e6-prep-save').click()
    saved=get_saved_prep(p)
    assert saved['eventId']==event_id and saved['prep']=={'count':2,'categories':['curry','dessert']}, saved
    # From U2 to U3, even file:// navigation has a validated packet.
    p.locator('#e6-footer-plan').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    assert p.locator('.e6-stock-config').count()==0
    savedPlan=p.evaluate("""(v)=>{const k='pokesleep-strategy-u3-e3-v1:'+v.week+':'+encodeURIComponent(v.id)+':plan';
      return JSON.parse(localStorage.getItem(k)||'null')}""",{'week':week,'id':event_id})
    assert savedPlan is not None and savedPlan['eventInfo']['prep']=={'count':2,'categories':['curry','dessert']}, savedPlan
    # A later start-clock view should use the same roster-first position.
    pre_cards=p.evaluate("""()=>[...document.querySelector('main').children].map(e=>e.id||e.className).filter(Boolean)""")
    p.locator('#e6-dev > summary').click()
    p.locator('[data-e6-stage="start"]').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    start_cards=p.evaluate("""()=>[...document.querySelector('main').children].map(e=>e.id||e.className).filter(Boolean)""")
    assert 'week-content' in pre_cards and 'week-content' in start_cards
    # For randomized weekly berries, retain the common custom dropdown and distinguish each type.
    p.locator('#event-details > summary').click() if not p.locator('#event-details').evaluate('(e)=>e.open') else None
    setval(p,'event-field','ワカクサ本島EX')
    assert p.locator('#e6-berry-settings').is_visible()
    trigger=p.locator('#e6-berry-main + .custom-select .custom-trigger')
    assert trigger.is_visible()
    trigger.click()
    option=p.locator('#e6-berry-main + .custom-select .custom-opt[data-berry-type="ほのお"]')
    assert option.is_visible()
    option.click()
    assert p.locator('#e6-berry-main').input_value()=='ほのお'
    assert trigger.get_attribute('data-berry-type')=='ほのお'
    assert trigger.evaluate('(e)=>getComputedStyle(e).borderLeftColor')!='rgb(0, 0, 0)'
    for id,v in [('e6-berry-sub1','みず'),('e6-berry-sub2','くさ')]:
        setval(p,id,v)
    setval(p,'e6-ex-effect','skill')
    p.locator('#event-save').click()
    assert p.locator('#event-details').count()==1
    # All three footer links have only the single-word label.
    for page in [p]:
        assert page.locator('#e6-footer small').count()==0
    assert not errs,errs
    browser.close()
print('E6 v42 browser acceptance: PASS')

# E6 v42: run a complete separate adopted-plan scenario to prove phase-independent controls.
errs2=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
    ctx.route('**/src/data/event.json',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(events)))
    p=ctx.new_page()
    p.on('pageerror',lambda err:errs2.append(str(err)))
    p.goto(U3+'?previewNow=2026-11-08T16:00&eventStart='+week,wait_until='domcontentloaded')
    p.wait_for_function("""id=>[...document.getElementById('event-source-select').options].some(x=>x.value===id)""",arg=event_id)
    setval(p,'event-source-select',event_id)
    setval(p,'event-field','シアンの砂浜')
    p.locator('#event-save').click()
    assert p.locator('#e3-next').inner_text()=='事前作戦を試す'
    assert not p.locator('#week-content').is_visible()
    # Save stock through U2. The early proposal can now be adopted rather than preview-only.
    p.locator('#e6-footer-prep').click()
    p.wait_for_url('**/U2_Prep_Local_Ingredients_20261108_v42_E6.html?*')
    p.locator('#btn-inventory').click()
    fields=p.locator('#inventory-panel input[inputmode="numeric"]')
    assert fields.count()==19, fields.count()
    fields.nth(0).fill('12')
    p.locator('#save-inventory').click()
    p.wait_for_function("""v=>{const x=JSON.parse(localStorage.getItem('pokesleep-strategy-u2-e2-v1:'+v+':timeline')||'null');return !!x?.currentInventory}""",arg=week)
    p.locator('#e6-footer-plan').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    p.wait_for_function("""()=>document.querySelector('#e3-next').textContent==='7日間の作戦を提案'""")
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    p.locator('#review-adopt').click()
    assert p.locator('#week-content').is_visible()
    assert not p.locator('#e3-primary').is_visible(), 'unchanged prep-week plan must not show re-propose'
    def order():
        return p.evaluate("""()=>[...document.querySelector('main').children]
            .map(e=>e.id||e.classList[0]).filter(x=>['week-content','e3-primary','sleep-settings','event-details'].includes(x))""")
    before=order()
    assert before[:4]==['week-content','e3-primary','sleep-settings','event-details'],before
    # The 04:00 transition must not create a button, shift the layout, or destroy the plan.
    p.locator('#e6-dev > summary').click()
    p.locator('[data-e6-stage="start"]').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    assert order()==before,(before,order())
    assert p.locator('#week-content').is_visible()
    assert not p.locator('#e3-primary').is_visible(), 'clock-only transition cannot demand re-proposal'
    # Returning to preparation and saving identical stock quantities is not a material change.
    p.locator('#e6-dev > summary').click()
    p.locator('[data-e6-stage="prep"]').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    assert not p.locator('#e3-primary').is_visible()
    p.locator('#e6-footer-prep').click()
    p.wait_for_url('**/U2_Prep_Local_Ingredients_20261108_v42_E6.html?*')
    p.locator('#btn-inventory').click()
    assert p.locator('#inventory-panel input[inputmode="numeric"]').nth(0).input_value()=='12'
    p.locator('#save-inventory').click()
    p.locator('#e6-footer-plan').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    assert not p.locator('#e3-primary').is_visible(), 'identical stock resave must not trigger re-propose'
    # A real saved condition change must show a full-week button before start.
    if not p.locator('#event-details').evaluate('(e)=>e.open'):
        p.locator('#event-details > summary').click()
    p.locator('#event-camp').click()
    assert p.locator('#e3-next').inner_text()=='イベント条件を設定'
    p.locator('#event-save').click()
    assert p.locator('#e3-next').inner_text()=='7日間の作戦を再提案'
    # Same change, same card order after 04:00. Only proposal range and button copy change.
    p.locator('#e6-dev > summary').click()
    p.locator('[data-e6-stage="start"]').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    assert order()==before
    assert p.locator('#e3-next').inner_text()=='残り期間を再提案'
    p.locator('#e6-dev > summary').click()
    p.locator('[data-e6-stage="during"]').click()
    p.wait_for_url('**/U3_Strategy_UI_20261108_v42_E6.html?*')
    assert order()==before
    assert p.locator('#e3-next').inner_text()=='残り期間を再提案'
    old=p.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:'+JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')).weekStart+':'+encodeURIComponent(JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')).id)+':plan')).applied""")
    p.locator('#e3-next').click()
    assert p.locator('#review-dialog').evaluate('(e)=>e.open')
    p.locator('#review-adopt').click()
    fresh=p.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:'+JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')).weekStart+':'+encodeURIComponent(JSON.parse(localStorage.getItem('pokesleep-strategy-u3-e3-v1:selected')).id)+':plan')).applied""")
    assert fresh['days'][0]['morning']==old['days'][0]['morning'], 'elapsed Monday party was overwritten'
    assert fresh['days'][0]['recipes'][0]==old['days'][0]['recipes'][0], 'elapsed Monday meal was overwritten'
    assert not p.locator('#e3-primary').is_visible(), 'no new changes after adoption'
    assert not errs2,errs2
    browser.close()
print('E6 v42 unified phases and elapsed-slot safety: PASS')

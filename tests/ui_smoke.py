from pathlib import Path
from playwright.sync_api import sync_playwright
import tempfile
root=Path(__file__).resolve().parent.parent
head=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3','メインスキル','せいかく','Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い']
rows=[]
for i in range(7):
    rows.append([(r'<img src=x onerror=alert(1)>' if i==0 else f'育成{i}'),'ピカチュウ',str(20+i),'3','とくせんリンゴ','とくせんリンゴ','とくせんリンゴ','エナジーチャージS','まじめ','','','','','','0','0'])
import csv,io
s=io.StringIO();w=csv.writer(s);w.writerow(head);w.writerows(rows)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=2,is_mobile=True,has_touch=True,accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    # Harness forbids http:// and file://; run the real bundled HTML in about:blank.
    html=(root/'dist'/'index.html').read_text()
    page.goto('about:blank')
    page.evaluate("""(html)=>{
      const values={};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k]}});
      window.__readStored=()=>({...values});
      document.open();document.write(html);document.close();
    }""",html)
    assert page.locator('#panel-event').is_visible()
    assert not page.locator('#food2Row').is_visible()
    page.locator('#eventDuration').select_option('2')
    assert page.locator('#food2Row').is_visible()
    page.locator('#eventName').fill('イベント試験')
    page.locator('#eventMap').fill('ワカクサ本島EX')
    page.locator('#food1').select_option('salad')
    page.locator('#camp1').check()
    page.locator('#saveEvent').click()
    page.locator('[data-tab="box"]').click()
    assert page.locator('#panel-box').is_visible()
    page.locator('#csvFile').set_input_files({'name':'box.csv','mimeType':'text/csv','buffer':s.getvalue().encode()})
    assert page.locator('#boxTotal').inner_text()=='7匹',page.locator('#importError').inner_text()
    assert page.locator('.pokemon-row img').count()==0, 'nicknames must not inject HTML'
    page.locator('[data-add]').first.click()
    assert page.locator('#sleepCount').inner_text()=='1 / 5'
    # Selection cap is five, even with more Pokémon in the box.
    for _ in range(4):
        page.locator('button.pick:not(.selected):not([disabled])').first.click()
    assert page.locator('#sleepCount').inner_text()=='5 / 5'
    assert page.locator('button.pick:not(.selected)').first.is_disabled()
    state=page.evaluate('window.__readStored()')
    page.evaluate("""(arg)=>{
      const {html,state}=arg;
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>state[k]??null,setItem:(k,v)=>state[k]=String(v),removeItem:k=>delete state[k]}});
      document.open();document.write(html);document.close();
    }""", {'html':html,'state':state})
    page.locator('[data-tab="box"]').click()
    assert page.locator('#sleepCount').inner_text()=='5 / 5'
    page.locator('[data-tab="event"]').click()
    assert page.locator('#eventName').input_value()=='イベント試験'
    assert page.locator('#camp1').is_checked()
    assert page.locator('#food2Row').is_visible()
    assert page.locator('#food1').input_value()=='salad'
    # Re-import the same individuals in a different order. Preserve five selected entries.
    page.locator('[data-tab="box"]').click()
    ss=io.StringIO();ww=csv.writer(ss);ww.writerow(head);ww.writerows(list(reversed(rows)))
    page.locator('#csvFile').set_input_files({'name':'reordered.csv','mimeType':'text/csv','buffer':ss.getvalue().encode()})
    assert page.locator('#sleepCount').inner_text()=='5 / 5'
    # Export, clear, and restore a full backup through the real UI.
    page.locator('[data-tab="settings"]').click()
    with page.expect_download() as dl:
        page.locator('#downloadBackup').click()
    payload=Path(dl.value.path()).read_bytes()
    page.locator('#clearData').click()
    page.locator('[data-tab="box"]').click()
    assert page.locator('#boxTotal').inner_text()=='0匹'
    page.locator('[data-tab="settings"]').click()
    page.locator('#backupFile').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':payload})
    page.locator('[data-tab="box"]').click()
    assert page.locator('#boxTotal').inner_text()=='7匹'
    assert page.locator('#sleepCount').inner_text()=='5 / 5'
    page.locator('[data-tab="event"]').click()
    assert page.locator('#food1').input_value()=='salad'
    page.locator('[data-tab="box"]').click()
    # invalid CSV does not wipe existing data
    page.locator('#csvFile').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':b'x,y\na,b'})
    assert page.locator('#boxTotal').inner_text()=='7匹'
    assert page.locator('#importError').is_visible()
    # STEP4: mixed recipes must survive real mobile DOM handling and reload.
    page.locator('[data-tab="prep"]').click()
    page.locator('#prepRecipe').select_option('apple_curry')
    page.locator('#prepMeals').fill('10')
    page.locator('#prepCapacity').fill('600')
    page.locator('#prepAddRecipe').click()
    assert page.locator('.step4-recipe-row').count()==1
    page.locator('.step4-recipe-row select').select_option('curry_03')
    page.locator('.step4-recipe-row input').fill('11')
    page.locator('#prepCalculate').click()
    assert not page.locator('#prepError').is_visible(),page.locator('#prepError').inner_text()
    assert '2品・合計21食分' in page.locator('#prepSummary').inner_text()
    assert '必要食材 235個' in page.locator('#prepCoverage').inner_text()
    live=page.evaluate('window.__readStored()')
    page.evaluate("""(arg)=>{
      const {html,state}=arg;
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>state[k]??null,setItem:(k,v)=>state[k]=String(v),removeItem:k=>delete state[k]}});
      document.open();document.write(html);document.close();
    }""", {'html':html,'state':live})
    page.locator('[data-tab="prep"]').click()
    assert page.locator('.step4-recipe-row').count()==1
    assert page.locator('.step4-recipe-row select').input_value()=='curry_03'
    assert page.locator('.step4-recipe-row input').input_value()=='11'
    page.locator('.step4-remove-recipe').click()
    assert page.locator('.step4-recipe-row').count()==0
    page.locator('#prepCalculate').click()
    assert not page.locator('#prepError').is_visible(),page.locator('#prepError').inner_text()
    assert '10食分' in page.locator('#prepSummary').inner_text()
    assert not errors,errors
    page.screenshot(path=str(root/'dist'/'step1-mobile-preview.png'),full_page=True)
    print('PASS: mobile CSV, XSS safety, 5-member cap, backup/restore, STEP4 mixed recipes/reload/remove, errors 0')
    browser.close()


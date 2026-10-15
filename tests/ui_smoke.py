from pathlib import Path
from playwright.sync_api import sync_playwright
import tempfile
root=Path(__file__).resolve().parent.parent
head=['ニックネーム','ポケモン','レベル','スキルレベル','食材1','食材2','食材3','メインスキル','せいかく','Lv10','Lv25','Lv50','Lv70','Lv80','一緒に眠った時間','色違い']
rows=[]
for i in range(7):
    rows.append([f'育成{i}','ピカチュウ',str(20+i),'3','とくせんリンゴ','とくせんリンゴ','とくせんリンゴ','エナジーチャージS','まじめ','','','','','','0','0'])
import csv,io
s=io.StringIO();w=csv.writer(s);w.writerow(head);w.writerows(rows)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=2,is_mobile=True,has_touch=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
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
    page.locator('[data-tab="box"]').click()
    # invalid CSV does not wipe existing data
    page.locator('#csvFile').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':b'x,y\na,b'})
    assert page.locator('#boxTotal').inner_text()=='7匹'
    assert page.locator('#importError').is_visible()
    assert not errors,errors
    page.screenshot(path=str(root/'dist'/'step1-mobile-preview.png'),full_page=True)
    print('PASS: mobile event settings, 7-row CSV, 5-member cap, persistence, 2-week settings, malformed import rollback, console errors 0')
    browser.close()


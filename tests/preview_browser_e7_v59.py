"""E7 v59 actual Chromium: headers, sprite grid, prefix search, safe Box mutations."""
import functools, json, threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'

def item(pokemon,nickname,level):
    return dict(nickname=nickname,pokemon=pokemon,level=level,skillLevel=4,
      ing1='とくせんリンゴ',ing2='モーモーミルク',ing3='リラックスカカオ',
      mainSkill='げんきチャージS',nature='おだやか',mint=False,
      lv10='おてつだいボーナス',lv25='スキル確率アップM',lv50=None,
      lv70=None,lv80=None,ribbon=0,shiny=False,favorite=None)

initial=[item('イーブイ','ラテ',55),item('イーブイ','ラテ',56),
 item('ピカチュウ','ぴか',45),item('ヒノアラシ','しゅう',50),
 item('カビゴン','カビゴン',32)]
key='pokesleep-strategy-e7-box-v1'
def data(items): return {'version':1,'source':'pokesleep-tool-header-mapped','items':items}

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':393,'height':852},timezone_id='Asia/Tokyo')
        page=context.new_page()
        errors=[];prompts=[];native=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:(native.append(d.message),d.dismiss()))
        page.goto(BASE+'?tab=box',wait_until='domcontentloaded')
        page.evaluate("""(payload)=>{
          localStorage.setItem('pokesleep-strategy-e7-box-v1',JSON.stringify(payload));
          localStorage.setItem('pokesleep-strategy-v59-event-sentinel','keep-event');
          localStorage.setItem('another-pwa-value','keep-other');
        }""",data(initial))
        page.reload(wait_until='domcontentloaded')
        def tab(name):
            page.locator('#tab-'+name).click()
            page.wait_for_function("""t=>{
              const f=document.getElementById('view-'+t);
              return document.documentElement.dataset.activeTab===t&&
                !f.hidden&&document.getElementById('status').hidden&&
                f.contentDocument?.readyState!=='loading';
            }""",arg=name,timeout=20000)
            return page.frame_locator('#view-'+name)
        box=tab('box')
        box.locator('#box-list .box-entry').first.wait_for()
        assert box.locator('#box-list .box-entry').count()==5
        assert box.locator('#box-registration').is_visible()
        assert box.locator('#box-registration').evaluate('(el)=>el.getBoundingClientRect().top') < box.locator('#box-title').evaluate('(el)=>el.getBoundingClientRect().top')
        assert box.locator('#box-clear').text_content().strip()=='全削除'
        assert box.locator('#box-clear').is_hidden()
        assert not box.locator('#e7-import-panel').evaluate('(el)=>el.open')
        assert box.locator('#box-list').evaluate('(el)=>getComputedStyle(el).gridTemplateColumns.split(" ").length')==4
        assert box.locator('.box-entry').first.locator('.box-level').inner_text()=='Lv. 56'
        assert box.locator('.box-entry').first.locator('.box-nickname').inner_text()=='ラテ'
        assert box.locator('.box-entry').filter(has_text='ぴか').locator('img[data-sprite-url]').get_attribute('data-sprite-url').endswith('/25.png')
        assert box.locator('.box-entry').first.locator('.box-avatar').evaluate('(el)=>getComputedStyle(el).borderTopStyle')=='solid'

        # Species and nickname each use normalized prefix, never substring.
        for query,count in [('らて',2),('ﾋﾟｶ',1),('ひの',1),('かび',1),('かちゅ',0),('て',0)]:
            box.locator('#box-query').fill(query)
            assert box.locator('#box-list .box-entry').count()==count,(query,count)
        box.locator('#box-query').fill('')

        # Duplicate nickname: deleting the second must leave the first intact.
        box.locator('.box-entry').first.locator('.box-avatar').click()
        assert box.locator('#box-detail-dialog').is_visible()
        assert box.locator('#box-detail-level').inner_text()=='Lv.56'
        assert box.locator('#box-detail-fields .iv-key').count()>=2
        assert box.locator('#box-detail-subskills .iv-skill').count()==5
        box.locator('#box-delete').click()
        box.locator('#e7-feedback-dialog').wait_for(state='visible')
        prompts.append(box.locator('#e7-feedback-message').inner_text())
        box.locator('#e7-feedback-cancel').click()
        assert box.locator('.box-entry').count()==5,'Cancelled delete changed Box'
        assert box.locator('#box-detail-dialog').is_visible()
        box.locator('#box-delete').click()
        box.locator('#e7-feedback-dialog').wait_for(state='visible')
        box.locator('#e7-feedback-ok').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items.length===4""")
        assert box.locator('.box-entry').count()==4
        remaining=page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items""")
        assert [r['level'] for r in remaining if r['nickname']=='ラテ']==[55]
        assert any('Lv.56' in x for x in prompts)

        # Header fonts and positions are consistent at each phone width.
        for width in (320,393,430):
            page.set_viewport_size({'width':width,'height':852})
            shapes={}
            for name in ('plan','prep','box'):
                child=tab(name)
                shapes[name]=child.locator('header.mast,header.header').evaluate("""el=>{
                  const b=el.querySelector('.brand'),r=el.getBoundingClientRect(),s=getComputedStyle(b);
                  return {left:r.left,right:r.right,font:s.fontSize,weight:s.fontWeight};
                }""")
                if name=='prep':
                    assert child.locator('#u2-week-label').is_hidden()
            for name in ('plan','prep','box'):
                assert shapes[name]['font']==('17px' if width<=360 else '19px') and shapes[name]['weight']=='800',shapes
                assert abs(shapes[name]['left']-shapes['box']['left'])<=2,(width,shapes)
                assert abs(shapes[name]['right']-shapes['box']['right'])<=2,(width,shapes)
        page.set_viewport_size({'width':393,'height':852})
        box=tab('box')

        # Full delete confirmation protects every non-Box key.
        box.locator('#e7-import-panel > summary').click()
        assert box.locator('#box-clear').is_visible()
        box.locator('#box-clear').click()
        box.locator('#e7-feedback-dialog').wait_for(state='visible')
        prompts.append(box.locator('#e7-feedback-message').inner_text())
        box.locator('#e7-feedback-cancel').click()
        assert box.locator('.box-entry').count()==4
        box.locator('#box-clear').click()
        box.locator('#e7-feedback-dialog').wait_for(state='visible')
        box.locator('#e7-feedback-ok').click()
        page.wait_for_function("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items.length===0""")
        assert box.locator('#box-clear').is_disabled()
        assert box.locator('.box-empty').is_visible()
        assert any('4匹' in x for x in prompts)
        assert page.evaluate("""()=>localStorage.getItem('pokesleep-strategy-v59-event-sentinel')""")=='keep-event'
        assert page.evaluate("""()=>localStorage.getItem('another-pwa-value')""")=='keep-other'

        # If the persisted version differs, a stale modal may not delete it.
        box=tab('box')
        box.locator('#e7-more-open').click()
        box.locator('#e7-more-backup').click()
        page.wait_for_function("""()=>document.getElementById('e7-settings-dialog')?.open""",timeout=15000)
        page.locator('#e7-settings-close').click()
        box=tab('box')
        box.locator('#box-query').fill('')
        box.locator('#box-query').evaluate("""el=>{
          localStorage.setItem('pokesleep-strategy-e7-box-v1',JSON.stringify({
            version:1,source:'pokesleep-tool-header-mapped',items:[{
              nickname:'original',pokemon:'イーブイ',level:55,skillLevel:4,
              ing1:null,ing2:null,ing3:null,mainSkill:null,nature:'おだやか',
              mint:null,lv10:null,lv25:null,lv50:null,lv70:null,lv80:null,
              ribbon:null,shiny:null,favorite:null
            }]
          }));
        }""")
        page.reload(wait_until='domcontentloaded')
        box=tab('box')
        box.locator('.box-avatar').first.click()
        box.locator('#box-detail-avatar').evaluate("""el=>{
          const key='pokesleep-strategy-e7-box-v1',box=JSON.parse(localStorage.getItem(key));
          box.items.push({...box.items[0],nickname:'external'});
          localStorage.setItem(key,JSON.stringify(box));
        }""")
        box.locator('#box-delete').click()
        box.locator('#e7-feedback-dialog').wait_for(state='visible')
        box.locator('#e7-feedback-ok').click()
        assert page.evaluate("""()=>JSON.parse(localStorage.getItem('pokesleep-strategy-e7-box-v1')).items.length""")==2
        box.locator('#e7-feedback-toast').wait_for(state='visible')
        assert '削除できませんでした' in box.locator('#e7-feedback-toast').inner_text()
        box.locator('#box-detail-close').click()
        assert not native,native
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()
print('E7 v59 browser: 4-column roster, kana prefix, details, deletes, headers, data safety PASS')

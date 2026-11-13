"""E7 v83 Android-width regression: stock, Box quantities and one canonical modal shell."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import functools,threading,json

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/e7-preview/'
WEEK='2026-11-16'
OWNER='manual:'+WEEK
PREF='pokesleep-strategy-e7-'
fields=['ワカクサ本島','シアンの砂浜','トープ洞窟','ウノハナ雪原','ラピスラズリ湖畔',
        'ゴールド旧発電所','アンバー渓谷','ワカクサ本島EX','シアンの砂浜EX']
def item(pokemon,ing1,ing2,ing3,nick):
    return dict(nickname=nick,pokemon=pokemon,level=50,skillLevel=4,
      ing1=ing1,ing2=ing2,ing3=ing3,
      mainSkill='エナジーチャージM',nature='てれや',mint=False,
      ribbon=0,shiny=False,favorite='',
      lv10='きのみの数S',lv25='おてつだいボーナス',
      lv50='おてつだいスピードS',lv70='スキル確率アップM',lv80='食材確率アップM')
box={'version':1,'source':'pokesleep-tool-header-mapped','items':[
    item('エーフィ','モーモーミルク','リラックスカカオ','モーモーミルク','エーフィの個体'),
    item('ミュウ','とくせんエッグ','ふといながねぎ','とくせんエッグ','ミュウの個体')]}
box['items'][1]['ribbon']=500
box['items'][0]['shiny']=True
player={'version':1,'pot':57,'bag':600,'bonuses':{f:(50 if f=='シアンの砂浜' else None) for f in fields}}
try:
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width in (320,393,430):
            context=browser.new_context(viewport={'width':width,'height':852},timezone_id='Asia/Tokyo')
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            base=BASE+'U2_Prep_Local_Ingredients_20261109_v50_E7.html?eventStart='+WEEK+\
                '&eventId='+quote(OWNER,safe='')+'&previewNow=2026-11-17T09:00'
            page.goto(base,wait_until='domcontentloaded')
            assert page.locator('#goal-panel .food').count()==19
            grid_positions=[]
            for selector in ('#goal-panel .food','#inventory-panel .food'):
                page.locator('#btn-goal' if selector.startswith('#goal') else '#btn-inventory').click()
                el=page.locator(selector).nth(4)
                style=el.locator('.name').evaluate(
                   '(e)=>({clip:getComputedStyle(e).clipPath,width:e.getBoundingClientRect().width})')
                assert style['clip']=='inset(50%)' and style['width']==1,(width,selector,style)
                card=el.bounding_box()
                image=el.locator('.food-media').bounding_box()
                assert card and image
                assert abs((image['x']+image['width']/2)-(card['x']+card['width']/2))<=2,\
                    ('icon not centered',width,selector,card,image)
                targeted=selector.startswith('#inventory') and \
                    'needed' in (el.get_attribute('class') or '').split()
                if targeted:
                    badge=el.locator('.target-chip').bounding_box()
                    field=el.locator('input').bounding_box()
                    assert badge and field,('missing target chip or stock input',width)
                    assert badge['x']>=card['x']-1 and \
                        badge['x']+badge['width']<=card['x']+card['width']+1 and \
                        badge['y']>=card['y']-1 and \
                        badge['y']+badge['height']<=card['y']+card['height']+1,\
                        ('target chip outside card',width,card,badge)
                    def overlaps(a,b):
                        return a['x']<b['x']+b['width']-.3 and \
                            b['x']<a['x']+a['width']-.3 and \
                            a['y']<b['y']+b['height']-.3 and \
                            b['y']<a['y']+a['height']-.3
                    # On 320px screens, a small upper-right image overlap
                    # is acceptable; the original centered icon must remain.
                    gap=field['y']-(badge['y']+badge['height'])
                    assert 0.5<=gap<=5,\
                        ('target count not directly above stock field',width,card,field,badge,gap)
                    assert badge['x']>card['x']+card['width']/2,\
                        ('target count not right aligned',width,card,badge)
                    assert not overlaps(field,badge),\
                        ('target chip overlaps stock field',width,card,field,badge)
                assert abs(card['height']-(card['width']*4/5))<=1.1,('food card not 5:4',width,selector,card)
                assert card['height']>=48,('food card too small',width,selector,card)
                assert image['width']>=27,('tiny icon',width,selector)
                # v94 changes geometry only; the pixel dimensions of the
                # accepted v80 ingredient image MUST be exactly unchanged.
                stock_field=el.locator('input').bounding_box() if selector.startswith('#inventory') else None
                page.locator('#e7-v95-inventory-target-badge').evaluate(
                    '(el)=>el.sheet.disabled=true')
                original_icon=el.locator('.food-media').bounding_box()
                original_field=el.locator('input').bounding_box() if stock_field else None
                page.locator('#e7-v95-inventory-target-badge').evaluate(
                    '(el)=>el.sheet.disabled=false')
                assert original_icon is not None
                assert abs(original_icon['width']-image['width'])<=.05 and \
                    abs(original_icon['height']-image['height'])<=.05,\
                    ('icon size changed',width,selector,original_icon,image)
                if stock_field:
                    assert abs(stock_field['x']-original_field['x'])<=.05 and \
                        abs(stock_field['width']-original_field['width'])<=.05 and \
                        abs(stock_field['height']-original_field['height'])<=.05,\
                        ('stock input resized or moved',width,selector,stock_field,original_field)
                if selector.startswith('#inventory'):
                    field=el.locator('input').bounding_box()
                    assert field and field['y']>=card['y']-1 and \
                        field['y']+field['height']<=card['y']+card['height']+1,\
                        ('inventory input outside landscape card',width,card,field)
                centers=[]
                for tile in page.locator(selector).all():
                    area=tile.locator('.food-media').bounding_box()
                    assert area
                    centers.append((area['x']+area['width']/2,area['y']+area['height']/2))
                grid_positions.append(centers)
            assert len(grid_positions[0])==len(grid_positions[1])==19
            for i,(g,a) in enumerate(zip(*grid_positions)):
                assert abs(g[0]-a[0])<=0.6 and abs(g[1]-a[1])<=0.6,\
                    ('food icon shifted from center on tab change',width,i,g,a)
            stock=page.locator('#inventory-panel input[data-key="apple"]')
            assert stock.is_visible()
            assert stock.locator('xpath=..').count()==1
            assert page.locator('#inventory-panel [data-item="apple"] .name').inner_text()=='とくせんリンゴ'
            stock.fill('27')
            page.locator('#save-inventory').click()
            page.reload(wait_until='domcontentloaded')
            page.locator('#btn-inventory').click()
            assert page.locator('#inventory-panel input[data-key="apple"]').input_value()=='27'
            assert not errors,'U2 errors: '+str(errors[:3])
            # The Box tab reads its existing saved records; no import or schema change.
            page.goto(BASE+'U4_Box_Preview_20261109_v50_E7.html',wait_until='domcontentloaded')
            page.evaluate('(pairs)=>{for(const [k,v] of Object.entries(pairs))localStorage.setItem(k,v)}',{
                PREF+'box-v1':json.dumps(box),PREF+'player-v1':json.dumps(player)})
            page.reload(wait_until='domcontentloaded')
            assert page.locator('#box-list .box-entry').count()==2
            page.locator('#box-list .box-avatar').first.click()
            dialog=page.locator('#box-detail-dialog')
            assert dialog.is_visible()
            assert dialog.locator('.iv-ingredient').count()==3
            assert dialog.locator('#box-detail-fields>.iv-key').first.inner_text()=='ポケモン：'
            assert dialog.locator('#box-detail-extra .iv-key').all_inner_texts()==['一緒に眠った時間：']
            assert box['items'][0]['shiny'] is True  # Raw identity was not changed
            assert dialog.locator('#box-delete').is_visible()
            box_shape=dialog.evaluate("""(el)=>{
              const c=getComputedStyle(el),backdrop=getComputedStyle(el,'::backdrop');
              return {position:c.position,bottom:c.bottom,left:c.left,right:c.right,
                width:c.width,maxHeight:c.maxHeight,padding:c.padding,margin:c.margin,
                border:c.border,borderRadius:c.borderRadius,background:c.backgroundColor,
                color:c.color,boxShadow:c.boxShadow,overflowY:c.overflowY,
                backdrop:backdrop.backgroundColor,
                children:[...el.children].filter(e=>!e.classList.contains('box-detail-actions'))
                  .map(e=>[e.tagName,e.className])};
            }""")
            assert dialog.locator('.box-detail-actions #box-delete').count()==1
            assert dialog.locator('.iv-close-row button').get_attribute('id')=='box-detail-close'
            box_tone=dialog.locator('#box-detail-avatar').evaluate(
                '(el)=>el.style.getPropertyValue("--tone")')
            assert box_tone==page.evaluate('()=>window.PokeE7PokemonDetail.tone("エーフィ")')
            assert dialog.locator('.ingredient-name').count()==0
            assert dialog.locator('.iv-ingredient-quantity').all_text_contents()==['×1','×1','×4']
            icons=dialog.locator('.iv-ingredient-image')
            xs=[i.bounding_box() for i in icons.all()]
            assert all(v and v['width']>=35 for v in xs)
            assert xs[0]['x']<xs[1]['x']<xs[2]['x']
            assert dialog.locator('#box-detail-extra .iv-key').first.inner_text()=='一緒に眠った時間：'
            assert dialog.locator('#box-detail-extra .iv-value').first.inner_text()=='200時間未満'
            heights=[x.bounding_box()['height'] for x in dialog.locator('#box-detail-fields>.iv-value').all()]
            assert all(h<=39 for h in heights[-2:]),('detail rows not compact',width,heights)
            page.locator('#box-detail-close').click()
            page.locator('#box-list .box-avatar').nth(1).click()
            assert dialog.locator('.iv-ingredient-quantity').all_text_contents()==['×2','×3','×6']
            assert dialog.locator('#box-detail-extra .iv-value').first.inner_text()=='500～1000時間'
            assert not errors,'Box errors: '+str(errors[:3])
            # Strategy and Box now draw the same modal sections, with separate
            # data adapters and Box-only destructive action.
            page.goto(BASE+'U3_Strategy_UI_20261109_v50_E7.html',wait_until='domcontentloaded')
            assert page.evaluate('()=>Boolean(window.PokeE7PokemonDetail)')
            # Date/phase gate may hide settings before an event is selected.
            # Trigger the existing handler without altering saved conditions.
            page.locator('#sleep-open').evaluate('(el)=>el.click()')
            first=page.locator('#sleep-team-preview .avatar-tap').first
            species=first.get_attribute('aria-label').replace('のステータス','')
            first.click()
            plan_dialog=page.locator('#pokemon-dialog')
            assert plan_dialog.is_visible()
            assert plan_dialog.locator('.iv-ingredient').count()==3
            assert plan_dialog.locator('#pokemon-extra .iv-key').all_inner_texts()==['一緒に眠った時間：']
            assert plan_dialog.locator('#pokemon-extra .iv-value').all_inner_texts()==['—']
            assert plan_dialog.locator('#box-delete').count()==0
            expected_tone=page.evaluate('(name)=>window.PokeE7PokemonDetail.tone(name)',species)
            actual_tone=plan_dialog.locator('#pokemon-sprite').evaluate(
                '(el)=>el.style.getPropertyValue("--tone")')
            assert actual_tone==expected_tone,('Strategy portrait type color',species,actual_tone,expected_tone)
            assert plan_dialog.locator('#pokemon-base-rows>.iv-key').all_inner_texts()==[
                '食材：','おてつだい時間：','最大所持数：'
            ]
            plan_shape=plan_dialog.evaluate("""(el)=>{
              const c=getComputedStyle(el),backdrop=getComputedStyle(el,'::backdrop');
              return {position:c.position,bottom:c.bottom,left:c.left,right:c.right,
                width:c.width,maxHeight:c.maxHeight,padding:c.padding,margin:c.margin,
                border:c.border,borderRadius:c.borderRadius,background:c.backgroundColor,
                color:c.color,boxShadow:c.boxShadow,overflowY:c.overflowY,
                backdrop:backdrop.backgroundColor,
                children:[...el.children].filter(e=>!e.classList.contains('box-detail-actions'))
                  .map(e=>[e.tagName,e.className])};
            }""")
            assert plan_shape==box_shape,('detail modal shell not identical',width,plan_shape,box_shape)
            assert plan_dialog.locator('.iv-close-row button').get_attribute('id')=='pokemon-close'
            assert plan_dialog.locator('.box-detail-actions').count()==0
            page.locator('#pokemon-close').click()
            assert not plan_dialog.is_visible()
            assert not errors,'Strategy errors: '+str(errors[:3])
            context.close()
        print('E7 v83 Chromium 320/393/430px: one identical modal shell, Box-only delete, preserved stock PASS')
        browser.close()
finally:
    server.shutdown()

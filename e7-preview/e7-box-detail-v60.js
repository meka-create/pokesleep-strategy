/* E7 v60 Box detail draws the same sections and layout as U3 status.
   This renderer uses imported Box fields only; missing numeric stats stay unknown. */
(function(root){'use strict';
const TYPES={"normal":"#c7b7a3","fire":"#dd9b84","water":"#89c6de","electric":"#eccb6c","grass":"#81c49e","ice":"#a1d9e4","fighting":"#cd9d86","poison":"#b8a2ce","ground":"#c9ad83","flying":"#a9bfe0","psychic":"#c4a3e7","bug":"#a5c887","rock":"#b9af94","ghost":"#a8a6d8","dragon":"#a7d294","dark":"#a9adb9","steel":"#a0bddd","fairy":"#e5a5d3"};
const SPECIES=new Map((root.PokeMaster?.species||[]).map(x=>[x.name,x]));
const INGREDIENTS=new Map([["ふといながねぎ","assets/ingredients/ingredient-01.png"],["あじわいキノコ","assets/ingredients/ingredient-02.png"],["とくせんエッグ","assets/ingredients/ingredient-03.png"],["ほっこりポテト","assets/ingredients/ingredient-04.png"],["とくせんリンゴ","assets/ingredients/ingredient-05.png"],["げきからハーブ","assets/ingredients/ingredient-06.png"],["マメミート","assets/ingredients/ingredient-07.png"],["モーモーミルク","assets/ingredients/ingredient-08.png"],["あまいミツ","assets/ingredients/ingredient-09.png"],["ピュアなオイル","assets/ingredients/ingredient-10.png"],["あったかジンジャー","assets/ingredients/ingredient-11.png"],["あんみんトマト","assets/ingredients/ingredient-12.png"],["リラックスカカオ","assets/ingredients/ingredient-13.png"],["おいしいシッポ","assets/ingredients/ingredient-14.png"],["ワカクサ大豆","assets/ingredients/ingredient-15.png"],["ワカクサコーン","assets/ingredients/ingredient-16.png"],["めざましコーヒー","assets/ingredients/ingredient-17.png"],["ずっしりカボチャ","assets/ingredients/ingredient-18.png"],["つやつやアボカド","assets/ingredients/ingredient-19.png"]]);
const NATURE_STATS=['おてつだいスピード','げんき回復量','食材おてつだい確率','メインスキル発生確率','EXP獲得量'];
const NATURE_GRID=[
 ['がんばりや','さみしがり','いじっぱり','やんちゃ','ゆうかん'],
 ['ずぶとい','すなお','わんぱく','のうてんき','のんき'],
 ['ひかえめ','おっとり','てれや','うっかりや','れいせい'],
 ['おだやか','おとなしい','しんちょう','きまぐれ','なまいき'],
 ['おくびょう','せっかち','ようき','むじゃき','まじめ']
];
const NATURE_EFFECTS=new Map(NATURE_GRID.flatMap((row,i)=>row.map((name,j)=>[name,i===j?[]:[NATURE_STATS[i],NATURE_STATS[j]]])));
const GRADES={
 gold:new Set(['睡眠EXPボーナス','おてつだいボーナス','げんき回復ボーナス','ゆめのかけらボーナス','リサーチEXPボーナス','きのみの数S','スキルレベルアップM']),
 blue:new Set(['スキルレベルアップS','最大所持数アップL','最大所持数アップM','おてつだいスピードM','食材確率アップM','スキル確率アップM']),
 white:new Set(['最大所持数アップS','おてつだいスピードS','食材確率アップS','スキル確率アップS'])
};
const $=id=>document.getElementById(id);
const grade=name=>Object.keys(GRADES).find(k=>GRADES[k].has(name))||'unknown';
function tone(item){
 const key=String(item?.pokemon||'').normalize('NFKC').replace(/\s*\(/g,' (').trim();
 return TYPES[SPECIES.get(key)?.type]||'#8ca2b5';
}
function value(key,content){
 const label=document.createElement('div');label.className='iv-key';
 label.textContent=key+(['食材','おてつだい時間','最大所持数','せいかく'].includes(key)?'：':'');
 const cell=document.createElement('div');cell.className='iv-value';
 if(typeof content==='string')cell.textContent=content;else cell.append(content);
 return [label,cell];
}
function render(item){
 const name=item.nickname||item.pokemon;
 $('box-detail-name').textContent=name;
 $('box-detail-level').textContent='Lv.'+item.level;
 const hero=$('box-detail-avatar');hero.innerHTML=root.PokeSprite.icon(item);
 hero.style.setProperty('--tone',tone(item));
 const base=$('box-detail-fields');base.replaceChildren();
 if(name!==item.pokemon)base.append(...value('ポケモン',item.pokemon));
 const ingredientGroup=document.createElement('div');ingredientGroup.className='iv-ingredients';
 for(const [index,raw] of [item.ing1,item.ing2,item.ing3].entries()){
  const el=document.createElement('span');el.className='iv-ingredient';
  const icon=document.createElement('span');icon.className='iv-ingredient-image';
  const ing=typeof raw==='string'&&raw.trim()?raw.trim():'—';
  const image=INGREDIENTS.get(ing);
  if(image){const img=document.createElement('img');img.src=image;img.alt='';img.loading='lazy';img.decoding='async';icon.append(img);}
  else icon.textContent='—';
  // Species-specific count depends on both ingredient and ingredient slot.
  // Unknown/out-of-scope forms retain an explicit dash, never a guessed count.
  const count=root.PokeE7IngredientQuantities?.get(item.pokemon,ing,index+1)??null;
  const quantity=document.createElement('span');quantity.className='iv-ingredient-quantity';
  quantity.textContent=count===null?'—':'×'+count;
  icon.append(quantity);
  el.setAttribute('role','img');
  el.setAttribute('aria-label',ing+(count===null?'・個数未確認':' '+count+'個'));
  el.append(icon);ingredientGroup.append(el);
 }
 base.append(...value('食材',ingredientGroup));
 base.append(...value('おてつだい時間','—'));
 base.append(...value('最大所持数','—'));
 const skill=$('box-detail-main-skill');skill.replaceChildren();
 const title=document.createElement('span');title.textContent=item.mainSkill||'—';
 const sl=document.createElement('em');sl.textContent='Lv.'+item.skillLevel;
 skill.append(title,sl);
 const skills=$('box-detail-subskills');skills.replaceChildren();
 for(const [i,key] of ['lv10','lv25','lv50','lv70','lv80'].entries()){
  const level=[10,25,50,70,80][i],known=String(item[key]||'').trim();
  const badge=document.createElement('div');
  const kind=known?grade(known):'unknown';
  badge.className='iv-skill '+kind+(item.level<level?' locked':'');
  badge.setAttribute('aria-label',known?known+'、Lv.'+level+(item.level<level?'未解放':'解放済み'):'Lv.'+level+'未登録');
  const text=document.createElement('span');text.textContent=known||'—';badge.append(text);skills.append(badge);
 }
 const nature=$('box-detail-nature');nature.replaceChildren();
 const row=document.createElement('div');row.className='iv-nature-row';
 const pill=document.createElement('strong');pill.className='iv-nature-pill';
 pill.textContent=item.nature;row.append(pill);
 const changes=document.createElement('div');changes.className='iv-nature-modifiers';
 const modifiers=NATURE_EFFECTS.get(item.nature);
 if(item.mint===true||!modifiers?.length){
  const span=document.createElement('span');span.className='iv-nature-none';
  span.textContent=item.mint===true?'まっしろミント使用（補正なし）':modifiers?'補正なし':'—';changes.append(span);
 }else{
  for(const [kind,stat,arrows,desc] of [['up',modifiers[0],'▲▲','上昇'],['down',modifiers[1],'▼▼','下降']]){
   const entry=document.createElement('div');entry.className='iv-nature-effect '+kind;
   entry.setAttribute('aria-label',desc+'補正：'+stat);
   const text=document.createElement('span');text.textContent=stat;
   const symbol=document.createElement('b');symbol.textContent=arrows;entry.append(text,symbol);changes.append(entry);
  }
 }
 row.append(changes);nature.append(row);
 const extra=$('box-detail-extra');extra.replaceChildren();
 extra.append(...value('一緒に眠った時間',item.ribbon===null?'—':String(item.ribbon)));
 if(item.shiny===true)extra.append(...value('色違い','はい'));
 if(item.favorite)extra.append(...value('お気に入り',String(item.favorite)));
 root.PokeSprite.enhance($('box-detail-dialog'));
}
root.E7BoxDetail=Object.freeze({tone,render});
})(window);

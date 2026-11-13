/* E7 v81: canonical status-detail renderer shared by Strategy (illustrative) and
   Box (imported individuals). No persistence, deletion, or calculation occurs here. */
(function(root){'use strict';
const FOOD_NAMES=[
 'ふといながねぎ','あじわいキノコ','とくせんエッグ','ほっこりポテト',
 'とくせんリンゴ','げきからハーブ','マメミート','モーモーミルク',
 'あまいミツ','ピュアなオイル','あったかジンジャー','あんみんトマト',
 'リラックスカカオ','おいしいシッポ','ワカクサ大豆','ワカクサコーン',
 'めざましコーヒー','ずっしりカボチャ','つやつやアボカド'];
const ingredientIcons=Object.freeze(Object.fromEntries(FOOD_NAMES.map((name,i)=>[
 name,'assets/ingredients/ingredient-'+String(i+1).padStart(2,'0')+'.png'
])));
const COLORS=Object.freeze({
 normal:'#c7b7a3',fire:'#dd9b84',water:'#89c6de',electric:'#eccb6c',
 grass:'#81c49e',ice:'#a1d9e4',fighting:'#cd9d86',poison:'#b8a2ce',
 ground:'#c9ad83',flying:'#a9bfe0',psychic:'#c4a3e7',bug:'#a5c887',
 rock:'#b9af94',ghost:'#a8a6d8',dragon:'#a7d294',dark:'#a9adb9',
 steel:'#a0bddd',fairy:'#e5a5d3'
});
const GRADES={
 gold:new Set(['睡眠EXPボーナス','おてつだいボーナス','げんき回復ボーナス',
  'ゆめのかけらボーナス','リサーチEXPボーナス','きのみの数S','スキルレベルアップM']),
 blue:new Set(['スキルレベルアップS','最大所持数アップL','最大所持数アップM',
  'おてつだいスピードM','食材確率アップM','スキル確率アップM']),
 white:new Set(['最大所持数アップS','おてつだいスピードS',
  '食材確率アップS','スキル確率アップS'])
};
const NATURE_STATS=['おてつだいスピード','げんき回復量','食材おてつだい確率',
 'メインスキル発生確率','EXP獲得量'];
const NATURE_GRID=[
 ['がんばりや','さみしがり','いじっぱり','やんちゃ','ゆうかん'],
 ['ずぶとい','すなお','わんぱく','のうてんき','のんき'],
 ['ひかえめ','おっとり','てれや','うっかりや','れいせい'],
 ['おだやか','おとなしい','しんちょう','きまぐれ','なまいき'],
 ['おくびょう','せっかち','ようき','むじゃき','まじめ']
];
const NATURE_EFFECTS=new Map(NATURE_GRID.flatMap((row,i)=>row.map((name,j)=>[
 name,i===j?[]:[NATURE_STATS[i],NATURE_STATS[j]]
])));
const NORMALIZE=name=>String(name||'').normalize('NFKC').replace(/\s*\(/g,' (').trim();
const FIELD_IDS={
 plan:{
  dialog:'pokemon-dialog',avatar:'pokemon-sprite',nickname:'pokemon-nickname',
  level:'pokemon-level',base:'pokemon-base-rows',main:'pokemon-main-skill',
  skills:'pokemon-subskills',nature:'pokemon-nature',extra:'pokemon-extra'
 },
 box:{
  dialog:'box-detail-dialog',avatar:'box-detail-avatar',nickname:'box-detail-name',
  level:'box-detail-level',base:'box-detail-fields',main:'box-detail-main-skill',
  skills:'box-detail-subskills',nature:'box-detail-nature',extra:'box-detail-extra'
 }
};
function grade(name){for(const [key,names] of Object.entries(GRADES))if(names.has(name))return key;return 'unknown';}
function tone(pokemon){
 const name=NORMALIZE(typeof pokemon==='string'?pokemon:pokemon?.pokemon);
 const profile=(root.PokeMaster?.species||[]).find(p=>p.name===name);
 return COLORS[profile?.type]||'#8ca2b5';
}
// pokesleep-tool stores a ribbon's lower threshold in hours; its UI displays a band.
function formatSharedSleepHours(hours){
 if(!Number.isSafeInteger(hours)||hours<0)return '—';
 if(hours>=2000)return '2000時間以上';
 if(hours>=1000)return '1000～2000時間';
 if(hours>=500)return '500～1000時間';
 if(hours>=200)return '200～500時間';
 return '200時間未満';
}
function field(doc,key,content){
 const label=doc.createElement('div');label.className='iv-key';label.textContent=key+'：';
 const cell=doc.createElement('div');cell.className='iv-value';
 if(typeof content==='string')cell.textContent=content;
 else cell.append(content);
 return [label,cell];
}
function foodGroup(doc,foods){
 const group=doc.createElement('div');group.className='iv-ingredients';
 for(const row of foods){
  const ingredient=doc.createElement('span');ingredient.className='iv-ingredient';
  const frame=doc.createElement('span');frame.className='iv-ingredient-image';
  const name=String(row?.name||'—').trim()||'—';
  const url=ingredientIcons[name];
  if(url){
   const img=doc.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.decoding='async';
   frame.append(img);
  }else frame.append(doc.createTextNode('—'));
  const count=Number.isInteger(row?.count)&&row.count>0?row.count:null;
  const badge=doc.createElement('span');badge.className='iv-ingredient-quantity';
  badge.textContent=count===null?'—':'×'+count;
  frame.append(badge);
  ingredient.setAttribute('role','img');
  ingredient.setAttribute('aria-label',name+(count===null?'・個数未確認':' '+count+'個'));
  ingredient.append(frame);group.append(ingredient);
 }
 return group;
}
function subskills(doc,skills,level){
 const result=doc.createDocumentFragment();
 for(const [i,limit] of [10,25,50,70,80].entries()){
  const label=String(skills[i]||'').trim(),band=label?grade(label):'unknown';
  const locked=Number(level)<limit;
  const badge=doc.createElement('div');badge.className='iv-skill '+band+(locked?' locked':'');
  badge.setAttribute('aria-label',label?label+'、Lv.'+limit+(locked?'未解放':'解放済み'):'Lv.'+limit+'未登録');
  const text=doc.createElement('span');text.textContent=label||'—';badge.append(text);
  result.append(badge);
 }
 return result;
}
function natureRow(doc,name,mint){
 const row=doc.createElement('div');row.className='iv-nature-row';
 const pill=doc.createElement('strong');pill.className='iv-nature-pill';
 pill.textContent=name||'—';row.append(pill);
 const changes=doc.createElement('div');changes.className='iv-nature-modifiers';
 const modifiers=NATURE_EFFECTS.get(name);
 if(mint===true||!modifiers?.length){
  const neutral=doc.createElement('span');neutral.className='iv-nature-none';
  neutral.textContent=mint===true?'まっしろミント使用（補正なし）':modifiers?'補正なし':'—';
  changes.append(neutral);
 }else{
  for(const [direction,stat,arrows,description] of [
   ['up',modifiers[0],'▲▲','上昇'],['down',modifiers[1],'▼▼','下降']
  ]){
   const entry=doc.createElement('div');entry.className='iv-nature-effect '+direction;
   entry.setAttribute('aria-label',description+'補正：'+stat);
   const text=doc.createElement('span');text.textContent=stat;
   const symbol=doc.createElement('b');symbol.textContent=arrows;
   entry.append(text,symbol);changes.append(entry);
  }
 }
 row.append(changes);return row;
}
/* Both views use identical DOM structure. Each caller only supplies its actual
   data, portrait driver and optional local actions; deletion remains Box-owned. */
function render(mode,data,paintPortrait){
 const ids=FIELD_IDS[mode];if(!ids)throw new Error('Unknown Pokémon detail view');
 const doc=root.document;
 const nodes=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,doc.getElementById(id)]));
 if(Object.values(nodes).some(node=>!node))throw new Error('Missing Pokémon detail mount');
 const nickname=data.nickname||data.pokemon;
 nodes.nickname.textContent=nickname;
 nodes.level.textContent='Lv.'+data.level;
 nodes.avatar.replaceChildren();
 nodes.avatar.className='status-portrait'+(mode==='plan'?' sprite-stage':'');
 nodes.avatar.style.setProperty('--tone',tone(data.pokemon));
 paintPortrait(nodes.avatar,data);
 nodes.base.replaceChildren();
 if(nickname!==data.pokemon)nodes.base.append(...field(doc,'ポケモン',data.pokemon));
 nodes.base.append(...field(doc,'食材',foodGroup(doc,data.ingredients||[])));
 nodes.base.append(...field(doc,'おてつだい時間',data.helpTime||'—'));
 nodes.base.append(...field(doc,'最大所持数',data.carry||'—'));
 nodes.main.replaceChildren();
 const skill=doc.createElement('span');skill.textContent=data.mainSkill||'—';
 const level=doc.createElement('em');level.textContent='Lv.'+(data.skillLevel??'—');
 nodes.main.append(skill,level);
 nodes.skills.replaceChildren(subskills(doc,data.subskills||[],data.level));
 nodes.nature.replaceChildren(natureRow(doc,data.nature,data.mint));
 nodes.extra.replaceChildren(...field(doc,'一緒に眠った時間',formatSharedSleepHours(data.ribbon)));
 if(data.favorite)nodes.extra.append(...field(doc,'お気に入り',String(data.favorite)));
 return nodes.dialog;
}
root.PokeE7PokemonDetail=Object.freeze({
 ingredientIcons,grade,tone,formatSharedSleepHours,render
});
})(window);

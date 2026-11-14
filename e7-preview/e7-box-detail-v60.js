/* E7 v105 Box-only read-only display adapter; deletion remains Box-owned. */
(function(root){'use strict';
const detail=root.PokeE7PokemonDetail;
let viewVersion=0;
function tone(item){return detail.tone(item?.pokemon);}
function patchStats(version,stats){
 const dialog=root.document.getElementById('box-detail-dialog');
 if(version!==viewVersion||!dialog?.open)return;
 const base=root.document.getElementById('box-detail-fields');
 for(const label of base?.querySelectorAll('.iv-key')||[]){
  const value=label.nextElementSibling;
  if(!value)continue;
  if(label.textContent==='おてつだい時間：')value.textContent=stats.helpTime;
  if(label.textContent==='最大所持数：')value.textContent=stats.carry;
 }
}
function render(item){
 const version=++viewVersion;
 const foods=[item.ing1,item.ing2,item.ing3].map((raw,i)=>{
  const name=typeof raw==='string'&&raw.trim()?raw.trim():'—';
  const count=root.PokeE7IngredientQuantities?.get(item.pokemon,name,i+1)??null;
  return {name,count};
 });
 detail.render('box',{
  pokemon:item.pokemon,nickname:item.nickname||item.pokemon,
  level:item.level,ingredients:foods,
  mainSkill:item.mainSkill,skillLevel:item.skillLevel,
  subskills:[item.lv10,item.lv25,item.lv50,item.lv70,item.lv80],
  nature:item.nature,mint:item.mint,ribbon:item.ribbon,
  favorite:item.favorite,helpTime:'算出中…',carry:'算出中…'
 },avatar=>{avatar.innerHTML=root.PokeSprite.icon(item);});
 root.PokeSprite.enhance(root.document.getElementById('box-detail-dialog'));
 if(root.PokeE7BoxStats?.calculate){
  Promise.resolve(root.PokeE7BoxStats.calculate(item)).then(stats=>patchStats(version,stats))
   .catch(()=>patchStats(version,{helpTime:'原典未確認',carry:'原典未確認'}));
 }else Promise.resolve().then(()=>patchStats(version,{
  helpTime:'原典未確認',carry:'原典未確認'}));
}
root.E7BoxDetail=Object.freeze({tone,render,formatSharedSleepHours:detail.formatSharedSleepHours});
})(window);

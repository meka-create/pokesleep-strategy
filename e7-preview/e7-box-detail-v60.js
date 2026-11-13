/* E7 v81: Box-only adapter. One canonical status renderer is shared with
   Strategy; real imported data, selection identity and deletion remain Box-owned. */
(function(root){'use strict';
const detail=root.PokeE7PokemonDetail;
function tone(item){return detail.tone(item?.pokemon);}
function render(item){
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
  favorite:item.favorite,helpTime:'—',carry:'—'
 },avatar=>{avatar.innerHTML=root.PokeSprite.icon(item);});
 root.PokeSprite.enhance(root.document.getElementById('box-detail-dialog'));
}
root.E7BoxDetail=Object.freeze({
 tone,render,formatSharedSleepHours:detail.formatSharedSleepHours
});
})(window);

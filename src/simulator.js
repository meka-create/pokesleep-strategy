/* STEP2 expected-value simulation. Species and stat constants: nitoyon/pokesleep-tool (MIT).
 * This is a bounded prototype, NOT a game-exact weekly strength calculator.
 * Unsupported skills/events are explicitly reported. No invented game formula.
 */
(function(root){
'use strict';
const Master=root.PokeMaster;
const BERRY=Master.berry, ING=Master.strength;
const FAVORITES={'シアンの砂浜':['water','fairy','flying'],'トープ洞窟':['ground','fire','rock'],'ウノハナ雪原':['ice','normal','dark'],'ラピスラズリ湖畔':['grass','psychic','fighting'],'ゴールド旧発電所':['electric','ghost','steel'],'アンバー渓谷':['poison','bug','dragon']};
const SKILL_STRENGTH={'Charge Strength S':[400,569,785,1083,1496,2066,3212],'Charge Strength M':[880,1251,1726,2383,3290,4546,6858],'Charge Strength S (Random)':[500,711.5,981.5,1354,1870,2582.5,4015]};
const HEAL_ALL=[5,7,9,11,15,18],HEAL_SELF=[12,16,21,27,34,43];
const RECOVERY_UP=['Bold','Impish','Lax','Relaxed'],RECOVERY_DOWN=['Hasty','Lonely','Gentle','Mild'];
const RECIPES=root.PokeRecipes||[];
function clamp(x,l,h){return Math.max(l,Math.min(h,x));}
function roundup(x){return Math.ceil(x-1e-9);}
function nums(x){return Number.isFinite(Number(x))?Number(x):0;}
function natureFactor(jp,up,down){const en=Object.keys(Master.natures).find(k=>Master.natures[k]===jp)||'';
 return up.includes(en)?1.2:down.includes(en)?.8:1;
}
function activeSkills(p){return p.subskills.filter((_,i)=>p.level>=[10,25,50,70,80][i]).map(s=>s||'');}
function signature(p,sp,team,camp,warnings){
 const sub=activeSkills(p),count=s=>sub.includes(s)?1:0;
 const speedNature=(function(){const f=natureFactor(p.nature,['Lonely','Adamant','Naughty','Brave'],['Bold','Timid','Calm','Modest']);return f===1.2?.9:f===.8?1.075:1;})();
 let helpingBonus=team.reduce((n,q)=>n+Number(activeSkills(q).includes('おてつだいボーナス')),0);
 const speed=.01*clamp(7*count('おてつだいスピードS')+14*count('おてつだいスピードM')+5*helpingBonus,0,35);
 const ribbonTier=p.sleepHours>=2000?4:p.sleepHours>=1000?3:p.sleepHours>=500?2:p.sleepHours>=200?1:0;
 const ribbonSpeed=sp.evolutionLeft===2?(ribbonTier>=4?.75:ribbonTier>=2?.89:1):sp.evolutionLeft===1?(ribbonTier>=4?.88:ribbonTier>=2?.95:1):1;
 const speedProduct=((501-p.level)/500)*speedNature*ribbonSpeed*(1-speed);
 const base=sp.frequency*(Math.trunc(speedProduct*10000)/10000);
 const ingFactor=natureFactor(p.nature,['Modest','Mild','Rash','Quiet'],['Impish','Jolly','Adamant','Careful']);
 const skillFactor=natureFactor(p.nature,['Calm','Gentle','Careful','Sassy'],['Lax','Naive','Naughty','Rash']);
 const ingRate=clamp(sp.ingRate/100*ingFactor*(1+.18*count('食材確率アップS')+.36*count('食材確率アップM')),0,1);
 const rawSkillRate=clamp(sp.skillRate/100*skillFactor*(1+.18*count('スキル確率アップS')+.36*count('スキル確率アップM')),0,1);
 // Long-run skill pity correction from PokemonIv.calculateSkillRateWithPityProc.
 // Proc scheduling and inventory constraints remain approximate.
 const pity=(sp.specialty==='Skills'||sp.specialty==='All')?Math.ceil(142000/sp.frequency):78;
 const skillRate=rawSkillRate===0?0:clamp(rawSkillRate/(1-Math.pow(1-rawSkillRate,pity+1)),0,1);
 const berryPerHelp=(sp.specialty==='Berries'||sp.specialty==='All'?2:1)+count('きのみの数S');
 const ribbon=(p.sleepHours>=2000?8:p.sleepHours>=1000?6:p.sleepHours>=500?3:p.sleepHours>=200?1:0);
 const cap=(sp.carryLimit||10)+5*(sp.evolutionCount||0)+ribbon+count('最大所持数アップS')*6+count('最大所持数アップM')*12+count('最大所持数アップL')*18;
 const slots=p.level>=60?3:p.level>=30?2:1;
 const ingSlots=[];
 for(let j=0;j<slots;j++){
   const key=Object.keys(Master.ingredients).find(k=>Master.ingredients[k]===p.ingredients[j]);
   const def=(sp.mythIng||sp.ings).filter(Boolean).find(i=>i.name===key&&i['c'+(j+1)]>0);
   if(!def){warnings.add('食材設定を種族マスターと照合できない個体があります。該当食材の生産は未計上です。');continue;}
   ingSlots.push({key,count:def['c'+(j+1)]});
 }
 const skill=sp.skill==='Versatile'?(Master.species.find(z=>z.skillName===p.mainSkill)||{}).skill:sp.skill;
 return {p,sp,interval:Math.max(150,base/(camp?1.2:1)),ingRate,skillRate,berryPerHelp,carry:cap*(camp?1.2:1),ingSlots,skill,stockMax:sp.specialty==='Skills'?2:1};
}
function energySpeed(e){return e>80?.45:e>60?.52:e>40?.58:e>1?.66:1;}
function berryUnit(type,lv,favorites,fieldBonus){const b0=BERRY[type];const raw=Math.max(b0+lv-1,Math.round(Math.pow(1.025,lv-1)*b0));return roundup(roundup(raw*(1+fieldBonus/100))*(favorites.includes(type)?2:1));}
function simulate(input){
 if(!input||!Array.isArray(input.box))throw Error('ボックスがありません。');
 const byId=new Map(input.box.map(p=>[p.id,p]));
 const teams=input.teams||{};
 const periods=['morning','noon','evening','sleep'];
 for(const key of periods){
  const ids=teams[key];
  if(!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5||ids.some(id=>!byId.has(id)))throw Error('朝・昼・夜・睡眠の各パーティに別々の5匹を指定してください。');
 }
 const opts=input.options||{};
 const bonus=nums(opts.fieldBonus),tapMinutes=nums(opts.tapMinutes||150),pot=nums(opts.potSize||57),score=nums(opts.sleepScore??100),initialEnergy=nums(opts.initialEnergy??100);
 if(bonus<0||bonus>100||tapMinutes<120||tapMinutes>180||pot<7||pot>300||score<0||score>100||initialEnergy<0||initialEnergy>150)throw Error('フィールド補正・回収間隔・鍋容量・睡眠スコアなどの入力値を確認してください。');
 const favorite=FAVORITES[opts.map]||[];
 const warnings=new Set();
 if(!favorite.length)warnings.add('このフィールドの好みのきのみは未確定です。好みボーナスを計上していません。');
 const species=new Map(Master.species.map(s=>[s.name,s]));
 const members=new Map(), energy=new Map(),pocket=new Map(),status={berries:0,skills:0,cooking:0,sneaky:0,ingredients:{},days:[],skillCount:0};
 for(const p of input.box){energy.set(p.id,initialEnergy);pocket.set(p.id,{used:0,berries:0,ingredients:{},skill:0});}
 for(const key of periods)for(const id of teams[key]){
  if(!members.has(id)){
   const p=byId.get(id),sp=species.get(p.pokemon);
   if(!sp){warnings.add('未登録の種族は計算対象外です：'+p.pokemon);members.set(id,null);}
   else members.set(id,{p,sp});
  }
 }
 if([...members.values()].every(x=>!x))throw Error('マスターに一致するポケモンがいません。');
 const inventory={...opts.initialIngredients};for(const k of Object.keys(inventory)){const v=nums(inventory[k]);if(!Number.isInteger(v)||v<0||v>10000)throw Error('初期食材数が不正です。');inventory[k]=v;}
 const recipe=RECIPES.find(r=>r.id===opts.recipeId);
 if(!recipe)warnings.add('レシピ未選択：料理エナジーを計上していません。');
 else if(opts.foodMode!=='random'&&opts.foodMode!==recipe.type)warnings.add('レシピと料理カテゴリが一致しません。料理エナジーを計上していません。');
 if(opts.foodMode==='random')warnings.add('ランダム料理カテゴリは未確定です。選択レシピの成立時のみ試算し、ランダム期待値ではありません。');
 const dishesAllowed=recipe&&opts.foodMode===recipe.type;
 if(recipe)warnings.add('食材の期待個数は端数を含む近似です。実際に揃った食材数や料理回数とは異なります。');
 if(recipe&&opts.foodMode==='random')warnings.add('料理カテゴリを確定するまで料理のエナジーは計上しません。');
 if(opts.map==='シアンの砂浜EX'||opts.map==='ワカクサ本島EX')warnings.add('EXフィールド固有の補正には未対応です。');
 if(opts.eventEffects)warnings.add('イベント補正メモはSTEP5まで計算に反映しません。');
 const warningsSkills=new Set();
 function collect(teamIds){
  for(const id of teamIds){
   const pair=members.get(id);if(!pair)continue;
   const bag=pocket.get(id);
   const strength=berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
   status.berries+=bag.berries*strength;
   for(const [key,v] of Object.entries(bag.ingredients)){inventory[key]=(inventory[key]||0)+v;status.ingredients[key]=(status.ingredients[key]||0)+v;}
   let triggers=bag.skill;const skill=pair.sp.skill,actual=pair.sp.skill==='Versatile'?(Master.species.find(z=>z.skillName===pair.p.mainSkill)||{}).skill:skill;
   if(SKILL_STRENGTH[actual]){const levels=SKILL_STRENGTH[actual];status.skills+=triggers*levels[clamp(pair.p.skillLevel-1,0,levels.length-1)]*(1+bonus/100);}
   else if(actual==='Energy for Everyone S'){const r=HEAL_ALL[clamp(pair.p.skillLevel-1,0,HEAL_ALL.length-1)];
     for(const who of teamIds){const recipient=byId.get(who);const f=natureFactor(recipient.nature,RECOVERY_UP,RECOVERY_DOWN);energy.set(who,clamp(energy.get(who)+r*triggers*f,0,150));}}
   else if(actual==='Charge Energy S'){const f=natureFactor(pair.p.nature,RECOVERY_UP,RECOVERY_DOWN);energy.set(id,clamp(energy.get(id)+HEAL_SELF[clamp(pair.p.skillLevel-1,0,HEAL_SELF.length-1)]*triggers*f,0,150));}
   else if(actual)warningsSkills.add(actual);
   status.skillCount+=triggers;
   pocket.set(id,{used:0,berries:0,ingredients:{},skill:0});
  }
 }
 function help(teamIds,hours,camp,estimatedEnergy){
  const group=teamIds.map(id=>members.get(id)).filter(Boolean).map(x=>x.p);
  for(const id of teamIds){
   const pair=members.get(id);if(!pair)continue;
   const x=signature(pair.p,pair.sp,group,camp,warnings),bag=pocket.get(id);
   const e=estimatedEnergy?.get(id)??energy.get(id),helps=(hours*3600/x.interval)/energySpeed(e);
   let remaining=helps,space=Math.max(0,x.carry-bag.used);
   const averageIngredientItems=x.ingSlots.length?x.ingSlots.reduce((a,b)=>a+b.count,0)/x.ingSlots.length:0;
   const itemPerHelp=(1-x.ingRate)*x.berryPerHelp+x.ingRate*averageIngredientItems;
   const fits=Math.min(remaining,itemPerHelp>0?space/itemPerHelp:0);
   const overflow=remaining-fits;
   bag.berries+=fits*(1-x.ingRate)*x.berryPerHelp;
   for(const s of x.ingSlots){bag.ingredients[s.key]=(bag.ingredients[s.key]||0)+fits*x.ingRate*s.count/x.ingSlots.length;}
   bag.used+=fits*itemPerHelp;
   const sneaky=overflow*x.berryPerHelp;
   const strength=berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
   status.berries+=sneaky*strength;status.sneaky+=sneaky*strength;
   bag.skill=Math.min(x.stockMax,bag.skill+fits*x.skillRate);
  }
 }
 function tickActive(ids,minutes,camp,awake){
  const mid=new Map();
  for(const id of ids)mid.set(id,clamp(energy.get(id)-(awake?minutes/20:0),0,150));
  help(ids,minutes/60,camp,mid);
  for(const id of ids)if(awake)energy.set(id,clamp(energy.get(id)-minutes/10,0,150));
 }
 function cook(){if(!dishesAllowed)return 0;const needed=Object.entries(recipe.requirements);const count=needed.reduce((a,[k,v])=>a+v,0);
   if(count>pot*(opts.camp?1.5:1))return 0;
   if(needed.some(([k,v])=>(inventory[k]||0)+1e-6<v))return 0;
   for(const [k,v] of needed)inventory[k]-=v;
   const value=recipe.strength70*(1+bonus/100);
   status.cooking+=value;
   return value;
 }
 const daySummaries=[];
 
 for(let d=0;d<7;d++){
  const before={berries:status.berries,cooking:status.cooking,skills:status.skills,sneaky:status.sneaky};
  let current=null;
  for(let t=7.5;t<24-1e-9;t+=.25){
    const key=t<12?'morning':t<18?'noon':'evening',ids=teams[key];
    if(current!==key){if(current)collect(teams[current]);current=key;collect(ids);if([7.5,12,18].includes(t))cook();}
    const sinceWake=(t-7.5)*60;
    if(Math.abs(sinceWake/tapMinutes-Math.round(sinceWake/tapMinutes))<1e-6 &&t>7.5)collect(ids);
    tickActive(ids,15,!!opts.camp,true);
  }
  collect(teams.evening);
  // No interaction from 00:00 until 07:30. Sunday -> Monday only 00:00-04:00 counts for this week.
  const sleepHours=d===6?4:7.5;
  for(let h=0;h<sleepHours-1e-9;h+=.25)help(teams.sleep,.25,!!opts.camp);
  // Sleep recovery occurs only after a full sleep, including the final day for continuation; no box recovery.
  if(d<6){
   const recoverBonuses=teams.sleep.filter(id=>activeSkills(byId.get(id)).includes('げんき回復ボーナス')).length;
   for(const id of teams.sleep){
    const p=byId.get(id),f=natureFactor(p.nature,RECOVERY_UP,RECOVERY_DOWN);
    const restore=Math.min(150,Math.round(score)*f*(1+.14*recoverBonuses));
    energy.set(id,clamp(energy.get(id)+restore,0,150));
   }
   collect(teams.sleep);
  }
  // The next Monday 04:00 is a field reset, NOT an interaction.
  // Do not credit the still-carried berries/ingredients or skill stock to the old week.
  daySummaries.push({day:d+1,berries:status.berries-before.berries,cooking:status.cooking-before.cooking,skills:status.skills-before.skills});
 }
 for(const s of warningsSkills)warnings.add('未対応のメインスキル（エナジー寄与未計上）：'+s);
 warnings.add('暫定期待値モデルです。げんき・所持上限・スキルストック・ピティ補正は近似であり、ゲーム内の厳密値とは一致しません。食材バッグの総容量制限・前週からの所持品持ち越しは未対応です。');
 if(recipe)warnings.add('料理はLv70の選択レシピのみ、成立した場合に計上します。追加食材・代替料理・大成功は未対応です。');
 return {berries:status.berries,cooking:status.cooking,skills:status.skills,total:status.berries+status.cooking+status.skills,sneaky:status.sneaky,skillTriggers:status.skillCount,ingredients:status.ingredients,inventory,days:daySummaries,warnings:[...warnings],models:members.size};
}
const api={simulate,RECIPES,FAVORITES,berryUnit,energySpeed};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeSimulator=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/* STEP2 expected-value simulation. Species and stat constants: nitoyon/pokesleep-tool (MIT).
 * This is a bounded prototype, NOT a game-exact weekly strength calculator.
 * Unsupported skills/events are explicitly reported. No invented game formula.
 */
(function(root){
'use strict';
const Master=root.PokeMaster;
const BERRY=Master.berry, ING=Master.strength;
const FAVORITES={'シアンの砂浜':['water','fairy','flying'],'トープ洞窟':['ground','fire','rock'],'ウノハナ雪原':['ice','normal','dark'],'ラピスラズリ湖畔':['grass','psychic','fighting'],'ゴールド旧発電所':['electric','ghost','steel'],'アンバー渓谷':['poison','bug','dragon']};
const SKILL_STRENGTH={'Charge Strength S':[400,569,785,1083,1496,2066,3212],'Charge Strength M':[880,1251,1726,2383,3290,4546,6858],'Charge Strength M (Bad Dreams)':[2640,3753,5178,7149,9870,13638,18515],'Charge Strength S (Random)':[500,711.5,981.5,1354,1870,2582.5,4015]};
const HEAL_ALL=[5,7,9,11,15,18],HEAL_SELF=[12,16,21,27,34,43];
// Spit Up rewards for 0..10 stockpiles, source: wiki.pokesleep.com stockpilechargestrengths.
const STOCKPILE_REWARDS=[
 [600,1020,1500,2040,2640,3300,4020,4920,6480,8880,12120],
 [853,1450,2132,2900,3753,4691,5715,6995,9213,12625,17231],
 [1177,2001,2943,4002,5179,6474,7886,9652,12712,17420,23776],
 [1625,2763,4063,5526,7151,8939,10889,13327,17552,24052,32827],
 [2243,3813,5607,7626,9869,12336,15028,18393,24225,33197,45309],
 [3099,5268,7747,10536,13635,17044,20763,25412,33469,45865,62600],
 [4502,7653,11255,15307,19809,24761,30163,36916,46370,59876,82386]
];
// Finite probability distribution: E[min(rolls,cap)] != min(E[rolls],cap).
// Pity-adjusted long-run proc rate remains an explicit approximation.
function advanceSkillStock(state,expectedHelps,rate,cap){
 if(!Number.isFinite(expectedHelps)||expectedHelps<0||
    !Number.isFinite(rate)||rate<0||rate>1||![1,2].includes(cap)||
    !Array.isArray(state)||state.length<cap+1)
  throw Error('スキルストック遷移の入力が不正です。');
 let probs=state.slice(0,cap+1);
 const apply=(chance)=>{
  const next=new Array(cap+1).fill(0);
  for(let i=0;i<=cap;i++){
   next[i]+=probs[i]*(1-chance);
   next[Math.min(cap,i+1)]+=probs[i]*chance;
  }
  probs=next;
 };
 const whole=Math.floor(expectedHelps),fraction=expectedHelps-whole;
 for(let i=0;i<whole;i++)apply(rate);
 if(fraction>1e-12)apply(fraction*rate);
 return probs;
}
function expectedSkillStock(state){return state.reduce((total,p,i)=>total+p*i,0);}
function emptyPocket(){return {used:0,berries:0,ingredients:{},skillState:[1,0,0]};}
function clearDepartingPockets(oldTeam,newTeam,pocket,extraPocket){
 const retained=new Set(newTeam);
 for(const id of oldTeam)if(!retained.has(id)){
  pocket.set(id,emptyPocket());
  extraPocket.set(id,emptyPocket());
 }
}
function emptyStockpile(){return [1,0,0,0,0,0,0,0,0,0,0];}
function stockpileStep(state,level){
 const next=new Array(11).fill(0),rewards=STOCKPILE_REWARDS[clamp(level-1,0,6)];
 let earned=0;
 for(let k=0;k<=10;k++){
  const p=state[k],spit=k===10?1:.25;
  earned+=p*spit*rewards[k];
  next[0]+=p*spit;
  if(k<10)next[k+1]+=p*(1-spit);
 }
 return {state:next,earned};
}
// A fractional expected activation is interpolated as a Bernoulli activation.
// This tracks undistributed stack probabilities, not just steady-state averages.
function advanceStockpile(state,expectedTriggers,level){
 if(!Number.isFinite(expectedTriggers)||expectedTriggers<0)throw Error('たくわえる発動回数が不正です。');
 let current=state.slice(),earned=0;
 let whole=Math.floor(expectedTriggers),fraction=expectedTriggers-whole;
 for(let n=0;n<whole;n++){const v=stockpileStep(current,level);current=v.state;earned+=v.earned;}
 if(fraction>1e-12){
  const v=stockpileStep(current,level);
  earned+=fraction*v.earned;
  current=current.map((x,i)=>(1-fraction)*x+fraction*v.state[i]);
 }
 return {state:current,earned};
}
const LUNAR_HEAL=[3,4,5,7,9,11];
const LUNAR_BERRIES=[
 [[5,1],[7,1],[9,1],[12,1],[14,2]],
 [[9,1],[12,1],[15,1],[16,2],[19,3]],
 [[13,1],[17,1],[18,2],[20,3],[24,4]],
 [[17,1],[19,2],[25,2],[28,3],[29,5]],
 [[21,1],[24,2],[27,3],[28,5],[30,7]],
 [[25,1],[29,2],[30,4],[31,6],[32,9]]
];
const DRACO_BERRIES=[
 [[12,1],[14,1],[18,1],[18,2],[20,2]],
 [[21,1],[24,1],[29,1],[30,2],[33,2]],
 [[29,1],[29,2],[35,2],[37,3],[41,3]],
 [[38,1],[39,2],[42,3],[45,4],[49,4]],
 [[43,2],[44,3],[48,4],[49,5],[53,5]],
 [[48,3],[50,4],[55,4],[55,5],[58,5]]
];
const PSYSTRIKE_STRENGTH=[1408,2002,2762,3813,5264,7274];
const EXTRA_HELP=[6,7,8,9,10,11,12];
const HELPER_BOOST=[
 [2,2,3,4,6], [3,3,4,5,7], [3,3,5,6,8],
 [4,4,6,7,9], [4,5,7,8,10], [5,6,8,9,11]
];
const HEAL_PULSE_HELP=[1,2,2,3,4,4];
const TASTY_CHANCE=[4,5,6,7,8,10];
const DRAW_AMOUNTS=[5,6,8,11,13,16,18];
const DRAW_POOLS={
 27:['potato','corn','pumpkin'],28:['potato','corn','pumpkin'],
 198:['mushroom','sausage','soy','coffee'],430:['mushroom','sausage','soy','coffee'],
 303:['potato','oil','tomato','corn'],
 557:['potato','oil','avocado'],558:['potato','oil','avocado'],
 701:['herb','ginger','sausage'],
 742:['honey','oil','corn'],743:['honey','oil','corn']
};
const CHEER_HEAL={
 'Energizing Cheer S':[12,15,20,25,33,44],
 'Energizing Cheer S (Nuzzle)':[9,12,16,20,27,35],
 'Energizing Cheer S (Heal Pulse)':[6,8,10,13,17,22]
};
const INGREDIENT_MAGNET={
 'Ingredient Magnet S':[6,8,11,14,17,21,24],
 'Ingredient Magnet S (Plus)':[5,7,9,11,13,16,18],
 'Ingredient Magnet S (Present)':[4,6,8,10,12,15,17],
 'Cooking Assist S (Bulk Up)':[6,8,11,14,17,21,24]
};
const POT_BOOST={
 'Cooking Power-Up S':[7,10,12,17,22,27,31],
 'Cooking Power-Up S (Minus)':[5,7,9,12,16,20,24]
};
const RECOVERY_UP=['Bold','Impish','Lax','Relaxed'],RECOVERY_DOWN=['Hasty','Lonely','Gentle','Mild'];
const RECIPES=root.PokeRecipes||[];
const BERRY_BURST={
 'Berry Burst':{self:[11,14,21,24,27,30],others:[1,2,2,3,4,5],critical:0},
 'Berry Burst (Disguise)':{self:[8,10,15,17,19,21],others:[1,2,2,3,4,5],critical:.185}
};
// User-directed exclusions: these seven main skills do not contribute to
// energy, ingredients, healing, extra help, or skill-trigger totals.
const EXCLUDED_MAIN_SKILLS=new Set([
 'Metronome',
 'Skill Copy (Mimic)',
 'Skill Copy (Transform)',
 'Versatile',
 'Dream Shard Magnet S',
 'Dream Shard Magnet S (Random)',
 'Dream Shard Magnet S (Aura Sphere)'
]);
function clamp(x,l,h){return Math.max(l,Math.min(h,x));}
function roundup(x){return Math.ceil(x-1e-9);}
function nums(x){return Number.isFinite(Number(x))?Number(x):0;}
function natureFactor(jp,up,down){const en=Object.keys(Master.natures).find(k=>Master.natures[k]===jp)||'';
 return up.includes(en)?1.2:down.includes(en)?.8:1;
}
// Energy-recovery-down natures use 0.88, not the 0.80 chance modifier.
// Source: nitoyon/pokesleep-tool src/util/Nature.ts#energyRecoveryFactor.
function recoveryNatureFactor(jp){
 const en=Object.keys(Master.natures).find(k=>Master.natures[k]===jp)||'';
 return RECOVERY_UP.includes(en)?1.2:RECOVERY_DOWN.includes(en)?.88:1;
}
function activeSkills(p){return p.subskills.filter((_,i)=>p.level>=[10,25,50,70,80][i]).map(s=>s||'');}
// Upstream evolutionCount=-1 means "no stage metadata", NOT minus one evolution.
// Normal Pikachu is a legacy exception (Pichu -> Pikachu): carryLimit 17 -> 22.
// Costumed Pikachu forms do not inherit that extra five.
function baseCarryCapacity(sp){
 const stages=Number.isInteger(sp.evolutionCount)?Math.max(0,sp.evolutionCount):0;
 const pikachuBonus=sp.name==='ピカチュウ'&&sp.english==='Pikachu'?5:0;
 return (sp.carryLimit||10)+5*stages+pikachuBonus;
}
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
 const cap=baseCarryCapacity(sp)+ribbon+count('最大所持数アップS')*6+count('最大所持数アップM')*12+count('最大所持数アップL')*18;
 const slots=p.level>=60?3:p.level>=30?2:1;
 const ingSlots=[];
 for(let j=0;j<slots;j++){
   const key=Object.keys(Master.ingredients).find(k=>Master.ingredients[k]===p.ingredients[j]);
   const def=(sp.mythIng||sp.ings).filter(Boolean).find(i=>i.name===key&&i['c'+(j+1)]>0);
   if(!def){warnings.add('食材設定を種族マスターと照合できない個体があります。該当食材の生産は未計上です。');continue;}
   ingSlots.push({key,count:def['c'+(j+1)]});
 }
 const skill=sp.skill;
 return {p,sp,interval:Math.max(150,base/(camp?1.2:1)),ingRate,skillRate,berryPerHelp,carry:camp?Math.ceil(cap*1.2):cap,ingSlots,skill,stockMax:(sp.specialty==='Skills'||sp.specialty==='All')?2:1};
}
function energySpeed(e){return e>80?.45:e>60?.52:e>40?.58:e>1?.66:1;}
function effectivePotCapacity(base,skillBonus,day,camp){
 const weekend=day===6?2:1;
 return Math.round((base*weekend+clamp(skillBonus,0,200))*(camp?1.5:1));
}
/* The game rounds the final Strength of each dish down separately for
   normal and Extra Tasty outcomes. Do not multiply an unrounded meal
   by an averaged success multiplier. Event modifiers are not modeled. */
function calculateMealEnergy(recipeStrength,extraStrength,fieldBonus,probability,day){
 if(![recipeStrength,extraStrength,fieldBonus,probability,day].every(Number.isFinite)||
   recipeStrength<0||extraStrength<0||fieldBonus<0||fieldBonus>100||
   probability<0||probability>1||!Number.isInteger(day)||day<0||day>6)
  throw Error('料理エナジー計算の入力が不正です。');
 const beforeRounding=(recipeStrength+extraStrength)*(1+fieldBonus/100);
 const normal=Math.floor(beforeRounding+1e-9);
 const extraTasty=Math.floor(beforeRounding*(day===6?3:2)+1e-9);
 return {normal,extraTasty,expected:normal*(1-probability)+extraTasty*probability};
}
// Greedy per-meal planner, not a global weekly optimizer and not in-game random auto-cook.
function chooseRecipe({mode='fixed',preferredId='',foodMode,inventory,potCapacity}){
 if(!['fixed','fallback','best'].includes(mode))throw Error('料理選択モードが不正です。');
 if(foodMode==='random'||!['curry','salad','dessert'].includes(foodMode))return null;
 const fits=r=>r.type===foodMode&&Object.values(r.requirements).reduce((a,b)=>a+b,0)<=potCapacity
   &&Object.entries(r.requirements).every(([key,count])=>(inventory[key]||0)+1e-6>=count);
 const preferred=RECIPES.find(r=>r.id===preferredId);
 if(mode==='fixed')return preferred&&fits(preferred)?preferred:null;
 if(mode==='fallback'){
  if(!preferred)throw Error('代替料理モードでは優先するレシピを選んでください。');
  if(preferred.type!==foodMode)return null;
  if(fits(preferred))return preferred;
 }
 // Stable tie break: higher energy first, then fewer mandatory ingredients, then ID.
 return RECIPES.filter(fits).sort((a,b)=>b.strength70-a.strength70
  ||Object.values(a.requirements).reduce((n,v)=>n+v,0)-Object.values(b.requirements).reduce((n,v)=>n+v,0)
  ||a.id.localeCompare(b.id))[0]||null;
}
// Target-weight proxy (not a measured game probability): 70% shared by
// lowest-energy teammates and 30% distributed over the entire party.
function cheerWeights(teamIds,energy){
 const minimum=Math.min(...teamIds.map(id=>energy.get(id)??0));
 const lowest=teamIds.filter(id=>(energy.get(id)??0)<=minimum+1e-9);
 return new Map(teamIds.map(id=>[id,.3/teamIds.length+((energy.get(id)??0)<=minimum+1e-9?.7/lowest.length:0)]));
}
function recoverFromSleep(current,score,natureRecovery,teamRecoveryBonus,selfHasRecoveryBonus){
 const limit=selfHasRecoveryBonus?105:100;
 const amount=Math.max(0,Math.round(score*natureRecovery*(1+.14*teamRecoveryBonus)));
 // A sleep result must never reduce energy already above the sleep-recovery cap.
 return clamp(Math.max(current,Math.min(limit,current+amount)),0,150);
}
function mealRecovery(energy){
 if(energy>=150)return 0;
 if(energy>=81)return 1;
 if(energy>=71)return 2;
 if(energy>=61)return 3;
 if(energy>=51)return 4;
 if(energy>=41)return 5;
 if(energy>=31)return 6;
 if(energy>=21)return 7;
 if(energy>=11)return 8;
 return 9;
}
function helperBoostCount(level,species){return HELPER_BOOST[clamp(level-1,0,5)][clamp(species-1,0,4)];}
function teamSpeciesCount(ids,members,triggerId){
 const triggerType=members.get(triggerId)?.sp?.type;
 return new Set(ids.map(id=>members.get(id)?.sp).filter(sp=>sp&&sp.type===triggerType).map(sp=>sp.id)).size;
}
function teamHasLatiTwins(ids,members){
 const a=ids.map(id=>members.get(id)?.sp?.english);
 return a.includes('Latios')&&a.includes('Latias');
}
function lunarBerryCounts(level,species){return LUNAR_BERRIES[clamp(level-1,0,5)][clamp(species-1,0,4)];}
function dracoBerryCounts(level,species,twins){
 const [self,others]=DRACO_BERRIES[clamp(level-1,0,5)][clamp(species-1,0,4)];
 const bonus=twins?(level<5?level*2:level===5?9:10):0;
 return [self+bonus,others];
}
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
 const members=new Map(), energy=new Map(),pocket=new Map(),extraPocket=new Map(),status={berries:0,skills:0,cooking:0,sneaky:0,ingredients:{},skillIngredients:{},unassignedMagnet:0,days:[],skillCount:0,extraHelps:0,stockpileResets:0,stockpileExpectedLost:0,meals:[],consumedIngredients:{}};
 for(const p of input.box){
  energy.set(p.id,initialEnergy);
  pocket.set(p.id,emptyPocket());
  extraPocket.set(p.id,emptyPocket());
 }
 for(const key of periods)for(const id of teams[key]){
  if(!members.has(id)){
   const p=byId.get(id),sp=species.get(p.pokemon);
   if(!sp){warnings.add('未登録の種族は計算対象外です：'+p.pokemon);members.set(id,null);}
   else members.set(id,{p,sp});
  }
 }
 if([...members.values()].every(x=>!x))throw Error('マスターに一致するポケモンがいません。');
 const inventory={...opts.initialIngredients};for(const k of Object.keys(inventory)){
   const v=nums(inventory[k]);if(!Number.isInteger(v)||v<0||v>10000||!Object.prototype.hasOwnProperty.call(Master.ingredients,k))throw Error('初期食材数が不正です。');
   inventory[k]=v;
 }
 const bagCapacity=nums(opts.bagCapacity??0);
 if(!Number.isInteger(bagCapacity)||bagCapacity<0||bagCapacity>10000)throw Error('食材バッグ容量が不正です。');
 const bagUsed=()=>Object.values(inventory).reduce((sum,n)=>sum+n,0);
 if(bagCapacity&&bagUsed()>bagCapacity)throw Error('初期食材の合計が食材バッグ容量を超えています。');
 if(!bagCapacity)warnings.add('食材バッグ容量が未設定です。満杯時の食材回収制限は考慮していません。');
 const recipeMode=opts.recipeMode??'fixed';
 if(!['fixed','fallback','best'].includes(recipeMode))throw Error('料理選択モードが不正です。');
 const recipe=RECIPES.find(r=>r.id===opts.recipeId);
 if(recipeMode==='fixed'&&!recipe)warnings.add('レシピ未選択：料理エナジーを計上していません。');
 if(recipeMode==='fallback'&&!recipe)throw Error('代替料理モードでは優先するレシピを選んでください。');
 if(recipeMode!=='best'&&recipe&&opts.foodMode!=='random'&&opts.foodMode!==recipe.type)warnings.add('レシピと料理カテゴリが一致しません。料理エナジーを計上していません。');
 if(opts.foodMode==='random')warnings.add('ランダム料理カテゴリは未確定です。料理カテゴリを確定するまで料理エナジーは計上しません。');
 if(recipeMode!=='fixed')warnings.add('料理の自動選択は各食事時点のLv70レシピエナジー最大を選ぶ近似です。翌日の食材確保や週間総エナジーを見越した最適化ではありません。');
 warnings.add('食材の期待個数は端数を含む近似です。実際に揃った食材数や料理回数とは異なります。');
 if(opts.map==='シアンの砂浜EX'||opts.map==='ワカクサ本島EX')warnings.add('EXフィールド固有の補正には未対応です。');
 if(opts.eventEffects)warnings.add('イベント補正メモはSTEP5まで計算に反映しません。');
 const warningsSkills=new Set(),warningsSkillsExcluded=new Set();
 // Every stockpile user starts at zero on Monday; team substitutions reset it.
 const stockpileStates=new Map();
 function resetStockpileLeaving(oldTeam,newTeam){
  // Outgoing team is collected before switching; any blocked carry is lost.
  clearDepartingPockets(oldTeam,newTeam,pocket,extraPocket);
  const retained=new Set(newTeam);
  for(const id of oldTeam){
   if(!retained.has(id)&&stockpileStates.has(id)){
    const probs=stockpileStates.get(id);
    status.stockpileExpectedLost+=probs.reduce((sum,p,k)=>sum+p*k,0);
    status.stockpileResets++;
    stockpileStates.delete(id);
   }
  }
 }
 const magnetPool=opts.magnetIngredients??[];
 if(!Array.isArray(magnetPool)||new Set(magnetPool).size!==magnetPool.length||
    magnetPool.some(k=>!Object.prototype.hasOwnProperty.call(Master.ingredients,k)))throw Error('食材ゲットSの抽選対象が不正です。');
 let potBonus=0,successBonus=0;
 const extraMode=opts.extraMode??'none',successMode=opts.successMode??'none';
 if(!['none','fill'].includes(extraMode)||!['none','expected'].includes(successMode))throw Error('追加食材・大成功の設定が不正です。');
 function addInventory(key,count,fromSkill){
  const available=bagCapacity?Math.max(0,bagCapacity-bagUsed()):count;
  const accepted=Math.max(0,Math.min(count,available));
  if(accepted>0){
   inventory[key]=(inventory[key]||0)+accepted;
   status.ingredients[key]=(status.ingredients[key]||0)+accepted;
   if(fromSkill)status.skillIngredients[key]=(status.skillIngredients[key]||0)+accepted;
  }
  return accepted;
 }
 function collect(teamIds){
  const granted=new Map();
  const giveHelps=(who,count)=>{
   if(!members.get(who)||count<=0)return;
   granted.set(who,(granted.get(who)||0)+count);
   status.extraHelps+=count;
  };
  for(const id of teamIds){
   const pair=members.get(id);if(!pair)continue;
   const bag=pocket.get(id),extraBag=extraPocket.get(id);
   const strength=berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
   status.berries+=(bag.berries+extraBag.berries)*strength;
   const receiveFood=(src)=>{
    const retained={};let retainedCount=0;
    for(const [key,v] of Object.entries(src.ingredients)){
     const capacity=bagCapacity?Math.max(0,bagCapacity-bagUsed()):v;
     const accepted=Math.max(0,Math.min(v,capacity));
     if(accepted){inventory[key]=(inventory[key]||0)+accepted;status.ingredients[key]=(status.ingredients[key]||0)+accepted;}
     if(v-accepted>1e-9){retained[key]=v-accepted;retainedCount+=v-accepted;}
    }
    return {retained,retainedCount};
   };
   const standardFood=receiveFood(bag),extraFood=receiveFood(extraBag);
   const remainingInPocket=standardFood.retained,uncollected=standardFood.retainedCount;
   const actual=pair.sp.skill;
   const excluded=EXCLUDED_MAIN_SKILLS.has(actual);
   const triggers=excluded?0:expectedSkillStock(bag.skillState);
   if(excluded)warningsSkillsExcluded.add(actual);
   else if(actual==='Charge Strength S (Stockpile)'){
    const current=stockpileStates.get(id)||emptyStockpile();
    const update=advanceStockpile(current,triggers,pair.p.skillLevel);
    stockpileStates.set(id,update.state);
    status.skills+=update.earned*(1+bonus/100);
    warnings.add('たくわえるは蓄積0回から開始し、交代時リセット・週末未放出を反映した状態確率モデルです。25%放出は実測推定、発動回数と抽選は期待値近似です。');
   }
   else if(actual==='Berry Zone (Psystrike)'){
    status.skills+=triggers*PSYSTRIKE_STRENGTH[clamp(pair.p.skillLevel-1,0,5)]*(1+bonus/100);
    warnings.add('サイコブレイクのマゴのみゾーン強化（発動ごと+0.6～2.0%）は未計上です。直接エナジーのみ反映しました。');
   }
   else if(SKILL_STRENGTH[actual]){
    const levels=SKILL_STRENGTH[actual];
    status.skills+=triggers*levels[clamp(pair.p.skillLevel-1,0,levels.length-1)]*(1+bonus/100);
    if(actual==='Charge Strength M (Bad Dreams)'){
     for(const who of teamIds){
      const target=members.get(who);
      if(target?.sp.type!=='dark'&&target)energy.set(who,clamp(energy.get(who)-12*triggers,0,150));
     }
     warnings.add('ナイトメアはあくタイプ以外のチームメンバーのげんき-12／発動を期待値で反映しています。');
    }
   }
   else if(actual==='Extra Helpful S'){
    const helps=triggers*EXTRA_HELP[clamp(pair.p.skillLevel-1,0,6)];
    for(const who of teamIds)giveHelps(who,helps/teamIds.length);
    warnings.add('おてつだいサポートSは対象1匹のランダム抽選を5匹への均等期待値で近似します。');
   }
   else if(actual==='Helper Boost'){
    const speciesCount=teamSpeciesCount(teamIds,members,id);
    const n=helperBoostCount(pair.p.skillLevel,speciesCount);
    for(const who of teamIds)giveHelps(who,triggers*n);
    warnings.add('おてつだいブーストは同タイプの異なる種族数と全員の追加おてつだいを反映した期待値です。');
   }
   else if(actual==='Energizing Cheer S (Heal Pulse)'){
    const lvl=clamp(pair.p.skillLevel-1,0,5),heal=CHEER_HEAL[actual][lvl];
    const bonusHelp=teamHasLatiTwins(teamIds,members)?(lvl<2?1:lvl<5?2:3):0;
    const helps=triggers*(HEAL_PULSE_HELP[lvl]+bonusHelp);
    for(const who of teamIds){
     const recipient=byId.get(who),factor=recoveryNatureFactor(recipient.nature);
     energy.set(who,clamp(energy.get(who)+triggers*heal*2/teamIds.length*factor,0,150));
     giveHelps(who,helps*2/teamIds.length);
    }
    warnings.add('いやしのはどうは回復・追加おてつだいを対象2匹への均等期待値で近似しています。');
   }
   else if(actual==='Energy for Everyone S (Lunar Blessing)'){
    const level=clamp(pair.p.skillLevel-1,0,5),r=LUNAR_HEAL[level];
    const speciesCount=teamSpeciesCount(teamIds,members,id),counts=lunarBerryCounts(level+1,speciesCount);
    let berryEnergy=counts[0]*berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    for(const who of teamIds){
     const target=members.get(who);if(!target||who===id)continue;
     berryEnergy+=counts[1]*berryUnit(target.sp.type,target.p.level,favorite,bonus);
    }
    status.berries+=triggers*berryEnergy;
    for(const who of teamIds){
     const recipient=byId.get(who),f=recoveryNatureFactor(recipient.nature);
     energy.set(who,clamp(energy.get(who)+r*triggers*f,0,150));
    }
    warnings.add('みかづきのいのりの回復ときのみは種族数を基に期待値計算しています。発動タイミング・丸めは簡易モデルです。');
   }
   else if(actual==='Energy for Everyone S'||actual==='Energy for Everyone S (Berry Juice)'){const r=HEAL_ALL[clamp(pair.p.skillLevel-1,0,HEAL_ALL.length-1)];
     for(const who of teamIds){const recipient=byId.get(who);const f=recoveryNatureFactor(recipient.nature);energy.set(who,clamp(energy.get(who)+r*triggers*f,0,150));}
     if(actual==='Energy for Everyone S (Berry Juice)')warnings.add('きのみジュースの追加獲得はアイテム不使用方針によりエナジーに換算しません。');}
   else if(actual==='Charge Energy S'||actual==='Charge Energy S (Moonlight)'){const f=recoveryNatureFactor(pair.p.nature);energy.set(id,clamp(energy.get(id)+HEAL_SELF[clamp(pair.p.skillLevel-1,0,HEAL_SELF.length-1)]*triggers*f,0,150));
    if(actual==='Charge Energy S (Moonlight)')warnings.add('つきのひかりの追加でチーム1匹を回復する効果は未計上です。');}
   else if(CHEER_HEAL[actual]){
    const heal=CHEER_HEAL[actual][clamp(pair.p.skillLevel-1,0,5)];
    const weights=cheerWeights(teamIds,energy);
    for(const who of teamIds){
     const recipient=byId.get(who),rate=recoveryNatureFactor(recipient.nature);
     energy.set(who,clamp(energy.get(who)+heal*triggers*(weights.get(who)||0)*rate,0,150));
    }
    warnings.add('げんきエールの回復対象は最低げんき優先70%／残り均等30%の仮定です。実際の抽選確率は確定していません。');
    if(actual==='Energizing Cheer S (Nuzzle)')warnings.add('ほっぺすりすりのスキル発動可能ボーナスは未計上です。');
    if(actual==='Energizing Cheer S (Heal Pulse)')warnings.add('いやしのはどうの追加おてつだい・ラティアスとラティオスの同時編成ボーナスは未計上です。');
   }
   else if(actual==='Berry Burst (Draco Meteor)'){
    const speciesCount=teamSpeciesCount(teamIds,members,id);
    const [own,others]=dracoBerryCounts(pair.p.skillLevel,speciesCount,teamHasLatiTwins(teamIds,members));
    let energyGain=own*berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    for(const who of teamIds){
     const target=members.get(who);if(!target||who===id)continue;
     energyGain+=others*berryUnit(target.sp.type,target.p.level,favorite,bonus);
    }
    status.berries+=triggers*energyGain;
    warnings.add('りゅうせいぐんは編成種族数とラティアス／ラティオス同時編成のボーナスを簡易期待値で計算しています。');
   }
   else if(BERRY_BURST[actual]){
    const burst=BERRY_BURST[actual],level=clamp(pair.p.skillLevel-1,0,burst.self.length-1);
    const own=burst.self[level]*(1+2*burst.critical);
    let energyGain=own*berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    for(const teammate of teamIds){
     if(teammate===id)continue;
     const target=members.get(teammate);if(!target)continue;
     energyGain+=burst.others[level]*berryUnit(target.sp.type,target.p.level,favorite,bonus);
    }
    status.berries+=triggers*energyGain;
    if(burst.critical)warnings.add('ばけのかわの大成功率18.5%は期待値で計算しています。抽選結果の上下振れは未再現です。');
   }
   else if(actual==='Tasty Chance S'){
    if(successMode==='expected')successBonus=clamp(successBonus+triggers*TASTY_CHANCE[clamp(pair.p.skillLevel-1,0,5)]/100,0,.7);
    else warnings.add('料理チャンスSは大成功期待値OFFのため計上していません。');
   }
   else if(actual==='Ingredient Draw S'||actual==='Ingredient Draw S (Super Luck)'||actual==='Ingredient Draw S (Hyper Cutter)'){
    const pool=DRAW_POOLS[pair.sp.id],chance=actual==='Ingredient Draw S (Super Luck)'?.86:1;
    if(!pool)warnings.add('食材セレクトの種族別抽選候補がマスターにありません：'+pair.p.pokemon);
    else{
     const produced=triggers*DRAW_AMOUNTS[clamp(pair.p.skillLevel-1,0,6)]*chance;
     const available=bagCapacity?Math.min(produced,Math.max(0,bagCapacity-bagUsed())):produced;
     for(const key of pool)addInventory(key,available/pool.length,true);
    }
    if(actual==='Ingredient Draw S (Super Luck)')warnings.add('きょううんは食材当選率86%の期待値を使用。ゆめのかけら報酬は対象外です。');
    if(actual==='Ingredient Draw S (Hyper Cutter)')warnings.add('かいりきバサミの条件付き追加食材は未計上です。');
    warnings.add('食材セレクトの抽選は種族ごとの候補へ均等配分した期待値近似で、実際の1種類抽選・所持数を再現しません。');
   }
   else if(INGREDIENT_MAGNET[actual]){
    const produced=triggers*INGREDIENT_MAGNET[actual][clamp(pair.p.skillLevel-1,0,6)];
    if(!magnetPool.length)status.unassignedMagnet+=produced;
    else {const available=bagCapacity?Math.min(produced,Math.max(0,bagCapacity-bagUsed())):produced;
      for(const key of magnetPool)addInventory(key,available/magnetPool.length,true);}
    if(actual==='Ingredient Magnet S (Plus)')warnings.add('プラスの条件付き追加食材は未計上です（ランダム食材部分のみ）。');
    if(actual==='Ingredient Magnet S (Present)')warnings.add('プレゼントのアメ効果はエナジーに換算しません。');
    if(actual==='Cooking Assist S (Bulk Up)'){
     if(successMode==='expected'){
      const chanceAmounts=[1,2,2,3,3,4,5];
      successBonus=clamp(successBonus+triggers*chanceAmounts[clamp(pair.p.skillLevel-1,0,6)]/100,0,.7);
     }else warnings.add('ビルドアップの大成功確率アップは大成功期待値OFFのため未計上です。');
     warnings.add('ビルドアップの食材は発見済み食材への均等配分・大成功率は期待値近似です。');
    }
   }
   else if(POT_BOOST[actual]){
    potBonus=Math.min(200,potBonus+triggers*POT_BOOST[actual][clamp(pair.p.skillLevel-1,0,6)]);
    if(actual==='Cooking Power-Up S (Minus)')warnings.add('マイナスの条件付きげんき回復効果は未計上です（鍋容量部分のみ）。');
   }
   else if(actual)warningsSkills.add(actual);
   status.skillCount+=triggers;
   pocket.set(id,{used:uncollected,berries:0,ingredients:remainingInPocket,skillState:[1,0,0]});
   extraPocket.set(id,{used:extraFood.retainedCount,berries:0,ingredients:extraFood.retained,skillState:[1,0,0]});
  }
  if(granted.size)help(teamIds,0,!!opts.camp,undefined,granted);
 }
 function help(teamIds,hours,camp,estimatedEnergy,forcedHelps){
  const group=teamIds.map(id=>members.get(id)).filter(Boolean).map(x=>x.p);
  for(const id of teamIds){
   const pair=members.get(id);if(!pair)continue;
   const x=signature(pair.p,pair.sp,group,camp,warnings),bag=forcedHelps?extraPocket.get(id):pocket.get(id);
   const e=estimatedEnergy?.get(id)??energy.get(id);
   const helps=forcedHelps?(forcedHelps.get(id)||0):(hours*3600/x.interval)/energySpeed(e);
   let remaining=helps,space=Math.max(0,(forcedHelps?999:x.carry)-bag.used);
   const averageIngredientItems=x.ingSlots.length?x.ingSlots.reduce((a,b)=>a+b.count,0)/x.ingSlots.length:0;
   const itemPerHelp=(1-x.ingRate)*x.berryPerHelp+x.ingRate*averageIngredientItems;
   const fits=Math.min(remaining,itemPerHelp>0?space/itemPerHelp:0);
   const overflow=remaining-fits;
   bag.berries+=fits*(1-x.ingRate)*x.berryPerHelp;
   for(const s of x.ingSlots){bag.ingredients[s.key]=(bag.ingredients[s.key]||0)+fits*x.ingRate*s.count/x.ingSlots.length;}
   bag.used+=fits*itemPerHelp;
   if(!forcedHelps){
    const sneaky=overflow*x.berryPerHelp;
    const strength=berryUnit(pair.sp.type,pair.p.level,favorite,bonus);
    status.berries+=sneaky*strength;status.sneaky+=sneaky*strength;
    if(!EXCLUDED_MAIN_SKILLS.has(pair.sp.skill))
     bag.skillState=advanceSkillStock(bag.skillState,fits,x.skillRate,x.stockMax);
   }
   else if(overflow>0)warnings.add('追加おてつだいの別所持上限999に達し、あふれた追加分は計上していません。');
  }
 }
 function tickActive(ids,minutes,camp,awake){
  const mid=new Map();
  for(const id of ids)mid.set(id,clamp(energy.get(id)-(awake?minutes/20:0),0,150));
  help(ids,minutes/60,camp,mid);
  for(const id of ids)if(awake)energy.set(id,clamp(energy.get(id)-minutes/10,0,150));
 }
 function cook(day,meal,teamIds){
   const capacity=effectivePotCapacity(pot,potBonus,day,!!opts.camp);
   const chosen=chooseRecipe({mode:recipeMode,preferredId:opts.recipeId||'',foodMode:opts.foodMode,inventory,potCapacity:capacity});
   if(!chosen)return 0;
   const needed=Object.entries(chosen.requirements);
   for(const [k,v] of needed){
    inventory[k]-=v;
    status.consumedIngredients[k]=(status.consumedIngredients[k]||0)+v;
   }
   const mandatoryCount=needed.reduce((n,[,v])=>n+v,0);
   const extraIngredients={};let extraEnergy=0,extraCount=0;
   if(extraMode==='fill'){
    const candidates=Object.keys(ING).filter(k=>ING[k]>0)
      .sort((a,b)=>ING[b]-ING[a]||a.localeCompare(b));
    for(const key of candidates){
     const count=Math.min(Math.floor(Math.max(0,inventory[key]||0)),capacity-mandatoryCount-extraCount);
     if(count<=0)continue;
     inventory[key]-=count;status.consumedIngredients[key]=(status.consumedIngredients[key]||0)+count;
     extraIngredients[key]=count;extraCount+=count;extraEnergy+=count*ING[key];
    }
   }
   const greatChance=successMode==='expected'?clamp((day===6?.3:.1)+successBonus,0,1):0;
   const mealEnergy=calculateMealEnergy(chosen.strength70,extraEnergy,bonus,greatChance,day);
   const value=mealEnergy.expected;
   status.cooking+=value;
   status.meals.push({day:day+1,meal,recipeId:chosen.id,name:chosen.name,energy:value,
     normalEnergy:mealEnergy.normal,extraTastyEnergy:mealEnergy.extraTasty,
     count:mandatoryCount+extraCount,mandatoryCount,extraIngredients,extraEnergy,successProbability:greatChance,
     potCapacity:capacity,usedPotBonus:potBonus});
   if(successMode==='expected')successBonus*=1-greatChance;
   // Cooking restores a small amount of energy to the current on-field party.
   for(const id of teamIds)energy.set(id,clamp(energy.get(id)+mealRecovery(energy.get(id)),0,150));
   potBonus=0;
   return value;
 }
 const daySummaries=[],nightEnergy=[];
 
 for(let d=0;d<7;d++){
  const before={berries:status.berries,cooking:status.cooking,skills:status.skills,sneaky:status.sneaky};
  let current=null;
  for(let t=7.5;t<24-1e-9;t+=.25){
    const key=t<12?'morning':t<18?'noon':'evening',ids=teams[key];
    if(current!==key){
      if(current)collect(teams[current]);
      resetStockpileLeaving(current?teams[current]:d===0?[]:teams.sleep,ids);
      current=key;collect(ids);
      if([7.5,12,18].includes(t))cook(d,t===7.5?'朝':t===12?'昼':'夜',ids);
    }
    const sinceWake=(t-7.5)*60;
    if(Math.abs(sinceWake/tapMinutes-Math.round(sinceWake/tapMinutes))<1e-6 &&t>7.5)collect(ids);
    tickActive(ids,15,!!opts.camp,true);
  }
  collect(teams.evening);
  resetStockpileLeaving(teams.evening,teams.sleep);
  // No interaction from 00:00 until 07:30. Sunday -> Monday only 00:00-04:00 counts for this week.
  // Helpers DO lose Energy while asleep: -1 Energy per 10 minutes, as when awake.
  const sleepHours=d===6?4:7.5;
  const beforeSleep=Object.fromEntries(teams.sleep.map(id=>[id,energy.get(id)]));
  for(let h=0;h<sleepHours-1e-9;h+=.25)tickActive(teams.sleep,15,!!opts.camp,true);
  const beforeRecovery=Object.fromEntries(teams.sleep.map(id=>[id,energy.get(id)]));
  // Recovery happens at the next 07:30 research/collection, not while asleep.
  // Only the fixed sleeping five recover. The user's box 5% recovery is intentionally excluded.
  if(d<6){
   const recoverBonuses=teams.sleep.filter(id=>activeSkills(byId.get(id)).includes('げんき回復ボーナス')).length;
   for(const id of teams.sleep){
    const p=byId.get(id),f=recoveryNatureFactor(p.nature);
    const selfHasBonus=activeSkills(p).includes('げんき回復ボーナス');
    energy.set(id,recoverFromSleep(energy.get(id),score,f,recoverBonuses,selfHasBonus));
   }
   collect(teams.sleep);
  }
  nightEnergy.push({day:d+1,hours:sleepHours,beforeSleep,beforeRecovery,afterRecovery:Object.fromEntries(teams.sleep.map(id=>[id,energy.get(id)]))});
  // The next Monday 04:00 is a field reset, NOT an interaction.
  // Do not credit the still-carried berries/ingredients or skill stock to the old week.
  daySummaries.push({day:d+1,berries:status.berries-before.berries,cooking:status.cooking-before.cooking,skills:status.skills-before.skills});
 }
 const stockpilePending={};
 for(const [id,probabilities] of stockpileStates){
  const pending=probabilities.reduce((sum,p,k)=>sum+p*k,0);
  if(pending>1e-9)stockpilePending[id]=pending;
 }
 if(status.stockpileResets)warnings.add('たくわえるは編成から外れた際、期待蓄積を計'+status.stockpileExpectedLost.toFixed(2)+'回分リセットしました（'+status.stockpileResets+'回の交代）。');
 if(Object.keys(stockpilePending).length)warnings.add('週末時点で放出されていないたくわえる蓄積はエナジーへ加算しません。');
 for(const s of warningsSkills)warnings.add('未対応のメインスキル（エナジー寄与未計上）：'+s);
 if(warningsSkillsExcluded.size)warnings.add('指定により計算対象外のメインスキルがあります：'+[...warningsSkillsExcluded].map(s=>({
  'Metronome':'ゆびをふる','Skill Copy (Mimic)':'ものまね','Skill Copy (Transform)':'へんしん',
  'Versatile':'オールマイティー','Dream Shard Magnet S':'ゆめのかけらゲットS',
  'Dream Shard Magnet S (Random)':'ゆめのかけらゲットS（ランダム）',
  'Dream Shard Magnet S (Aura Sphere)':'はどうだん'
 })[s]).join('、')+'。これらのスキル効果は評価せず、通常のおてつだい・きのみ・食材は計算します。');
 if(status.unassignedMagnet>0)warnings.add('食材ゲット系スキルで抽選候補が未設定のため、ランダム食材の期待'+status.unassignedMagnet.toFixed(1)+'個は料理材料に計上していません。発見済み食材を選択してください。');
 if(Object.keys(status.skillIngredients).length)warnings.add('食材ゲット系の抽選は選択した発見済み食材に均等配分した期待値近似です。実際の抽選単位・食材の偏りは未再現です。');
 warnings.add('暫定期待値モデルです。スキルストックは上限1／2回の確率分布で計算していますが、ピティ補正・発動時刻・げんき・所持上限・追加おてつだい別枠999は近似です。前週からの所持品持ち越しは未対応です。');
 if(extraMode==='none')warnings.add('追加食材はOFFです。鍋の余剰容量による食材エナジーは未計上です。');
 else warnings.add('追加食材は高エナジー食材から鍋を埋める短期近似です。翌食・翌週の食材温存やレシピの自動切替は考慮しません。');
 if(successMode==='none')warnings.add('料理の大成功はOFFです。料理チャンスSの寄与も未計上です。');
 else warnings.add('大成功は平日10%・日曜30%の推定確率と料理チャンスSの期待値近似です。大成功時のスキル蓄積リセットや結果のばらつきは簡略化しています。');
 if(bagCapacity)warnings.add('食材バッグ満杯時は回収できない食材をポケモンの所持品に残す期待値近似を使います。');
 return {berries:status.berries,cooking:status.cooking,skills:status.skills,total:status.berries+status.cooking+status.skills,sneaky:status.sneaky,skillTriggers:status.skillCount,extraHelps:status.extraHelps,stockpileResets:status.stockpileResets,stockpileExpectedLost:status.stockpileExpectedLost,stockpilePending,ingredients:status.ingredients,skillIngredients:status.skillIngredients,unassignedMagnet:status.unassignedMagnet,potBonus,successBonus,inventory,meals:status.meals,consumedIngredients:status.consumedIngredients,nightEnergy,days:daySummaries,warnings:[...warnings],models:members.size};
}
const api={simulate,RECIPES,FAVORITES,berryUnit,energySpeed,baseCarryCapacity,effectivePotCapacity,calculateMealEnergy,chooseRecipe,mealRecovery,cheerWeights,recoveryNatureFactor,recoverFromSleep,lunarBerryCounts,dracoBerryCounts,teamSpeciesCount,helperBoostCount,STOCKPILE_REWARDS,emptyStockpile,advanceStockpile,advanceSkillStock,expectedSkillStock,clearDepartingPockets,EXCLUDED_MAIN_SKILLS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeSimulator=api;
})(typeof globalThis!=='undefined'?globalThis:this);

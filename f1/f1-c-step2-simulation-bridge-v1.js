/* F1-C verified-input bridge to the existing STEP2 weekly EXPECTED-VALUE
 * simulator. Opt-in only: E7 UI, saves, old STEP2 inputs are untouched.
 * Weekly values are PROVISIONAL, never game-exact or certified optimal.
 * No network/storage access, no personal CSV or nickname in output.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PokeF1CSimulationBridge=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const fail=(code)=>Object.freeze({status:'BLOCKED',calculation:'BLOCKED',
 reason:code,weeklyEnergy:null,source:'F1_C_PINNED_66_FORMS',userRowsRetained:false});
const equal=(a,b)=>a===b||Number.isNaN(a)&&Number.isNaN(b);
const NAMES=['type','specialty','frequency','ingRate','skillRate','carryLimit','skill','english','evolutionCount','evolutionLeft'];
// Provisional 2026-11-13 Wiki estimates. The 4.0% static Mew profile is
// only appropriate to medium-tier selected skills, NOT all 12 effects.
// These values may change; all weekly results remain PROVISIONAL.
const MEW_BASE_SKILL_RATE=Object.freeze({
 'Berry Burst':.0284,'Energy for Everyone S':.0337,
 'Energizing Cheer S':.0439,
 'Charge Strength S (Random)':.064,'Charge Energy S':.064,
 'Metronome':.04,'Charge Strength M':.04,
 'Dream Shard Magnet S (Random)':.04,'Ingredient Magnet S':.04,
 'Extra Helpful S':.04,'Cooking Power-Up S':.04,'Tasty Chance S':.04
});
const trunc4=n=>Math.floor(Number((n*1e4).toFixed(6)))/1e4;
function mewProvisional(row,snapshot,rates){
 const dictionary=snapshot?.dictionaries?.mainSkills;
 if(!dictionary)return null;
 let selected=Object.keys(MEW_BASE_SKILL_RATE).find(key=>dictionary[key]===row.mainSkill);
 const notes=[];
 if(!selected&&row.mainSkill===dictionary.Versatile){
  selected='Metronome';notes.push('DEFAULT_METRONOME_ASSUMED');
 }else if(!selected&&row.mainSkill===dictionary['Charge Strength S']){
  selected='Charge Strength S (Random)';notes.push('AMBIGUOUS_RANDOM_CHARGE_ASSUMED');
 }
 if(!selected)return null;
 const n=Object.entries(snapshot.dictionaries.natures)
  .find(([,jp])=>jp===row.nature)?.[0];
 if(!n||row.mint!==true&&row.mint!==false)return null;
 const active=['lv10','lv25','lv50','lv70','lv80']
  .filter((_,i)=>row.level>=[10,25,50,70,80][i])
  .map(slot=>row[slot]);
 const dict=snapshot.dictionaries.subskills;
 const up=active.filter(x=>x===dict['Skill Trigger S']).length+
  2*active.filter(x=>x===dict['Skill Trigger M']).length;
 const probability=trunc4(MEW_BASE_SKILL_RATE[selected]*
  rates.natureFactor(n,row.mint,'skill')*(1+.18*up));
 if(!Number.isFinite(probability)||probability<0||probability>1)return null;
 if(['Metronome','Dream Shard Magnet S (Random)'].includes(selected))
  notes.push('SKILL_EFFECT_EXCLUDED_IN_LEGACY_STEP2');
 if(row.skillLevel>7)notes.push('SELECTED_SKILL_LEVEL_ABOVE_STEP2_EFFECT_CAP');
 return Object.freeze({selected,probability,notes:Object.freeze(notes)});
}
function verifyMaster(snapshot,traits,master,rates){
 rates.validateTraits(snapshot,traits);
 if(!master||!Array.isArray(master.species)||!master.natures||!master.ingredients)
  throw Error('MASTER_MISSING');
 const byName=new Map(master.species.map(s=>[s.name,s]));
 const tr=new Map(traits.traits.map(t=>[t.name,t]));
 for(const t of snapshot.targets){
  const old=byName.get(t.name),e=tr.get(t.name),p=t.sourceProfile;
  if(!old||!e)throw Error('SOURCE_IDENTITY_DRIFT');
  const expected={
   type:t.type,specialty:t.specialty,frequency:p.frequency,
   ingRate:p.ingredientRate,skillRate:p.skillRate,
   carryLimit:p.carryLimit,skill:p.mainSkill,english:t.upstreamName,
   evolutionCount:e.evolutionCount,evolutionLeft:e.evolutionLeft
  };
  for(const key of NAMES){
   if(equal(old[key],expected[key]))continue;
   // Known October -> November 2026 change. F1-B rate overrides the old
   // value; all other differences must be reviewed before simulation.
   if(t.name==='ゲンガー'&&key==='ingRate'&&
      old.ingRate===16.1&&expected.ingRate===16.6)continue;
   throw Error('SOURCE_PROFILE_DRIFT:'+t.name+'/'+key);
  }
  if(!Array.isArray(old.ings)||!Object.hasOwn(master.ingredients,p.ing1.name))
   throw Error('SOURCE_FOOD_DRIFT');
  // The normal species food catalog still matches the pinned source.
  if(!['ミュウ','ダークライ'].includes(t.name)){
   for(let i=1;i<=3;i++){
    const a=old.ings[i-1]||null,b=p['ing'+i]||null;
    if((a?.name||null)!==(b?.name||null))throw Error('SOURCE_FOOD_DRIFT');
    for(let n=1;n<=3;n++)if((a?.['c'+n]??0)!==(b?.['c'+n]??0))
     throw Error('SOURCE_FOOD_DRIFT');
   }
  }
 }
 return byName;
}
function foodSlots(row,target,snapshot,legal){
 const result=[],jp=snapshot.dictionaries.ingredients, special=legal.SPECIAL_FOODS[target.name];
 for(let slot=1;slot<=3;slot++){
  if(slot===2&&row.level<30||slot===3&&row.level<60)continue;
  let found=null;
  if(special){
   for(const [key,count] of Object.entries(special[slot-1]))
    if(count>0&&jp[key]===row['ing'+slot]){found={key,count};break;}
  }else{
   for(const entry of [target.sourceProfile.ing1,target.sourceProfile.ing2,
     target.sourceProfile.ing3].slice(0,slot)){
    if(entry&&entry.name!=='unknown'&&entry['c'+slot]>0&&
       jp[entry.name]===row['ing'+slot]){
     found={key:entry.name,count:entry['c'+slot]};break;
    }
   }
  }
  if(!found)return null;
  result.push(Object.freeze(found));
 }
 return Object.freeze(result);
}
function simulateWeekly(input,deps){
 if(!deps||!input||!Array.isArray(input.box)||!input.box.length||
    input.box.length>1000||!deps.simulator||!deps.rates||!deps.legal)
  return fail('INVALID_F1C_INPUT');
 const {snapshot,traits,master,simulator,rates,legal}=deps;
 let catalog,teams;
 try{
  catalog=verifyMaster(snapshot,traits,master,rates);
  teams=simulator.normalizeWeeklyTeams(input);
 }catch(_){return fail('INVALID_SOURCE_OR_TEAM');}
 const ids=new Set(),originalById=new Map(),chosen=new Set();
 for(const p of input.box){
  if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id))
   return fail('DUPLICATE_OR_INVALID_ID');
  ids.add(p.id);originalById.set(p.id,p);
 }
 for(const day of teams.days)
  for(const key of ['morning','noon','evening','sleep'])
   for(const id of day[key])chosen.add(id);
 const goodCamp=input.options?.camp===true;
 if(input.options?.camp!==undefined&&typeof input.options.camp!=='boolean')
  return fail('INVALID_CAMP_SETTING');
 const rows=[],reviewSpecies=new Set(),mewAssumptions=[];
 for(const id of chosen){
  const inputRow=originalById.get(id);
  if(!inputRow)return fail('UNKNOWN_INDIVIDUAL_ID');
  const pokemon=inputRow.pokemon;
  if(!catalog.has(pokemon)||!snapshot.targets.some(t=>t.name===pokemon))
   return fail('OUTSIDE_F1_SCOPE');
  // Mew is included with an explicitly provisional chosen-effect rate.
  const clean={...inputRow,
   ribbon:inputRow.ribbon??inputRow.sleepHours};
  const sourceReport=legal.auditBuild(clean,snapshot);
  if(sourceReport.status==='INVALID'||!sourceReport.inScope)
   return fail('INVALID_BUILD');
  const target=snapshot.targets.find(t=>t.name===pokemon);
  const slots=foodSlots(clean,target,snapshot,legal);
  if(!slots)return fail('UNVERIFIED_ACTIVE_FOOD');
  const mew=pokemon==='ミュウ'?mewProvisional(clean,snapshot,rates):null;
  if(pokemon==='ミュウ'&&!mew)return fail('MEW_EFFECT_NOT_IDENTIFIED');
  const rateTable={};
  for(let teammates=0;teammates<=4;teammates++){
   const rate=rates.evaluate(clean,snapshot,traits,{
    teammateHelpingBonusCount:teammates,goodCamp});
   if(rate.status==='BLOCKED')return fail('UNVERIFIED_INDIVIDUAL_RATE');
   const effective=mew?{
    ...rate,mainSkillProbabilityPerEligibleHelp:mew.probability,
    skillRateStatus:'PROVISIONAL_MEW_SELECTED_SKILL'
   }:rate;
   if(effective.mainSkillProbabilityPerEligibleHelp===null)
    return fail('UNVERIFIED_INDIVIDUAL_RATE');
   rateTable[teammates]=Object.freeze(effective);
  }
  if(mew)mewAssumptions.push(mew);
  if(sourceReport.status==='REVIEW_REQUIRED')reviewSpecies.add(pokemon);
  const subs=['lv10','lv25','lv50','lv70','lv80'].map(x=>clean[x]||'');
  // Mint neutralizes EVERY nature modifier (not just help speed).
  const nature=clean.mint?'てれや':clean.nature;
  rows.push({
   id,pokemon,nickname:clean.nickname||'',level:clean.level,
   skillLevel:clean.skillLevel,nature,
   ingredients:[clean.ing1,clean.ing2,clean.ing3],
   subskills:subs,sleepHours:clean.ribbon,shiny:clean.shiny===true,
   __f1VerifiedRates:Object.freeze(rateTable),
   __f1IngredientSlots:slots,
   ...(mew?{__f1SelectedSkill:mew.selected}:{})
  });
 }
 // Only the chosen individuals enter the simulator: a larger imported box
 // may retain unselected, unsupported, or special species safely.
 const adapted={...input,box:rows};
 let simulation;
 try{simulation=simulator.simulate(adapted);}
 catch(_){return fail('WEEKLY_SIMULATOR_REJECTED_INPUT');}
 if(!Number.isFinite(simulation?.total)||simulation.total<0||
    !Array.isArray(simulation.days)||simulation.days.length!==7)
  return fail('INVALID_WEEKLY_NUMERIC_RESULT');
 const warnings=simulation.warnings||[];
 warnings.push('F1-C暫定週間期待値：F1-Bで照合済みの個体別おてつだい速度・食材率・スキル率を使用しています。げんき、所持枠、スキルの発動時刻、料理の成立確率などは既存STEP2の近似で、最適編成の保証はありません。');
 if(mewAssumptions.length){
  const effects=[...new Set(mewAssumptions.map(m=>m.selected))];
  warnings.push('ミュウのメインスキル発動率は選択効果ごとの暫定推定値（基礎2.84%・3.37%・4.00%・4.39%・6.40%）です。確定値として扱わず、個体比較に誤差が残る可能性があります。');
  if(mewAssumptions.some(m=>m.notes.includes('SKILL_EFFECT_EXCLUDED_IN_LEGACY_STEP2')))
   warnings.push('ミュウのゆびをふる／ゆめのかけらゲットの効果はSTEP2でエナジー寄与を計算していません。');
  if(mewAssumptions.some(m=>m.notes.includes('DEFAULT_METRONOME_ASSUMED')))
   warnings.push('ミュウの選択スキルがオールマイティー表記のため、初期状態のゆびをふると仮定しました。');
  if(mewAssumptions.some(m=>m.notes.includes('AMBIGUOUS_RANDOM_CHARGE_ASSUMED')))
   warnings.push('ミュウのエナジーチャージSはランダム効果として仮定しました。');
  if(mewAssumptions.some(m=>m.notes.includes('SELECTED_SKILL_LEVEL_ABOVE_STEP2_EFFECT_CAP')))
   warnings.push('ミュウのメインスキルLv8効果は既存STEP2で表示できる効果Lv上限へ丸めています。');
 }
 if(reviewSpecies.size)
  warnings.push('一部の個体構成に未解放枠等の確認待ちがあります：'+[...reviewSpecies].join('・'));
 return Object.freeze({
  status:'PROVISIONAL',calculation:'WEEKLY_EXPECTATION_PROTOTYPE',
  source:'F1_C_PINNED_66_FORMS',weeklyEnergy:simulation.total,
  coveredIndividuals:rows.length,coveredSpeciesForms:[...new Set(rows.map(r=>r.pokemon))].length,
  // Preserve the STEP2 breakdown; never expose the input rows or rate cache.
  breakdown:simulation,
  warnings:Object.freeze([...warnings]),
  userRowsRetained:false
 });
}
return Object.freeze({verifyMaster,foodSlots,mewProvisional,simulateWeekly});
});

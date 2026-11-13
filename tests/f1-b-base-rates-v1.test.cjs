'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path');
const snapshot=require('../f1/f1-b-target-source-v1.json');
const traits=require('../f1/f1-b-help-traits-v1.json');
const calc=require('../f1/f1-b-base-rates-v1.js');
const legal=require('../f1/f1-b-legal-build-v2.js');
const dict=snapshot.dictionaries,byName=new Map(snapshot.targets.map(t=>[t.name,t]));
function firstFood(t,slot){
 const special=legal.SPECIAL_FOODS[t.name];
 if(special)return dict.ingredients[Object.keys(special[slot-1])[0]];
 const r=[t.sourceProfile.ing1,t.sourceProfile.ing2,t.sourceProfile.ing3]
  .slice(0,slot).find(x=>x&&x.name!=='unknown'&&x['c'+slot]>0);
 if(!r)throw Error('Missing candidate: '+t.name+'/'+slot);
 return dict.ingredients[r.name];
}
function row(name='エーフィ',level=50){
 const t=byName.get(name);
 return {pokemon:name,level,skillLevel:3,nature:'てれや',mint:false,ribbon:0,
  mainSkill:name==='ミュウ'?dict.mainSkills.Metronome:t.sourceProfile.mainSkillJa,
  ing1:firstFood(t,1),ing2:firstFood(t,2),ing3:firstFood(t,3),
  lv10:'きのみの数S',lv25:'おてつだいボーナス',
  lv50:'おてつだいスピードS',lv70:'スキル確率アップS',
  lv80:'食材確率アップS',nickname:'PRIVATE_ROW_MUST_NOT_RETURN'};
}
const get=(build,opts)=>calc.evaluate(build,snapshot,traits,opts);
function close(value,wanted,context){assert(Math.abs(value-wanted)<1e-8,context+': '+value+' vs '+wanted);}
test('F1-B batch: all 66 profiles join the pinned source and have finite base rates',()=>{
 assert.equal(calc.validateTraits(snapshot,traits).size,66);
 for(const t of snapshot.targets){
  const r=get(row(t.name,60));
  assert.equal(r.calculation,'BLOCKED',t.name);
  assert(['BASE_RATES_AVAILABLE','SPECIAL_REVIEW_REQUIRED'].includes(r.status),t.name+':'+r.status);
  assert(Number.isFinite(r.referenceHelpSeconds)&&r.referenceHelpSeconds>0,t.name);
  assert(Number.isInteger(r.carryLimit)&&r.carryLimit>0,t.name);
  assert(r.ingredientProbabilityPerHelp>=0&&r.ingredientProbabilityPerHelp<=1,t.name);
  assert(r.berryCountPerBerryHelp>=1);
  assert.equal(r.userRowsRetained,false);
  assert.equal(r.energyStrength,null);
  assert(!JSON.stringify(r).includes('PRIVATE_ROW_MUST_NOT_RETURN'));
 }
});
test('F1-B batch: exact Espeon neutral zero-sub base values and level adjustment',()=>{
 const b=row('エーフィ');b.lv10='リサーチEXPボーナス';b.lv25='ゆめのかけらボーナス';
 b.lv50='睡眠EXPボーナス';b.lv70='食材確率アップS';b.lv80='きのみの数S';
 const r=get(b);
 close(r.referenceHelpSeconds,2400*.902,'Lv50 base frequency');
 close(r.ingredientProbabilityPerHelp,.164,'ingRate');
 close(r.mainSkillProbabilityPerEligibleHelp,.044,'skillRate');
 assert.equal(r.berryCountPerBerryHelp,1);
 assert.equal(r.carryLimit,21);
 assert.equal(r.ribbonTier,0);
 assert.equal(r.model,'BASE_RATES_ONLY');
});
test('F1-B batch: helping-speed M and team bonuses cap at 35%, good-camp factor',()=>{
 const b=row('エーフィ',50);b.lv10='おてつだいスピードM';
 b.lv25='おてつだいスピードS';b.lv50='おてつだいボーナス';
 const r=get(b,{teammateHelpingBonusCount:4,goodCamp:true});
 close(r.referenceHelpSeconds,2400*.902*.65/1.2,'35% cap and camp');
 assert.equal(r.carryLimit,Math.ceil((16+5)*1.2));
});
test('F1-B batch: nature boosts, mint neutralization, ingredient/skill substacks',()=>{
 const b=row('エーフィ',60);
 b.nature='ひかえめ'; // Modest: ingredient up / helping speed down
 b.lv10='食材確率アップM';b.lv25='食材確率アップS';
 b.lv50='スキル確率アップM';
 b.lv70='スキル確率アップS';
 const r=get(b);
 close(r.ingredientProbabilityPerHelp,
  Math.floor(Number((.164*1.2*(1+.18*3)*1e4).toFixed(6)))/1e4,'ingredient stacking');
 close(r.referenceHelpSeconds,2400*calc.natureFactor('Modest',false,'speed')*
  Math.floor(Number((441/500*1e4).toFixed(6)))/1e4,'nature helper slow');
 const m=get({...b,mint:true});
 close(m.ingredientProbabilityPerHelp,
  Math.floor(Number((.164*(1+.18*3)*1e4).toFixed(6)))/1e4,'mint neutralization');
 assert(m.referenceHelpSeconds<r.referenceHelpSeconds);
 assert.equal(calc.natureFactor('Calm',false,'skill'),1.2);
 assert.equal(calc.natureFactor('Rash',false,'skill'),.8);
});
test('F1-B batch: ribbon HOURS are transformed to tiers, with evolution speed',()=>{
 for(const [hours,tier,bonus] of [[0,0,0],[199,0,0],[200,1,1],
  [499,1,1],[500,2,3],[1000,3,6],[2000,4,8]]){
  assert.equal(calc.ribbonTier(hours),tier);
  const b=row('ロコン',50);b.lv10='きのみの数S';
  b.lv25='リサーチEXPボーナス';b.lv50='睡眠EXPボーナス';
  const r=get({...b,ribbon:hours});
  close(r.referenceHelpSeconds,byName.get('ロコン').sourceProfile.frequency*
   Math.floor(Number((.902*([1,1,.95,.95,.88][tier])*1e4).toFixed(6)))/1e4,'ribbon factor');
  assert.equal(r.carryLimit,byName.get('ロコン').sourceProfile.carryLimit+bonus);
 }
 const baby=row('タツベイ');baby.lv25='リサーチEXPボーナス';
 baby.lv50='睡眠EXPボーナス';
 close(get({...baby,ribbon:2000}).referenceHelpSeconds,
  byName.get('タツベイ').sourceProfile.frequency*
  Math.floor(Number((.902*.75*1e4).toFixed(6)))/1e4,'two-evolution ribbon');
});
test('F1-B batch: level unlocks subskills and food (30 / 60 / 70 / 80)',()=>{
 const one=get(row('エーフィ',29));
 const two=get(row('エーフィ',30));
 const three=get(row('エーフィ',60));
 assert(one.ingredientCountsPerHelp.milk>0);
 assert(!Object.hasOwn(one.ingredientCountsPerHelp,'cacao'));
 assert(two.ingredientCountsPerHelp.cacao>0);
 assert(three.ingredientCountsPerHelp.cacao>two.ingredientCountsPerHelp.cacao/2);
 const lv69=get(row('エーフィ',69)),lv70=get(row('エーフィ',70));
 assert(lv70.mainSkillProbabilityPerEligibleHelp>lv69.mainSkillProbabilityPerEligibleHelp);
 const lv79=get(row('エーフィ',79)),lv80=get(row('エーフィ',80));
 assert(lv80.ingredientProbabilityPerHelp>lv79.ingredientProbabilityPerHelp);
});
test('F1-B batch: skill ceilings, unknown optional CSV fields, special skill HOLD',()=>{
 assert.equal(calc.skillMax('Versatile'),8);
 assert.equal(calc.skillMax('Charge Strength M'),7);
 assert.equal(calc.skillMax('Berry Burst'),6);
 assert.equal(get({...row(),skillLevel:8}).status,'BLOCKED');
 assert.equal(get({...row(),mint:null}).status,'BLOCKED');
 assert.equal(get({...row(),ribbon:null}).status,'BLOCKED');
 assert.equal(get({...row(),pokemon:'未登録の姿'}).status,'BLOCKED');
 const mew=get(row('ミュウ',60));
 assert.equal(mew.status,'SPECIAL_REVIEW_REQUIRED');
 assert.equal(mew.mainSkillProbabilityPerEligibleHelp,null);
 assert.equal(mew.skillRateStatus,'UNVERIFIED_MEW_SELECTED_SKILL_RATE');
 assert(get(row('ダークライ')).mainSkillProbabilityPerEligibleHelp>0);
});
test('F1-B batch: immutable source protection and no E7 or storage dependencies',()=>{
 const corrupted={...traits,source:{...traits.source,pokemonJsonBlob:'bad'}};
 assert.throws(()=>calc.validateTraits(snapshot,corrupted),x=>x.code==='TRAIT_PROVENANCE');
 const duplicate={...traits,traits:traits.traits.slice()};
 duplicate.traits[1]=duplicate.traits[0];
 assert.throws(()=>calc.validateTraits(snapshot,duplicate),x=>x.code==='TRAIT_IDENTITY');
 const js=fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-base-rates-v1.js'),'utf8');
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|document\.|fetch\(/);
 assert.doesNotMatch(js,/energyStrength:\s*[^n]/);
 const json=fs.readFileSync(path.resolve(__dirname,'../f1/f1-b-help-traits-v1.json'),'utf8');
 assert(!json.includes('nickname'));
});

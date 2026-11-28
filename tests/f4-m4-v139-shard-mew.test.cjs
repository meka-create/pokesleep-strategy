'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const browser=vm.createContext({});
for(const file of ['f1/f1-b-legal-build-v2.js','f1/f1-b-base-rates-v1.js',
 'f1/f1-c-skill-values-v1.js','e7-preview/e7-master-v122.js',
 'f4/f4-f1b-roster-adapter-v1.js','f4/f4-c-auto-v112.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),browser,{filename:file});
}
const snapshot=require('../f1/f1-b-target-source-v1.json');
const deps={snapshot,traits:require('../f1/f1-b-help-traits-v1.json'),
 legal:browser.PokeF1LegalBuild,rates:browser.PokeF1BaseRates,master:browser.PokeMaster};
const mew={pokemon:'ミュウ',level:45,skillLevel:4,mainSkill:'ゆめのかけらゲットS（ランダム）',
 ing1:'ピュアなオイル',ing2:'とくせんエッグ',ing3:null,nature:'てれや',
 lv10:'きのみの数S',lv25:null,lv50:null,lv70:null,lv80:null};
test('shard Mew enters the real roster with item production and no direct energy skill',()=>{
 const items=[...Array.from({length:5},()=>({...mew})),
  {...mew,mainSkill:'オールマイティー'},{...mew,ing1:'とくせんリンゴ'},
  {...mew,mainSkill:'料理チャンスS'}];
 const result=browser.PokeF4F1RosterAdapter.adapt({items,camp:false,fieldBonus:0,favoriteTypes:[]},deps);
 assert.equal(result.status,'READY',result.reason);
 assert.deepEqual(Array.from(result.profiles,p=>p.id),['p0','p1','p2','p3','p4']);
 const p=result.profiles[0],rate=p.ratesByTeammateBonus[0];
 assert.equal(p.skillCode,'Dream Shard Magnet S (Random)');
 assert.equal(p.selectedMainSkillLevel,4);
 assert.equal(rate.skillProbabilityPerEligibleHelp,null);
 assert(rate.berryEnergyPerHelp>0&&rate.ingredientCountsPerHelp.oil>0&&rate.ingredientCountsPerHelp.egg>0);
 assert.equal(browser.PokeF1SkillValues.skillValue(p.skillCode,4).unit,'DREAM_SHARDS_EXPECTED');
});
test('overnight direct-energy comparison uses the saved skill level and caps stocks',()=>{
 const skill=browser.PokeF1SkillValues;
 const candidates=Array.from({length:6},(_,i)=>({id:'p'+i,
  skillCode:'Charge Strength M',selectedMainSkillLevel:i<4?7:i===4?5:6,
  carryLimit:50,helpingBonus:false,skillSpecialty:'Skills',ratesByTeammateBonus:[{helpSeconds:3600,
   berryEnergyPerHelp:10,berryCountPerBerryHelp:1,berryItemsPerHelp:1,
   ingredientCountsPerHelp:{},skillProbabilityPerEligibleHelp:i===4?1:.5}]}));
 const selected=browser.PokeF4CAutoV112.selectNight(candidates,skill,7.5,0);
 assert(selected.includes(5)&&!selected.includes(4));
 candidates[4].selectedMainSkillLevel=7;
 assert(browser.PokeF4CAutoV112.selectNight(candidates,skill,7.5,0).includes(4));
});

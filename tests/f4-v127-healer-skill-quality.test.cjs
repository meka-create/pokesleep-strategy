'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=p=>{
 const scope={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',p),'utf8'),
  scope,{filename:p,timeout:15000});
 return scope.module.exports;
};
const auto=load('f4/f4-c-auto-v112.js');
const skillValues=load('f1/f1-c-skill-values-v1.js');
const simple=(id,level,skill='Energy for Everyone S',chance=0.06,berry=10)=>({
 id,source:'F1_B_PINNED_66_SPECIES',healerRole:'TEAM_WIDE_HEALER',
 skillCode:skill,selectedMainSkillLevel:level,helpingBonus:false,
 ratesByTeammateBonus:Array.from({length:5},()=>({
  status:'BASE_RATES_AVAILABLE',helpSeconds:3600,berryEnergyPerHelp:berry,
  ingredientCountsPerHelp:{apple:1},skillProbabilityPerEligibleHelp:chance
 }))
});
test('v127: heal-per-cast table at actual level excludes Lv1 Shuckle even with huge favorite berries',()=>{
 const low=simple('p2',1,'Energy for Everyone S (Berry Juice)',0.20,10000);
 const metric=auto.assessHealer(low,skillValues);
 assert.equal(metric.qualified,false);
 assert.equal(metric.healPerCast,5);
 assert.equal(metric.level,1);
 assert.equal(metric.reason,'HEALER_RECOVERY_TOO_LOW');
 const status=skillValues.skillValue(low.skillCode,low.selectedMainSkillLevel);
 assert.equal(status.status,'PARTIAL_SIDE_EFFECT_UNMODELED',
  'Berry Juice additional item is unpriced but base healing must be checked');
});
test('v127: Level 4 is not silently upgraded; Level 5 needs sufficient skill frequency',()=>{
 const lv4=auto.assessHealer(simple('p1',4,'Energy for Everyone S',0.5),skillValues);
 assert.equal(lv4.qualified,false);assert.equal(lv4.healPerCast,11);
 const rare=auto.assessHealer(simple('p1',5,'Energy for Everyone S',0.02),skillValues);
 assert.equal(rare.qualified,false);assert.equal(rare.healPerCast,15);
 const good=auto.assessHealer(simple('p1',5,'Energy for Everyone S',0.06),skillValues);
 assert.equal(good.qualified,true);
 assert(good.expectedPrimary>good.expectedSecondary);
 assert.equal(good.healPerCast,15);
});
test('v127: require enough combined recovery; do not invent extra heal energy',()=>{
 const a=simple('p0',6,'Energy for Everyone S',0.09);
 const b=simple('p1',5,'Energy for Everyone S (Berry Juice)',0.07);
 const people=new Map([[a.id,a],[b.id,b]]);
 const ok=auto.healerPairQuality(['p0','p1'],people,skillValues);
 assert.equal(ok.qualified,true);
 assert(ok.expected>=30);
 const result=auto.rankingScore({energyExpected:52000},['p0','p1'],people,skillValues);
 assert.equal(result.score,52000,'healing should be an eligibility gate, not synthetic Snorlax energy');
 assert.equal(result.healerQualified,true);
 const weak=auto.rankingScore({energyExpected:90000},['p0','p2'],
  new Map([...people,['p2',simple('p2',1,'Energy for Everyone S (Berry Juice)',0.5,999)]]),
  skillValues);
 assert.equal(weak.score,-Infinity,'even a spectacular berry scorer cannot bypass healing gate');
});
test('v127: invalid levels, missing rates and spoofed recovery skills are blocked',()=>{
 const p=simple('p0',6);
 assert.equal(auto.assessHealer({...p,selectedMainSkillLevel:0},skillValues).qualified,false);
 assert.equal(auto.assessHealer({...p,ratesByTeammateBonus:[]},skillValues).qualified,false);
 assert.equal(auto.assessHealer({...p,skillCode:'Charge Energy S'},skillValues).qualified,false);
 assert.equal(auto.assessHealer({...p,ratesByTeammateBonus:[{...p.ratesByTeammateBonus[0],skillProbabilityPerEligibleHelp:NaN}]},skillValues).qualified,false);
});
test('v127: Amber Valley chooses strong healer pair, never Lv1 Berry Juice healer',()=>{
 const rates=[
  simple('p0',6,'Energy for Everyone S',0.09,10),
  simple('p1',5,'Energy for Everyone S',0.09,15),
  simple('p2',1,'Energy for Everyone S (Berry Juice)',0.40,999)
 ];
 const roster=[...rates,...Array.from({length:4},(_,i)=>({
  ...simple('p'+(i+3),6,'Charge Strength M',0.01,7),
  healerRole:null
 }))];
 const windows=Array.from({length:29},(_,i)=>({
  day:i===0?-1:Math.floor((i-1)/4),
  slot:i===0?'sleep':['morning','noon','evening','sleep'][(i-1)%4],
  source:i===0?'PREVIOUS_WEEK_SLEEP':i===28?'FINAL_NIGHT_TRUNCATED':'WEEK',
  startsAt:'w'+i,endsAt:'x'+i
 }));
 const ctx={status:'CONTEXT_READY',weekStart:'2026-11-23',eventId:'manual:2026-11-23',
  clock:{status:'TIMELINE_READY',windowCount:29,phase:'BEFORE',windows},
  fields:{field:'アンバー渓谷',source:null,camp:false,food:'curry'},
  player:{bonuses:{'アンバー渓谷':65}},
  privateBoxRows:[],autoSleep:true,
  conditionRevision:'c',inventoryRevision:'i'};
 const tried=[];
 const deps={
  master:{types:{poison:'どく',bug:'むし',dragon:'ドラゴン'}},
  roster:{adapt:()=>({status:'READY',profiles:roster})},
  legal:{},rates:{},
  skillValues,
  bridge:{buildNeutralInput:(context,opts)=>({
   status:'READY',sourceCommit:'a'.repeat(40),
   input:{profiles:roster,recipes:Array.from({length:81},(_,i)=>({id:'recipe'+i})),
    nightTeams:opts.realNightTeamIndices.map(t=>t.map(i=>'p'+i)),
    previousWeekSleepTeam:opts.previousWeekSleepIndices.map(i=>'p'+i),
    eventSource:null,autoSleep:false}
  })},
  itemRank:{rank:inp=>{
   tried.push([inp.primaryHealerId,inp.secondaryHealerId]);
   const slots=windows.map((w,i)=>({
    ...w,team:i===0?[]:
     w.slot==='sleep'?inp.nightTeams[w.day]:
     w.slot==='morning'?['p3','p4','p5',inp.secondaryHealerId,inp.primaryHealerId]:
      ['p3','p4','p5','p6',inp.primaryHealerId],
    recipeId:w.slot==='sleep'?null:'recipe1'
   }));
   const berry=Number(inp.primaryHealerId.slice(1))===2?999999:1000+
    (inp.primaryHealerId==='p1'?100:0);
   return {status:'PROVISIONAL',slots,energyExpected:berry,
    weeklyEnergyCertified:false};
  }},
  healerSearch:{plan:()=>{}},healerPolicy:{validate:()=>{}},
  baseCore:{normalizeProfiles:()=>{}},weekClock:{build:()=>{}}
 };
 const result=auto.propose(ctx,{},deps);
 assert.equal(result.status,'PROVISIONAL',result.reason);
 assert(!tried.some(pair=>pair.includes('p2')),'low-level Shuckle must never reach final reranking');
 assert(new Set([result.selectedPrimary,result.selectedSecondary]).size===2);
 assert(![result.selectedPrimary,result.selectedSecondary].includes('p2'));
 assert.equal(result.rankingEnergyProxy,result.expectedEnergy);
});
test('v127: no sufficiently leveled healer pair fails closed rather than picking low-level favorite berry',()=>{
 const roster=[
  simple('p0',2,'Energy for Everyone S',0.40,2000),
  simple('p1',1,'Energy for Everyone S (Berry Juice)',0.50,3000),
  ...Array.from({length:4},(_,i)=>({...simple('p'+(i+2),6,'Charge Strength M',0.01,5),healerRole:null}))
 ];
 const ctx={status:'CONTEXT_READY',weekStart:'2026-11-23',eventId:'manual:2026-11-23',
  clock:{status:'TIMELINE_READY',windowCount:29,phase:'BEFORE',windows:[]},
  fields:{field:'アンバー渓谷',source:null},
  player:{bonuses:{'アンバー渓谷':60}},privateBoxRows:[],autoSleep:true,
  conditionRevision:'c',inventoryRevision:'i'};
 const deps={master:{types:{poison:'どく',bug:'むし',dragon:'ドラゴン'}},
  roster:{adapt:()=>({status:'READY',profiles:roster})},
  skillValues,
  bridge:{buildNeutralInput:(c,o)=>({status:'READY',sourceCommit:'a'.repeat(40),
   input:{profiles:roster,nightTeams:o.realNightTeamIndices.map(team=>team.map(i=>'p'+i)),
    previousWeekSleepTeam:o.previousWeekSleepIndices.map(i=>'p'+i),
    recipes:Array.from({length:81},(_,i)=>({id:'recipe'+i})),eventSource:null}
  })},
  itemRank:{rank:()=>{throw Error('Must not rank invalid healer')}},
  healerSearch:{plan:()=>{}},healerPolicy:{validate:()=>{}},
  baseCore:{normalizeProfiles:()=>{}},weekClock:{build:()=>{}}
 };
 const result=auto.propose(ctx,{},deps);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.reason,'TWO_QUALIFIED_HEALERS_REQUIRED');
});
test('v127: automatic sleep roster prices verified direct energy at individual skill level',()=>{
 const players=Array.from({length:6},(_,i)=>({
  ...simple('p'+i,i===0?1:7,'Charge Strength M',0.12,10),
  healerRole:null
 }));
 // All help/berry/ingredients are identical: the lone Lv1 must be the
 // one excluded from the top five if direct skill effect level matters.
 const selected=auto.selectNight(players,skillValues);
 assert.equal(selected.length,5);
 assert(!selected.includes(0));
 assert(selected.includes(5));
});
test('v127: F5 and UI consume the same fail-closed healer gate',()=>{
 const f5=fs.readFileSync(path.resolve(__dirname,'../f5/f5-midweek-v119.js'),'utf8');
 const ui=fs.readFileSync(path.resolve(__dirname,'../e7-preview/e7-f4c-integrated-v112.js'),'utf8');
 assert.match(f5,/deps\.auto\.assessHealer\(p,deps\.skillValues\)\.qualified/);
 assert.match(f5,/deps\.auto\.healerPairQuality\(/);
 assert.match(ui,/TWO_QUALIFIED_HEALERS_REQUIRED/);
 assert.match(ui,/F5_TWO_QUALIFIED_HEALERS_REQUIRED/);
});

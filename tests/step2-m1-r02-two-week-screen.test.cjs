'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx,{filename:file});
const {comparePair}=require('../scripts/step2-m1-r02-two-week-compare.cjs');
const master=ctx.globalThis.PokeMaster,sim=ctx.globalThis.PokeSimulator,
 obs=ctx.globalThis.PokeObservation;
const dex=new Map(master.species.map(sp=>[sp.name,sp]));
function member(id,name){
 const sp=dex.get(name);assert.ok(sp,name);
 const slots=sp.mythIng||sp.ings;
 const first=slots.find(s=>s&&s.c1>0);
 assert.ok(first,name+' mandatory first slot');
 return {id,pokemon:name,nickname:id,level:50,skillLevel:6,
  ingredients:[1,2,3].map(i=>{
   const slot=slots.find(s=>s&&s['c'+i]>0);
   return slot?master.ingredients[slot.name]:'';
  }),
  subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false};
}
const sleep=['a','b','c','d','e'],one=['a','b','c','d','w'],
 two=['a','b','c','w','g'];
function fixture(roster){
 return {box:[
  member('a','ライチュウ'),member('b','ライチュウ'),
  member('c','ライチュウ'),member('d','ライチュウ'),
  member('e','ライチュウ'),member('w','プクリン'),member('g','サーナイト')
 ],teams:{morning:[...roster],noon:[...roster],evening:[...roster],sleep:[...sleep]},
 options:{map:'ゴールド旧発電所',fieldBonus:25,tapMinutes:150,potSize:57,
  sleepScore:88,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',
  recipeId:'apple_curry',initialIngredients:{apple:147},
  bagCapacity:500,camp:false,extraMode:'none',successMode:'expected',
  magnetIngredients:['apple']}
 };
}
const allVerified=Object.fromEntries(obs.flags.map(k=>[k,true]));
function observation(roster,monday,edit){
 const input=fixture(roster);
 if(edit)edit(input);
 const predicted=sim.simulate(input);
 const summaryBerry=Math.round(predicted.berries+predicted.skills);
 const summaryCooking=Math.round(predicted.cooking);
 return obs.makeReport(obs.captureSimulation(input,predicted,'0.2.55','2026-10-20T10:00:00.000Z'),{
  mondayDate:monday,total:String(summaryBerry+summaryCooking),
  berryAndStrengthSkill:String(summaryBerry),cooking:String(summaryCooking),
  confirmedSummary:true,...allVerified
 });
}
const pair=()=>[
 observation(one,'2026-10-19'),observation(two,'2026-10-26')
];
function screen(reports){return obs.reviewImportedReports(reports,sim.simulate).r02TwoWeekScreen;}
test('R02 two different saved weeks, same input except one daytime healer substitution, are descriptive ONLY',()=>{
 const reports=pair(),result=screen(reports);
 assert.equal(result.type,'R02_TWO_WEEK_SCREEN');
 assert.equal(result.status,'DESCRIPTIVE_ONLY');
 assert.equal(result.blockers.length,0);
 assert.ok(result.modelLimitations.some(s=>s.includes('R02型')));
 assert.equal(result.rankOrAccuracyValidated,false);
 assert.equal(result.independentGameRankingValidated,false);
 assert.equal(result.accuracyGate,'HOLD');
 assert.equal(result.step3,'NOT_STARTED');
 assert.equal(result.comparison.oneHealerMonday,'2026-10-19');
 assert.equal(result.comparison.twoHealerMonday,'2026-10-26');
 assert.equal(result.comparison.observedDeltaTwoMinusOne,
  reports[1].observed.total-reports[0].observed.total);
 assert.ok(Number.isFinite(result.comparison.modeledDeltaTwoMinusOne));
 assert.ok(Number.isFinite(result.comparison.descriptiveDeltaDisagreement));
 assert.ok(result.notes.some(s=>s.includes('証明しません')));
 // A model that excludes real Extra Tasty rolls cannot screen cooked game weeks.
 const off=[observation(one,'2026-10-19',x=>x.options.successMode='none'),
  observation(two,'2026-10-26',x=>x.options.successMode='none')];
 const blocked=screen(off);
 assert.equal(blocked.status,'NON_COMPARABLE');
 assert.ok(blocked.modelLimitations.some(s=>s.includes('大成功期待値OFF')));
 const cli=comparePair(reports);
 assert.equal(cli.status,result.status);
 assert.equal(cli.comparison.modeledDeltaTwoMinusOne,result.comparison.modeledDeltaTwoMinusOne);
 assert.equal(cli.comparison.observedDeltaTwoMinusOne,result.comparison.observedDeltaTwoMinusOne);
 assert.equal(cli.screenshotVerified,false);
 assert.throws(()=>comparePair([reports[0]]),/2つ/);
 const reverse=screen(reports.slice().reverse());
 assert.equal(reverse.status,'DESCRIPTIVE_ONLY');
 assert.equal(reverse.comparison.modeledDeltaTwoMinusOne,result.comparison.modeledDeltaTwoMinusOne);
 assert.equal(reverse.comparison.observedDeltaTwoMinusOne,result.comparison.observedDeltaTwoMinusOne);
});
test('R02 screening refuses same-week duplicates, mismatched box/settings/sleep, non-fixed daytime, or multiple substitutions',()=>{
 const edits=[
  rs=>rs[1].week.mondayDate=rs[0].week.mondayDate,
  rs=>rs[1]=observation(two,'2026-10-26',x=>x.box[0].level=49),
  rs=>rs[1]=observation(two,'2026-10-26',x=>x.options.fieldBonus=50),
  rs=>rs[1]=observation(two,'2026-10-26',x=>x.options.eventEffects='限定ボーナス適用'),
  rs=>rs[1]=observation(two,'2026-10-26',x=>x.teams.sleep=['b','a','c','d','e']),
  rs=>rs[1]=observation(two,'2026-10-26',x=>x.teams.noon=['a','b','c','d','w']),
  rs=>rs[1]=observation(['a','b','w','g','e'],'2026-10-26')
 ];
 for(const edit of edits){
  const reports=pair();edit(reports);
  const out=screen(reports);
  assert.equal(out.status,'NON_COMPARABLE');
  assert.equal(out.comparison,null);
  assert.ok(out.blockers.length>=1);
  assert.equal(out.rankOrAccuracyValidated,false);
 }
});
test('R02 screening declines drift, incomplete provenance, or imbalanced game summary',()=>{
 const tamper=[
  rs=>{rs[0].capture.modelAtCapture.total+=100;rs[0].capture.modelAtCapture.berries+=100;},
  rs=>{rs[1].provenance.sameCollectionSchedule=false;},
  rs=>{rs[1].observed.total+=10;}
 ];
 for(const edit of tamper){
  const reports=pair();edit(reports);
  const out=screen(reports);
  assert.equal(out.status,'NON_COMPARABLE');
  assert.equal(out.comparison,null);
  assert.equal(out.accuracyGate,'HOLD');
 }
});
test('R02 screen never confuses same-team repeat weeks or batches with a candidate 1-vs-2 comparison',()=>{
 const same=screen([observation(one,'2026-10-19'),observation(one,'2026-10-26')]);
 assert.equal(same.status,'NON_COMPARABLE');
 assert.ok(same.blockers.some(s=>s.includes('1匹対2匹')));
 const single=screen([observation(one,'2026-10-19')]);
 assert.equal(single,null);
 const triple=screen([observation(one,'2026-10-19'),
  observation(two,'2026-10-26'),observation(two,'2026-11-02')]);
 assert.equal(triple,null);
});

test('R02 pair with identical non-R02 model omissions still blocks a misleading comparison',()=>{
 for(const edit of [
  x=>{x.options.eventEffects='イベントの追加エナジー';},
  x=>{x.box[0].ingredients[0]='';}
 ]){
  const a=observation(one,'2026-10-19',edit);
  const b=observation(two,'2026-10-26',edit);
  const out=screen([a,b]);
  assert.equal(out.status,'NON_COMPARABLE');
  assert.equal(out.comparison,null);
  assert.ok(out.blockers.some(s=>s.includes('R02以外')));
  assert.equal(out.independentGameRankingValidated,false);
 }
});

test('R02 whitelist cannot be spoofed by an unknown species name containing an allowed diagnostic substring',()=>{
 for(const speciesName of ['R02型未登録','げんき回復時の150上限_未登録']){
  const invalid=x=>{x.box.find(p=>p.id==='b').pokemon=speciesName;};
  const a=observation(one,'2026-10-19',invalid);
  const b=observation(two,'2026-10-26',invalid);
  const out=screen([a,b]);
  assert.equal(out.status,'NON_COMPARABLE');
  assert.equal(out.comparison,null);
  assert.ok(out.modelLimitations.some(x=>x.includes('マスター未登録')&&x.includes(speciesName)));
  assert.ok(out.blockers.some(x=>x.includes('R02以外')));
  assert.equal(out.independentGameRankingValidated,false);
 }
});


test('R02 comparison ignores harmless box-array order while preserving lineup and member differences',()=>{
 const rs=pair(),before=screen(rs);
 assert.equal(before.status,'DESCRIPTIVE_ONLY');
 const same=JSON.parse(JSON.stringify(rs[1]));
 same.input.box.reverse();
 const preserved=JSON.stringify(same);
 const after=screen([rs[0],same]);
 assert.equal(after.status,'DESCRIPTIVE_ONLY');
 assert.equal(after.blockers.length,0);
 assert.equal(after.comparison.modeledDeltaTwoMinusOne,before.comparison.modeledDeltaTwoMinusOne);
 assert.equal(after.comparison.observedDeltaTwoMinusOne,before.comparison.observedDeltaTwoMinusOne);
 assert.equal(JSON.stringify(same),preserved);
 const viaCli=comparePair([rs[0],same]);
 assert.equal(viaCli.status,'DESCRIPTIVE_ONLY');
 const genuinelyChanged=JSON.parse(JSON.stringify(same));
 genuinelyChanged.input.box.find(p=>p.id==='a').level--;
 assert.equal(screen([rs[0],genuinelyChanged]).status,'NON_COMPARABLE');
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareBuckets,compareSingleWeek}=require('../scripts/step2-m1-observation-compare.cjs');
test('weekly game berry summary is compared with simulator berries PLUS direct strength skills',()=>{
 const r=compareBuckets({total:175,berries:100,skills:25,cooking:50},
  {total:180,berryAndStrengthSkill:125,cooking:55});
 assert.equal(r.model.berryAndStrengthSkill,125);
 assert.equal(r.signedDeltaObservedMinusModel.berryAndStrengthSkill,0);
 assert.equal(r.signedDeltaObservedMinusModel.total,5);
 assert.equal(r.signedDeltaObservedMinusModel.cooking,5);
 assert.equal(r.grade,'RAW_SINGLE_WEEK_OBSERVATION_ONLY');
 assert.equal(r.rankOrAccuracyValidated,false);
});
test('unattributed game weekly totals must warn rather than be silently assigned to berries',()=>{
 const r=compareBuckets({total:175,berries:100,skills:25,cooking:50},
  {total:181,berryAndStrengthSkill:125,cooking:55});
 assert.equal(r.observed.unattributed,1);
 assert.equal(r.weeklySummaryBucketsReconcile,false);
 assert.ok(r.warnings.some(x=>x.includes('2欄の合計が異なります')));
});
test('invalid observed data and internally inconsistent predictions fail closed',()=>{
 assert.throws(()=>compareBuckets({total:175,berries:100,skills:25,cooking:50},
  {total:-1,berryAndStrengthSkill:100,cooking:50}),/整数/);
 assert.throws(()=>compareBuckets({total:175,berries:100,skills:25,cooking:50},
  {total:10,berryAndStrengthSkill:2.5,cooking:5}),/整数/);
 assert.throws(()=>compareBuckets({total:170,berries:100,skills:25,cooking:50},
  {total:175,berryAndStrengthSkill:125,cooking:50}),/内訳/);
});
test('weekly observation gate rejects missing inputs, non-Mondays and mismatched field',()=>{
 const t={schema:'step2-m1-weekly-observation-v1',week:{mondayDate:'2026-10-19',field:'ゴールド旧発電所'},
  provenance:{source:'in_game_weekly_summary'},input:{box:[],teams:{},options:{map:'シアンの砂浜'}},
  observed:{total:1,berryAndStrengthSkill:1,cooking:0}};
 assert.throws(()=>compareSingleWeek({...t,week:{...t.week,mondayDate:'2026-10-18'}}),/月曜日/);
 assert.throws(()=>compareSingleWeek(t),/一致しません/);
 assert.throws(()=>compareSingleWeek({...t,provenance:{source:'uncorroborated'}}),/出典/);
});
test('complete simulator input can be compared against a single observation without declaring accuracy',()=>{
 const ids=['a','b','c','d','e'];
 const p=id=>({id,pokemon:'ライチュウ',nickname:id,level:1,skillLevel:1,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false});
 const x={schema:'step2-m1-weekly-observation-v1',
  week:{mondayDate:'2026-10-19',field:'ゴールド旧発電所'},
  provenance:{source:'in_game_weekly_summary',noUnmodeledEvents:false,sameCollectionSchedule:false,noUntrackedItems:false,startStrengthVerified:false},
  input:{box:ids.map(p),teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
   options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:150,potSize:57,
    sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'',
    initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'none'}},
  observed:{total:10,berryAndStrengthSkill:10,cooking:0}};
 const r=compareSingleWeek(x);
 assert.equal(r.status,'CONFOUNDED_OBSERVATION');
 assert.equal(r.accuracyGate,'HOLD');
 assert.equal(r.rankOrAccuracyValidated,false);
 assert.equal(r.provenance.screenshotReviewed,false);
 assert.equal(r.confounders.length,5);
 assert.ok(r.confounders.some(x=>x.includes('04:00')));
 assert.ok(r.model.total>0);
});

test('observation verification flags must be boolean, never truthy strings',()=>{
 const t={schema:'step2-m1-weekly-observation-v1',
  week:{mondayDate:'2026-10-19',field:'ゴールド旧発電所'},
  provenance:{source:'in_game_weekly_summary',noUnmodeledEvents:'false'},
  input:{box:[],teams:{},options:{map:'ゴールド旧発電所'}},
  observed:{total:0,berryAndStrengthSkill:0,cooking:0}};
 assert.throws(()=>compareSingleWeek(t),/確認フラグ/);
});
test('a contradictory game summary is always confounded even if user checked every flag',()=>{
 const ids=['a','b','c','d','e'];
 const p=id=>({id,pokemon:'ライチュウ',nickname:id,level:1,skillLevel:1,
  ingredients:['とくせんリンゴ','',''],subskills:['','','','',''],nature:'まじめ',sleepHours:0,shiny:false});
 const flags={source:'in_game_weekly_summary',noUnmodeledEvents:true,
  sameCollectionSchedule:true,noUntrackedItems:true,startStrengthVerified:true,weekBoundaryReconciled:true};
 const input={box:ids.map(p),teams:{morning:ids,noon:ids,evening:ids,sleep:ids},
  options:{map:'ゴールド旧発電所',fieldBonus:0,tapMinutes:150,potSize:57,
   sleepScore:80,initialEnergy:100,foodMode:'curry',recipeMode:'fixed',recipeId:'',
   initialIngredients:{},bagCapacity:0,camp:false,extraMode:'none',successMode:'none'}};
 const base={schema:'step2-m1-weekly-observation-v1',week:{mondayDate:'2026-10-19',field:'ゴールド旧発電所'},
  provenance:flags,input,observed:{total:10,berryAndStrengthSkill:10,cooking:0}};
 const ok=compareSingleWeek(base);
 assert.equal(ok.status,'UNCALIBRATED_OBSERVATION');
 assert.equal(ok.accuracyGate,'HOLD');
 assert.equal(ok.rankOrAccuracyValidated,false);
 const bad=compareSingleWeek({...base,observed:{total:11,berryAndStrengthSkill:10,cooking:0}});
 assert.equal(bad.status,'CONFOUNDED_OBSERVATION');
 assert.equal(bad.weeklySummaryBucketsReconcile,false);
 assert.ok(bad.confounders.some(x=>x.includes('合計が一致しません')));
 assert.equal(bad.accuracyGate,'HOLD');
 const legacy=compareSingleWeek({...base,provenance:{...flags,weekBoundaryReconciled:undefined}});
 assert.equal(legacy.status,'CONFOUNDED_OBSERVATION');
 assert.ok(legacy.confounders.some(x=>x.includes('04:00')));
});

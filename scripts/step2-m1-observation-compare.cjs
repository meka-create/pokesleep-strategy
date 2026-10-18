'use strict';
/* M1 single-week observational data intake.
 * The game's weekly summary has "berry Strength" and "cooking Strength":
 * direct Charge Strength skill is included with BERRIES in the game's UI.
 * Never compare that bucket against simulator.berries alone.
 * A single random week is NOT evidence of expected-value accuracy.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx,{filename:file});
const sim=ctx.globalThis.PokeSimulator;
const observation=ctx.globalThis.PokeObservation;
function whole(x){
 return typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
}
function compareBuckets(predicted,observed){
 if(!predicted||!['berries','skills','cooking','total'].every(k=>
   typeof predicted[k]==='number'&&Number.isFinite(predicted[k])&&predicted[k]>=0))
  throw Error('週間計算結果の数値が不正です。');
 if(!observed||!whole(observed.total)||!whole(observed.berryAndStrengthSkill)||
   !whole(observed.cooking))
  throw Error('週間まとめの総・きのみ欄・料理欄の整数値が必要です。');
 const modelBerryAndStrength=predicted.berries+predicted.skills;
 if(Math.abs(modelBerryAndStrength+predicted.cooking-predicted.total)>1e-5)
  throw Error('モデルの週間エナジー内訳が一致しません。');
 const unknownObserved=observed.total-observed.berryAndStrengthSkill-observed.cooking;
 const signedDelta={
  total:observed.total-predicted.total,
  berryAndStrengthSkill:observed.berryAndStrengthSkill-modelBerryAndStrength,
  cooking:observed.cooking-predicted.cooking
 };
 return {
  model:{total:predicted.total,berryAndStrengthSkill:modelBerryAndStrength,
   cooking:predicted.cooking,berryInternal:predicted.berries,skillInternal:predicted.skills},
  observed:{...observed,unattributed:unknownObserved},
  signedDeltaObservedMinusModel:signedDelta,
  weeklySummaryBucketsReconcile:unknownObserved===0,
  grade:'RAW_SINGLE_WEEK_OBSERVATION_ONLY',
  rankOrAccuracyValidated:false,
  warnings:[
   'ゲーム内の「きのみでのエナジー」欄にはエナジーチャージなど直接エナジー獲得スキルの寄与も含まれ得ます。シミュレーターのきのみ+スキルとの比較は暫定的な対応付けです。',
   '一週間の実測1回と確率モデルの期待値は一致するとは限らず、この差分単独では計算精度や編成順位の合否を判定できません。',
   ...(unknownObserved!==0?['週間まとめの総エナジーと2欄の合計が異なります。特殊効果・計上分類・記録ミスを先に確認してください。']:[])
  ]
 };
}
function compareSingleWeek(report){
 if(!report||report.schema!=='step2-m1-weekly-observation-v1')
  throw Error('M1週間まとめ報告のスキーマが不正です。');
 const {week,provenance,input,observed}=report;
 if(!week||typeof week.mondayDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week.mondayDate))
  throw Error('週の開始日（YYYY-MM-DD）が必要です。');
 const date=new Date(week.mondayDate+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.getUTCDay()!==1||
   date.toISOString().slice(0,10)!==week.mondayDate)
  throw Error('週開始日は有効な月曜日である必要があります。');
 if(!provenance||provenance.source!=='in_game_weekly_summary'||
   !input||!input.options||!input.teams||!Array.isArray(input.box))
  throw Error('ゲーム内の週まとめ出典と同週の手動編成設定が必要です。');
 // Non-boolean strings such as "false" must never count as verified evidence.
 const confirmationKeys=['noUnmodeledEvents','sameCollectionSchedule','noUntrackedItems',
  'startStrengthVerified','weekBoundaryReconciled'];
 for(const key of confirmationKeys){
  if(Object.prototype.hasOwnProperty.call(provenance,key)&&typeof provenance[key]!=='boolean')
   throw Error('観測条件の確認フラグは真偽値で指定してください: '+key);
 }
 if(typeof week.field!=='string'||!week.field.trim())
  throw Error('観測フィールドを指定してください。');
 if(week.field!==input.options.map)
  throw Error('観測フィールドとシミュレーター設定が一致しません。');
 observation.validateReplayInput(input);
 if(report.capture!==undefined)observation.validateReplayCapture(report.capture);
 const predicted=sim.simulate(input);
 // New browser-originated evidence carries the *actual model result recorded
 // at run time*. Replaying after a master or engine change must not silently
 // compare a new model prediction as though it were the old one.
 let captureComparison=null;
 if(report.capture!==undefined){
  const c=report.capture;
  if(!c||typeof c!=='object'||!c.modelAtCapture||
   !['total','berries','skills','cooking'].every(k=>
    typeof c.modelAtCapture[k]==='number'&&Number.isFinite(c.modelAtCapture[k])&&c.modelAtCapture[k]>=0))
   throw Error('記録時の試算スナップショットが不正です。');
  const delta=Object.fromEntries(['total','berries','skills','cooking'].map(k=>
   [k,predicted[k]-c.modelAtCapture[k]]));
  captureComparison={matchesCurrentModel:Object.values(delta).every(x=>Math.abs(x)<1e-5),
   signedDeltaCurrentMinusCaptured:delta,declaredAppVersion:c.appVersion??null,
   warning:'記録された試算値はユーザー提供データです。署名済みのゲーム観測ではありません。'};
 }
 const bucket=compareBuckets(predicted,observed);
 const unexplained=[
  captureComparison&&!captureComparison.matchesCurrentModel?'記録時の試算値と現在の計算器による再試算が一致しません。マスター・モデル版や入力の変更を先に確認してください。':null,
  !provenance.noUnmodeledEvents?'イベント・EX等の未対応追加効果が除外されたことを確認できません。':null,
  !provenance.sameCollectionSchedule?'実際の回収・食事・編成交代時刻と本モデルのスケジュールが同じか未確認です。':null,
  !provenance.noUntrackedItems?'ホイッスル等のアイテムによる増加が除外されたことを確認できません。':null,
  !provenance.startStrengthVerified?'月曜07:30の試算開始時点のエナジー差分を確認できません。':null,
  !provenance.weekBoundaryReconciled?'実ゲームの月曜04:00開始とモデルの月曜07:30開始の3時間30分の差を照合できません。':null,
  !bucket.weeklySummaryBucketsReconcile?'実ゲームの週まとめ総エナジーと、きのみ欄＋料理欄の合計が一致しません。':null
 ].filter(Boolean);
 // A meal that relies on expected (not guaranteed) future ingredients is
 // not comparable to a deterministic observed meal count without extra evidence.
 const modelLimitations=predicted.estimatedMeals>0?[
  'モデルは'+predicted.estimatedMeals+'食の料理成立を不確実な食材生産期待値から計上しています。実際の成立率は未検証です。'
 ]:[];
 return {
  schema:report.schema,week:{mondayDate:week.mondayDate,field:week.field},
  provenance:{source:provenance.source,screenshotReviewed:false,rawSingleWeek:true},
  ...bucket,
  captureComparison,
  status:unexplained.length||modelLimitations.length?'CONFOUNDED_OBSERVATION':'UNCALIBRATED_OBSERVATION',
  confounders:unexplained,modelLimitations,
  accuracyGate:'HOLD',step3:'NOT_STARTED',
  notes:'ユーザー報告の1週間まとめを数値比較するだけで、画像確認・再現実験・期待値精度合格は行いません。'
 };
}
if(require.main===module){
 const file=process.argv[2];
 if(!file){process.stderr.write('Usage: npm run m1:observe -- path/to/your-real-week.json\n');process.exit(1);}
 try{
  const report=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  process.stdout.write(JSON.stringify(compareSingleWeek(report),null,2)+'\n');
 }catch(error){process.stderr.write(String(error.message||error)+'\n');process.exit(1);}
}
module.exports={compareBuckets,compareSingleWeek};

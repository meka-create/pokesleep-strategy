(function(root){
'use strict';
// Browser and Node share the evidence contract; this is NOT a game accuracy gate.
const schema='step2-m1-weekly-observation-v1';
const planSchema='step2-m1-weekly-plan-v1';
const flags=['noUnmodeledEvents','sameCollectionSchedule','noUntrackedItems',
 'startStrengthVerified','weekBoundaryReconciled'];
// Persist minimal, non-sensitive model diagnostics at the ORIGINAL run.
// Total/berry/skill/cooking alone cannot reconstruct uncertainty at capture.
// Existing three/four-counter observation JSON remains readable. New captures
// also preserve dependence on expected skill-driven pot expansion.
const legacyDiagnosticFields=['estimatedMeals','healingTimerCorrelationEvents','healingCapNonlinearEvents'];
const optionalReplayDiagnosticFields=['expectedSourceMeals','potDependentMeals'];
const diagnosticFields=[...legacyDiagnosticFields,...optionalReplayDiagnosticFields];
function modelDiagnostics(predicted){
 const present=diagnosticFields.filter(k=>Object.prototype.hasOwnProperty.call(predicted,k));
 if(present.length===0)return null; // historical/limited model-only snapshots
 if(present.length!==diagnosticFields.length||diagnosticFields.some(k=>
   !Number.isSafeInteger(predicted[k])||predicted[k]<0))
  throw Error('試算時点の診断カウンターが不正です。再度試算してください。');
 return Object.fromEntries(diagnosticFields.map(k=>[k,predicted[k]]));
}
function capturedDiagnosticLimitations(capture,current){
 const stored=capture&&capture.modelDiagnosticsAtCapture;
 if(!stored)return ['記録時点の料理成立・げんき回復の診断情報が保存されていません。旧形式として比較保留にしてください。'];
 const issues=[];
 if(!Object.prototype.hasOwnProperty.call(stored,'expectedSourceMeals'))
  issues.push('記録時点の追加食材を含む不確実な料理エナジーの診断情報が保存されていません。旧形式として比較保留にしてください。');
 if(!Object.prototype.hasOwnProperty.call(stored,'potDependentMeals'))
  issues.push('記録時点のスキル期待値による鍋拡張依存の診断情報が保存されていません。旧形式として比較保留にしてください。');
 if(current&&diagnosticFields.some(k=>Object.prototype.hasOwnProperty.call(stored,k)&&stored[k]!==current[k]))
  issues.push('記録時点と現在の計算器で、料理成立・追加食材・鍋拡張・げんき回復の診断カウンターが変わっています。計算条件・版数を再確認してください。');
 return issues;
}
function integerInput(raw,name){
 const value=String(raw??'').trim();
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))
  throw Error(name+'は0以上の整数を入力してください。');
 return Number(value);
}
function validMonday(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&d.getUTCDay()===1;
}
function modelStats(predicted){
 if(!predicted||!['total','berries','cooking','skills'].every(
  k=>typeof predicted[k]==='number'&&Number.isFinite(predicted[k])&&predicted[k]>=0))
  throw Error('試算結果の内訳が不正です。再度試算してください。');
 if(Math.abs(predicted.berries+predicted.cooking+predicted.skills-predicted.total)>1e-5)
  throw Error('試算内訳が総エナジーと一致していません。再度試算してください。');
 return {total:predicted.total,berries:predicted.berries,
  skills:predicted.skills,cooking:predicted.cooking};
}
function captureSimulation(input,predicted,appVersion,capturedAt){
 if(!input||!Array.isArray(input.box)||!input.teams||!input.options||
  typeof input.options.map!=='string'||!input.options.map.trim())
  throw Error('フィールドと編成が確定した試算が必要です。');
 const safe=modelStats(predicted),diagnostics=modelDiagnostics(predicted);
 const snapshot=JSON.parse(JSON.stringify({input,model:safe,
  ...(diagnostics?{modelDiagnostics:diagnostics}:{})}));
 if(typeof appVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(appVersion))
  throw Error('計算器の版数を確認できません。');
 if(typeof capturedAt!=='string'||!Number.isFinite(Date.parse(capturedAt))||
  new Date(capturedAt).toISOString()!==capturedAt)
  throw Error('試算日時が不正です。');
 return {...snapshot,appVersion,capturedAt};
}

 // Browser clock and editable JSON are not independent proof of advance registration.
 function forecastTiming(capturedAt,mondayDate){
  if(!validMonday(mondayDate)||typeof capturedAt!=='string'||
     !Number.isFinite(Date.parse(capturedAt))||
     new Date(capturedAt).toISOString()!==capturedAt)
   throw Error('観測週または事前試算の日時が不正です。');
  const start=Date.parse(mondayDate+'T04:00:00+09:00');
  const end=start+7*24*60*60*1000,at=Date.parse(capturedAt);
  return {phase:at<start?'PRE_WEEK':at<end?'DURING_WEEK':'AFTER_WEEK',
   capturedAt,weekStartJst:mondayDate+' 04:00 JST',
   preWeekByRecordedClock:at<start,independentlyVerified:false};
 }
 function timingLimitations(capture,mondayDate){
  const timing=forecastTiming(capture.capturedAt,mondayDate);
  if(timing.phase==='DURING_WEEK')
   return ['試算の保存日時は対象週の月曜04:00以降です。週開始前に固定した予測ではなく、週途中に作った試算として比較保留にしてください。'];
  if(timing.phase==='AFTER_WEEK')
   return ['試算の保存日時は対象週が終了した後です。事後再現のため、週開始前に固定した予測として扱えません。'];
  return [];
 }
 // Export the snapshot before Monday 04:00 JST; never substitute a later rerun.
 function makePlan(snapshot,mondayDate){
  if(!snapshot||!snapshot.input||!snapshot.model)throw Error('先に7日間を試算してください。');
  if(!validMonday(mondayDate))throw Error('事前計画の対象週には実際の月曜日を指定してください。');
  if(!forecastTiming(snapshot.capturedAt,mondayDate).preWeekByRecordedClock)
   throw Error('週開始前の計画は対象月曜04:00（日本時間）より前に試算・保存してください。');
  validateReplayInput(snapshot.input);
  const model=modelStats(snapshot.model);
  const capture={appVersion:snapshot.appVersion,capturedAt:snapshot.capturedAt,
   modelAtCapture:{...model},
   ...(snapshot.modelDiagnostics?{modelDiagnosticsAtCapture:{...snapshot.modelDiagnostics}}:{}),
   recordingMethod:'manual_game_summary_input',screenshotReviewedByApp:false};
  validateReplayCapture(capture);
  return {schema:planSchema,week:{mondayDate,field:snapshot.input.options.map},
   input:JSON.parse(JSON.stringify(snapshot.input)),capture};
 }
 // Imported plan is limited to the originally chosen week; current box is untouched.
 function snapshotFromPlan(plan){
  if(!plan||plan.schema!==planSchema||!plan.week||!plan.input||!plan.capture)
   throw Error('事前計画JSONの形式が不正です。');
  if(!validMonday(plan.week.mondayDate)||plan.week.field!==plan.input.options?.map)
   throw Error('事前計画の月曜日またはフィールドが不正です。');
  validateReplayInput(plan.input);
  validateReplayCapture(plan.capture);
  if(!forecastTiming(plan.capture.capturedAt,plan.week.mondayDate).preWeekByRecordedClock)
   throw Error('事前計画の保存日時が週の開始以降です。事前予測として読み込めません。');
  const model=modelStats(plan.capture.modelAtCapture);
  return {input:JSON.parse(JSON.stringify(plan.input)),model,
   ...(plan.capture.modelDiagnosticsAtCapture?
    {modelDiagnostics:{...plan.capture.modelDiagnosticsAtCapture}}:{}),
   appVersion:plan.capture.appVersion,capturedAt:plan.capture.capturedAt,
   plannedWeekMonday:plan.week.mondayDate};
 }

// A manually-entered WEEKLY summary cannot exist before the entire Monday
// 04:00 JST -> next Monday 04:00 JST period ends. Existing observations
// without this field remain readable; recorded clocks are not trusted proof.
function summaryRecordingTime(mondayDate,capturedAt,recordedAt){
 if(recordedAt===undefined)return null; // legacy observation schema
 if(!validMonday(mondayDate)||typeof recordedAt!=='string'||
    !Number.isFinite(Date.parse(recordedAt))||
    new Date(recordedAt).toISOString()!==recordedAt)
  throw Error('週まとめの記録日時が不正です。ISO形式の日時が必要です。');
 const weekEnd=Date.parse(mondayDate+'T04:00:00+09:00')+7*24*60*60*1000;
 if(Date.parse(recordedAt)<weekEnd)
  throw Error('実ゲームの週まとめは対象週の終了（翌月曜04:00、日本時間）後に記録してください。未終了の週は観測記録にできません。');
 if(Date.parse(recordedAt)<Date.parse(capturedAt))
  throw Error('実ゲーム週まとめの記録時刻が試算の保存時刻より前になっています。記録の順序を確認してください。');
 return {recordedAt,weekCompletedByRecordedClock:true,independentlyVerified:false};
}

function makeReport(snapshot,form,recordedAt){
 if(!snapshot||!snapshot.input||!snapshot.model)throw Error('先に7日間を試算してください。');
 if(!form||!form.confirmedSummary)
  throw Error('ゲーム内の週まとめを実際に確認した場合だけ記録できます。');
 if(!validMonday(form.mondayDate))
  throw Error('実測週の開始日には実際の月曜日を指定してください。');
 if(snapshot.plannedWeekMonday&&snapshot.plannedWeekMonday!==form.mondayDate)
  throw Error('読み込んだ事前計画と実測週の月曜日が一致していません。');
 const observed={
  total:integerInput(form.total,'週間総エナジー'),
  berryAndStrengthSkill:integerInput(form.berryAndStrengthSkill,'きのみ＋直接エナジースキル'),
  cooking:integerInput(form.cooking,'料理エナジー')
 };
 const field=snapshot.input.options.map;
 if(typeof field!=='string'||!field.trim())throw Error('フィールドが未設定です。');
 const provenance={source:'in_game_weekly_summary'};
 const recorded=summaryRecordingTime(form.mondayDate,snapshot.capturedAt,recordedAt);
 if(recorded)provenance.summaryRecordedAt=recorded.recordedAt;
 for(const key of flags){
  if(typeof form[key]!=='boolean')throw Error('確認項目が不正です：'+key);
  provenance[key]=form[key];
 }
 const ref=String(form.screenshotReference??'').trim();
 if(ref.length>300)throw Error('スクリーンショット識別子は300文字以内にしてください。');
 if(ref)provenance.screenshotReference=ref;
 return {
  schema,week:{mondayDate:form.mondayDate,field},
  provenance,input:JSON.parse(JSON.stringify(snapshot.input)),observed,
  capture:{appVersion:snapshot.appVersion,capturedAt:snapshot.capturedAt,
   modelAtCapture:{...snapshot.model},
   ...(snapshot.modelDiagnostics?{modelDiagnosticsAtCapture:{...snapshot.modelDiagnostics}}:{}),
   recordingMethod:'manual_game_summary_input',
   screenshotReviewedByApp:false}
 };
}

// M1 evidence triage: known missing model scope must override a user's
// positive checkboxes. This is NOT an estimate of game error or rank.
// Determine issues from the saved inputs and explicit simulator diagnostics,
// rather than from user-editable evidence claims or warning-language matching.
function knownModelLimitations(input,simulated,observedCooking){
 const opts=input&&input.options||{},issues=[];
 const favorites=root.PokeSimulator&&root.PokeSimulator.FAVORITES;
 if(favorites&&typeof opts.map==='string'&&
   !Object.prototype.hasOwnProperty.call(favorites,opts.map))
  issues.push('指定フィールドの好みのきのみがモデルで未確定です。週間のきのみエナジーを直接照合できません。');
 if(opts.map==='シアンの砂浜EX'||opts.map==='ワカクサ本島EX')
  issues.push('EXフィールド固有の補正をモデルは計算していません。');
 if(opts.foodMode==='random')
  issues.push('ランダム料理カテゴリをモデルは確定できず、料理エナジーを計上していません。');
 if(typeof opts.eventEffects==='string'&&opts.eventEffects.trim())
  issues.push('イベント補正メモはSTEP5まで計算へ反映されません。観測週の効果と差が生じ得ます。');
 const species=root.PokeMaster&&root.PokeMaster.species;
 const ingredients=root.PokeMaster&&root.PokeMaster.ingredients;
 if(Array.isArray(species)&&ingredients&&Array.isArray(input&&input.box)){
  const dex=new Map(species.map(x=>[x.name,x]));
  const active=new Set(['morning','noon','evening','sleep'].flatMap(period=>
   Array.isArray(input.teams&&input.teams[period])?input.teams[period]:[]));
  const selected=input.box.filter(p=>active.has(p.id));
  if(opts.successMode==='expected'&&selected.some(p=>
    ['Tasty Chance S','Cooking Assist S (Bulk Up)'].includes(dex.get(p.pokemon)?.skill)))
   issues.push('料理チャンス系の大成功後リセットは分岐計算ですが、スキル加算量は発動期待値です。実際の抽選履歴・上限時の待機ストックとの相関は未検証です。');
  const omitted=new Set();
  const skillOmission=root.PokeSimulator&&root.PokeSimulator.unmodeledStrengthSkillEffect;
  if(typeof skillOmission==='function')
   for(const p of selected){
    const sp=dex.get(p.pokemon),effect=sp&&skillOmission(sp.skill);
    if(effect)omitted.add(sp.name+'：'+effect);
   }
  if(omitted.size)
   issues.push('編成中のメインスキルには週間エナジーに影響し得る未計上の追加効果があります（'+[...omitted].join('、')+'）。実ゲームとの差分を計算誤差と断定できません。');
  // The weekly engine omits food from ingredient-magnet skills if the pool of
  // discovered items is empty. Game observations can still contain that food.
  const needsPool=root.PokeSimulator&&root.PokeSimulator.needsMagnetIngredientPool;
  if((!Array.isArray(opts.magnetIngredients)||opts.magnetIngredients.length===0)&&
     typeof needsPool==='function'&&selected.some(p=>needsPool(dex.get(p.pokemon)?.skill)))
   issues.push('編成中に抽選食材の候補が未設定の食材ゲット系メインスキルがあります。計算器はその食材の生産を料理へ加算しないため、実ゲームの料理エナジーとの比較は未検証です。');
  if(selected.some(p=>dex.get(p.pokemon)?.skill==='Energizing Cheer S (Heal Pulse)'))
   issues.push('いやしのはどうは対象2匹の抽選・げんき回復・追加おてつだいを1発動分の期待値で近似しています。週内の抽選履歴・所持品・回復時刻の結合は未検証です。');
  const missing=[...new Set(selected.filter(p=>!dex.has(p.pokemon)).map(p=>p.pokemon))];
  if(missing.length)
   issues.push('編成にマスター未登録の種族があり、通常おてつだいを含め計算対象外です：'+missing.join('、'));
  // The weekly simulator deliberately skips ingredients it cannot resolve
  // against the unlocked slot in the species snapshot. Never treat those
  // missing expected drops as a measured game-production difference.
  let invalidIngredientSlots=0;
  for(const p of selected){
   const sp=dex.get(p.pokemon);
   if(!sp)continue; // separately flagged above
   const choices=sp.mythIng||sp.ings;
   for(let j=0;j<(p.level>=60?3:p.level>=30?2:1);j++){
    const key=Object.keys(ingredients||{}).find(k=>ingredients[k]===
     (Array.isArray(p.ingredients)?p.ingredients[j]:undefined));
    if(!Array.isArray(choices)||!choices.some(row=>
      row&&row.name===key&&row['c'+(j+1)]>0))
     invalidIngredientSlots++;
   }
  }
  if(invalidIngredientSlots)
   issues.push('解放済み食材の設定が種族マスターと一致せず、生産が未計上です（'+invalidIngredientSlots+'枠）。');
  const isE4=root.PokeSimulator&&root.PokeSimulator.isAllHealerSkill;
  if(['morning','noon','evening'].some(period=>
   (input.teams&&input.teams[period]||[]).filter(id=>{
    const p=input.box.find(item=>item.id===id),sp=p&&dex.get(p.pokemon);
    return sp&&typeof isE4==='function'&&isE4(sp.skill);
   }).length>=2))
   issues.push('げんきオールS系を日中に2匹以上同時編成しています。R02型の回復時刻・げんき相関と編成順位は未検証です。');
 }
 // A zero modeled cooking bucket does not account for a positive game
 // cooking bucket. The source may be a missing recipe, unsupported food mode,
 // or stochastic meals not represented by the expected-inventory model.
 // Keep it explicitly uncalibrated, not an unexplained model error verdict.
 if(Number.isFinite(observedCooking)&&observedCooking>0&&simulated&&
    Number.isFinite(simulated.cooking)&&simulated.cooking===0)
  issues.push('ゲーム週まとめには料理エナジーが記録されていますが、計算器は料理エナジーを0として試算しています。レシピ未選択・料理カテゴリ不一致・食材不足や抽選近似を確認できるまでは、同条件の料理比較として扱えません。');
 // A real cooked meal can randomly be Extra Tasty without a chance skill.
 // An expectation-OFF cooking estimate cannot calibrate observed game cooking.
 if(opts.successMode==='none'&&simulated&&Number.isFinite(simulated.cooking)&&simulated.cooking>0)
  issues.push('大成功期待値OFFの試算で料理エナジーを計上しています。実ゲームには通常の料理大成功抽選があり、実測の料理エナジーとこの試算を同条件として定量照合できません。');
 // The model's per-meal fallback/best pick is not an observed cooking log.
 // Without a meal-by-meal game recipe record, it cannot calibrate actual cooking.
 if(simulated&&Number.isFinite(simulated.cooking)&&simulated.cooking>0&&
    (opts.recipeMode==='best'||opts.recipeMode==='fallback'))
  issues.push('料理の代替／毎食最高エナジーは食事ごとの自動選択近似です。実ゲームで選んだ全レシピと一致する記録がなく、観測週の料理エナジーをこの試算と同条件として定量照合できません。');
 if(simulated&&simulated.potDependentMeals>0)
  issues.push('モデルは'+simulated.potDependentMeals+'食のレシピ選択または追加食材量をスキル期待値による鍋拡張に依存して計上しています。初期食材が十分でも、実際の発動・料理成立・げんき回復の分岐は未検証です。');
 if(simulated&&simulated.estimatedMeals>0)
  issues.push('モデルは'+simulated.estimatedMeals+'食の料理成立を不確実な食材生産期待値から計上しています。実際の成立率は未検証です。');
 // Mandatory ingredients can be certain while optional pot fillers remain
 // stochastic. Only additional source-dependent meals need a separate warning.
 if(simulated&&Number.isSafeInteger(simulated.expectedSourceMeals)&&
    simulated.expectedSourceMeals>Math.max(0,simulated.estimatedMeals||0))
  issues.push('モデルは'+(simulated.expectedSourceMeals-Math.max(0,simulated.estimatedMeals||0))+'食で、必須材料が揃っていても追加食材のエナジーを不確実な食材生産期待値から計上しています。料理エナジーの実際の成立・追加量は未検証です。');
 if(simulated&&simulated.healingTimerCorrelationEvents>0)
  issues.push('げんき回復の発動分岐と10分減衰タイマーの相関が週間モデルでは未検証です。');
 if(simulated&&simulated.healingCapNonlinearEvents>0)
  issues.push('げんき回復時の150上限とスキル発動分岐の非線形誤差が週間モデルでは未解消です。');
 return issues;
}

function preview(report){
 if(!report||report.schema!==schema||!report.capture||!report.observed)
  throw Error('観測記録が不正です。');
 validateReplayCapture(report.capture);
 const summaryTime=summaryRecordingTime(report.week?.mondayDate,report.capture.capturedAt,report.provenance?.summaryRecordedAt);
 const model=modelStats(report.capture.modelAtCapture),o=report.observed;
 const signedDelta={
  total:o.total-model.total,
  berryAndStrengthSkill:o.berryAndStrengthSkill-model.berries-model.skills,
  cooking:o.cooking-model.cooking
 };
 const unattributed=o.total-o.berryAndStrengthSkill-o.cooking;
 const unconfirmed=flags.filter(key=>report.provenance[key]!==true);
 const modelLimitations=[...knownModelLimitations(report.input,{...report.capture.modelDiagnosticsAtCapture,cooking:model.cooking},o.cooking),
  ...capturedDiagnosticLimitations(report.capture),
   ...timingLimitations(report.capture,report.week.mondayDate)];
 return {forecastTiming:forecastTiming(report.capture.capturedAt,report.week.mondayDate),
   summaryRecordingTime:summaryTime,
   signedDeltaObservedMinusModel:signedDelta,
  weeklySummaryBucketsReconcile:unattributed===0,
  observedUnattributed:unattributed,
  unconfirmedConditions:unconfirmed,modelLimitations,
  rankOrAccuracyValidated:false,
  accuracyGate:'HOLD',
  status:unattributed===0&&unconfirmed.length===0&&modelLimitations.length===0?'UNCALIBRATED_OBSERVATION':'CONFOUNDED_OBSERVATION'};
}


function validateReplayInput(input){
 const bad=reason=>{throw Error('保存した試算入力が不正です：'+reason);};
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !Array.isArray(input.box)||input.box.length<5||input.box.length>10000||
  !input.teams||typeof input.teams!=='object'||Array.isArray(input.teams))
  bad('ボックス・編成の形式または件数');
 const ids=new Set();
 for(const p of input.box){
  if(!p||typeof p!=='object'||Array.isArray(p)||
   typeof p.id!=='string'||!p.id||p.id.length>300||ids.has(p.id))
   bad('ポケモンの内部IDが欠落・重複しています');
  if(typeof p.pokemon!=='string'||!p.pokemon||p.pokemon.length>120||
   !Number.isInteger(p.level)||p.level<1||p.level>100||
   !Number.isInteger(p.skillLevel)||p.skillLevel<1||p.skillLevel>20)
   bad('ポケモンの種族・レベル・スキルレベル');
  ids.add(p.id);
 }
 for(const period of ['morning','noon','evening','sleep']){
  const team=input.teams[period];
  if(!Array.isArray(team)||team.length!==5||new Set(team).size!==5||
   team.some(id=>typeof id!=='string'||!ids.has(id)))
   bad(period+'編成はボックス内の異なる5匹が必要です');
 }
 const opts=input.options;
 if(!opts||typeof opts!=='object'||Array.isArray(opts)||
  typeof opts.map!=='string'||!opts.map.trim()||opts.map.length>80)
  bad('フィールド設定');
 for(const [key,min,max] of [
  ['fieldBonus',0,100],['tapMinutes',120,180],['potSize',7,300],
  ['bagCapacity',0,10000],['sleepScore',0,100],['initialEnergy',0,150]]){
  if(!Number.isInteger(opts[key])||opts[key]<min||opts[key]>max)
   bad(key+' は画面で許可された整数範囲が必要です');
 }
 if(typeof opts.recipeId!=='string'||opts.recipeId.length>80||
  !['fixed','fallback','best'].includes(opts.recipeMode)||
  !['none','fill'].includes(opts.extraMode)||
  !['none','expected'].includes(opts.successMode)||
  !['random','curry','salad','dessert'].includes(opts.foodMode)||
  typeof opts.camp!=='boolean'||
  (opts.eventEffects!==undefined&&(typeof opts.eventEffects!=='string'||opts.eventEffects.length>1000)))
  bad('料理・イベント設定');
 const ingredients=root.PokeMaster&&root.PokeMaster.ingredients;
 const keys=opts.initialIngredients;
 if(!keys||typeof keys!=='object'||Array.isArray(keys)||!ingredients||
  Object.keys(keys).length>19)bad('初期食材の形式');
 for(const [key,count] of Object.entries(keys)){
  if(!Object.prototype.hasOwnProperty.call(ingredients,key)||
   !Number.isInteger(count)||count<0||count>10000)
   bad('初期食材の種類と個数');
 }
 const magnet=opts.magnetIngredients??[];
 if(!Array.isArray(magnet)||magnet.length>19||new Set(magnet).size!==magnet.length||
  magnet.some(key=>typeof key!=='string'||
   !Object.prototype.hasOwnProperty.call(ingredients,key)))
  bad('食材抽選対象');
 return input;
}
function validateReplayCapture(capture){
 if(!capture||typeof capture!=='object'||Array.isArray(capture)||
  typeof capture.appVersion!=='string'||! /^[0-9]+[.][0-9]+[.][0-9]+$/.test(capture.appVersion)||
  typeof capture.capturedAt!=='string'||!Number.isFinite(Date.parse(capture.capturedAt))||
  new Date(capture.capturedAt).toISOString()!==capture.capturedAt||
  capture.recordingMethod!=='manual_game_summary_input'||
  capture.screenshotReviewedByApp!==false||
  (capture.modelDiagnosticsAtCapture!==undefined&&
   (!capture.modelDiagnosticsAtCapture||
    typeof capture.modelDiagnosticsAtCapture!=='object'||
    Array.isArray(capture.modelDiagnosticsAtCapture)||
    legacyDiagnosticFields.some(k=>!Number.isSafeInteger(capture.modelDiagnosticsAtCapture[k])||
     capture.modelDiagnosticsAtCapture[k]<0)||
    optionalReplayDiagnosticFields.some(k=>Object.prototype.hasOwnProperty.call(capture.modelDiagnosticsAtCapture,k)&&
     (!Number.isSafeInteger(capture.modelDiagnosticsAtCapture[k])||
      capture.modelDiagnosticsAtCapture[k]<0)))))
  throw Error('観測JSONの試算時点のメタデータが不正です。画像はアプリで検証済みとは扱えません。');
 return capture;
}

// Replay a saved observation against CURRENT simulator input and model
// without importing that input into the user's local box or storage.
// This is a screening tool, never game screenshot verification or rank PASS.
function reviewImportedReport(report,simulate){
 if(!report||report.schema!==schema||!report.week||!report.provenance||
  report.provenance.source!=='in_game_weekly_summary'||
  !report.input||!Array.isArray(report.input.box)||!report.input.options||
  !report.input.teams||!report.observed)
  throw Error('週間観測JSONの形式・出典・編成設定が不正です。');
 if(!validMonday(report.week.mondayDate))throw Error('観測開始日は実際の月曜日が必要です。');
 if(typeof report.week.field!=='string'||!report.week.field.trim()||
  report.week.field!==report.input.options.map)
  throw Error('観測したフィールドと記録した試算フィールドが一致しません。');
 if(typeof simulate!=='function')throw Error('現在の週間計算器が使えません。');
 const o=report.observed;
 for(const key of ['total','berryAndStrengthSkill','cooking']){
  if(!Number.isSafeInteger(o[key])||o[key]<0)
   throw Error('ゲーム週まとめのエナジー欄は0以上の整数が必要です：'+key);
 }
 for(const key of flags){
  if(Object.prototype.hasOwnProperty.call(report.provenance,key)&&
     typeof report.provenance[key]!=='boolean')
   throw Error('観測条件の確認フラグは真偽値が必要です：'+key);
 }
 if(!report.capture||!report.capture.modelAtCapture)
  throw Error('試算時点の記録がないJSONです。v0.2.35以降に保存した観測JSONを選択してください。');
 validateReplayCapture(report.capture);
 const summaryTime=summaryRecordingTime(report.week.mondayDate,report.capture.capturedAt,report.provenance.summaryRecordedAt);
 validateReplayInput(report.input);
 const saved=modelStats(report.capture.modelAtCapture);
 // Treat the uploaded record as untrusted; recompute from the recorded
 // roster rather than treating the sender's model values as authoritative.
 const fullCurrent=simulate(report.input);
 const current=modelStats(fullCurrent);
 const original=Object.fromEntries(['total','berries','skills','cooking'].map(k=>
  [k,current[k]-saved[k]]));
 const differs=Object.values(original).some(x=>Math.abs(x)>1e-5);
 const signedDeltaObservedMinusCurrent={
  total:o.total-current.total,
  berryAndStrengthSkill:o.berryAndStrengthSkill-current.berries-current.skills,
  cooking:o.cooking-current.cooking
 };
 const signedDeltaObservedMinusCaptured={
  total:o.total-saved.total,
  berryAndStrengthSkill:o.berryAndStrengthSkill-saved.berries-saved.skills,
  cooking:o.cooking-saved.cooking
 };
 const balance=o.total-o.berryAndStrengthSkill-o.cooking;
 const unconfirmed=flags.filter(k=>report.provenance[k]!==true);
 const modelLimitations=[...knownModelLimitations(report.input,fullCurrent,o.cooking),
  ...capturedDiagnosticLimitations(report.capture,fullCurrent),
  ...timingLimitations(report.capture,report.week.mondayDate)];
 const confounders=[
  ...(differs?['記録時の試算値と最新の計算器の結果が異なります。マスター・計算式の変更を確認してください。']:[]),
  ...(balance!==0?['ゲームの週まとめ総エナジーときのみ＋料理欄の合計が一致しません。']:[]),
  ...(unconfirmed.length?['観測条件に未確認が'+unconfirmed.length+'項目あります。']:[])
 ];
 return {
  schema,forecastTiming:forecastTiming(report.capture.capturedAt,report.week.mondayDate),
  summaryRecordingTime:summaryTime,
  week:{mondayDate:report.week.mondayDate,field:report.week.field},
  currentModel:{...current,berryAndStrengthSkill:current.berries+current.skills},
  capturedModel:{...saved,berryAndStrengthSkill:saved.berries+saved.skills},
  observed:{total:o.total,berryAndStrengthSkill:o.berryAndStrengthSkill,
   cooking:o.cooking,unattributed:balance},
  signedDeltaObservedMinusCurrent,signedDeltaObservedMinusCaptured,
  captureComparison:{matchesCurrentModel:!differs,
    signedDeltaCurrentMinusCaptured:original},
  unconfirmedConditions:unconfirmed,confounders,modelLimitations,
  weeklySummaryBucketsReconcile:balance===0,
  sourceIsUserSupplied:true,screenshotReviewed:false,
  rankOrAccuracyValidated:false,accuracyGate:'HOLD',
  status:confounders.length||modelLimitations.length?'CONFOUNDED_OBSERVATION':'UNCALIBRATED_OBSERVATION'
 };
}

// Compare JSON data by meaning, not by arbitrary object property order.
// Arrays stay ordered: five-member lineup and event order may be significant.
// This does NOT establish that game conditions were actually the same.
function comparableInputKey(input){
 return JSON.stringify(input,(_key,value)=>
  value&&typeof value==='object'&&!Array.isArray(value)?
   Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
}
// The box is an ID-keyed inventory, not a lineup. Imported CSV or manual
// sorting must not create a false week-to-week mismatch. Actual team-array
// ordering remains significant and is never normalized.
function comparableBoxKey(box){
 return comparableInputKey([...box].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
}
function comparableSavedInputKey(input){
 return comparableInputKey({...input,box:[...input.box].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)});
}
// A model-input controlled screening of two user-supplied weeks. Not a game
// ranking test: the uncontrolled stochastic week outcomes remain confounded.
function screenR02TwoWeekPair(reports,entries){
 if(reports.length!==2)return null;
 const blockers=[],notes=[];
 const [a,b]=reports,[entryA,entryB]=entries;
 if(a.week.mondayDate===b.week.mondayDate)
  blockers.push('同じ週の記録は独立した2週比較になりません。');
 if(comparableBoxKey(a.input.box)!==comparableBoxKey(b.input.box))
  blockers.push('両週のボックス個体・レベル・食材・サブスキルなどが異なります。');
 if(comparableInputKey(a.input.options)!==comparableInputKey(b.input.options))
  blockers.push('フィールド・料理・回収・初期在庫などの試算設定が両週で異なります。');
 if(comparableInputKey(a.input.teams.sleep)!==comparableInputKey(b.input.teams.sleep))
  blockers.push('固定睡眠チームの5匹または並びが両週で異なります。');
 const dex=new Map(root.PokeMaster.species.map(sp=>[sp.name,sp]));
 const isHealer=root.PokeSimulator&&root.PokeSimulator.isAllHealerSkill;
 const rosters=reports.map(r=>{
  const teams=r.input.teams,day=teams.morning;
  if(!['noon','evening'].every(k=>comparableInputKey(teams[k])===comparableInputKey(day)))
   blockers.push(r.week.mondayDate+'：日中3時間帯が同じ固定編成ではありません。');
  const box=new Map(r.input.box.map(p=>[p.id,p]));
  const count=day.filter(id=>typeof isHealer==='function'&&
   isHealer(dex.get(box.get(id)?.pokemon)?.skill)).length;
  return {day,count};
 });
 const oneIndex=rosters.findIndex(r=>r.count===1);
 const twoIndex=rosters.findIndex(r=>r.count===2);
 if(oneIndex<0||twoIndex<0)
  blockers.push('日中固定の全員回復ヒーラー1匹対2匹の組み合わせではありません。');
 if(oneIndex>=0&&twoIndex>=0){
  const one=new Set(rosters[oneIndex].day),two=new Set(rosters[twoIndex].day);
  if([...one].filter(id=>two.has(id)).length!==4)
   blockers.push('日中の編成差が1匹の交代に限定されていません。');
 }
 entries.forEach((entry,i)=>{
  if(entry.unconfirmedConditions.length||entry.confounders.length||
     !entry.weeklySummaryBucketsReconcile)
   blockers.push(reports[i].week.mondayDate+'：観測条件・実測内訳または試算整合に未解決事項があります。');
  if(!entry.captureComparison.matchesCurrentModel)
   blockers.push(reports[i].week.mondayDate+'：記録時と現行のモデル試算に差があります。');
  if(entry.modelLimitations.some(x=>x.includes('診断情報が保存されていません')||
     x.includes('診断カウンターが変わっています')))
   blockers.push(reports[i].week.mondayDate+'：記録時のモデル診断が欠落または変化しています。');
  // R02 itself and its known E4 correlations are descriptive limitations,
  // not evidence that an optional ingredient, invalid slot, or omitted skill
  // can be safely compared between the two candidate weeks.
  // A user-supplied, unregistered species name can contain "R02型".
  // Only the exact three program-authored E4 diagnostics are allowed here.
  const allowedR02=new Set([
   'げんきオールS系を日中に2匹以上同時編成しています。R02型の回復時刻・げんき相関と編成順位は未検証です。',
   'げんき回復の発動分岐と10分減衰タイマーの相関が週間モデルでは未検証です。',
   'げんき回復時の150上限とスキル発動分岐の非線形誤差が週間モデルでは未解消です。'
  ]);
  const r02Specific=x=>allowedR02.has(x);
  if(entry.modelLimitations.some(x=>!r02Specific(x)))
   blockers.push(reports[i].week.mondayDate+'：R02以外のモデル前提不足・料理や食材の未検証要因があります。');
 });
 const limitations=entries.flatMap((entry,i)=>
  entry.modelLimitations.map(x=>reports[i].week.mondayDate+'：'+x));
 const compatible=blockers.length===0;
 let comparison=null;
 if(compatible){
  const one=entries[oneIndex],two=entries[twoIndex];
  const observed=two.observed.total-one.observed.total;
  const modeled=two.currentModel.total-one.currentModel.total;
  comparison={
   oneHealerMonday:reports[oneIndex].week.mondayDate,
   twoHealerMonday:reports[twoIndex].week.mondayDate,
   observedOneHealer:one.observed.total,observedTwoHealers:two.observed.total,
   modeledOneHealer:one.currentModel.total,modeledTwoHealers:two.currentModel.total,
   observedDeltaTwoMinusOne:observed,modeledDeltaTwoMinusOne:modeled,
   descriptiveDeltaDisagreement:observed-modeled,
   observedSign:Math.abs(observed)<1e-9?'TIE':observed>0?'TWO':'ONE',
   modelSign:Math.abs(modeled)<1e-9?'TIE':modeled>0?'TWO':'ONE'
  };
  notes.push('保存された試算条件のR02型1匹交代だけを確認しました。実ゲームで操作・補正が一致した証拠ではありません。');
  notes.push('異なる2週のランダム実績差はモデル期待値の真の誤差、統計的な順位、勝率を証明しません。');
 }
 return {
  type:'R02_TWO_WEEK_SCREEN',
  status:compatible?'DESCRIPTIVE_ONLY':'NON_COMPARABLE',
  blockers,modelLimitations:limitations,notes,comparison,
  independentGameRankingValidated:false,rankOrAccuracyValidated:false,
  accuracyGate:'HOLD',step2:'HOLD',step3:'NOT_STARTED'
 };
}
function reviewImportedReports(reports,simulate){
 if(!Array.isArray(reports)||reports.length<1||reports.length>4)
  throw Error('観測JSONは1〜4ファイル選択してください。');
 // Validate all weeks before exposing any combined result.
 const entries=reports.map(report=>reviewImportedReport(report,simulate));
 const inputKeys=reports.map(report=>comparableSavedInputKey(report.input));
 const sameInput=inputKeys.every(key=>key===inputKeys[0]);
 const seen=new Map(),duplicates=new Set(),conflicts=new Set(),inputConflicts=new Set();
 for(let i=0;i<reports.length;i++){
  const report=reports[i],date=report.week.mondayDate;
  if(seen.has(date)){
   duplicates.add(date);
   const prior=reports[seen.get(date)];
   if(prior.week.field!==report.week.field||
      ['total','berryAndStrengthSkill','cooking'].some(k=>prior.observed[k]!==report.observed[k]))
    conflicts.add(date);
   // Two records for the SAME real-game week with different simulation
   // settings cannot be presented as a matching duplicated observation,
   // even when the user entered identical weekly summary numbers.
   if(inputKeys[seen.get(date)]!==inputKeys[i])inputConflicts.add(date);
  }else seen.set(date,i);
 }
 return {
  items:entries,
  r02TwoWeekScreen:screenR02TwoWeekPair(reports,entries),
  sameSavedInputs:sameInput,
  duplicateMondays:Array.from(duplicates).sort(),
  conflictingMondays:Array.from(conflicts).sort(),
  conflictingInputsMondays:Array.from(inputConflicts).sort(),
  count:entries.length,
  confoundedCount:entries.filter(x=>x.status==='CONFOUNDED_OBSERVATION').length,
  rankOrAccuracyValidated:false,accuracyGate:'HOLD',
  status:'UNVERIFIED_MULTI_WEEK_RECORDS'
 };
}

const api={schema,planSchema,flags,diagnosticFields,modelDiagnostics,capturedDiagnosticLimitations,validMonday,integerInput,captureSimulation,forecastTiming,summaryRecordingTime,makePlan,snapshotFromPlan,makeReport,preview,knownModelLimitations,validateReplayInput,validateReplayCapture,reviewImportedReport,reviewImportedReports};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeObservation=api;
})(typeof globalThis!=='undefined'?globalThis:this);

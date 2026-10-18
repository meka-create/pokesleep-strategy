(function(root){
'use strict';
// Browser and Node share the evidence contract; this is NOT a game accuracy gate.
const schema='step2-m1-weekly-observation-v1';
const flags=['noUnmodeledEvents','sameCollectionSchedule','noUntrackedItems',
 'startStrengthVerified','weekBoundaryReconciled'];
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
 const safe=modelStats(predicted);
 const snapshot=JSON.parse(JSON.stringify({input,model:safe}));
 if(typeof appVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(appVersion))
  throw Error('計算器の版数を確認できません。');
 if(typeof capturedAt!=='string'||!Number.isFinite(Date.parse(capturedAt))||
  new Date(capturedAt).toISOString()!==capturedAt)
  throw Error('試算日時が不正です。');
 return {...snapshot,appVersion,capturedAt};
}
function makeReport(snapshot,form){
 if(!snapshot||!snapshot.input||!snapshot.model)throw Error('先に7日間を試算してください。');
 if(!form||!form.confirmedSummary)
  throw Error('ゲーム内の週まとめを実際に確認した場合だけ記録できます。');
 if(!validMonday(form.mondayDate))
  throw Error('実測週の開始日には実際の月曜日を指定してください。');
 const observed={
  total:integerInput(form.total,'週間総エナジー'),
  berryAndStrengthSkill:integerInput(form.berryAndStrengthSkill,'きのみ＋直接エナジースキル'),
  cooking:integerInput(form.cooking,'料理エナジー')
 };
 const field=snapshot.input.options.map;
 if(typeof field!=='string'||!field.trim())throw Error('フィールドが未設定です。');
 const provenance={source:'in_game_weekly_summary'};
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
   modelAtCapture:{...snapshot.model},recordingMethod:'manual_game_summary_input',
   screenshotReviewedByApp:false}
 };
}
function preview(report){
 if(!report||report.schema!==schema||!report.capture||!report.observed)
  throw Error('観測記録が不正です。');
 const model=modelStats(report.capture.modelAtCapture),o=report.observed;
 const signedDelta={
  total:o.total-model.total,
  berryAndStrengthSkill:o.berryAndStrengthSkill-model.berries-model.skills,
  cooking:o.cooking-model.cooking
 };
 const unattributed=o.total-o.berryAndStrengthSkill-o.cooking;
 const unconfirmed=flags.filter(key=>report.provenance[key]!==true);
 return {signedDeltaObservedMinusModel:signedDelta,
  weeklySummaryBucketsReconcile:unattributed===0,
  observedUnattributed:unattributed,
  unconfirmedConditions:unconfirmed,
  rankOrAccuracyValidated:false,
  accuracyGate:'HOLD',
  status:unattributed===0&&unconfirmed.length===0?'UNCALIBRATED_OBSERVATION':'CONFOUNDED_OBSERVATION'};
}
const api={schema,flags,validMonday,integerInput,captureSimulation,makeReport,preview};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeObservation=api;
})(typeof globalThis!=='undefined'?globalThis:this);

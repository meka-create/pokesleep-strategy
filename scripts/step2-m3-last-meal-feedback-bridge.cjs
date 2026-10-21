'use strict';
/* M3 research-only integration: an EXPLICIT artificial binary food draw
 * (seven apples OR zero) immediately before Sunday's final meal.
 *
 * This is NOT a probability inference from mean inventory. The exact
 * ingredient-distribution kernel supplies a success probability, and two
 * previously independently clock-verified deterministic seven-day outcomes
 * supply energy conditional on success/failure. No real-game roll rate,
 * team ranking, or M01-M04 weekly game accuracy is certified.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const sandbox=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','ingredient-distribution.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),sandbox,{filename:file});
const kernel=sandbox.globalThis.PokeIngredientDistribution;
const round=x=>Math.round(x*1e8)/1e8;
function bridgeExplicitLastMealRoll(controlledReport,probability){
 if(!Number.isFinite(probability)||probability<0||probability>1)
  throw Error('人工料理抽選確率は0〜1の明示的な数値が必要です。');
 if(!controlledReport||controlledReport.schema!=='step2-m1-controlled-meal-week-v2'||
    !Array.isArray(controlledReport.cases)||controlledReport.cases.length!==5||
    controlledReport.realGameMixedAccuracyValidated!==false||
    controlledReport.lastMealCounterfactual?.grade!=='B_CONTROLLED_ZERO_INGREDIENT_ZERO_SKILL')
  throw Error('独立の7日間人工時計算結果が必要です。');
 const missing=controlledReport.cases.find(x=>x.id==='CM04'),
  present=controlledReport.cases.find(x=>x.id==='CM05');
 if(!missing||!present||missing.reference.meals!==20||present.reference.meals!==21||
    missing.noAppleProduction!==true||present.noAppleProduction!==true)
  throw Error('最後の1食だけ異なる人工ペアが必要です。');
 for(const c of [missing,present])
  for(const k of ['berries','cooking','total'])
   if(c.reference[k]!==c.model[k])
    throw Error('独立時計算と週間本体の一致が未確認です。');
 const delta=controlledReport.lastMealCounterfactual.independentDelta;
 if(delta.total!==3767||delta.cooking!==3347||delta.berries!==420||
    missing.reference.total!==282620||present.reference.total!==286387)
  throw Error('最終食事の制御ベンチマークが変わっています。');
 // The two worlds are exactly the same until Sunday night in this
 // artificial case. A separate zero/7 apple draw is injected at that meal,
 // not guessed from actual Pokemon assistance rates.
 const initial=kernel.certainIngredientBag({},7);
 const sequence=kernel.evaluateRecipeSequence(initial,[{
  draws:[[
   {ingredient:'apple',count:7,probability},
   {ingredient:null,count:0,probability:1-probability}
  ]],
  requirements:{apple:7},energyIfCooked:3347
 }],7);
 const success=sequence.meals[0].successProbability;
 assert.ok(Math.abs(success-probability)<1e-10);
 assert.ok(Math.abs(sequence.expectedCooking-3347*probability)<1e-7);
 const fromDistribution={
  meals:20+success,
  cookingEnergy:round(missing.reference.cooking+sequence.expectedCooking),
  berryEnergy:round(missing.reference.berries+success*delta.berries),
  totalEnergy:round(missing.reference.total+success*delta.total)
 };
 // Independent direct enumeration of the explicitly supplied two outcomes;
 // does NOT call the bag kernel nor the production simulator.
 const outcomes=[
  {p:1-probability,cooked:false,weekly:missing.reference},
  {p:probability,cooked:true,weekly:present.reference}
 ];
 const brute={
  meals:round(outcomes.reduce((n,w)=>n+w.p*w.weekly.meals,0)),
  cookingEnergy:round(outcomes.reduce((n,w)=>n+w.p*w.weekly.cooking,0)),
  berryEnergy:round(outcomes.reduce((n,w)=>n+w.p*w.weekly.berries,0)),
  totalEnergy:round(outcomes.reduce((n,w)=>n+w.p*w.weekly.total,0))
 };
 for(const k of Object.keys(brute))
  assert.ok(Math.abs(brute[k]-fromDistribution[k])<1e-7,
   'M3 final meal: probability branch vs independent two-world reference: '+k);
 return {
  schema:'step2-m3-last-meal-feedback-v1',
  scope:'CONTROLLED_EXPLICIT_SINGLE_DRAW_SUNDAY_EVENING_ONLY',
  artificialDraw:{appleCountOnSuccess:7,probability,notGameMeasured:true},
  successProbability:success,
  independentReference:{
   failure:{meals:20,berries:missing.reference.berries,cooking:missing.reference.cooking,total:missing.reference.total},
   success:{meals:21,berries:present.reference.berries,cooking:present.reference.cooking,total:present.reference.total}
  },
  exactBranchAverage:fromDistribution,
  independentEnumeration:brute,
  naiveCookingOnlyTotal:round(missing.reference.total+success*delta.cooking),
  omittedExpectedBerryFeedback:round(success*delta.berries),
  usedActualGameSkillRates:false,usedActualGameIngredientRates:false,
  validatesM01M04WeeklyAccuracy:false,validatesOriginalM02M03:false,
  validatesRealGameRankings:false,
  m1:'PARTIAL',m2:'PARTIAL',m3:'PARTIAL',m4:'NOT_STARTED',
  step2:'HOLD',step3:'NOT_STARTED'
 };
}
if(require.main===module){
 const {controlledMealReport}=require('./step2-m1-controlled-meal-oracle.cjs');
 const args=process.argv.slice(2);
 if(args.length>1)throw Error('Usage: npm run m3:last-meal-feedback -- [artificial_probability]');
 const p=args.length?Number(args[0]):0.25;
 if(args.length&&args[0].trim()==='')throw Error('確率は必須です。');
 console.log('M3_LAST_MEAL_FEEDBACK_JSON='+JSON.stringify(
  bridgeExplicitLastMealRoll(controlledMealReport(),p)));
}
module.exports={bridgeExplicitLastMealRoll};

/* W2: bounded, deterministic, incremental WEEKLY optimizer.
 * All rankings use the W1 full-week simulator, never a berry proxy.
 * Session.step() performs at most ONE potentially expensive simulation:
 * callers can yield to the UI between steps instead of freezing for N trials.
 */
(function(root){
'use strict';
const Sim=root.PokeSimulator,Master=root.PokeMaster;
const PERIODS=['morning','noon','evening'];
const cloneDays=days=>days.map(day=>({
 morning:[...day.morning],noon:[...day.noon],evening:[...day.evening],sleep:[...day.sleep]
}));
const snapshot=days=>days.map(day=>({
 morning:[...day.morning],noon:[...day.noon],evening:[...day.evening]
}));
const nights=days=>days.map(day=>[...day.sleep]);
const fingerprint=days=>JSON.stringify(days.map(day=>
 [day.morning,day.noon,day.evening,day.sleep]));
function countSwaps(days){
 let count=0;const perDay=[];
 const added=(previous,next)=>{
  const prior=new Set(previous);
  return next.filter(id=>!prior.has(id)).length;
 };
 days.forEach((day,i)=>{
  const morning=added(i?days[i-1].sleep:day.sleep,day.morning);
  const noon=added(day.morning,day.noon);
  const evening=added(day.noon,day.evening);
  const bedtime=added(day.evening,day.sleep);
  const total=morning+noon+evening+bedtime;
  perDay.push({day:i+1,morning,noon,evening,bedtime,total});count+=total;
 });
 return {total:count,days:perDay};
}
function candidatePool(box,options){
 const species=new Map((Master?.species||[]).map(sp=>[sp.name,sp]));
 const favorite=Sim?.FAVORITES?.[options?.map]||[];
 const known=box.map((p,index)=>{
  const sp=species.get(p.pokemon);
  if(!sp||!Number.isFinite(sp.frequency)||sp.frequency<=0||
    !Number.isFinite(Master?.berry?.[sp.type]))return null;
  const ingredientRate=Math.max(0,Math.min(1,(Number(sp.ingRate)||0)/100));
  const berries=sp.specialty==='Berries'||sp.specialty==='All'?2:1;
  const strength=Sim.berryUnit(sp.type,p.level,favorite,0);
  const proxy=strength*berries*(1-ingredientRate)/sp.frequency;
  return {id:p.id,proxy,index};
 }).filter(Boolean);
 known.sort((a,b)=>b.proxy-a.proxy||a.index-b.index);
 return known;
}
function validatedScore(result){
 if(!result||!['total','berries','cooking','skills'].every(k=>
  typeof result[k]==='number'&&Number.isFinite(result[k])&&result[k]>=0))
  throw Error('週間計算器が不正なエナジー内訳を返しました。');
 const sum=result.berries+result.cooking+result.skills;
 if(Math.abs(sum-result.total)>Math.max(1e-6,result.total*1e-9))
  throw Error('週間計算器の総エナジーと内訳が不一致です。');
 return {total:result.total,berries:result.berries,cooking:result.cooking,
  skills:result.skills};
}
function createSession(config){
 if(!Sim||typeof Sim.normalizeWeeklyTeams!=='function'||
    typeof Sim.simulate!=='function')
  throw Error('W1週間シミュレーターが利用できません。');
 if(!config||!Array.isArray(config.box))throw Error('手持ちポケモンがありません。');
 const sleepAuto=config.sleepAuto===true;
 if(config.sleepAuto!==undefined&&typeof config.sleepAuto!=='boolean')
  throw Error('睡眠自動提案のON/OFFが不正です。');
 const maximum=config.maxEvaluations===undefined?12:config.maxEvaluations;
 if(!Number.isSafeInteger(maximum)||maximum<1||maximum>32)
  throw Error('自動探索の試算上限は1～32回にしてください。');
 const evaluator=config.simulate||Sim.simulate;
 if(typeof evaluator!=='function')throw Error('7日間の評価関数がありません。');
 const normalized=Sim.normalizeWeeklyTeams({
  box:config.box,teams:config.teams,teamsByDay:config.teamsByDay,
  sleepTeamsByDay:config.sleepTeamsByDay
 });
 const initial=cloneDays(normalized.days);
 const originalNights=nights(initial);
 const originalSignature=fingerprint(initial);
 const pool=candidatePool(config.box,config.options);
 const ranked=pool.map(x=>x.id),strength=new Map(pool.map(x=>[x.id,x.proxy]));
 const scoreOf=id=>strength.get(id)??-Infinity;
 const attemptsMax=Math.max(28,maximum*12);
 let attempts=0,evalCount=0,baseline=null,best=null,done=false;
 const seen=new Set(),history=[],failures=[];
 function replaceOne(team,shift){
  const outside=ranked.filter(id=>!team.includes(id));
  if(!outside.length)return false;
  const replacement=outside[shift%outside.length];
  const weakest=team.map((id,i)=>({id,i,score:scoreOf(id)}))
   .sort((a,b)=>a.score-b.score||b.i-a.i);
  // A production proxy selects WHICH candidates to TRY; the weekly
  // simulator, not this proxy, determines which of them wins.
  team[weakest[0].i]=replacement;
  return true;
 }
 function setTop(team,shift){
  const ids=ranked.slice(shift,shift+5);
  if(ids.length!==5)return false;
  for(let i=0;i<5;i++)team[i]=ids[i];
  return true;
 }
 function suggest(number){
  const base=cloneDays(best?best.days:initial);
  const day=(number*3+1)%7;
  const period=PERIODS[Math.floor((number-1)/7)%3];
  const kind=number%9;
  let changed=false;
  if(number===1||number===2){
   // Static top-box reference remains a candidate, NOT the final algorithm.
   const offset=number-1;
   for(const row of base)for(const slot of PERIODS)
    changed=setTop(row[slot],offset)||changed;
  }else if(kind===3){
   // One Tuesday/Saturday/etc evening instead of a fixed daily pattern.
   changed=replaceOne(base[day].evening,number);
  }else if(kind===4){
   // A whole day block, with breakfast/lunch/dinner modeled jointly.
   for(const slot of PERIODS)changed=replaceOne(base[day][slot],number)||changed;
  }else if(kind===5){
   // Contiguous weekday block (not 21 independent greedy choices).
   for(let d=day;d<7;d++)changed=replaceOne(base[d][period],number)||changed;
  }else if(kind===6){
   for(let d=0;d<=day;d++)changed=replaceOne(base[d][period],number)||changed;
  }else if(kind===7){
   // Sleep exploration is opt-in, but tests nights on whole-week energy.
   if(sleepAuto)changed=replaceOne(base[day].sleep,number);
   else changed=replaceOne(base[day][period],number);
  }else if(kind===8){
   if(sleepAuto){
    for(let d=day;d<Math.min(day+3,7);d++)
     changed=replaceOne(base[d].sleep,number)||changed;
   }else{
    for(let d=day;d<7;d+=2)
     changed=replaceOne(base[d][period],number)||changed;
   }
  }else if(kind===0){
   // Distinct lunch/dinner adjustments in the same day.
   changed=replaceOne(base[day].noon,number)||changed;
   changed=replaceOne(base[day].evening,number+1)||changed;
  }else{
   changed=replaceOne(base[day][period],number);
  }
  if(!changed)return null;
  if(!sleepAuto&&JSON.stringify(nights(base))!==JSON.stringify(originalNights))
   throw Error('内部エラー：睡眠OFFの手動7晩が変更されました。');
  return base;
 }
 function oneEvaluation(days,tag){
  const signature=fingerprint(days);seen.add(signature);
  const input={
   box:config.box,teams:config.teams||{},
   teamsByDay:snapshot(days),sleepTeamsByDay:nights(days),
   options:{...config.options}
  };
  try{
   const result=evaluator(input);
   const score=validatedScore(result);
   const swaps=countSwaps(days);
   const row={tag,days:cloneDays(days),score,swaps,
    warnings:Array.isArray(result.warnings)?result.warnings.filter(x=>typeof x==='string'):[],
    estimatedMeals:result.estimatedMeals||0,
    status:'REFERENCE_ONLY',weekRankValidated:false};
   history.push({tag,score:{...score},swaps:swaps.total});
   if(!baseline)baseline=row;
   if(!best||row.score.total>best.score.total+1e-8||
    (Math.abs(row.score.total-best.score.total)<=1e-8&&
     row.swaps.total<best.swaps.total))best=row;
   return {evaluated:true,tag,score:{...score},swaps:swaps.total};
  }catch(e){
   if(tag==='baseline')throw e;
   const message=e&&e.message?e.message:String(e);
   failures.push({tag,error:message});
   return {evaluated:true,tag,error:message};
  }finally{evalCount++;}
 }
 function status(){
  const publicRow=row=>row?{
   tag:row.tag,score:{...row.score},swaps:{
    total:row.swaps.total,days:row.swaps.days.map(x=>({...x}))},
   teamsByDay:snapshot(row.days),sleepTeamsByDay:nights(row.days),
   warningCount:row.warnings.length,warnings:[...row.warnings],
   estimatedMeals:row.estimatedMeals,status:row.status,
   weekRankValidated:false
  }:null;
  return {done,evaluations:evalCount,maxEvaluations:maximum,
   attempts,baseline:publicRow(baseline),best:publicRow(best),
   improvement:baseline&&best?best.score.total-baseline.score.total:null,
   changesVsBaseline:baseline&&best?best.swaps.total-baseline.swaps.total:null,
   history:history.map(x=>({tag:x.tag,score:{...x.score},swaps:x.swaps})),
   failures:failures.map(x=>({...x})),sleepAuto,
   originalPlanUnchanged:fingerprint(initial)===originalSignature,
   exhaustive:false,weekRankValidated:false,status:'REFERENCE_ONLY'};
 }
 function step(){
  if(done)return status();
  if(!baseline){
   oneEvaluation(cloneDays(initial),'baseline');
   if(evalCount>=maximum)done=true;
   return status();
  }
  let proposal=null;
  while(!proposal&&attempts<attemptsMax){
   attempts++;
   const generated=suggest(attempts);
   if(generated&&!seen.has(fingerprint(generated)))proposal=generated;
  }
  if(!proposal){done=true;return status();}
  oneEvaluation(proposal,'trial-'+attempts);
  if(evalCount>=maximum||attempts>=attemptsMax)done=true;
  return status();
 }
 return {step,status};
}
function optimize(config){
 const session=createSession(config);
 let result=session.status();
 while(!result.done)result=session.step();
 return result;
}
const api={createSession,optimize,countSwaps,candidatePool};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeWeekOptimizer=api;
})(typeof globalThis!=='undefined'?globalThis:this);

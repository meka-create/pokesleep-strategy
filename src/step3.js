/* STEP3 S3-A: bounded deterministic *proposal* generation, not a rank oracle.
 * The energy comparison is S3-B. No exhaustive search or invented skill
 * coefficients; the proxy below is used only to pick a small candidate pool.
 */
(function(root){
'use strict';
const Master=root.PokeMaster,Sim=root.PokeSimulator;
const HOURS=Object.freeze(['morning','noon','evening']);
function countChanges(from,to){
 const prior=new Set(from);
 return to.reduce((n,id)=>n+(prior.has(id)?0:1),0);
}
function changes(sleep,teams){
 const morning=countChanges(sleep,teams.morning);
 const noon=countChanges(teams.morning,teams.noon);
 const evening=countChanges(teams.noon,teams.evening);
 const bedtime=countChanges(teams.evening,sleep);
 return {morning,noon,evening,bedtime,total:morning+noon+evening+bedtime};
}
function createCandidates({box,sleepIds,map}){
 if(!Array.isArray(box)||!Array.isArray(sleepIds)||sleepIds.length!==5||
    new Set(sleepIds).size!==5)throw Error('先にボックスタブで睡眠用5匹を決めてください。');
 const byId=new Map(box.map(p=>[p.id,p]));
 if(sleepIds.some(id=>!byId.has(id)))throw Error('睡眠用5匹が現在のボックスに存在しません。');
 if(!Master||!Array.isArray(Master.species)||!Sim||!Sim.FAVORITES||
    typeof Sim.isAllHealerSkill!=='function'||typeof Sim.berryUnit!=='function')
  throw Error('STEP3用の種族マスター・計算器が読み込まれていません。');
 const species=new Map(Master.species.map(sp=>[sp.name,sp]));
 const favorite=Sim.FAVORITES[map]||[];
 const known=box.map((p,index)=>{
  const sp=species.get(p.pokemon);
  if(!sp||!Number.isFinite(sp.frequency)||sp.frequency<=0||
   !Number.isFinite(Master.berry[sp.type]))return null;
  // Relative *berry-oriented* proxy only. It is NOT actual energy, food,
  // healing strength, nature/subskill speed or the 7-day simulator's ranking.
  const rate=Math.max(0,Math.min(1,Number(sp.ingRate||0)/100));
  const berries=sp.specialty==='Berries'||sp.specialty==='All'?2:1;
  const raw=Sim.berryUnit(sp.type,p.level,favorite,0)*berries*(1-rate)/sp.frequency;
  const score=raw*(sleepIds.includes(p.id)?1.03:1);
  return {id:p.id,sp,score,index,healer:Sim.isAllHealerSkill(sp.skill)};
 }).filter(Boolean);
 known.sort((a,b)=>b.score-a.score||a.index-b.index);
 const healer=known.filter(x=>x.healer),other=known.filter(x=>!x.healer);
 const warnings=['候補選出には簡易的なきのみ生産指標を使っています。料理・回復・スキル・げんきの7日比較は未実施で、表示順は推奨順位ではありません。'];
 if(known.length<box.length)warnings.push('種族マスター未登録または基礎値不明の個体は自動候補への新規選出対象外です。睡眠用5匹の固定編成は維持します。');
 if(!favorite.length)warnings.push('フィールドの好みのきのみが未確定のため、好み補正なしで候補を選びました。');
 const candidates=[],seen=new Set();
 const add=(code,title,description,morning,noon,evening)=>{
  const teams={morning:[...morning],noon:[...noon],evening:[...evening]};
  if(HOURS.some(k=>teams[k].length!==5||new Set(teams[k]).size!==5||
    teams[k].some(id=>!byId.has(id))))throw Error('内部エラー：候補の5匹編成が不正です。');
  const key=JSON.stringify(teams);
  if(seen.has(key))return;
  seen.add(key);
  candidates.push({code,title,description,teams,changes:changes(sleepIds,teams)});
 };
 if(healer.length>=2&&other.length>=4){
  const one=healer[0].id,two=healer[1].id;
  const low=other.slice(0,4).map(x=>x.id);
  add('A','A：朝2匹・昼夜1匹ヒーラー',
   '朝は全体回復系2匹、昼夜は1匹。12:00の変更を想定し、18:00は変更しない案です。',
   [one,two,...low.slice(0,3)],[one,...low],[one,...low]);
 }else warnings.push('A案は全体回復系2匹＋その他4匹が必要です。手持ち不足のため表示しません。');
 if(healer.length>=1&&other.length>=4){
  const fillers=other.slice(0,4).map(x=>x.id);
  const first=[healer[0].id,...fillers];
  add('B','B：終日1匹ヒーラー',
   '朝・昼・夜に同じ全体回復系1匹を置き、12:00と18:00の交代をなくす案です。',
   first,first,first);
  if(healer.length>=2){
   const second=[healer[1].id,...fillers];
   add('B2','B別案：もう1匹のヒーラー',
    '全体回復役を別個体にした比較用です。昼夜交代は不要です。',
    second,second,second);
  }
 }else warnings.push('B案は全体回復系1匹＋その他4匹が必要です。手持ち不足のため表示しません。');
 const all=known.slice(0,5).map(x=>x.id);
 if(all.length===5)add('C','C：簡易生産指標による編成',
  '全体回復の人数は固定せず、簡易きのみ指標で選んだ比較用の案です。',all,all,all);
 if(other.length>=5){
  const noHealer=other.slice(0,5).map(x=>x.id);
  add('C0','C別案：全体回復系0匹',
   '全体回復系スキルを持たない5匹による比較用の案です。',noHealer,noHealer,noHealer);
 }
 add('CS','C別案：睡眠用5匹を日中も継続',
  '0:00～7:30の固定睡眠パーティを朝・昼・夜にも継続し、入替をなくす案です。',
  sleepIds,sleepIds,sleepIds);
 return {candidates,warnings,eligibleKnown:known.length,healers:healer.length};
}
// S3-B: run precisely the *same* STEP2 weekly engine as the manual trial.
// Scores are model outputs, not independently validated game ranking.
function evaluateCandidate({candidate,box,sleepIds,options,simulate}){
 if(!candidate||!candidate.teams||!Array.isArray(box)||!Array.isArray(sleepIds)||
   sleepIds.length!==5||new Set(sleepIds).size!==5)throw Error('候補評価の睡眠5匹・手持ちが不正です。');
 const ids=new Set(box.map(p=>p.id));
 if(HOURS.some(k=>!Array.isArray(candidate.teams[k])||candidate.teams[k].length!==5||
  new Set(candidate.teams[k]).size!==5||candidate.teams[k].some(id=>!ids.has(id)))||
  sleepIds.some(id=>!ids.has(id)))throw Error('候補評価の編成が不正です。');
 const fn=simulate||Sim?.simulate;
 if(typeof fn!=='function')throw Error('7日間計算エンジンを利用できません。');
 const teams={sleep:[...sleepIds]};
 for(const key of HOURS)teams[key]=[...candidate.teams[key]];
 const input={box,teams,options:{...options}};
 const result=fn(input);
 if(!result||!['total','berries','cooking','skills'].every(k=>
  Number.isFinite(result[k])&&result[k]>=0))throw Error('7日間計算結果の内訳が不正です。');
 const count=changes(sleepIds,candidate.teams);
 const caveats=[];
 if(result.estimatedMeals>0||result.expectedSourceMeals>0)
  caveats.push('食材生産の期待値に依存する料理');
 if(result.potDependentMeals>0)caveats.push('鍋拡張スキルの期待値に依存する料理');
 if((result.healingTimerCorrelationEvents||0)>0||
   (result.healingCapNonlinearEvents||0)>0)caveats.push('回復スキルとげんき・発動確率の相関');
 if((result.uncollectedExtraHelpItemsAtSwap||0)>0)
  caveats.push('編成交代時の未回収追加おてつだい');
 if(Array.isArray(result.warnings)&&result.warnings.some(w=>
  /未対応のメインスキル|未計上|未再現|未検証/.test(w)))
  caveats.push('未対応または独立未検証のスキル・料理等');
 return {candidate,score:{total:result.total,berries:result.berries,
  cooking:result.cooking,skills:result.skills},
  changes:count,warningCount:Array.isArray(result.warnings)?result.warnings.length:0,
  caveats,estimatedMeals:result.estimatedMeals||0,
  weekRankValidated:false,status:'REFERENCE_ONLY'};
}
// Scores are first sorted by model energy, then *within a fixed 3% band*
// relative to the band's highest score by fewest swaps. The algorithm is
// deterministic and groups scores rather than using a non-transitive sorter.
function orderEvaluations(rows,nearPct=0.03){
 if(!Array.isArray(rows)||!Number.isFinite(nearPct)||nearPct<0||nearPct>0.2)
  throw Error('候補比較の入力が不正です。');
 const sorted=rows.map((x,i)=>({...x,originalIndex:i})).sort((a,b)=>
  b.score.total-a.score.total||a.originalIndex-b.originalIndex);
 const best=sorted[0]?.score.total||0,ordered=[];
 while(sorted.length){
  const high=sorted[0].score.total;
  const group=[];
  while(sorted.length&&high-sorted[0].score.total<=high*nearPct+1e-9)
   group.push(sorted.shift());
  group.sort((a,b)=>a.changes.total-b.changes.total||
   b.score.total-a.score.total||a.originalIndex-b.originalIndex);
  for(const row of group)ordered.push({...row,
   modelGapPct:best>0?(best-row.score.total)/best*100:0,
   closeScoreGroup:group.length>1,
   preference:'参考表示順（僅差時は入替が少ない案を前に表示）'});
 }
 return ordered;
}
const api={createCandidates,countChanges,changes,evaluateCandidate,orderEvaluations};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStep3=api;
})(typeof globalThis!=='undefined'?globalThis:this);

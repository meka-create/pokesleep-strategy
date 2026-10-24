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
const api={createCandidates,countChanges,changes};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PokeStep3=api;
})(typeof globalThis!=='undefined'?globalThis:this);

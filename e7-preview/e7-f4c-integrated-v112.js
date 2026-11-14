/* F4-C v112: ONE E7 Plan UI. No extra proposal card, healer selectors
 * or consent check. Owns real proposal/review/adoption/sleep modal only.
 * Legacy demo plans are preserved in storage, but never presented as real.
 */
(function(root){'use strict';
const doc=root.document,q=id=>doc.getElementById(id);
const auto=root.PokeF4CAutoV112,store=root.PokeF4CRealStoreV112;
const bridge=root.PokeF4BE7ReadOnly, DAYS=['月','火','水','木','金','土','日'];
const deps={scope:root.PokeE7InventoryScope,e1:root.PokeE7E1,
 weekClock:root.PokeF4BGameWeek,bridge,identity:root.PokeF4CStableBoxIDs,
 roster:root.PokeF4F1RosterAdapter,legal:root.PokeF1LegalBuild,
 rates:root.PokeF1BaseRates,baseCore:root.PokeF4ChronologicalCore,
 healerSearch:root.PokeF4CHealerSearch,healerPolicy:root.PokeF4CHealerPolicy,
 itemRank:root.PokeF4CItemAwareRank,skillValues:root.PokeF1SkillValues,
 master:root.PokeMaster,recipes:root.PokeRecipes,crypto:root.crypto};
let data=null,bound=null,modelPromise=null,plan=null,sleep=null,draft=null;
let targetDay=0,reviewDay=0,sleepDay=0,editPicks=[],pending=false;
let readToken=0,owner='',lastKey='',error='',sleepBusy=false,detailVersion=0;
let eligibleIndices=new Set(),carryTeam=null,sleepViewCarry=false,editingCarry=false,carryIssue='';
const val=(storageKey)=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null');}catch(_){return null;}};
const selected=()=>val('pokesleep-strategy-u3-e3-v1:selected');
const instant=()=>{
 const value=new URLSearchParams(location.search).get('previewNow');
 return value&&/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)?value+':00+09:00':new Date().toISOString();
};
const ctx=()=>{
 const c=bridge.readContext(localStorage,deps,instant());
 if(c.status!=='CONTEXT_READY')return c;
 const k=store.key('carry',c.weekStart,c.eventId);
 try{
  const raw=localStorage.getItem(k),p=raw?JSON.parse(raw):null;
  return {...c,previousCarryRevision:raw?(p?.revision||'INVALID_CARRY'):null};
 }catch(_){return {...c,previousCarryRevision:'INVALID_CARRY'};}
};
const textNode=(tag,txt,cl)=>{
 const e=doc.createElement(tag);if(txt!==undefined)e.textContent=txt;
 if(cl)e.className=cl;return e;
};
function flash(msg,bad=false){
 const warning=q('e3-warning');if(!warning)return;
 warning.hidden=!msg;warning.textContent=msg||'';
 warning.dataset.error=String(bad);
}
function label(i){
 const row=data?.privateBoxRows?.[i];
 return row?(row.nickname||row.pokemon):'未設定';
}
function itemAt(i){return data?.privateBoxRows?.[i]||null;}
function realAvatar(i){
 const item=itemAt(i),tile=textNode('div',undefined,'mon');
 if(!item)return textNode('span','未設定','hint');
 tile.append(textNode('span','Lv.'+item.level,'mon-level'));
 const btn=textNode('button',undefined,'avatar avatar-tap sprite-stage');
 btn.type='button';btn.style.setProperty('--tone',
  root.PokeE7PokemonDetail?.tone(item.pokemon)||'#8ca3b8');
 if(root.PokeSprite)btn.innerHTML=root.PokeSprite.icon(item);
 else btn.textContent=item.pokemon.slice(0,2);
 btn.setAttribute('aria-label',(item.nickname||item.pokemon)+'のステータス');
 btn.addEventListener('click',()=>showDetail(item));
 tile.append(btn,textNode('span',label(i),'mon-name'));return tile;
}
function patchDetailStats(version,stats){
 const dialog=q('pokemon-dialog');
 if(version!==detailVersion||!dialog?.open)return;
 for(const label of q('pokemon-base-rows')?.querySelectorAll('.iv-key')||[]){
  const value=label.nextElementSibling;if(!value)continue;
  if(label.textContent==='おてつだい時間：')value.textContent=stats.helpTime;
  if(label.textContent==='最大所持数：')value.textContent=stats.carry;
 }
}
function showDetail(item){
 if(!item||!root.PokeE7PokemonDetail)return;
 const version=++detailVersion;
 const foods=[item.ing1,item.ing2,item.ing3].map((name,i)=>({
  name,count:root.PokeE7IngredientQuantities?.get(item.pokemon,name,i+1)??null
 }));
 root.PokeE7PokemonDetail.render('plan',{
  pokemon:item.pokemon,nickname:item.nickname||item.pokemon,level:item.level,
  nature:item.nature,mint:item.mint,mainSkill:item.mainSkill,
  skillLevel:item.skillLevel,ingredients:foods,
  subskills:[item.lv10,item.lv25,item.lv50,item.lv70,item.lv80],
  ribbon:item.ribbon,favorite:item.favorite,helpTime:'算出中…',carry:'算出中…'
 },node=>{node.innerHTML=root.PokeSprite?.icon(item)||item.pokemon.slice(0,2);});
 root.PokeSprite?.enhance(q('pokemon-dialog'));
 q('pokemon-dialog').showModal();
 Promise.resolve().then(()=>root.PokeE7BoxStats?.calculate?.(item)||
  {helpTime:'原典未確認',carry:'原典未確認'}).then(stats=>
  patchDetailStats(version,stats)).catch(()=>patchDetailStats(version,
  {helpTime:'原典未確認',carry:'原典未確認'}));
}
function dateOf(day){
 const date=new Date((data?.weekStart||'2026-11-09')+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+day);
 return (date.getUTCMonth()+1)+'/'+date.getUTCDate();
}
function nav(id,index,cb){
 const rootNode=q(id);rootNode.replaceChildren();
 for(let d=0;d<7;d++){
  const btn=textNode('button',undefined,'daybtn');
  btn.type='button';btn.role='tab';btn.tabIndex=d===index?0:-1;
  btn.setAttribute('aria-selected',String(d===index));
  btn.setAttribute('aria-label',DAYS[d]+'曜日');
  btn.append(textNode('span',DAYS[d]),textNode('span',dateOf(d),'daydate'));
  btn.addEventListener('click',()=>cb(d));rootNode.append(btn);
 }
}
function recipesMap(){return new Map(deps.recipes.map(r=>[r.id,r.name]));}
function drawSlots(parent,visible,day){
 parent.replaceChildren();if(!visible)return;
 const known=recipesMap(),rows=visible.slots.slice(1+day*4,5+day*4);
 for(const w of rows){
  const section=textNode('section',undefined,'slot');section.dataset.slot=w.slot;
  const heading=textNode('div',undefined,'slot-head');
  heading.append(textNode('span',({
    morning:'07:30–12:00',noon:'12:00–18:00',
    evening:'18:00–0:00',sleep:'睡眠枠'
   })[w.slot]||w.slot,'slot-title'));section.append(heading);
  const lineup=textNode('div',undefined,'mini-roster');
  for(const i of w.teamIndices)lineup.append(realAvatar(i));
  section.append(lineup);
  if(w.slot!=='sleep'){
   const meal=textNode('div',w.recipeId?
    (known.get(w.recipeId)||'未照合レシピ'):'料理なし','meal');
   section.append(meal);
  }
  parent.append(section);
 }
 root.PokeSprite?.enhance(parent);
}
function viewForDraft(){
 if(!draft||!bound)return null;
 const ids=draft.slots.map(w=>({...w,
  teamIndices:w.team.map(s=>Number(s.slice(1)))}));
 return {slots:ids};
}
function drawReview(){
 if(!draft)return;
 const note=q('review-dialog')?.querySelector('.review-note');
 if(note)note.textContent=draft.officialEffectsExcluded?
  '実ボックスを使用した作戦です。一部イベント補正・新食材・新料理は未反映（参考計算）。':
  '実ボックスを使用した19食材・78料理の提案です。回復発動・収集は期待値の参考計算です。';
 const adopt=q('review-adopt');adopt.disabled=false;adopt.textContent='この作戦を採用';
 nav('review-day-nav',reviewDay,day=>{reviewDay=day;drawReview();});
 drawSlots(q('review-slots'),viewForDraft(),reviewDay);
}
function drawAdopted(){
 if(!['ADOPTED','STALE_ADOPTED'].includes(plan?.status))return;
 const stale=plan.status==='STALE_ADOPTED';
 q('week-content').hidden=false;
 const button=q('e3-next'),card=q('e3-primary');
 card.hidden=!stale;button.hidden=!stale;
 if(stale){
  button.textContent='作戦を再提案';button.dataset.action='F4C_REPROPOSE';
  button.disabled=data?.clock?.phase!=='BEFORE'||pending;
  flash(data?.clock?.phase==='BEFORE'?
   '以前の作戦を保持しています。変更した条件・在庫を反映するには再提案してください。':
   '以前の作戦を保持しています。週途中の再提案はF5工程で対応します。');
 }else flash('');
 const footer=q('e6-footer-plan');
 if(footer)footer.dataset.reproposal=String(stale);
 q('current-state-title').textContent='週間編成';
 q('day-label').textContent=DAYS[targetDay]+'曜日';
 q('day-date').textContent=dateOf(targetDay);
 nav('day-nav',targetDay,day=>{targetDay=day;drawAdopted();});
 drawSlots(q('slots'),plan,targetDay);
 // No unverified weekly energy exposed as an authoritative figure.
 q('e4-result-energy').hidden=true;
 q('e4-changed').hidden=!stale;
}
function renderEffective(){
 const carryButton=q('f4c-carry-trigger');
 if(carryButton)carryButton.hidden=!(data?.status==='CONTEXT_READY'&&
  !!bound&&data?.clock?.phase==='BEFORE');
 const sel=selected();
 if(!sel||!data||sel.weekStart!==data.weekStart||sel.id!==data.eventId)return;
 if(['ADOPTED','STALE_ADOPTED'].includes(plan?.status)){
  drawAdopted();return;
 }
 q('week-content').hidden=true;
 const button=q('e3-next'),card=q('e3-primary');
 if(data.clock?.phase==='ENDED'){card.hidden=true;return;}
 if(!card||!button)return;
 card.hidden=false;button.hidden=false;
 const can=data.status==='CONTEXT_READY'&&data.clock.phase==='BEFORE'&&!carryIssue;
 // Never bypass E7 condition validation when the player has unsaved edits.
 if(['SELECT_EVENT','SET_EVENT','SET_INVENTORY'].includes(button.dataset.action))return;
 button.textContent='作戦を提案';
 button.dataset.action='F4C_PROPOSE';
 button.disabled=!can||pending;
 if(data.clock.phase!=='BEFORE')flash('開始済みの週の残期間再提案は、F5工程で対応します。',true);
 else if(error)flash(error,true);
 else if(!can)flash('イベント条件・在庫・ボックス・プレイヤー設定を確認してください。',true);
 else flash('');
}
function dataFingerprint(c){
 return JSON.stringify([c?.status,c?.eventId,c?.weekStart,c?.conditionRevision,
  c?.inventoryRevision,c?.autoSleep,c?.fields,c?.player,c?.savedBerrySetup,c?.previousCarryRevision,
  c?.privateBoxRows,
  localStorage.getItem(c?.eventId?store.key('plan',c.weekStart,c.eventId):'invalid'),
  localStorage.getItem(c?.eventId?store.key('sleep',c.weekStart,c.eventId):'invalid')]);
}
async function models(){
 if(!modelPromise)modelPromise=Promise.all([
  '../f1/f1-b-target-source-v1.json','../f1/f1-b-help-traits-v1.json'
 ].map(async url=>{
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw Error('固定原典の読込に失敗しました');return res.json();
 })).then(([snapshot,traits])=>({snapshot,traits})).catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
async function synchronize(force=false){
 const id=++readToken,c=ctx(),sel=selected();
 if(c.status!=='CONTEXT_READY'){
  if(id!==readToken)return;
  data=c;bound=null;plan=null;sleep=null;carryTeam=null;carryIssue='';eligibleIndices=new Set();lastKey='';owner='';
  if(sel&&sel.id)error=c.message||'実ボックスの計算条件を確認してください。';
  renderEffective();return;
 }
 const key=dataFingerprint(c),newOwner=c.weekStart+':'+c.eventId;
 if(!force&&key===lastKey&&bound&&data?.status==='CONTEXT_READY'){
  data=c;renderEffective();return;
 }
 try{
  const mods=await models();
  const refs=await store.identities(localStorage,c.privateBoxRows,{
   identity:deps.identity,crypto:deps.crypto
  });
  if(id!==readToken)return;
  if(refs.status!=='IDENTITIES_READY'){
   data=c;owner=newOwner;plan=null;bound=null;sleep=null;carryTeam=null;eligibleIndices=new Set();error=refs.reason;
   renderEffective();return;
  }
  // A stable Box ID proves identity, NOT F1 legality or numerical support.
   // Use the exact F1-B adapter used by the proposal engine.
   const eligibility=deps.roster.adapt({items:c.privateBoxRows,
    camp:c.fields.camp,fieldBonus:c.player?.bonuses?.[c.fields.field],
    favoriteTypes:[]},{snapshot:mods.snapshot,traits:mods.traits,
    legal:deps.legal,rates:deps.rates,master:deps.master});
   const nextEligible=new Set(eligibility.status==='READY'?
    eligibility.profiles.map(p=>Number(p.id.slice(1))):[]);
   const carried=store.readCarry(localStorage,c,refs);
   const nextCarryIssue=carried.status==='BLOCKED'?carried.reason:'';
   let adopted=store.readPlan(localStorage,c,refs,mods.snapshot.upstream.commit,
   deps.recipes,c.clock);
  const nights=store.readSleep(localStorage,c,refs);
  // Explicit manual night changes invalidate a formerly adopted plan.
  if(['ADOPTED','STALE_ADOPTED'].includes(adopted.status)&&!c.autoSleep){
   const saved=nights.status==='SLEEP_READY'?nights.teams:null;
   if(!saved||adopted.slots.some(w=>w.slot==='sleep'&&w.day>=0&&
    (!saved[w.day]||w.teamIndices.join('|')!==saved[w.day].join('|'))))
    adopted={...adopted,status:'STALE_ADOPTED',reason:'MANUAL_SLEEP_CHANGED'};
  }
  if(id!==readToken)return;
  if(owner!==newOwner)draft=null;
  owner=newOwner;data=c;bound=refs;eligibleIndices=nextEligible;carryIssue=nextCarryIssue;
   carryTeam=carried.status==='CARRY_READY'?carried.team:null;
  plan=!carryIssue&&['ADOPTED','STALE_ADOPTED'].includes(adopted.status)?adopted:null;
  sleep=nights.status==='SLEEP_READY'?nights.teams:Array.from({length:7},()=>null);
  error=carryIssue?'前週日曜の個体照合に失敗しました。確定した5匹を再登録してください：'+carryIssue:
    adopted.status==='BLOCKED'?
   '採用済み作戦は保存条件またはボックスが変更されたため保護しました。再提案が必要です。':
   carried.status==='CARRY_READY'&&carried.team.some(i=>!nextEligible.has(i))?
     '前週日曜の確定編成に未検証の個体が含まれています。対象個体5匹を再登録してください。':
    nights.status==='BLOCKED'?'睡眠編成の実個体照合に失敗しました。':
    nights.status==='SLEEP_READY'&&nights.teams.some(team=>
     team&&team.some(i=>!nextEligible.has(i)))?
     '睡眠編成にF1計算対象外または未検証の個体があります。合法個体5匹で再設定してください。':
    eligibility.status!=='READY'?'睡眠編成用の合法個体判定ができません：'+eligibility.reason:'';
  lastKey=key;renderEffective();
 }catch(_){
  if(id!==readToken)return;
  data=c;bound=null;plan=null;carryTeam=null;carryIssue='';eligibleIndices=new Set();error='計算原典またはボックス照合を確認できません。';
  renderEffective();
 }
}
function refresh(){void synchronize();}
async function preflight(){
 const c=ctx();
 if(carryIssue){
  error='前週日曜の保存編成が照合できません。確定5匹を再登録してください。';
  renderEffective();return null;
 }
 if(c.status!=='CONTEXT_READY'){error=c.message||c.reason;renderEffective();return null;}
 if(c.clock.phase!=='BEFORE'){error='開始済み週の再提案はF5で対応します。';renderEffective();return null;}
 await synchronize(true);
 if(!bound||data?.eventId!==c.eventId)return null;
 const now=ctx();
 if(now.status!=='CONTEXT_READY'||dataFingerprint(now)!==dataFingerprint(c)){
  error='イベント・在庫・ボックスが変更されました。もう一度提案してください。';
  renderEffective();return null;
 }
 return c;
}
async function propose(){
 if(pending)return;
 pending=true;error='';renderEffective();
 try{
  const c=await preflight();
  if(!c)return;
  const original=dataFingerprint(c),mods=await models();
  if(original!==dataFingerprint(ctx())){error='保存内容が変更されました。';return;}
  const o={manualNights:sleep,previousWeekSleepIndices:carryTeam};
  const result=auto.propose(c,o,{...deps,...mods});
  if(result.status!=='PROVISIONAL'){
   const reason={
    EVENT_FAVORITE_BERRIES_UNKNOWN:'好みのきのみが未確定です。イベント条件を確認してください。',
    SLEEP_PARTIES_NOT_CONFIGURED:'睡眠編成の自動をONにするか、既存の睡眠編成で7晩を設定してください。',
    TWO_VERIFIED_HEALERS_MISSING:'ボックスに対象の全体回復ヒーラーが2匹必要です。',
    FOUR_NON_HEALERS_MISSING:'ボックスにヒーラー以外の個体が4匹必要です。',
    PLAYER_VALUES_UNCONFIRMED:'プレイヤー情報の鍋・バッグ・フィールドボーナスを確認してください。'
   }[result.reason]||('今回の条件では自動提案できません：'+result.reason);
   error=reason;return;
  }
  draft=result;reviewDay=0;drawReview();q('review-dialog').showModal();
 }catch(_){error='実個体の計算に失敗しました。ボックス・在庫・設定を確認してください。';}
 finally{pending=false;renderEffective();}
}
async function adopt(){
 if(!draft||pending||!bound)return;
 pending=true;q('review-adopt').disabled=true;
 try{
  const c=await preflight();
  if(!c)return;
  if(c.weekStart!==draft.weekStart||c.eventId!==draft.eventId||
   c.conditionRevision!==draft.conditionRevision||
   c.inventoryRevision!==draft.inventoryRevision)
   {error='提案後に条件・在庫が更新されました。再提案してください。';return;}
  const mods=await models();
  const refs=await store.identities(localStorage,c.privateBoxRows,{
   identity:deps.identity,crypto:deps.crypto});
  if(refs.status!=='IDENTITIES_READY'){error=refs.reason;return;}
  const adopted=store.adopt(localStorage,c,draft,refs,
   mods.snapshot.upstream.commit,deps.recipes,c.clock);
  if(adopted.status!=='ADOPTED'){error='採用保存できませんでした：'+adopted.reason;return;}
  data=c;bound=refs;plan=adopted;draft=null;
  q('review-dialog').close();lastKey='';
  await synchronize(true);
  if(plan?.status==='ADOPTED')root.PokeUI?.toast('実ボックスから作成した作戦を採用しました');
 }catch(_){error='実個体作戦を安全に保存できませんでした。';}
 finally{pending=false;q('review-adopt').disabled=false;renderEffective();
  if(error)flash(error,true);}
}
function drawSleep(){
 if(!data||!bound)return;
 q('sleep-title').textContent=sleepViewCarry?'前週日曜の睡眠編成':'睡眠編成';
 q('f4c-carry-entry').hidden=!sleepViewCarry;
 q('sleep-manual').hidden=sleepViewCarry;
 if(sleepViewCarry){
  const target=q('f4c-carry-preview');target.replaceChildren();
  if(carryTeam)for(const i of carryTeam)target.append(realAvatar(i));
  else target.append(textNode('p','確定編成は未登録です。持越しは未観測として計算します。','hint'));
  root.PokeSprite?.enhance(target);
  q('f4c-carry-edit').disabled=data.clock?.phase!=='BEFORE';
  return;
 }
 nav('sleep-day-nav',sleepDay,d=>{sleepDay=d;drawSleep();});
 const target=q('sleep-team-preview');target.replaceChildren();
 const chosen=sleep?.[sleepDay];
 if(chosen)for(const i of chosen)target.append(realAvatar(i));
 else target.append(textNode('p','この夜の睡眠編成は未設定です。','hint'));
 root.PokeSprite?.enhance(target);
 q('sleep-change').disabled=data.clock?.phase!=='BEFORE';
 q('sleep-copy').disabled=!chosen||data.clock?.phase!=='BEFORE';
}
function openSleep(){
 if(!data||!bound){error='ボックスを確認できません。';renderEffective();return;}
 if(data.autoSleep){error='睡眠自動ONでは当週7晩の手動設定は無効です。';renderEffective();return;}
 sleepViewCarry=false;sleepDay=0;drawSleep();q('sleep-dialog').showModal();
}
function openCarry(){
 if(!data||!bound||data.clock?.phase!=='BEFORE'){
  error='前週日曜の確定編成はイベント開始前にのみ登録できます。';
  renderEffective();return;
 }
 sleepViewCarry=true;drawSleep();q('sleep-dialog').showModal();
}
function beginCarryEdit(){
 if(!bound||!eligibleIndices.size||data?.clock?.phase!=='BEFORE')return;
 editingCarry=true;
 editPicks=carryTeam?carryTeam.filter(i=>eligibleIndices.has(i)):[];
 q('edit-title').textContent='前週日曜 · 確定5匹';
 drawEditor();q('edit-dialog').showModal();
}
function drawEditor(){
 const grid=q('pick-grid');grid.replaceChildren();
 q('select-count').textContent=editPicks.length+' / 5';
 q('edit-save').disabled=editPicks.length!==5;
 q('edit-save').textContent=editingCarry?'前週日曜の5匹を登録':'この夜を保存';
 for(let i=0;i<data.privateBoxRows.length;i++){
  if(!eligibleIndices.has(i))continue;
  const item=itemAt(i),on=editPicks.includes(i),entry=textNode('div',undefined,'pick');
  entry.dataset.selected=String(on);
  const pic=textNode('button',undefined,'pick-status sprite-stage');
  pic.type='button';pic.setAttribute('aria-label',label(i)+'の個体詳細');
  pic.innerHTML=root.PokeSprite?.icon(item)||item.pokemon.slice(0,1);
  pic.addEventListener('click',()=>showDetail(item));
  const choose=textNode('button',undefined,'pick-select');
  choose.type='button';choose.dataset.id=String(i);
  choose.setAttribute('aria-pressed',String(on));
  choose.disabled=!on&&editPicks.length>=5;
  const meta=textNode('span',undefined,'pick-meta');
  meta.append(textNode('span','Lv.'+item.level,'pick-level'),
   textNode('span',label(i),'pick-name'));
  choose.append(meta,textNode('span',on?'✓':'','selected-check'));
  choose.addEventListener('click',()=>{
   editPicks=on?editPicks.filter(v=>v!==i):[...editPicks,i];
   drawEditor();
  });
  entry.append(pic,choose);grid.append(entry);
 }
 root.PokeSprite?.enhance(grid);
 if(!eligibleIndices.size){
  const notice=textNode('p','F1計算対象となる合法個体を確認できません。イベント条件・プレイヤー情報・ボックスを確認してください。','hint');
  grid.append(notice);
 }
}
function beginEdit(){
 editingCarry=false;
 editPicks=sleep?.[sleepDay]?sleep[sleepDay].filter(i=>eligibleIndices.has(i)):[];
 q('edit-title').textContent=DAYS[sleepDay]+'曜日 · 睡眠編成';
 drawEditor();q('edit-dialog').showModal();
}
function saveNight(teams){
 const c=ctx();
 if(c.clock?.phase!=='BEFORE'){
  error='開始済み週の睡眠編成変更はF5で対応します。';renderEffective();return false;
 }
 if(!Array.isArray(teams)||teams.some(team=>
  team&&team.some(i=>!eligibleIndices.has(i)))){
  error='F1計算対象外の個体を睡眠編成へ保存できません。';renderEffective();return false;
 }
 if(c.status!=='CONTEXT_READY'||c.eventId!==data?.eventId||
  !bound)return false;
 const saved=store.saveSleep(localStorage,c,bound,teams);
 if(saved.status!=='SLEEP_SAVED'){
  error='睡眠編成を保存できませんでした：'+saved.reason;renderEffective();return false;
 }
 sleep=teams;draft=null;lastKey='';
 void synchronize(true);
 return true;
}
function saveEdit(){
 if(editPicks.length!==5||new Set(editPicks).size!==5||
    editPicks.some(i=>!eligibleIndices.has(i)))return;
 if(editingCarry){
  const c=ctx();
  if(c.status!=='CONTEXT_READY'||c.clock.phase!=='BEFORE'||!bound||
     c.eventId!==data?.eventId){error='前週日曜の登録条件が変更されました。';renderEffective();return;}
  const saved=store.saveCarry(localStorage,c,bound,editPicks);
  if(saved.status!=='CARRY_SAVED'){
   error='前週日曜の確定編成を保存できませんでした：'+saved.reason;
   renderEffective();return;
  }
  carryTeam=[...editPicks];draft=null;lastKey='';
  q('edit-dialog').close();drawSleep();
  void synchronize(true);
  root.PokeUI?.toast('前週日曜の確定5匹を登録しました');
  return;
 }
 const teams=sleep.map(x=>x?[...x]:null);
 teams[sleepDay]=[...editPicks];
 if(saveNight(teams)){
  q('edit-dialog').close();drawSleep();
  root.PokeUI?.toast('睡眠編成を保存しました');
 }
}
async function copyNights(){
 const current=sleep?.[sleepDay];if(!current)return;
 const shouldCopy=sleep.some(x=>JSON.stringify(x)!==JSON.stringify(current));
 if(shouldCopy&&!(await root.PokeUI.confirm(
  'この5匹を未開始の7晩すべてに設定しますか？',{
   title:'睡眠編成を一括設定',okText:'設定する'})))return;
 const teams=Array.from({length:7},()=>[...current]);
 if(saveNight(teams)){drawSleep();root.PokeUI?.toast('7晩に設定しました');}
}
const hijack=(id,fn,condition=()=>true)=>q(id)?.addEventListener('click',e=>{
 if(!condition())return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 void fn();
},true);
// Keep E7's approved event-selection and event-save clicks untouched.
hijack('e3-next',async()=>{
 const action=q('e3-next')?.dataset.action;
 if(['F4C_PROPOSE','F4C_REPROPOSE'].includes(action)&&
    data?.status==='CONTEXT_READY')return propose();
 // A selected event with missing Box/player/inventory must NEVER silently
 // fall back to the illustrative E7 mock proposal.
 error=data?.message||data?.reason||
  '実ボックスとイベント条件を登録してから作戦を提案してください。';
 flash(error,true);
},()=>['F4C_PROPOSE','F4C_REPROPOSE','PROPOSE','REPROPOSE','RESUME_DRAFT']
 .includes(q('e3-next')?.dataset.action));
hijack('generate',propose);
hijack('review-adopt',adopt);
hijack('review-close',()=>{draft=null;q('review-dialog').close();});
hijack('review-cancel',()=>{draft=null;q('review-dialog').close();});
// Preserve the accepted E7 sleeping interface while no real Box is loaded.
// Once a legal real Box is ready, use the exact same existing modal controls.
const realReady=()=>data?.status==='CONTEXT_READY'&&!!bound;
hijack('sleep-open',openSleep,realReady);
hijack('f4c-carry-trigger',openCarry);
hijack('f4c-carry-edit',beginCarryEdit);
hijack('sleep-change',beginEdit,realReady);
hijack('sleep-copy',copyNights,realReady);
hijack('edit-save',saveEdit,realReady);
const realDrop=q('review-dialog');
if(realDrop)realDrop.addEventListener('close',()=>{
 if(!plan||plan.status!=='ADOPTED')draft=null;
});
doc.addEventListener('click',e=>{
 if(e.target?.closest?.('#event-save,#e7-cal-weeks,#auto-sleep,#e7-event-delete'))
  Promise.resolve().then(()=>synchronize(true));
},false);
root.addEventListener('storage',refresh);
root.addEventListener('pageshow',refresh);
root.PokeF4CIntegratedUI=Object.freeze({refresh,isAdopted:(e)=>
 !!plan&&['ADOPTED','STALE_ADOPTED'].includes(plan.status)&&
 e?.weekStart===data?.weekStart&&e?.id===data?.eventId});
void synchronize(true);
})(window);

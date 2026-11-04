/**
 * PokeSleep Strategy — E1 shared, UI-free phase and inventory state model.
 *
 * No DOM, storage, network or timers. Used by U2/U3 in E2–E4 and unified U5.
 * A prior demonstration week is NEVER assumed to be the selected event.
 * The 04:00 JST game-day boundary is distinct from midnight.
 */
export const E1_SCHEMA_VERSION = 2;
export const PHASE = Object.freeze({
  UNSELECTED:'UNSELECTED', BEFORE:'BEFORE', DURING:'DURING', ENDED:'ENDED'
});
export const PRIMARY_ACTION = Object.freeze({
  NONE:'NONE', SELECT_EVENT:'SELECT_EVENT', SET_EVENT:'SET_EVENT',
  SET_INVENTORY:'SET_INVENTORY', PROPOSE:'PROPOSE', REPROPOSE:'REPROPOSE'
});
export const INGREDIENT_NAMES = Object.freeze([
  'ふといながねぎ','あじわいキノコ','とくせんエッグ','ほっこりポテト',
  'とくせんリンゴ','げきからハーブ','マメミート','モーモーミルク',
  'あまいミツ','ピュアなオイル','あったかジンジャー','あんみんトマト',
  'リラックスカカオ','おいしいシッポ','ワカクサ大豆','ワカクサコーン',
  'めざましコーヒー','ずっしりカボチャ','つやつやアボカド'
]);
const INGREDIENT_SET = new Set(INGREDIENT_NAMES);
const MS_DAY = 86_400_000;
const INSTANT_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/;
const WEEK_RE = /^\d{4}-\d\d-\d\d$/;
const JST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone:'Asia/Tokyo', year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
});

export function validWeekStart(week) {
  if(typeof week!=='string'||!WEEK_RE.test(week))return false;
  const d=new Date(week+'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===week &&
    d.getUTCDay()===1;
}
function instantMs(iso) {
  if(typeof iso!=='string'||!INSTANT_RE.test(iso))
    throw new Error('Timestamp requires an explicit UTC offset.');
  const n=Date.parse(iso);
  if(!Number.isFinite(n))throw new Error('Invalid timestamp.');
  return n;
}
function japaneseClock(instant) {
  const ms=instantMs(instant);
  const p=Object.fromEntries(JST_PARTS.formatToParts(new Date(ms))
    .filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {date:p.year+'-'+p.month+'-'+p.day, hour:Number(p.hour),
    minute:Number(p.minute), second:Number(p.second),ms};
}
function shiftCalendarDay(date,delta) {
  const d=new Date(date+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+delta);
  return d.toISOString().slice(0,10);
}
export function gameDateInJST(instant) {
  const clock=japaneseClock(instant);
  return clock.hour<4?shiftCalendarDay(clock.date,-1):clock.date;
}
export function gameWeekdayIndex(weekStart,instant) {
  if(!validWeekStart(weekStart))return null;
  const day=gameDateInJST(instant);
  const n=Math.round((Date.parse(day+'T12:00:00Z')-
    Date.parse(weekStart+'T12:00:00Z'))/MS_DAY);
  return n>=0&&n<7?n:null;
}
export function phaseForEvent(selectedEvent,instant) {
  if(selectedEvent===null || selectedEvent===undefined)return PHASE.UNSELECTED;
  if(!selectedEvent||typeof selectedEvent!=='object'||
    typeof selectedEvent.id!=='string'||!selectedEvent.id.trim()||
    selectedEvent.id.length>160||!validWeekStart(selectedEvent.weekStart))
    throw new Error('Explicit event ID and Monday start required.');
  const now=instantMs(instant);
  const start=Date.parse(selectedEvent.weekStart+'T04:00:00+09:00');
  if(now<start)return PHASE.BEFORE;
  if(now>=start+7*MS_DAY)return PHASE.ENDED;
  return PHASE.DURING;
}
function cleanRevision(x) {
  return typeof x==='string'&&x.length>0&&x.length<=160;
}
function cleanInventoryValues(values) {
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Inventory must be an object.');
  const keys=Object.keys(values);
  if(keys.length!==19||keys.some(k=>!INGREDIENT_SET.has(k)))throw Error('Exactly 19 known ingredient names required.');
  const next=Object.create(null);
  let total=0;
  for(const key of INGREDIENT_NAMES) {
    const n=values[key];
    if(!Number.isSafeInteger(n)||n<0||n>10000)throw Error('Invalid ingredient quantity: '+key);
    next[key]=n;total+=n;
  }
  if(total>10000)throw Error('Inventory capacity safety limit exceeded.');
  return {...next};
}
function cleanSnapshot(raw,week) {
  if(raw==null)return null;
  if(typeof raw!=='object'||raw.weekStart!==week||
    !cleanRevision(raw.revision))throw Error('Invalid inventory snapshot.');
  const savedAt=raw.savedAt;
  instantMs(savedAt);
  return {weekStart:week,savedAt,revision:raw.revision,
    values:cleanInventoryValues(raw.values)};
}
/** Shape is v2 and completely independent of the legacy v1 U3 and v3 U2 keys. */
export function newInventoryTimeline(weekStart) {
  if(!validWeekStart(weekStart))throw Error('Inventory must belong to a Monday event week.');
  return {version:E1_SCHEMA_VERSION,weekStart,
    preparationLatest:null,startInventory:null,currentInventory:null};
}
export function validateInventoryTimeline(raw,weekStart=raw?.weekStart) {
  if(!validWeekStart(weekStart)||!raw||typeof raw!=='object'||
    raw.version!==E1_SCHEMA_VERSION||raw.weekStart!==weekStart)
    throw Error('Unsupported inventory timeline; old data must be read by the legacy adapter.');
  const timeline={
    version:E1_SCHEMA_VERSION,weekStart,
    preparationLatest:cleanSnapshot(raw.preparationLatest,weekStart),
    startInventory:cleanSnapshot(raw.startInventory,weekStart),
    currentInventory:cleanSnapshot(raw.currentInventory,weekStart)
  };
  const start=Date.parse(weekStart+'T04:00:00+09:00');
  const prep=timeline.preparationLatest,baseline=timeline.startInventory,cur=timeline.currentInventory;
  if(prep&&instantMs(prep.savedAt)>=start)throw Error('Preparation stock saved after event start.');
  if(baseline&&instantMs(baseline.savedAt)>=start)throw Error('Baseline cannot be an event-time save.');
  if((prep===null)!==(baseline===null) ||
    (prep&&JSON.stringify(prep)!==JSON.stringify(baseline)))
    throw Error('Start stock must equal the final recorded preparation stock.');
  if(prep&&!cur)throw Error('Latest inventory must include the confirmed pre-event stock.');
  if(prep&&cur&&instantMs(cur.savedAt)<instantMs(prep.savedAt))
    throw Error('Latest inventory older than baseline.');
  return timeline;
}
/** Pure transition; never writes to localStorage.
 * saveAt is the actual commit instant, never a user-editable game day.
 * The final successful pre-event save becomes the baseline.
 * After the event starts, only currentInventory can change.
 */
export function applyInventorySave(raw,{savedAt,values,revision}) {
  const prev=validateInventoryTimeline(raw);
  const when=instantMs(savedAt);
  if(!cleanRevision(revision))throw Error('Every saved inventory needs a revision.');
  const eventStart=Date.parse(prev.weekStart+'T04:00:00+09:00');
  if(when>=eventStart+7*MS_DAY)throw Error('Ended event stock cannot be changed.');
  const previousTime=prev.currentInventory?instantMs(prev.currentInventory.savedAt):-Infinity;
  if(when<previousTime)throw Error('Stale inventory save; do not overwrite newer values.');
  // Equal timestamp from another mutation cannot determine ordering: reject unless idempotent.
  const nextSnapshot={weekStart:prev.weekStart,savedAt,revision,values:cleanInventoryValues(values)};
  if(when===previousTime) {
    if(JSON.stringify(prev.currentInventory)===JSON.stringify(nextSnapshot))return prev;
    throw Error('Conflicting inventory save with the same time.');
  }
  const future={...prev,currentInventory:nextSnapshot};
  if(when<eventStart){
    future.preparationLatest=nextSnapshot;
    future.startInventory=nextSnapshot;
  }
  return validateInventoryTimeline(future);
}
/** Read-only adapter for v29 U2 records, never auto-commits a new schema.
 * v29 initialValues came from the FIRST pre-event save and MUST NOT be treated
 * as the final start stock, or as a valid historic snapshot after the event began.
 */
export function previewLegacyU2V3(record,selectedWeek) {
  if(!validWeekStart(selectedWeek)||!record||record.version!==3||
    record.weekStart!==selectedWeek||record.source!=='inventory')
    throw Error('Legacy inventory belongs to a different event week or version.');
  const values=cleanInventoryValues(Object.fromEntries(
    INGREDIENT_NAMES.map(key=>[key,record.values?.[key]??0])));
  // Missing keys from a corrupt old record MUST NOT become a zero value.
  if(!record.values||INGREDIENT_NAMES.some(k=>!Object.prototype.hasOwnProperty.call(record.values,k))||
    Object.keys(record.values).length!==19)throw Error('Legacy stock is incomplete.');
  const savedAt=record.savedAt;
  const t=instantMs(savedAt);
  const start=Date.parse(selectedWeek+'T04:00:00+09:00');
  const converted=newInventoryTimeline(selectedWeek);
  const snapshot={weekStart:selectedWeek,savedAt,revision:'legacy-v3:'+savedAt,values};
  if(t<start){
    converted.preparationLatest=snapshot;
    converted.startInventory=snapshot;
  }
  converted.currentInventory=snapshot;
  return {timeline:validateInventoryTimeline(converted),
    warnings:t>=start?['START_STOCK_UNKNOWN_FROM_LEGACY'] : [],
    requiresExplicitCommit:true};
}
function conditionView(conditions) {
  if(!conditions||typeof conditions!=='object')return {ready:false,reason:['EVENT_CONDITIONS_UNCONFIRMED'],revision:null};
  const missing=Array.isArray(conditions.missingFields)?conditions.missingFields:null;
  if(missing===null||missing.some(x=>typeof x!=='string'||!x.trim()||x.length>120))
    return {ready:false,reason:['EVENT_CONDITIONS_UNCONFIRMED'],revision:null};
  if(conditions.status!=='CONFIRMED'||conditions.dirty===true||missing.length ||
    !cleanRevision(conditions.revision))
    return {ready:false,reason:missing.length?[...new Set(missing)]:['EVENT_CONDITIONS_UNCONFIRMED'],revision:null};
  return {ready:true,reason:[],revision:conditions.revision};
}
function confirmedInventory(timeline,event) {
  if(!timeline)return null;
  try{
    return validateInventoryTimeline(timeline,event.weekStart).currentInventory;
  }catch{return null;}
}
/** Pure state presentation used by U2/U3 (E2–E4) and U5.
 * No UI switching, modal action, implicit selection or storage writes.
 */
export function getPrimaryViewState({
  selectedEvent=null,nowISO,conditions=null,inventoryTimeline=null,
  adoptedPlan=null,draft=null,dirtyFlags={}
}={}) {
  const phase=phaseForEvent(selectedEvent,nowISO);
  if(phase===PHASE.UNSELECTED)
    return {phase,screen:'NO_EVENT',primaryAction:PRIMARY_ACTION.SELECT_EVENT,
      compactWarning:'EVENT_NOT_SELECTED',lockReasons:['EVENT_NOT_SELECTED'],
      canPropose:false,canRepropose:false,canAdoptDraft:false,
      adoption:'NONE',gameDayIndex:null};
  const cond=conditionView(conditions);
  const stock=confirmedInventory(inventoryTimeline,selectedEvent);
  const adopted=adoptedPlan?.status==='ADOPTED'&&
    adoptedPlan.weekStart===selectedEvent.weekStart&&
    adoptedPlan.eventId===selectedEvent.id;
  const hasDraft=draft?.status==='DRAFT'&&draft.weekStart===selectedEvent.weekStart&&
    draft.eventId===selectedEvent.id;
  const staleDraft=hasDraft&&(draft.conditionsRevision!==cond.revision||
    draft.inventoryRevision!==stock?.revision||
    Boolean(dirtyFlags.sleepChanged)||Boolean(dirtyFlags.conditionsChanged)||
    Boolean(dirtyFlags.inventoryChanged));
  const canPropose=phase===PHASE.DURING&&cond.ready&&Boolean(stock);
  const canRepropose=canPropose&&adopted;
  const canAdoptDraft=canPropose&&hasDraft&&!staleDraft;
  const reasons=[...cond.reason];
  if(!stock)reasons.push('INVENTORY_NOT_SAVED');
  let action=PRIMARY_ACTION.NONE,screen=adopted?'ADOPTED_PLAN':'PENDING_PLAN';
  if(phase===PHASE.ENDED)screen=adopted?'ADOPTED_PLAN':'EVENT_ENDED';
  else if(phase===PHASE.BEFORE)screen='PREPARATION';
  else if(adopted) {
    if(!cond.ready)action=PRIMARY_ACTION.SET_EVENT;
    else if(!stock)action=PRIMARY_ACTION.SET_INVENTORY;
    else if(dirtyFlags.conditionsChanged||dirtyFlags.inventoryChanged||
      dirtyFlags.sleepChanged||adoptedPlan.inventoryRevision!==stock.revision||
      adoptedPlan.conditionsRevision!==cond.revision)
      action=PRIMARY_ACTION.REPROPOSE;
  }else if(!cond.ready)action=PRIMARY_ACTION.SET_EVENT;
  else if(!stock)action=PRIMARY_ACTION.SET_INVENTORY;
  else action=PRIMARY_ACTION.PROPOSE;
  return {phase,screen,primaryAction:action,
    compactWarning:action===PRIMARY_ACTION.NONE?null:action,
    lockReasons:reasons,canPropose,canRepropose,canAdoptDraft,
    adoption:adopted?'ADOPTED':hasDraft?'DRAFT':'NONE',
    gameDayIndex:gameWeekdayIndex(selectedEvent.weekStart,nowISO)};
}

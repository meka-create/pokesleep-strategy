'use strict';
/* v124: end-to-end pure forecast boundary, stable-ID read-only verification,
 * event ownership, time ordering, bag capacity and no premature deduction.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>{const c={module:{exports:{}},globalThis:{},TextEncoder:globalThis.TextEncoder};vm.runInNewContext(read(p),c,{filename:p});return c.module.exports;};
const projection=load('f3/f3-adopted-opening-v124.js');
const week=load('f4/f4-b-game-week-v1.js');
const stockpile=load('f3/f3-stockpile-v120.js');
const store=load('f4/f4-c-real-storage-v112.js');
const idsMod=load('f4/f4-c-stable-box-ids-v1.js');
const meal={id:'two_apples',type:'curry',baseStrength:100,requirements:{apple:12}};
const base=stockpile.make({recipes:[meal],categories:['curry'],
 bagCapacity:120,potCapacity:12,camp:false,currentStock:{},
 selectedRecipes:{curry:meal.id},targetMeals:{curry:2}});
const stable=i=>'f4c_'+String(i).padStart(32,'0');
function fixture(){
 const clock=week.build('2026-11-23','2026-11-19T10:00:00+09:00');
 assert.equal(clock.phase,'BEFORE');
 const idList=Array.from({length:5},(_,i)=>stable(i));
 const slots=clock.windows.map((w,i)=>({
  day:w.day,slot:w.slot,source:w.source,startsAt:w.startsAt,endsAt:w.endsAt,
  teamIds:i===0?[]:[...idList],recipeId:i===1||i===2?meal.id:null
 }));
 const profiles=idList.map((id,i)=>({id:'p'+i,helpingBonus:false,
  ratesByTeammateBonus:Array.from({length:5},()=>({
   helpSeconds:3600,carryLimit:30,berryItemsPerHelp:0,
   ingredientCountsPerHelp:{apple:i===0?1:0}
  }))}));
 const ctx={status:'CONTEXT_READY',weekStart:'2026-11-23',
  eventId:'manual:2026-11-23',clock};
 const plan={kind:'REAL_BOX_PLAN_V112',weekStart:ctx.weekStart,
  eventId:ctx.eventId,sourceCommit:'a'.repeat(40),
  previousWeekCarryUnknown:true,slots};
 const identity={status:'IDENTITIES_READY',byId:new Map(idList.map((id,i)=>[id,i]))};
 return {ctx,plan,identity,roster:{sourceCommit:plan.sourceCommit,profiles},
  recipes:[meal],base,bagCapacity:120,currentStock:Object.fromEntries(projection.FOODS.map(k=>[k,0]))};
}
test('v124: only production collected before noon reduces opening stock',()=>{
 const scenario=projection.calculate(fixture());
 assert.equal(scenario.status,'PROVISIONAL',scenario.reason);
 assert.equal(base.goals.apple,24);
 assert.equal(scenario.goals.apple,14,'12 at breakfast + 2 at noon; morning yield 10');
 assert.equal(scenario.deductedExpected.apple,10);
 assert.equal(scenario.productionCertified,false);
 assert.equal(scenario.readOnly,true);
});
test('v124: no proven production leaves entire 24-apple opening goal',()=>{
 const input=fixture();
 for(const p of input.roster.profiles)for(const rate of p.ratesByTeammateBonus)
  rate.ingredientCountsPerHelp.apple=0;
 const r=projection.calculate(input);
 assert.equal(r.status,'PROVISIONAL',r.reason);
 assert.equal(r.goals.apple,24);
});
test('v124: no planned meal match or wrong event can silently lower goal',()=>{
 let x=fixture();
 x.plan.slots[2].recipeId=null;
 assert.equal(projection.calculate(x).reason,'PLANNED_MEAL_COUNT_DIFFERS');
 x=fixture();x.plan.eventId='manual:another';
 assert.equal(projection.calculate(x).reason,'VERIFIED_ADOPTED_WEEK_REQUIRED');
 x=fixture();x.plan.slots[2].recipeId='unrelated_recipe';
 assert.equal(projection.calculate(x).reason,'PLANNED_RECIPE_DIFFERS');
 x=fixture();x.identity.byId.delete(x.plan.slots[1].teamIds[0]);
 assert.equal(projection.calculate(x).reason,'TIMELINE_OR_IDENTITY_MISMATCH');
 x=fixture();x.ctx.clock.phase='DURING';
 assert.equal(projection.calculate(x).reason,'VERIFIED_ADOPTED_WEEK_REQUIRED');
});
test('v124: missing producer, full bag, or extra stock cannot fake reductions',()=>{
 let x=fixture();x.roster.profiles[0].ratesByTeammateBonus.forEach(r=>r.carryLimit=1);
 const less=projection.calculate(x);
 assert.equal(less.status,'PROVISIONAL',less.reason);
 assert(less.goals.apple>=23,'capacity must bound materialized food');
 x=fixture();x.currentStock.oil=110;
 const blocked=projection.calculate(x);
 assert.equal(blocked.status,'BLOCKED');
 assert.match(blocked.reason,/ROOM|COLLECTION|BAG/);
});
test('v124: two-tab code paths use one no-write stable ledger read method',async()=>{
 const row=Object.fromEntries([
  'nickname','pokemon','level','skillLevel','ing1','ing2','ing3',
  'mainSkill','nature','mint','lv10','lv25','lv50','lv70','lv80',
  'ribbon','shiny','favorite'
 ].map(k=>[k,k==='level'?20:'']));
 row.pokemon='ピカチュウ';
 const rows=Array.from({length:5},(_,i)=>({...row,nickname:'unique'+i}));
 const boxRaw=JSON.stringify({version:1,items:rows});
 const salt='0123456789abcdef0123456789abcdef';
 const digests=rows.map(one=>{
  const order=['nickname','pokemon','level','skillLevel','ing1','ing2','ing3',
   'mainSkill','nature','mint','lv10','lv25','lv50','lv70','lv80','ribbon','shiny','favorite'];
  const c=JSON.stringify(['f4c-real-identity-v112',...order.map(k=>one[k])]);
  return crypto.createHash('sha256').update('f4c-v112|'+salt+'|'+c).digest('hex');
 });
 const ledgerRaw=JSON.stringify({version:1,salt,ledger:{version:1,
  entries:digests.map((digest,i)=>({digest,id:stable(i)}))}});
 const values=new Map([
  ['pokesleep-strategy-e7-box-v1',boxRaw],[store.LEDGER,ledgerRaw]]);
 const storage={getItem:key=>values.get(key)??null,setItem:()=>{throw Error('MUST_NEVER_WRITE');}};
 const verified=await store.verifyExistingIdentities(storage,rows,{
  identity:idsMod,crypto:crypto.webcrypto});
 assert.equal(verified.status,'IDENTITIES_READY',verified.reason);
 assert.equal(verified.ids.length,5);
 assert.equal(verified.byId.get(stable(1)),1);
 const altered=await store.verifyExistingIdentities(storage,[...rows].reverse(),{
  identity:idsMod,crypto:crypto.webcrypto});
 assert.equal(altered.status,'BLOCKED');
 assert.equal(values.get(store.LEDGER),ledgerRaw);
});
test('v124: Prep uses same verified Box/recipe plan, original 5:4 UI is pinned',()=>{
 const html=read('e7-preview/U2_Prep_Local_Ingredients_20261109_v50_E7.html');
 const ui=read('e7-preview/e7-f3-prep-goals-v88.js');
 const sw=read('e7-preview/e7-sw-v50.js');
 assert.match(html,/src="\.\.\/f3\/f3-adopted-opening-v124\.js"/);
 assert.match(html,/src="\.\.\/f4\/f4-c-real-storage-v112\.js"/);
 assert.match(html,/id="e7-v94-landscape-food-grid"/);
 assert.match(html,/aspect-ratio:5 \/ 4/);
 assert.match(ui,/verifyExistingIdentities\(localStorage/);
 assert.match(ui,/Store\.readPlan\(localStorage/);
 assert.match(ui,/Model\.calculate\(\{ctx:c,plan:adopted\.plan/);
 assert.match(ui,/if\(token!==renderToken\)return/);
 assert.match(ui,/if\(result\.status!=='PROVISIONAL'\)/);
 assert.match(sw,/'\.\.\/f3\/f3-adopted-opening-v124\.js'/);
 assert.match(read('e7-preview/e7-ingredient-size-v123.css'),/scale\(1\.13\)/);
});

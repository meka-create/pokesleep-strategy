'use strict';
/* M1 R02 pair intake: two distinct user-reported weeks, SAME model inputs
 * except one daytime healer substitution. No screenshots or game ranks verified.
 * Browser and CLI deliberately share PokeObservation's single screening gate.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({module:{exports:{}},globalThis:{}});
for(const file of ['master.js','recipes.js','simulator.js','observation.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx,{filename:file});
const obs=ctx.globalThis.PokeObservation,sim=ctx.globalThis.PokeSimulator;
function comparePair(reports){
 if(!Array.isArray(reports)||reports.length!==2)
  throw Error('R02の参考比較には異なる週の観測JSONを2つ指定してください。');
 const batch=obs.reviewImportedReports(reports,sim.simulate);
 return {...batch.r02TwoWeekScreen,source:'user_supplied_weekly_summaries',
  screenshotVerified:false,realGameSkillProbabilitiesMeasured:false};
}
if(require.main===module){
 try{
  const files=process.argv.slice(2);
  if(files.length!==2)throw Error('Usage: npm run m1:r02-two-week -- week_one.json week_two.json');
  const reports=files.map(f=>{
   const stat=fs.statSync(path.resolve(f));
   if(stat.size>8*1024*1024)throw Error('観測JSONは各8MB以下にしてください。');
   return JSON.parse(fs.readFileSync(path.resolve(f),'utf8'));
  });
  process.stdout.write(JSON.stringify(comparePair(reports),null,2)+'\n');
 }catch(e){process.stderr.write(String(e.message||e)+'\n');process.exit(1);}
}
module.exports={comparePair};

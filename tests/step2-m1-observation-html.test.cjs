'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('weekly game observation is opt-in after successful simulation and is embedded in both compiled artifacts',()=>{
 const html=read('src/index.template.html'),build=read('build.mjs');
 const app=read('src/app.js'),packageData=JSON.parse(read('package.json'));
 assert.equal(packageData.version,'0.2.41');
 assert.match(html,/STEP 2 · v0\.2\.41/);
 assert.match(html,/<details class="sim-observation">/);
 assert.match(html,/id="observationFile"/);
 assert.match(html,/id="observationFile"[^>]*multiple/);
 assert.match(html,/id="obsImportResult"/);
 assert.match(html,/id="obsImportError"/);
 assert.ok(app.includes("PokeObservation.reviewImportedReports(reports,PokeSimulator.simulate)"));
 assert.match(html,/id="obsConfirmedSummary"/);
 assert.match(html,/id="downloadObservation"/);
 assert.match(html,/id="obsWeekBoundaryReconciled"/);
 assert.match(html,/id="obsTotal"/);
 assert.match(html,/id="obsCooking"/);
 assert.ok(build.includes("'simulator.js','observation.js'"));
 assert.ok(app.indexOf('lastRunSnapshot=PokeObservation.captureSimulation')>app.indexOf('PokeSimulator.simulate(runInput)'));
 assert.ok(app.includes("PokeObservation.makeReport(lastRunSnapshot,form)"));
 assert.ok(app.includes("PokeObservation.preview(report)"));
 assert.ok(app.includes("checked=false"));
 assert.ok(app.includes("lastRunSnapshot=null"));
 for(const output of ['index.html','dist/index.html']){
  const data=read(output);
  assert.match(data,/STEP 2 · v0\.2\.41/);
  assert.ok(data.includes('PokeObservation=api'));
  assert.ok(data.includes('id="obsMonday"'));
  assert.ok(data.indexOf('PokeObservation=api')<data.indexOf("lastRunSnapshot=PokeObservation.captureSimulation"));
 }
 assert.equal(read('index.html'),read('dist/index.html'));
});

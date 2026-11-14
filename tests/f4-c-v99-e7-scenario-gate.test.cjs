'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(p){
 const sandbox={module:{exports:{}},globalThis:{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',p),'utf8'),
  sandbox,{filename:p,timeout:15000});
 return sandbox.module.exports;
}
const bridge=load('f4/f4-b-e7-readonly-v1.js');
test('F4-C E7 scenario is explicitly gated and has no hidden mutation route',()=>{
 assert.equal(typeof bridge.statefulScenario,'function');
 assert.equal(bridge.statefulScenario(null,{},{}).reason,'STATE_SCENARIO_EXPLICIT_REQUIRED');
 assert.equal(bridge.statefulScenario(null,{
  scenarioConsent:'EXPLICIT_OBSERVATIONS_AND_SLEEP_PROXY'
 },{}).reason,'STATEFUL_DEPENDENCIES_MISSING');
 const source=fs.readFileSync(path.resolve(__dirname,
  '../f4/f4-b-e7-readonly-v1.js'),'utf8');
 assert(source.includes("statefulScenario"));
 assert(source.includes("weeklyEnergyCertified:false"));
 assert(!source.includes("storage.setItem("));
 assert(!source.includes("localStorage.setItem("));
});

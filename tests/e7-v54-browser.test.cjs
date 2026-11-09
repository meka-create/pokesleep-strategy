'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process'),path=require('node:path');
test('E7 v54 interactive first paint and offline lazy icons (Chromium)',{timeout:100000},()=>{
 execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v54.py')],{
  cwd:path.resolve(__dirname,'..'),timeout:95000,stdio:'pipe'
 });
});

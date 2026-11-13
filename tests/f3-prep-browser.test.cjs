'use strict';
const {test}=require('node:test'),path=require('node:path'),cp=require('node:child_process');
test('F3 v88 U2 mobile Chromium: energy-based goals, event isolation and no implicit writes',
 {timeout:125000},()=>{
 cp.execFileSync('python3',[path.resolve(__dirname,'preview_browser_f3_prep.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:115000});
});

'use strict';
const {test}=require('node:test'),path=require('node:path'),cp=require('node:child_process');
test('F2 v87 independent Chromium: explicit source reflection, translation update and offline LKG',
 {timeout:140000},()=>{
 cp.execFileSync('python3',[path.resolve(__dirname,'preview_browser_f2_pre_f3.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:130000});
});

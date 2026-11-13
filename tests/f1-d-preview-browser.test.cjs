'use strict';
const {test}=require('node:test'),path=require('node:path'),cp=require('node:child_process');
test('F1-D Chromium: approved E7 plan receives real Box weekly read-only result',{timeout:130000},()=>{
 cp.execFileSync('python3',[path.resolve(__dirname,'preview_browser_f1_d.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:120000});
});

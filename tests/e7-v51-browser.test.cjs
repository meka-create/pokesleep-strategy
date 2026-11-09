'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
test('E7 v51 persistent tabs Chromium integration',{timeout:180000},()=>{
 execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v51.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:175000});
});

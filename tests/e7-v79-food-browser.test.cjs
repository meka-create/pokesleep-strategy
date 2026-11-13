'use strict';
const {test}=require('node:test'),path=require('node:path'),cp=require('node:child_process');
test('E7 v79 mobile Chromium: icon-only food grid, Box count badges, inventory preservation',{timeout:110000},()=>{
 cp.execFileSync('python3',[path.resolve(__dirname,'preview_browser_e7_v79_food.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:100000});
});

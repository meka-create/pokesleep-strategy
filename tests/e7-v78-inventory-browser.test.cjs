'use strict';
const {test}=require('node:test'),path=require('node:path'),cp=require('node:child_process');
test('E7 v78 Chromium: same-week A/B stock is independently writable and legacy readable',{timeout:110000},()=>{
 cp.execFileSync('python3',[path.resolve(__dirname,'preview_browser_e7_v78_inventory.py')],{
 cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:100000});
});

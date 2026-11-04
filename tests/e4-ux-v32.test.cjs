'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const {resolve}=require('node:path');
const cwd=resolve(__dirname,'..');
test('E4 v32: frozen E3 contract, syntax and no deprecated editing',()=>{
 execFileSync('python3',[resolve(__dirname,'test_e4_contract_v32.py')],{
  cwd,stdio:'pipe',timeout:35000});
});
test('E4 v32: actual offline Chromium adopted-day and future-only operation',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{
  cwd,stdio:'pipe',timeout:120000});
 execFileSync('python3',[resolve(__dirname,'preview_browser_e4_v32.py')],{
  cwd,stdio:'pipe',timeout:110000});
});

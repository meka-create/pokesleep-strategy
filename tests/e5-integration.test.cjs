'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const {resolve}=require('node:path');
const cwd=resolve(__dirname,'..');
test('E5: frozen E4 baseline, v33 UI contract, data safety and JS syntax',()=>{
 execFileSync('python3',[resolve(__dirname,'test_e5_contract_v33.py')],{
  cwd,stdio:'pipe',timeout:40000
 });
});
test('E5: independent U2/U3 prep -> event -> ended browser integration and races',{timeout:180000},()=>{
 execFileSync('python3',['-m','pip','install','--quiet','playwright'],{
  cwd,stdio:'pipe',timeout:120000
 });
 execFileSync('python3',[resolve(__dirname,'preview_browser_e5_integration.py')],{
  cwd,stdio:'pipe',timeout:120000
 });
});

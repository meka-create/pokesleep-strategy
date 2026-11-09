'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process'),path=require('node:path');
test('E7 v56 global Settings, player and lossless scoped backup/restore (Chromium)',
  {timeout:120000},()=>{
    execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v56.py')],{
      cwd:path.resolve(__dirname,'..'),timeout:115000,stdio:'pipe'
    });
  });

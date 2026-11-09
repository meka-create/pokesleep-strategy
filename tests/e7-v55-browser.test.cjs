'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
test('E7 v55 loading text is deferred, while slow loads and fast tab switching remain safe (Chromium)',
  {timeout:100000},()=>{
    execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v55_loading.py')],{
      cwd:path.resolve(__dirname,'..'),timeout:95000,stdio:'pipe'
    });
  });

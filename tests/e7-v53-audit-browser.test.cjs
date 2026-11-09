'use strict';
const {test}=require('node:test'),{execFileSync}=require('node:child_process'),path=require('node:path');
test('E7 midterm browser: event edit survives switching to previously saved week',{timeout:90000},()=>{
 execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v53_audit.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'pipe',timeout:85000});
});

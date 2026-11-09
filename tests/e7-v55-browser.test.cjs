'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
test('E7 v55 loading text is deferred, while slow loads and fast tab switching remain safe (Chromium)',
  {timeout:100000},()=>{
    execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v55_loading.py')],{
      cwd:path.resolve(__dirname,'..'),timeout:95000,stdio:'pipe'
    });
  });

test('E7 v55 guards the delayed loading message without exposing stale child screens',()=>{
 const fs=require('node:fs');
 const html=fs.readFileSync(path.resolve(__dirname,'../e7-preview/index.html'),'utf8');
 assert.equal((html.match(/id="status"/g)||[]).length,1);
 assert.match(html,/#status\[data-show-message="true"\] > span\{visibility:visible\}/);
 assert.match(html,/const LOADING_NOTICE_DELAY_MS=350;/);
 assert.match(html,/if\(loadingNoticeTimer!==null\)\{clearTimeout\(loadingNoticeTimer\)/);
 assert.match(html,/if\(epoch===loadingNoticeEpoch&&!status.hidden\)status.dataset.showMessage='true'/);
 assert.match(html,/status.hidden=!active;/);
 assert.match(html,/function finishReady\(tab,href,via\)/);
});

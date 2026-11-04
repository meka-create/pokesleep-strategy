'use strict';
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const cwd=resolve(__dirname,'..');
test('E3 U2/U3 v31: E1 identity, syntax, fail-closed and no deprecated UI', () => {
  execFileSync('python3', [resolve(__dirname,'test_e3_event_flow_v31.py')], {
    cwd, stdio:'pipe', timeout:25000
  });
});
test('E3 v31: actual offline Chromium event-to-adoption roundtrip', {timeout:180000}, () => {
  execFileSync('python3',['-m','pip','install','--quiet','playwright'],{
    cwd,stdio:'pipe',timeout:120000
  });
  execFileSync('python3',[resolve(__dirname,'preview_browser_e3_v31.py')],{
    cwd,stdio:'pipe',timeout:95000
  });
});

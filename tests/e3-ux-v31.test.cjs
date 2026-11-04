'use strict';
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
test('E3 U2/U3 v31: E1 identity, syntax, fail-closed and no deprecated UI', () => {
  execFileSync('python3', [resolve(__dirname,'test_e3_event_flow_v31.py')], {
    cwd: resolve(__dirname,'..'), stdio:'pipe', timeout:25000
  });
});

'use strict';
// Node's test runner launches files concurrently. The older browser tests each
// run pip install, which races while creating ~/.local/bin/playwright on CI.
// Bootstrap once before launching parallel tests; subsequent pip checks are no-ops.
const {spawnSync,execFileSync}=require('node:child_process');
const python=process.env.POKESLEEP_TEST_PYTHON||'python3';
const probe=spawnSync(python,['-c','import playwright'],{stdio:'ignore',timeout:15000});
if(probe.status!==0){
 execFileSync(python,['-m','pip','install','--quiet','playwright'],{stdio:'inherit',timeout:120000});
 // Fail explicitly rather than silently skipping browser tests.
 const verified=spawnSync(python,['-c','import playwright'],{stdio:'inherit',timeout:15000});
 if(verified.status!==0)process.exit(1);
}

'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process'),path=require('node:path');
test('E7 v56 global Settings, player and lossless scoped backup/restore (Chromium)',
  {timeout:120000},()=>{
    execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v56.py')],{
      cwd:path.resolve(__dirname,'..'),timeout:115000,stdio:'pipe'
    });
  });

test('E7 v56 shared Settings entry and recoverable app-only backup are wired',()=>{
 const assert=require('node:assert/strict'),fs=require('node:fs');
 const base=path.resolve(__dirname,'../e7-preview');
 const read=p=>fs.readFileSync(path.join(base,p),'utf8');
 const shell=read('index.html'),bridge=read('e7-unified-bridge-v51.js');
 const settings=read('e7-settings-v56.js'),sw=read('e7-sw-v50.js');
 assert.equal((shell.match(/class="view"/g)||[]).length,3);
 assert.equal((shell.match(/id="tab-(?:plan|prep|box)"/g)||[]).length,3);
 assert.match(shell,/e7-settings-v56\.css/);
 assert.match(shell,/e7-settings-v56\.js/);
 assert.match(bridge,/gear\.setAttribute\('aria-label','設定'\)/);
 assert.match(bridge,/action:'open-settings'/);
 assert.match(bridge,/if\(playerCard\)playerCard\.hidden=true/);
 assert.match(settings,/const PREFIX='pokesleep-strategy-'/);
 assert.match(settings,/validPlayer/);
 assert.match(settings,/validBox/);
 assert.match(settings,/validateRecords/);
 assert.match(settings,/__pokesleepE7ResetRevoked=true/);
 assert.match(settings,/window\.confirm\(msg\)/);
 assert.match(sw,/'e7-settings-v56\.js','e7-settings-v56\.css'/);
 assert.match(sw,/pokesleep-strategy-e7-v57-more-menu/);
 const vm=require('node:vm');
 new vm.Script(settings);new vm.Script(bridge);new vm.Script(sw);
});

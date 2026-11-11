'use strict';
const {test}=require('node:test');
const {execFileSync}=require('node:child_process'),path=require('node:path');
test('E7 v57 three-dot menu, dedicated player and backup modals (Chromium)',
  {timeout:120000},()=>{
    execFileSync('python3',[path.join(__dirname,'preview_browser_e7_v56.py')],{
      cwd:path.resolve(__dirname,'..'),timeout:115000,stdio:'pipe'
    });
  });

test('E7 v57 menu exposes only two settings dialogs and preserves backup safety',()=>{
 const assert=require('node:assert/strict'),fs=require('node:fs');
 const base=path.resolve(__dirname,'../e7-preview');
 const read=p=>fs.readFileSync(path.join(base,p),'utf8');
 const shell=read('index.html'),bridge=read('e7-unified-bridge-v51.js');
 const settings=read('e7-settings-v56.js'),sw=read('e7-sw-v50.js');
 assert.equal((shell.match(/class="view"/g)||[]).length,3);
 assert.equal((shell.match(/id="tab-(?:plan|prep|box)"/g)||[]).length,3);
 assert.match(shell,/e7-settings-v56\.css/);
 assert.match(shell,/e7-settings-v56\.js/);
 assert.match(bridge,/more\.setAttribute\('aria-label','メニュー'\)/);
 assert.match(bridge,/\.e7-more-btn\{[^}]*width:42px;height:42px;[^}]*border:0;border-radius:0;background:transparent;box-shadow:none/);
 assert.match(bridge,/\.e7-more-btn:hover,[^}]*\{background:transparent;border-color:transparent;box-shadow:none/);
 assert.match(bridge,/menu\.setAttribute\('role','menu'\)/);
 assert.match(bridge,/item\.setAttribute\('role','menuitem'\)/);
 assert.match(bridge,/section},location\.origin/);
 assert.match(bridge,/\['activate','dismiss-menu'\]\.includes\(event\.data\.action\)/);
 assert.match(bridge,/action:'open-settings'/);
 assert.match(bridge,/if\(playerCard\)playerCard\.hidden=true/);
 assert.match(settings,/const PREFIX='pokesleep-strategy-'/);
 assert.match(settings,/function open\(section='player'\)/);
 assert.match(settings,/section==='player'\?'プレイヤー情報':'バックアップ・復元'/);
 assert.match(settings,/\$\('e7-backup-settings'\)\.hidden=section!=='backup'/);
 assert.match(settings,/validPlayer/);
 assert.match(settings,/validBox/);
 assert.match(settings,/validateRecords/);
 assert.match(settings,/__pokesleepE7ResetRevoked=true/);
 assert.match(settings,/window\.confirm\(msg\)/);
 assert.match(sw,/'e7-settings-v56\.js','e7-settings-v56\.css'/);
 assert.match(sw,/pokesleep-strategy-e7-v64-card-picker-calendar/);
 const vm=require('node:vm');
 new vm.Script(settings);new vm.Script(bridge);new vm.Script(sw);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.resolve(__dirname,'../e7-preview',n),'utf8');
const js=read('e7-pokemon-detail-shared-v81.js');
const css=read('e7-pokemon-detail-shared-v81.css');
const plan=read('U3_Strategy_UI_20261109_v50_E7.html');
const box=read('U4_Box_Preview_20261109_v50_E7.html');
test('E7 v83 single canonical modal shell owns outer geometry, backdrop and accessible heading',()=>{
 assert.match(css,/\.pokemon-detail-modal\s*\{\s*position:fixed;inset:auto 0 0/);
 assert.match(css,/\.pokemon-detail-modal::backdrop\s*\{/);
 assert.match(css,/\.pokemon-detail-modal \.visually-hidden\s*\{/);
 assert.match(css,/width:min\(540px,100%\)/);
 assert.match(css,/border-radius:20px 20px 0 0/);
 const local=read('e7-box-detail-v60.css');
 assert.doesNotMatch(local,/\.box-detail-dialog\s*\{/);
 assert.doesNotMatch(local,/\.box-detail-dialog::backdrop/);
 assert.match(local,/\.box-detail-dialog #box-delete\s*\{/);
 for(const html of [plan,box])assert.match(html,/class="[^"]*pokemon-detail-modal[^"]*"/);
 assert.match(plan,/PokeE7PokemonDetail\.mount\('plan'\)/);
 assert.match(box,/PokeE7PokemonDetail\.mount\('box'\)/);
 for(const html of [plan,box])assert(html.indexOf('<script src="e7-pokemon-detail-shared-v81.js">')<html.indexOf('PokeE7PokemonDetail.mount('),'renderer must load before mount');
 assert(box.indexOf('PokeE7PokemonDetail.mount(')<box.indexOf('<script id="e7-box">'),'mount must precede Box handler binding');
 assert.doesNotMatch(plan,/<div class="iv-hero">/);
 assert.doesNotMatch(box,/<div class="iv-hero">/);
 assert.doesNotMatch(plan,/id="box-delete"/);
 assert.equal((box.match(/id="box-delete"/g)||[]).length,1);
 assert.doesNotMatch(plan,/id="pokemon-base-rows"/);
 assert.doesNotMatch(box,/id="box-detail-fields"/);
 assert.doesNotMatch(plan,/<style id="e7-v79-status-ingredients">/);
 assert.doesNotMatch(plan,/<style id="e7-v80-status-compact-rows">/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|box-delete|removeItem|setItem/);
});
class FakeElement{
 constructor(tag){this.tagName=tag.toUpperCase();this.className='';this.id='';this.textContent='';
  this.dataset={};this.attributes={};this.children=[];}
 append(...els){this.children.push(...els);}
 replaceChildren(...els){this.children=[...els];}
 setAttribute(k,v){this.attributes[k]=v;}
 querySelector(q){
  const queue=[...this.children];
  while(queue.length){const x=queue.shift();
   if(q==='.box-detail-actions'&&x.className.split(' ').includes('box-detail-actions'))return x;
   queue.push(...x.children);
  }return null;
 }
}
test('E7 v83 mount constructs identical accessible DOM; Box actions retain original identity',()=>{
 const planDialog=new FakeElement('dialog');planDialog.id='pokemon-dialog';
 const boxDialog=new FakeElement('dialog');boxDialog.id='box-detail-dialog';
 const actions=new FakeElement('div');actions.className='box-detail-actions';
 const deletion=new FakeElement('button');deletion.id='box-delete';actions.append(deletion);
 boxDialog.append(actions);
 const find=(root,id)=>{
  const queue=[root];while(queue.length){const el=queue.shift();
   if(el.id===id)return el;queue.push(...el.children);
  }return null;
 };
 const doc={
  createElement:tag=>new FakeElement(tag),
  getElementById:id=>find(planDialog,id)||find(boxDialog,id)
 };
 const root={document:doc};
 vm.runInNewContext(js,{window:root});
 const api=root.PokeE7PokemonDetail;
 assert.equal(api.mount('plan'),planDialog);
 assert.equal(api.mount('box'),boxDialog);
 assert.equal(planDialog.dataset.e7StatusMounted,'true');
 assert.equal(boxDialog.dataset.e7StatusMounted,'true');
 assert.equal(find(planDialog,'pokemon-status-title').textContent,'ポケモンの詳細');
 assert.equal(find(boxDialog,'box-detail-title').textContent,'ポケモンの詳細');
 assert.equal(find(planDialog,'pokemon-close').textContent,'閉じる');
 assert.equal(find(boxDialog,'box-detail-close').textContent,'閉じる');
 assert.equal(find(planDialog,'pokemon-close').attributes['aria-label'],'ステータスを閉じる');
 assert.equal(find(boxDialog,'box-detail-close').attributes['aria-label'],'ステータスを閉じる');
 assert.equal(find(planDialog,'box-delete'),null);
 assert.equal(boxDialog.children.at(-1),actions);
 assert.equal(find(boxDialog,'box-delete'),deletion);
 const shape=node=>[node.tagName,node.className,node.children.map(shape)];
 assert.deepEqual(
  planDialog.children.map(shape),
  boxDialog.children.filter(x=>x!==actions).map(shape)
 );
 assert.equal(api.mount('box'),boxDialog);
 assert.equal(boxDialog.children.at(-1),actions,'repeated mount must not replace deletion button');
 assert.equal(find(boxDialog,'box-delete'),deletion);
});

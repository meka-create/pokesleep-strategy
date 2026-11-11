/* E7 v66 shared feedback UI. Browser alert/confirm/prompt are never used. */
(()=>{
'use strict';
if(window.PokeUI)return;
const pending=[];let active=null,dialog=null,toastNode=null,toastTimer=0;
const $=id=>document.getElementById(id);
function ensureDialog(){
 if(dialog)return dialog;
 if(!document.body)return null;
 dialog=document.createElement('dialog');
 dialog.id='e7-feedback-dialog';
 dialog.setAttribute('aria-labelledby','e7-feedback-title');
 dialog.setAttribute('aria-describedby','e7-feedback-message');
 dialog.innerHTML=[
  '<div class="e7-feedback-inner">',
  '<h2 id="e7-feedback-title"></h2>',
  '<p id="e7-feedback-message"></p>',
  '<div class="e7-feedback-actions">',
  '<button type="button" id="e7-feedback-cancel">キャンセル</button>',
  '<button type="button" id="e7-feedback-ok">確認</button>',
  '</div></div>'
 ].join('');
 document.body.append(dialog);
 $('e7-feedback-cancel').addEventListener('click',()=>settle(false));
 $('e7-feedback-ok').addEventListener('click',()=>settle(true));
 dialog.addEventListener('cancel',e=>{e.preventDefault();settle(false);});
 dialog.addEventListener('click',e=>{if(e.target===dialog)settle(false);});
 return dialog;
}
function settle(accepted){
 if(!active)return;
 const current=active;active=null;
 if(dialog?.open)dialog.close();
 try{current.opener?.focus({preventScroll:true});}catch{}
 current.resolve(Boolean(accepted));
 queueMicrotask(display);
}
function display(){
 if(active||!pending.length)return;
 const modal=ensureDialog();
 if(!modal){
  document.addEventListener('DOMContentLoaded',display,{once:true});
  return;
 }
 active=pending.shift();
 active.opener=document.activeElement;
 $('e7-feedback-title').textContent=active.options.title||
  (active.type==='confirm'?'確認':'お知らせ');
 $('e7-feedback-message').textContent=active.message;
 const cancel=$('e7-feedback-cancel'),ok=$('e7-feedback-ok');
 cancel.hidden=active.type!=='confirm';
 cancel.textContent=active.options.cancelText||'キャンセル';
 ok.textContent=active.options.okText||(active.type==='confirm'?'続ける':'閉じる');
 ok.dataset.danger=String(active.options.danger===true);
 modal.dataset.kind=active.type;
 modal.showModal();
 // Cancel is the default focus on destructive actions; never default to "delete".
 if(active.type==='confirm')cancel.focus();
 else ok.focus();
}
function request(type,message,options={}){
 return new Promise(resolve=>{
  pending.push({type,message:String(message??''),options,resolve,opener:null});
  display();
 });
}
function confirm(message,options={}){return request('confirm',message,options);}
async function alert(message,options={}){await request('alert',message,options);}
function ensureToast(){
 if(toastNode)return toastNode;
 if(!document.body)return null;
 toastNode=document.createElement('div');
 toastNode.id='e7-feedback-toast';
 toastNode.setAttribute('aria-atomic','true');
 toastNode.hidden=true;
 document.body.append(toastNode);
 return toastNode;
}
function toast(message,{error=false,duration=3000}={}){
 const node=ensureToast();
 if(!node){
  document.addEventListener('DOMContentLoaded',()=>toast(message,{error,duration}),{once:true});
  return;
 }
 clearTimeout(toastTimer);
 // A top-layer dialog would otherwise conceal a body-level toast.
 const open=[...document.querySelectorAll('dialog[open]')];
 const host=open.at(-1)||document.body;
 if(node.parentElement!==host)host.append(node);
 node.textContent=String(message??'');
 node.dataset.error=String(error===true);
 node.setAttribute('role',error?'alert':'status');
 node.setAttribute('aria-live',error?'assertive':'polite');
 node.hidden=!message;
 if(message)toastTimer=setTimeout(()=>{node.hidden=true;toastTimer=0;},Math.max(1000,duration));
}
window.PokeUI=Object.freeze({confirm,alert,toast});
})();
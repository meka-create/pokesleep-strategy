'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const id=require('../f4/f4-c-stable-box-ids-v1.js');
const digest=s=>createHash('sha256').update(s).digest('hex');
const A=digest('PRIVATE_ROW_A'),B=digest('PRIVATE_ROW_B'),C=digest('PRIVATE_ROW_C');
let n=0;const issue=()=>('f4c_'+(++n).toString(16).padStart(32,'0'));
test('F4-C identity: first local ledger, same rows, append rows retain IDs',()=>{
 n=0;
 const initial=id.reconcile([A,B],null,issue);
 assert.equal(initial.status,'IDENTITY_READY');
 assert.equal(initial.writesSavedData,false);
 const repeated=id.reconcile([A,B],initial.ledger,issue);
 assert.equal(repeated.status,'IDENTITY_READY');
 assert.deepEqual(repeated.ledger,initial.ledger);
 const appended=id.reconcile([A,B,C],initial.ledger,issue);
 assert.equal(appended.status,'IDENTITY_READY');
 assert.deepEqual(appended.ledger.entries.slice(0,2),initial.ledger.entries);
 assert.notEqual(appended.ledger.entries[2].id,initial.ledger.entries[1].id);
});
test('F4-C identity: unique reorder/deletion correctly reconciles, duplicate reorder fails closed',()=>{
 n=0;
 const before=id.reconcile([A,B,C],null,issue);
 const shuffled=id.reconcile([C,A],before.ledger,issue);
 assert.equal(shuffled.status,'IDENTITY_READY',shuffled.reason);
 assert.equal(shuffled.ledger.entries[0].id,before.ledger.entries[2].id);
 assert.equal(shuffled.ledger.entries[1].id,before.ledger.entries[0].id);
 const twins=id.reconcile([A,A,B],null,issue);
 assert.equal(twins.status,'IDENTITY_READY');
 assert.equal(id.reconcile([A,B],twins.ledger,issue).reason,
  'DUPLICATE_BOX_IDENTITY_AMBIGUOUS');
 assert.equal(id.reconcile([A,A,B],twins.ledger,issue).status,'IDENTITY_READY');
 const plus=id.reconcile([A,A,B,C],twins.ledger,issue);
 assert.equal(plus.status,'IDENTITY_READY');
});
test('F4-C identity: five chosen distinct individuals require unchanged exact snapshot',()=>{
 n=0;
 const hashes=[A,B,C,digest('D'),digest('E'),digest('F')];
 const made=id.reconcile(hashes,null,issue);
 const x=id.resolve(hashes,made.ledger,[0,1,2,3,4]);
 assert.equal(x.status,'IDENTITIES_VERIFIED');
 assert.equal(x.ids.length,5);
 assert.equal(new Set(x.ids).size,5);
 assert.equal(id.resolve([B,A,...hashes.slice(2)],made.ledger,[0,1,2,3,4]).reason,
  'BOX_CHANGED_OR_SELECTION_INVALID');
 assert.equal(id.resolve(hashes,made.ledger,[0,0,2,3,4]).status,'BLOCKED');
});
test('F4-C identity: never accept reused IDs, untrusted digest or unexpected state',()=>{
 const repeated=()=>'f4c_'+'a'.repeat(32);
 assert.equal(id.reconcile([A,B],null,repeated).reason,'UNSAFE_OR_REUSED_ID');
 assert.equal(id.reconcile(['not-a-hash'],null,issue).status,'BLOCKED');
 assert.equal(id.reconcile([A],{version:1,entries:[{digest:A,id:'bad'}]},issue).status,'BLOCKED');
 const s=fs.readFileSync(path.resolve(__dirname,'../f4/f4-c-stable-box-ids-v1.js'),'utf8');
 for(const sideEffect of ['localStorage','sessionStorage','.setItem(','console.log','fetch('])
  assert(!s.includes(sideEffect));
 assert(!s.includes('nickname'));
});

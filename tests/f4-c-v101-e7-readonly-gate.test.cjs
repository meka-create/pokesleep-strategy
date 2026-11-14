'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,
 '../f4/f4-b-e7-readonly-v1.js'),'utf8');
const sandbox={module:{exports:{}},globalThis:{}};
vm.runInNewContext(source,sandbox,{filename:'f4-b-e7-readonly-v1.js',timeout:15000});
const api=sandbox.module.exports;
test('v101 E7 gateway refuses guessed collection and unverified dependencies',()=>{
 assert.equal(typeof api.itemAwareReference,'function');
 assert.equal(api.itemAwareReference(null,{},{}).reason,
  'ITEM_AWARE_DEPENDENCIES_MISSING');
 assert.equal(api.itemAwareReference(null,{},{
  itemRank:{rank(){}},skillValues:{skillValue(){}}
 }).reason,'REFERENCE_ASSUMPTIONS_NOT_SELECTED');
 assert(!source.includes('storage.setItem('));
 assert(!source.includes('localStorage.setItem('));
 assert(!source.includes('sessionStorage.setItem('));
});
test('v101 modules remain isolated from formally accepted saved-data/UI shells',()=>{
 const root=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 const e7=fs.readFileSync(path.resolve(__dirname,'../e7-preview/index.html'),'utf8');
 assert(!root.includes('f4-c-item-aware-rank-v101'));
 assert(!e7.includes('f4-c-item-aware-rank-v101'));
 assert(source.includes("itemAwareReference"));
});

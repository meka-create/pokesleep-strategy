/* F1-A (2026-11-13): pure, fail-closed 68-individual species/form scope.
 * Does NOT provide numerical game stats or enable real energy calculations.
 * Input is the already-validated E7BoxCsv.parseBox() result and the E7
 * species/form identity catalog (249 entries as of the E7 frozen snapshot).
 * No personal individual rows are written to storage or embedded in the build.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PokeF1SpeciesScope=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION=1,EXPECTED=68;
 const fail=(code,description)=>Object.assign(new Error(description),{code});
 // Normalize spacing and width only. Never collapse to dex ID or strip forms.
 function identity(name){
  if(typeof name!=='string')return '';
  return name.normalize('NFKC').trim().replace(/\s+/gu,' ');
 }
 function indexCatalog(species){
  if(!Array.isArray(species)||species.length===0)throw fail('CATALOG','種族・フォームのカタログがありません。');
  const byName=new Map();
  for(const entry of species){
   const name=identity(entry?.name);
   if(!name||name.length>160||!Number.isSafeInteger(entry?.id)||entry.id<=0||
      typeof entry.type!=='string'||!entry.type.trim())
    throw fail('CATALOG','種族・フォーム定義が不正です。');
   // Unicode/spacing aliases that collide MUST be reviewed, not silently merged.
   if(byName.has(name))throw fail('CATALOG_COLLISION','種族・フォーム名の識別が重複しています：'+name);
   byName.set(name,Object.freeze({name,id:entry.id,type:entry.type}));
  }
  return byName;
 }
 function buildScope(parsed,catalog,options={}){
  if(parsed?.ok!==true||!Array.isArray(parsed.items)||
     (Array.isArray(parsed.errors)&&parsed.errors.length>0))
   throw fail('SOURCE_INVALID','CSV・TSVの読み取りが確定していません。部分データを採用しません。');
  // Initial F1 scope is exactly the user-selected 68 individuals. A caller
  // must not bypass that contract with a lower/higher expected row count.
  if(Object.prototype.hasOwnProperty.call(options,'expectedIndividuals')&&
     options.expectedIndividuals!==EXPECTED)
   throw fail('SCOPE_COUNT','F1初期対象は68個体固定です。');
  const expected=EXPECTED;
  if(parsed.items.length!==expected)
   throw fail('SCOPE_COUNT',`対象は${expected}個体です。入力された${parsed.items.length}個体から暗黙に選別しません。`);
  const byName=indexCatalog(catalog);
  const selection=new Map(),unresolved=[];
  for(const individual of parsed.items){
   const name=identity(individual?.pokemon);
   const found=byName.get(name);
   if(!found){unresolved.push(name||'(空欄)');continue;}
   selection.set(found.name,found);
  }
  if(unresolved.length){
   const unique=[...new Set(unresolved)];
   throw fail('UNKNOWN_FORM','未照合の種族・フォームがあります：'+unique.slice(0,8).join('・'));
  }
  if(options.sha256!==undefined&&
    (typeof options.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(options.sha256)))
   throw fail('HASH','入力ファイルのSHA-256形式が不正です。');
  const targets=[...selection.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja'))
   .map(x=>Object.freeze({name:x.name,id:x.id,type:x.type}));
  const source=Object.freeze({
   individualCount:parsed.items.length,
   speciesFormCount:targets.length,
   // Existing E7 parser embeds the upstream CSV format revision. It is NOT
   // evidence that the numeric game-data profile has been verified.
   csvAdapterCommit:typeof parsed.upstreamCommit==='string'?parsed.upstreamCommit:null,
   sha256:options.sha256?.toLowerCase()||null
  });
  return Object.freeze({
   version:VERSION,
   state:'DRAFT_UNVERIFIED_GAME_DATA',
   targets:Object.freeze(targets),
   source,
   // No "supported=true" here. Numeric and legality oracles belong to F1-B.
   numericalCoverage:'NONE_VERIFIED'
  });
 }
 function evaluateIndividual(individual,scope,catalog){
  const byName=indexCatalog(catalog);
  const name=identity(individual?.pokemon);
  const found=byName.get(name);
  if(!found)return Object.freeze({identity:name||null,inScope:false,reason:'UNKNOWN_SPECIES_FORM',
    calculation:'BLOCKED'});
  const targets=Array.isArray(scope?.targets)?scope.targets:[];
  const authorized=targets.some(x=>identity(x?.name)===found.name&&x.id===found.id);
  return Object.freeze({identity:found.name,inScope:authorized,
   reason:authorized?'GAME_DATA_UNVERIFIED':'OUTSIDE_F1_SCOPE',
   calculation:'BLOCKED'});
 }
 return Object.freeze({VERSION,EXPECTED,identity,indexCatalog,buildScope,evaluateIndividual});
});

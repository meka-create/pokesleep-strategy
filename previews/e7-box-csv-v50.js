/* E7 v50 — fail-closed, header-addressed box CSV/TSV adapter.
 * Upstream reference: nitoyon/pokesleep-tool @965f5d7481cec52be9f407fc54f0dee43d30df9a
 * src/util/Formatter/{BoxExporter,BoxImporter}.ts and src/i18n/ja/IvCalc.json,data.json
 * E7 only stores literal source data; numerical gameplay mapping belongs to F1.
 */
(function (root, factory) {
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.E7BoxCsv=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const UPSTREAM_COMMIT='965f5d7481cec52be9f407fc54f0dee43d30df9a';
 const fields=['nickname','pokemon','level','skillLevel','ing1','ing2','ing3',
  'mainSkill','nature','mint','lv10','lv25','lv50','lv70','lv80','ribbon','shiny','favorite'];
 const aliases={
  nickname:['ニックネーム','nickname'],
  pokemon:['ポケモン','pokemon','pokémon'],
  level:['レベル','level'],
  skillLevel:['スキルレベル','skill level'],
  ing1:['食材1','ing 1','ingredient 1'],
  ing2:['食材2','ing 2','ingredient 2'],
  ing3:['食材3','ing 3','ingredient 3'],
  mainSkill:['メインスキル','main skill'],
  nature:['せいかく','nature'],
  mint:['まっしろミント','neutralizing mint','mint'],
  lv10:['lv10'],lv25:['lv25'],lv50:['lv50'],lv70:['lv70'],lv80:['lv80'],
  ribbon:['一緒に眠った時間','sleeping time shared','ribbon'],
  shiny:['色違い','shiny'],
  favorite:['お気に入り','favorite','favorites']
 };
 const required=['pokemon','level','skillLevel','ing1','ing2','ing3','nature',
  'lv10','lv25','lv50','lv70','lv80'];
 const clean=s=>String(s||'').normalize('NFKC').replace(/[\s\uFEFF]/g,'').toLowerCase();
 const aliasMap=new Map();
 for(const [key,names] of Object.entries(aliases))
  for(const name of names){const n=clean(name);if(aliasMap.has(n)&&aliasMap.get(n)!==key)throw Error('Alias collision');
   aliasMap.set(n,key);}
 const fail=(code,message)=>Object.assign(new Error(message),{code});
 function parseRows(input,delimiter=','){
  if(typeof input!=='string'||input.length>2_000_000)throw fail('SIZE','ファイルが大きすぎます（上限2MB）。');
  if(delimiter!==','&&delimiter!=='\t')throw fail('FORMAT','CSVまたはTSVだけ対応しています。');
  const text=input.replace(/^\uFEFF/,'');
  let rows=[],row=[],field='',quoted=false,closed=false;
  function finish(){row.push(field);field='';closed=false;}
  function endRow(){finish();if(row.some(v=>v.trim()!==''))rows.push(row);row=[];
   if(rows.length>10001)throw fail('SIZE','1万行を超えるファイルは扱えません。');}
  for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(quoted){
    if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
    else field+=ch;
    continue;
   }
   if(ch==='"'){if(field!==''||closed)throw fail('QUOTE','引用符の形式が不正です。');quoted=true;continue;}
   if(ch===delimiter){finish();continue;}
   if(ch==='\n'||ch==='\r'){
    if(ch==='\r'&&text[i+1]==='\n')i++;
    endRow();continue;
   }
   if(closed)throw fail('QUOTE','引用符の後に余分な文字があります。');
   field+=ch;
  }
  if(quoted)throw fail('QUOTE','閉じられていない引用符があります。');
  if(field!==''||row.length||closed)endRow();
  return rows;
 }
 function parseBox(text){
  const first=(String(text).replace(/^\uFEFF/,'').split(/\r?\n/).find(x=>x.trim())||'');
  // TSV, CSV with headers only; serialized custom IV strings are not interpreted as CSV.
  const delimiter=first.includes('\t')?'\t':',';
  const rows=parseRows(text,delimiter);
  if(rows.length<2)throw fail('EMPTY','見出しと1件以上の個体データが必要です。');
  const header=rows.shift();
  if(header.length<12||header.length>36)throw fail('HEADER','CSV列の構成を確認してください。');
  const index=new Map(),unknown=[];
  for(let i=0;i<header.length;i++){
   const key=aliasMap.get(clean(header[i]));
   if(!key){unknown.push(header[i]||'(空列)');continue;}
   if(index.has(key))throw fail('HEADER_DUP','同じ意味の見出しが重複しています：'+header[i]);
   index.set(key,i);
  }
  if(unknown.length)throw fail('HEADER_UNKNOWN','未対応の列があります：'+unknown.slice(0,4).join('・'));
  const missing=required.filter(key=>!index.has(key));
  if(missing.length)throw fail('HEADER_MISSING','必要な列がありません：'+missing.join('・'));
  const variant=header.length===18&&fields.every(k=>index.has(k))?'current18':'header-mapped-'+header.length;
  const items=[],errors=[];
  for(let r=0;r<rows.length;r++){
   const cells=rows[r],line=r+2;
   if(cells.length!==header.length){errors.push(line+'行目：列数が一致しません');continue;}
   const get=key=>index.has(key)?String(cells[index.get(key)]||'').trim():'';
   const obj={};for(const key of fields)obj[key]=index.has(key)?get(key):null;
   const level=Number(obj.level),skill=Number(obj.skillLevel);
   if(!obj.pokemon||obj.pokemon.length>160||obj.nickname?.length>160||
      !/^\d+$/.test(obj.level)||!Number.isInteger(level)||level<1||level>150||
      !/^\d+$/.test(obj.skillLevel)||!Number.isInteger(skill)||skill<1||skill>8||
      !obj.nature||obj.nature.length>80){
    errors.push(line+'行目：ポケモン・レベル・スキルレベル・せいかくを確認してください');continue;
   }
   const tooLong=['ing1','ing2','ing3','mainSkill','lv10','lv25','lv50','lv70','lv80','favorite']
    .some(k=>(obj[k]||'').length>250);
   const binaryBad=['mint','shiny'].some(k=>obj[k]!==null&&!['0','1','true','false',''].includes(obj[k].toLowerCase()));
   const ribbonBad=obj.ribbon!==null&&obj.ribbon!==''&&(!/^\d+$/.test(obj.ribbon)||Number(obj.ribbon)>100000);
   if(tooLong||binaryBad||ribbonBad){
    errors.push(line+'行目：食材・サブスキル・ミント・リボン等の値を確認してください');continue;
   }
   obj.level=level;obj.skillLevel=skill;
   // Missing optional columns remain null, never silently converted to false/zero.
   obj.mint=obj.mint===null||obj.mint===''?null:['1','true'].includes(obj.mint.toLowerCase());
   obj.shiny=obj.shiny===null||obj.shiny===''?null:['1','true'].includes(obj.shiny.toLowerCase());
   obj.ribbon=obj.ribbon===null||obj.ribbon===''?null:Number(obj.ribbon);
   items.push(obj);
  }
  if(items.length>10000)throw fail('SIZE','個体数の上限を超えています。');
  return {ok:errors.length===0,items:errors.length?[]:items,errors,variant,
   columns:[...index.keys()],header,delimiter:delimiter==='\t'?'tsv':'csv',
   upstreamCommit:UPSTREAM_COMMIT};
 }
 return Object.freeze({parseRows,parseBox,UPSTREAM_COMMIT});
});

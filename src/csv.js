/* CSV/TSV import adapter for pokesleep-tool's Japanese 16-column box export.
 * No 3rd-party code copied: format traced to nitoyon/pokesleep-tool
 * src/util/Formatter/BoxExporter.ts and BoxImporter.ts.
 */
(function (root) {
  'use strict';
  const FIELDS = ['nickname','pokemon','level','skillLevel','ingredient1','ingredient2','ingredient3','mainSkill','nature','lv10','lv25','lv50','lv70','lv80','sleepHours','shiny'];
  const ALIASES = [
    ['ニックネーム','nickname'], ['nickname','nickname'],
    ['ポケモン','pokemon'], ['pokemon','pokemon'], ['pokémon','pokemon'], ['種族','pokemon'],
    ['レベル','level'], ['level','level'],
    ['スキルレベル','skillLevel'], ['skill level','skillLevel'], ['スキルlv','skillLevel'],
    ['食材1','ingredient1'], ['ing 1','ingredient1'], ['ingredient 1','ingredient1'],
    ['食材2','ingredient2'], ['ing 2','ingredient2'], ['ingredient 2','ingredient2'],
    ['食材3','ingredient3'], ['ing 3','ingredient3'], ['ingredient 3','ingredient3'],
    ['メインスキル','mainSkill'], ['main skill','mainSkill'],
    ['せいかく','nature'], ['nature','nature'],
    ['lv10','lv10'], ['lv25','lv25'], ['lv50','lv50'], ['lv70','lv70'], ['lv80','lv80'],
    ['一緒に眠った時間','sleepHours'], ['睡眠時間','sleepHours'], ['sleeping time shared','sleepHours'], ['ribbon','sleepHours'],
    ['色違い','shiny'], ['shiny','shiny']
  ];
  const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[\s　_\-]/g,'');
  const ALIAS_MAP = new Map(ALIASES.map(([name,key])=>[norm(name),key]));

  function parseDelimited(text, delimiter) {
    if (typeof text !== 'string') throw new Error('テキストを読み込めません。');
    text = text.replace(/^\uFEFF/, '');
    const rows=[]; let row=[],field='',quoted=false,atStart=true;
    for (let i=0;i<text.length;i++) {
      const c=text[i];
      if (quoted) {
        if (c==='"' && text[i+1]==='"') {field+='"'; i++;}
        else if (c==='"') quoted=false;
        else field+=c;
      } else if (c==='"' && atStart) { quoted=true; atStart=false; }
      else if (c===delimiter) {row.push(field);field='';atStart=true;}
      else if (c==='\n'||c==='\r') {
        if(c==='\r'&&text[i+1]==='\n')i++;
        row.push(field); if(row.some(v=>v.trim()!=='')) rows.push(row);
        row=[];field='';atStart=true;
      } else {field+=c;atStart=false;}
    }
    if(quoted) throw new Error('CSV内の引用符が閉じられていません。');
    row.push(field); if(row.some(v=>v.trim()!==''))rows.push(row);
    return rows;
  }
  function parseBoxText(text) {
    const first=String(text).replace(/^\uFEFF/,'').split(/\r?\n/,1)[0];
    const delimiter=first.includes('\t')?'\t':',';
    const rows=parseDelimited(text,delimiter);
    if(rows.length<2)throw new Error('見出しと1件以上のポケモン行を含むCSV/TSVを指定してください。');
    const header=rows[0];
    if(header.length!==16)throw new Error(`ヘッダー列数が${header.length}列です。pokesleep-toolの16列CSV/TSVを指定してください。`);
    const cols=new Map();
    header.forEach((h,i)=>{const key=ALIAS_MAP.get(norm(h));if(key && !cols.has(key))cols.set(key,i);});
    const missing=FIELDS.filter(f=>!cols.has(f));
    if(missing.length)throw new Error(`pokesleep-tool互換の見出しを確認できません。未認識: ${missing.join(' / ')}`);
    const items=[],errors=[];
    for(let i=1;i<rows.length;i++) {
      const r=rows[i];const line=i+1;
      if(r.length!==header.length){errors.push(`${line}行目: ${r.length}列（16列必要）`);continue;}
      const get=k=>(r[cols.get(k)]??'').trim();
      const pokemon=get('pokemon'); const level=Number(get('level'));const skillLevel=Number(get('skillLevel'));
      if(!pokemon){errors.push(`${line}行目: ポケモン名が空です`);continue;}
      if(!Number.isInteger(level)||level<1||level>100){errors.push(`${line}行目: レベルが不正です`);continue;}
      if(!Number.isInteger(skillLevel)||skillLevel<1||skillLevel>20){errors.push(`${line}行目: スキルレベルが不正です`);continue;}
      const sleepHoursRaw=get('sleepHours');
      if(sleepHoursRaw && (!Number.isFinite(Number(sleepHoursRaw))||Number(sleepHoursRaw)<0)){errors.push(`${line}行目: 一緒に眠った時間が不正です`);continue;}
      items.push({id:`p-${i}`,nickname:get('nickname'),pokemon,level,skillLevel,
        ingredients:[get('ingredient1'),get('ingredient2'),get('ingredient3')],
        mainSkill:get('mainSkill'),nature:get('nature'),
        subskills:[get('lv10'),get('lv25'),get('lv50'),get('lv70'),get('lv80')],
        sleepHours:sleepHoursRaw===''?null:Number(sleepHoursRaw),
        shiny:['1','true','はい','yes'].includes(get('shiny').toLowerCase()),sourceRow:line});
    }
    // All-or-nothing import: never silently replace the box with a partial parse.
    if(errors.length)throw new Error(`${errors.length}行に問題があります。既存ボックスは変更していません。\n${errors.slice(0,8).join('\n')}${errors.length>8?'\nほか'+(errors.length-8)+'行':''}`);
    if(!items.length)throw new Error('読み込めるポケモンがありません。');
    return {items,format:delimiter==='\t'?'TSV':'CSV',headers:header};
  }
  const api={parseDelimited,parseBoxText,FIELDS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PokeCsv=api;
})(typeof globalThis!=='undefined'?globalThis:this);

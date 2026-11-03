"""U2/U3 v25 regression audit: immutable originals, internal links, icons, semantics."""
from pathlib import Path
import base64
import hashlib
import re
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'previews'
U2_V23='U2_Prep_Local_Ingredients_20261103.html'
U3_V23='U3_Strategy_UI_20261103.html'
U3_V24='U3_Strategy_UI_20261104_v24.html'
U2_V25='U2_Prep_Local_Ingredients_20261104_v25.html'
U3_V25='U3_Strategy_UI_20261104_v25.html'

def blob_sha(raw):
 return hashlib.sha1(b'blob '+str(len(raw)).encode('ascii')+b'\0'+raw).hexdigest()

class V25Audit(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.text={name:(BASE/name).read_text(encoding='utf8') for name in (U2_V23,U3_V23,U3_V24,U2_V25,U3_V25)}
  cls.raw={name:(BASE/name).read_bytes() for name in cls.text}

 def test_historical_goldens_untouched(self):
  for name,sha in (
      (U2_V23,'5472d3883bb4d90744fc10b3889cde7f2f009061'),
      (U3_V23,'bf9a79feb072d8ddf92737ebe34053361adc0abf'),
      (U3_V24,'ac4770f3030455868d8016c486ea790ecbd1df1b')):
   with self.subTest(name=name):self.assertEqual(blob_sha(self.raw[name]),sha)

 def test_u2_only_link_delta(self):
  self.assertEqual(self.text[U2_V25], self.text[U2_V23].replace(
    "new URL('U3_Strategy_UI_20261103.html',location.href)",
    "new URL('U3_Strategy_UI_20261104_v25.html',location.href)"))

 def test_link_coherence(self):
  u2=self.text[U2_V25];u3=self.text[U3_V25]
  self.assertIn("new URL('U3_Strategy_UI_20261104_v25.html',location.href)",u2)
  self.assertIn("new URL('U2_Prep_Local_Ingredients_20261104_v25.html',base)",u3)
  self.assertNotIn('U2_Prep_Local_Ingredients_20261103.html',u3)
  for name in (U2_V25,U3_V25): self.assertTrue((BASE/name).is_file())

 def test_images_and_critical_v23_contracts(self):
  v23=self.text[U3_V23];v25=self.text[U3_V25]
  imgs=lambda s:re.findall(r'data:image/png;base64,[A-Za-z0-9+/=]+',s)
  self.assertEqual(imgs(v23),imgs(v25))
  self.assertEqual(len(imgs(v25)),19)
  self.assertTrue(all(len(base64.b64decode(img.split(',',1)[1]))>100 for img in imgs(v25)))
  for marker in (
   'id="stock-gate"','id="resume-draft"','id="repropose"','id="inventory-notice"',
   'id="review-dialog"','id="review-adopt"','id="review-cancel"','id="week-content"',
   'id="auto-sleep"','id="sleep-dialog"','id="sleep-open"','id="sleep-day-nav"',
   'function normalizeInventory(item)','function refreshInventory()',
   'function storeState()','function restoreState(week,resetIfMissing=false)',
   'function syncEventControls()','function persistEventWeek()',
   "className='iv-nature-pill'",".iv-skill.locked{opacity:.64}",
   "className='iv-ingredient-quantity'",'実ゲームの最適化計算は未接続',
   'if(changed&&oldStart!==next.start)storeState();'
  ):
   with self.subTest(marker=marker): self.assertIn(marker,v25)
  for forbidden in ('id="stock-dialog"','id="stock-open"','id="view-tabs"'):
   self.assertNotIn(forbidden,v25)

 def test_v25_gate_and_safety(self):
  s=self.text[U3_V25]
  for item in (
    "let eventInfo={start:initialEventStart(),field:'',food:'',camp:false};",
    "if(next.field===eventInfo.field)next.field='';",
    "if(next.food===eventInfo.food)next.food='';",
    "if(eventInfo.field==='ワカクサ本島'",
    'const blockers=eventBlockers(),canPropose=',
    "const blockers=eventBlockers();",
    "JSON.stringify(stockPending)!==JSON.stringify(importedStock)",
    "$('#resume-draft').disabled=phase==='ended'||!canPropose",
    "if(!$('#event-source-apply').hidden)",
    "pendingEventSource=null;",
  ):self.assertIn(item,s)
  self.assertEqual(s.count('id="auto-sleep"'),1)
  self.assertEqual(s.count('id="event-source-fetch"'),1)
  self.assertEqual(s.count('id="event-gate"'),1)

 def test_js_grammar(self):
  for name in (U2_V25,U3_V25):
   with self.subTest(name=name):
    scripts=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',self.text[name],re.S)
    self.assertTrue(scripts)
    with tempfile.TemporaryDirectory() as tmp:
     for i,script in enumerate(scripts):
      f=Path(tmp)/f's{i}.js';f.write_text(script,encoding='utf8')
      subprocess.run(['node','--check',str(f)],check=True,capture_output=True,text=True)

if __name__=='__main__': unittest.main()

"""U2/U3 v23 zero-regression gate for additive U3 v24 preview."""
from pathlib import Path
import hashlib
import re
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
PREVIEWS=ROOT/"previews"

def git_blob_sha(data):
 return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()

class U3V24NoRegression(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.u2_bytes=(PREVIEWS/"U2_Prep_Local_Ingredients_20261103.html").read_bytes()
  cls.u3_bytes=(PREVIEWS/"U3_Strategy_UI_20261103.html").read_bytes()
  cls.v23=cls.u3_bytes.decode("utf-8")
  cls.v24=(PREVIEWS/"U3_Strategy_UI_20261104_v24.html").read_text(encoding="utf-8")

 def test_pin_original_v23_without_any_mutation(self):
  self.assertEqual(git_blob_sha(self.u2_bytes),"5472d3883bb4d90744fc10b3889cde7f2f009061")
  self.assertEqual(git_blob_sha(self.u3_bytes),"bf9a79feb072d8ddf92737ebe34053361adc0abf")

 def test_preserve_all_original_ingredient_image_bytes(self):
  regex=r'data:image/png;base64,[a-zA-Z0-9+/=]+'
  self.assertEqual(re.findall(regex,self.v24),re.findall(regex,self.v23))
  self.assertEqual(len(re.findall(regex,self.v24)),19)

 def test_v23_functions_and_ui_in_v24(self):
  keep=(
   'id="stock-gate"','id="resume-draft"','id="repropose"','id="inventory-notice"',
   'id="review-dialog"','id="review-adopt"','id="review-cancel"','id="week-content"',
   'id="auto-sleep"','id="sleep-dialog"','id="sleep-open"','id="sleep-day-nav"',
   'function normalizeInventory(item)','function refreshInventory()',
   'function storeState()','function restoreState(week,resetIfMissing=false)',
   'function syncEventControls()','function persistEventWeek()',
   'const activePlan=hasApplied&&appliedEventStart===eventInfo.start;',
   "className='iv-nature-pill'",".iv-skill.locked{opacity:.64}",
   "className='iv-ingredient-quantity'",'実ゲームの最適化計算は未接続',
   'if(changed&&oldStart!==next.start)storeState();',
   'U2_Prep_Local_Ingredients_20261103.html',
   "localStorage.setItem(strategyKey(eventInfo.start)"
  )
  for marker in keep:
   with self.subTest(marker=marker):
    self.assertIn(marker,self.v24)
  for forbidden in ('id="stock-dialog"','id="stock-open"','id="view-tabs"'):
   self.assertNotIn(forbidden,self.v24)

 def test_v24_only_adds_event_source_and_interlock(self):
  for marker in ('id="event-source-fetch"','id="event-source-select"',
                 'id="event-source-apply"','id="event-gate"',
                 'function eventBlockers()','function showProposal(stock=null)',
                 'const pendingCondition=activePlan',
                 "未確定（備蓄のみ）",
                 "if(eventInfo.field&&/EX$/.test(eventInfo.field))",
                 "pendingEventSource=null;"):
   self.assertIn(marker,self.v24)
  self.assertIn("refreshInventory();const blockers=eventBlockers();",self.v24)
  self.assertEqual(self.v24.count('id="event-source-fetch"'),1)
  self.assertEqual(self.v24.count('id="auto-sleep"'),1)
  self.assertEqual(self.v24.count('id="stock-gate"'),1)

 def test_preview_js_compiles(self):
  scripts=re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',self.v24,re.S)
  self.assertTrue(scripts)
  with tempfile.TemporaryDirectory() as d:
   for i,script in enumerate(scripts):
    p=Path(d)/f"v24-{i}.js";p.write_text(script,encoding="utf-8")
    subprocess.run(["node","--check",str(p)],check=True,capture_output=True,text=True)

if __name__=="__main__":
 unittest.main()

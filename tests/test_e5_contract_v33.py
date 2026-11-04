"""E5 independent source/UI regression guard for the audited v33 pair."""
from pathlib import Path
import unittest,re,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/"previews"
E4U2=(P/"U2_Prep_Local_Ingredients_20261105_v32.html").read_text()
E4U3=(P/"U3_Strategy_UI_20261105_v32.html").read_text()
U2=(P/"U2_Prep_Local_Ingredients_20261105_v33.html").read_text()
U3=(P/"U3_Strategy_UI_20261105_v33.html").read_text()
class E5Integrity(unittest.TestCase):
 def test_u2_same_ui_as_frozen_e4(self):
  self.assertEqual(U2.replace("U3_Strategy_UI_20261105_v33.html",
   "U3_Strategy_UI_20261105_v32.html"),E4U2)
  self.assertIn("U3_Strategy_UI_20261105_v33.html",U2)
  self.assertIn("U2_Prep_Local_Ingredients_20261105_v33.html",U3)
 def test_one_conditions_form_and_one_primary(self):
  self.assertEqual(U3.count('id="event-details"'),1)
  self.assertEqual(U3.count('id="e3-primary"'),1)
  self.assertEqual(U3.count('id="e3-next"'),1)
  self.assertIn("RESUME_DRAFT:'未採用の提案を確認'",U3)
  self.assertIn("draft&&e4DraftIsCurrent()",U3)
  self.assertIn("const unsaved=eventBlockers().includes('イベント条件の保存')",U3)
  self.assertIn("const conditions=confirmed?{...confirmed,dirty:unsaved}:null",U3)
 def test_invariants_and_regression_against_e4(self):
  for old in ("function e4DraftIsCurrent()", "const previous={applied,hasApplied",
   "function currentEventGameDayIndex(", "if(slot!=='sleep'", "e3ConditionKey",
   "E1.confirmEventConditions", "function refreshInventory()", "showProposal("):
   self.assertIn(old,E4U3)
   self.assertIn(old,U3)
  self.assertIn("stockPending=clone(importedStock)",U3)
  self.assertIn("dateFor(7)+'T04:00'",U3)
  self.assertNotIn('id="recipe-editor"',U3)
  self.assertNotIn('id="recipe-choice"',U3)
  self.assertNotIn('id="daytime-change"',U3)
  self.assertEqual(U3.count('id="sleep-dialog"'),1)
  self.assertEqual(U3.count('id="review-dialog"'),1)
  self.assertEqual(U3.count('id="event-start"'),1)
 def test_scripts_compile(self):
  for source in (U2,U3):
   scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",source,re.S)
   self.assertEqual(len(scripts),1)
   with tempfile.NamedTemporaryFile(mode="w",suffix=".js") as fp:
    fp.write("\n".join(scripts));fp.flush()
    subprocess.run(["node","--check",fp.name],capture_output=True,text=True,check=True)
if __name__=="__main__":unittest.main()

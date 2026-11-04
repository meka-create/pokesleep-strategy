"""E4 v32 static audit: frozen E3, no day/meal editing, E1 and safe save semantics."""
from pathlib import Path
import unittest,re,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/"previews"
OLD2=(P/"U2_Prep_Local_Ingredients_20261105_v31.html").read_text()
NEW2=(P/"U2_Prep_Local_Ingredients_20261105_v32.html").read_text()
OLD3=(P/"U3_Strategy_UI_20261105_v31.html").read_text()
NEW3=(P/"U3_Strategy_UI_20261105_v32.html").read_text()
class E4(unittest.TestCase):
 def test_frozen_e3_u2(self):
  self.assertEqual(NEW2.replace("U3_Strategy_UI_20261105_v32.html",
   "U3_Strategy_UI_20261105_v31.html"),OLD2)
 def test_today_first_and_no_mock_energy(self):
  for val in ("今日の作戦","e4-result-energy","hidden aria-hidden=\"true\"",
   "e4-changed","e3-update-stock","#week-content .slot[data-slot=\"sleep\"]",
   "hasFutureSlot()","state.phase==='ENDED'"):
   self.assertIn(val,NEW3)
 def test_sleep_and_replan_guard(self):
  for val in ("e4DraftIsCurrent","inventoryFingerprint","manualSleepFingerprint",
   "stockPending=clone(importedStock)","JSON.stringify(arrangeHealers(team))",
   "draft.e4Basis", "const previous={applied,hasApplied", "if(!storeState())"):
   self.assertIn(val,NEW3,val)
  self.assertIn("if(slot!=='sleep'",NEW3)
  self.assertNotIn('id="recipe-editor"',NEW3)
  self.assertNotIn('id="recipe-choice"',NEW3)
 def test_jst_rollover_and_finish(self):
  self.assertIn("dateFor(7)+'T04:00'",NEW3)
  self.assertNotIn("dateFor(7)+'T04:00'||remainingSlots()===0",NEW3)
  self.assertIn("currentEventGameDayIndex()",NEW3)
  self.assertIn("if(event.persisted)selectDayOnOpen()",NEW3)
 def test_node_syntax(self):
  for source in (NEW2,NEW3):
   scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",source,re.S)
   self.assertTrue(scripts)
   with tempfile.NamedTemporaryFile(mode="w",suffix=".js") as f:
    f.write("\n".join(scripts));f.flush()
    subprocess.run(["node","--check",f.name],check=True,capture_output=True,text=True)
if __name__=="__main__":unittest.main()

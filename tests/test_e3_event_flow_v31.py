"""E3 v31 static safety checks, Node syntax and frozen UI contracts."""
from pathlib import Path
import re,subprocess,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/"previews"
U3=(P/"U3_Strategy_UI_20261105_v31.html").read_text()
U2=(P/"U2_Prep_Local_Ingredients_20261105_v31.html").read_text()
E1=(ROOT/"src/ux-phase-state.js").read_text()
class TestE3(unittest.TestCase):
 def test_shared_e1_exact_source(self):
  model=re.sub(r"\\bexport\\s+(?=(?:const|function)\\b)","",E1)
  self.assertIn("const E1=(()=>{"+model,U3)
 def test_explicit_selection_and_separation(self):
  for term in ("E3_SELECTED_KEY","if(!e3Selected)return","e3ConditionKey",
    "E1.stageConditionEdits","E1.confirmEventConditions","getPrimaryViewState",
    "e3Selected.id","e3-primary","e3-next","eventId"):
   self.assertIn(term,U3,term)
  self.assertNotIn("localStorage.setItem(EVENT_WEEK_KEY",U3)
  self.assertNotIn("const saved=localStorage.getItem(EVENT_WEEK_KEY)",U3)
 def test_u2_return_and_event_ownership(self):
  self.assertIn("U3_Strategy_UI_20261105_v31.html",U2)
  self.assertIn("U2_Prep_Local_Ingredients_20261105_v31.html",U3)
  self.assertIn("if(validEventId)updated.eventId=selectedEventId",U2)
  self.assertIn("item?.eventId!==e3Selected.id",U3)
  self.assertIn("raw?.eventId||null",U3)
 def test_disallowed_editing_absent(self):
  self.assertNotIn('id="recipe-editor"',U3)
  self.assertNotIn('id="recipe-choice"',U3)
  self.assertIn("if(slot!=='sleep'",U3)
  self.assertIn("SLOT_KEYS.forEach",U3)
 def test_javascript_syntax(self):
  for source in (U2,U3):
   scripts=re.findall(r"<script(?:\\s[^>]*)?>(.*?)</script>",source,re.S)
   self.assertTrue(scripts)
   with tempfile.NamedTemporaryFile(mode="w",suffix=".js") as tmp:
    tmp.write("\\n".join(scripts));tmp.flush()
    subprocess.run(["node","--check",tmp.name],check=True,capture_output=True,text=True)
if __name__=="__main__":unittest.main()

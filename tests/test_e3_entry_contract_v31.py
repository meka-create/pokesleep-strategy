"""E3 code and frozen baseline contracts; no Android UX acceptance implied."""
from pathlib import Path
import re,hashlib,subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1];P=R/"previews"
def git_blob(data):return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
class E3Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.u2=(P/"U2_Prep_Local_Ingredients_20261104_v31.html").read_text()
  cls.u3=(P/"U3_Strategy_UI_20261104_v31.html").read_text()
 def test_frozen_v29_originals(self):
  self.assertEqual(git_blob((P/"U2_Prep_Local_Ingredients_20261104_v29.html").read_bytes()),"9857040cc46cd0269b8261e779c3b2da24d897d9")
  self.assertEqual(git_blob((P/"U3_Strategy_UI_20261104_v29.html").read_bytes()),"6f258db5f053641ab0b31b37addcce80e8cfd31a")
 def test_E3_uses_exact_E1_model_without_copy_fork(self):
  original=(R/"src/ux-phase-state.js").read_text().replace("export const ","const ").replace("export function ","function ")
  self.assertIn(original,self.u3)
  self.assertIn(original,self.u2)
 def test_u2_19_icons_and_tabs_unchanged(self):
  self.assertEqual(self.u2.count("data:image/png;base64,"),38)
  self.assertEqual(len(re.findall(r'<input\b[^>]*data-key=',self.u2)),19)
  for tag in ("id=\"btn-goal\"","id=\"btn-inventory\"","id=\"prep-skill-open\""):
   self.assertIn(tag,self.u2)
 def test_single_event_condition_form_and_one_primary_button(self):
  self.assertEqual(self.u3.count('id="event-details"'),1)
  self.assertEqual(self.u3.count('id="event-save"'),1)
  self.assertEqual(self.u3.count('id="e3-primary"'),1)
  self.assertIn("const E3_SELECTED_KEY=",self.u3)
  self.assertIn("return {PHASE,PRIMARY_ACTION,INGREDIENT_NAMES",self.u3)
  self.assertIn("E1.getPrimaryViewState(",self.u3)
  self.assertIn("E1.confirmEventConditions(",self.u3)
  self.assertNotIn("return DEFAULT_EVENT_WEEK",self.u3)
  self.assertNotIn('id="event-start" type="date" value="2026-11-09"',self.u3)
 def test_event_identity_and_storage_isolation(self):
  self.assertIn("pokesleep-strategy-u3-e3-v1:",self.u3)
  self.assertIn("pokesleep-strategy-u2-e3-v1:",self.u2)
  self.assertIn("pokesleep-strategy-u2-e3-v1:",self.u3)
  self.assertIn("packet.version!==4",self.u3)
  self.assertIn("packet.eventId!==selectedEvent.id",self.u3)
  self.assertIn("value.eventId===eventId",self.u2)
  self.assertIn("version:4,weekStart:week,eventId,timeline:validated",self.u2)
  self.assertNotIn("localStorage.setItem(EVENT_WEEK_KEY",self.u3)
 def test_draft_and_adopt_revisions_and_rollback(self):
  self.assertIn("state.canAdoptDraft",self.u3)
  self.assertIn("conditionsRevision:draftMeta.conditionsRevision",self.u3)
  self.assertIn("inventoryRevision:draftMeta.inventoryRevision",self.u3)
  self.assertIn("if(!storeState()){",self.u3)
  self.assertIn("applied=previous.applied;",self.u3)
  self.assertIn("currentInventory",self.u2)
 def test_no_deprecated_manual_day_and_meal_editors(self):
  for forbidden in ('id="recipe-editor"','id="recipe-choice"','id="edit-meal"',
    "運用中／提案の切替","id=\"day-edit\""):
   self.assertNotIn(forbidden,self.u3)
  self.assertIn("if(slot!=='sleep'",self.u3)
  self.assertIn("sleep-copy",self.u3)
  self.assertIn("currentEventGameDayIndex",self.u3)
 def test_Javascript_syntax(self):
  for text in (self.u2,self.u3):
   scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",text,re.S)
   self.assertEqual(len(scripts),1)
   with tempfile.TemporaryDirectory() as temp:
    p=Path(temp)/"test.js";p.write_text(scripts[0])
    subprocess.run(["node","--check",str(p)],check=True,capture_output=True)
if __name__=="__main__":unittest.main()

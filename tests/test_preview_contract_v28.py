"""U3-B immutable v27 base plus JST 04:00 event-weekday contract."""
import hashlib
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]/"previews"
U2_27="U2_Prep_Local_Ingredients_20261104_v27.html"
U3_27="U3_Strategy_UI_20261104_v27.html"
U2_28="U2_Prep_Local_Ingredients_20261104_v28.html"
U3_28="U3_Strategy_UI_20261104_v28.html"
def sha(raw):
 return hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()

class U3BContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.a=(BASE/U2_27).read_text(encoding="utf8")
  cls.b=(BASE/U3_27).read_text(encoding="utf8")
  cls.c=(BASE/U2_28).read_text(encoding="utf8")
  cls.d=(BASE/U3_28).read_text(encoding="utf8")

 def test_frozen_v27_goldens(self):
  self.assertEqual(sha((BASE/U2_27).read_bytes()),"dc6688b690e4d8e8f6deef16fef3e98d8a01aad4")
  self.assertEqual(sha((BASE/U3_27).read_bytes()),"90c7e3acb8b94df13c305763db445ba8747726a7")

 def test_u2_only_changes_u3_bridge(self):
  self.assertEqual(self.c,self.a.replace("new URL('U3_Strategy_UI_20261104_v27.html',location.href)",
    "new URL('U3_Strategy_UI_20261104_v28.html',location.href)"))
  self.assertNotIn("U2_Prep_Local_Ingredients_20261104_v27.html",self.d)
  self.assertEqual(self.d.count("U2_Prep_Local_Ingredients_20261104_v28.html"),4)

 def test_all_icons_ui_and_v27_layout_retained(self):
  images=lambda s:re.findall(r"data:image/png;base64,[A-Za-z0-9+/=]+",s)
  self.assertEqual(images(self.b),images(self.d))
  self.assertEqual(len(images(self.d)),19)
  for marker in ("id=\"phase-intro\"","function arrangePhaseLayout(phase,activePlan,blockers)",
    "id=\"event-details\"","id=\"week-content\"","id=\"stock-gate\"",
    "id=\"auto-sleep\"","id=\"sleep-change\"","id=\"sleep-copy\"",
    "id=\"sleep-dialog\"","id=\"review-adopt\"","id=\"repropose\"",
    "function storeState()","function restoreState(week,resetIfMissing=false)",
    "function eventBlockers()","function firstFutureDay()","function renderSlots(container,plan,dayIndex){",
    "if(slot!=='sleep'||isPastSlot(day,'sleep')"):
   with self.subTest(marker=marker):self.assertIn(marker,self.d)
  for rejected in ("id=\"stock-dialog\"","id=\"view-tabs\"","id=\"daytime-edit\""):
   self.assertNotIn(rejected,self.d)

 def test_initial_selection_and_interaction_guards(self):
  s=self.d
  for marker in ("function currentEventGameDayIndex(week=eventInfo.start,clock=nowInJapan()){",
    "if(clock.slice(11,16)<'04:00')date.setUTCDate(date.getUTCDate()-1)",
    "function selectDayOnOpen(){",
    "selectDayOnOpen();",
    "if(day!==null){selectedDay=day;return;}",
    "if(nowInJapan()<eventInfo.start+'T04:00')selectedDay=0;",
    "if(event.persisted)selectDayOnOpen();",
    "selectedDay=currentEventGameDayIndex()??firstFutureDay();",
    "selectDayOnOpen(); // Selecting a different event is a new week-view opening.",
    "day=>{selectedDay=day;render();}"):
   self.assertIn(marker,s)
  # U3-B must not reset the chosen weekday during routine render().
  render=s[s.index("function render(){"):s.index("function makeDayButton(")]
  self.assertNotIn("selectDayOnOpen()",render)
  self.assertNotIn("selectedDay=currentEventGameDayIndex",render)

 def test_js_syntax(self):
  scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",self.d,re.S)
  self.assertEqual(len(scripts),1)
  with tempfile.TemporaryDirectory() as d:
   file=Path(d)/"v28.js";file.write_text(scripts[0],encoding="utf8")
   subprocess.run(["node","--check",str(file)],check=True,capture_output=True,text=True)

if __name__=="__main__":unittest.main()

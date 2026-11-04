"""U3-C immutable v28 source + safety fixes + no-regression contract."""
from pathlib import Path
import hashlib,re,subprocess,tempfile,unittest

P=Path(__file__).resolve().parents[1]/"previews"
V28U2="U2_Prep_Local_Ingredients_20261104_v28.html"
V28U3="U3_Strategy_UI_20261104_v28.html"
V29U2="U2_Prep_Local_Ingredients_20261104_v29.html"
V29U3="U3_Strategy_UI_20261104_v29.html"
def gitsha(b): return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()

class V29Audit(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.old2=(P/V28U2).read_text(encoding="utf8")
  cls.old3=(P/V28U3).read_text(encoding="utf8")
  cls.u2=(P/V29U2).read_text(encoding="utf8")
  cls.u3=(P/V29U3).read_text(encoding="utf8")

 def test_pin_approved_v28_sources(self):
  self.assertEqual(gitsha((P/V28U2).read_bytes()),"15e791713b742481f134a8659dde315ffe7f61e0")
  self.assertEqual(gitsha((P/V28U3).read_bytes()),"9b882626fd41a15e0aae3ded63a71f36da5f4e4b")

 def test_u2_only_link_changed(self):
  self.assertEqual(self.u2,self.old2.replace(
   "new URL('U3_Strategy_UI_20261104_v28.html',location.href)",
   "new URL('U3_Strategy_UI_20261104_v29.html',location.href)"))
  self.assertNotIn("U2_Prep_Local_Ingredients_20261104_v28.html",self.u3)
  self.assertEqual(self.u3.count("U2_Prep_Local_Ingredients_20261104_v29.html"),4)

 def test_images_and_v28_features_preserved(self):
  pictures=lambda s:re.findall(r"data:image/png;base64,[A-Za-z0-9+/=]+",s)
  self.assertEqual(pictures(self.old3),pictures(self.u3))
  self.assertEqual(len(pictures(self.u3)),19)
  for mark in (
   "id=\"phase-intro\"","function arrangePhaseLayout(phase,activePlan,blockers)",
   "function currentEventGameDayIndex(week=eventInfo.start,clock=nowInJapan()){",
   "id=\"week-content\"","id=\"day-nav\"","id=\"sleep-dialog\"",
   "id=\"auto-sleep\"","id=\"sleep-copy\"","id=\"sleep-change\"",
   "id=\"review-dialog\"","id=\"review-adopt\"","id=\"repropose\"",
   "id=\"stock-gate\"","id=\"event-gate\"","id=\"event-source-fetch\"",
   "function restoreState(week,resetIfMissing=false)","function storeState()",
   "function eventBlockers()","function renderSlots(container,plan,dayIndex){",
   "localizeEventName('meal prep week vol1')","function validPlan(plan){"
  ):
   with self.subTest(marker=mark):self.assertIn(mark,self.u3)
  for rejected in ('id="view-tabs"','id="stock-dialog"','id="daytime-edit"'):
   self.assertNotIn(rejected,self.u3)

 def test_pre_event_gate_and_adoption_revalidation(self):
  s=self.u3
  self.assertIn("canPropose=phase==='during'&&hasInventory&&blockers.length===0",s)
  self.assertIn("$('#resume-draft').disabled=!canPropose;",s)
  self.assertEqual(s.count("if(eventPhase()!=='during'||!hasInventory||blockers.length)"),3)
  self.assertIn("const phaseGate=phase==='before'",s)
  self.assertIn("function staleSleepProposal(){",s)
  self.assertEqual(s.count("if(staleSleepProposal()){"),2)
  self.assertIn("if(draft.autoSleep!==switchOn('auto-sleep'))return true;",s)
  self.assertIn("JSON.stringify(arrangeHealers(draft.days[day].sleep))",s)
  self.assertIn("if(!hasApplied||appliedEventStart!==eventInfo.start){",s)
  self.assertIn("next.unknownPast.push({day:d,slot});",s)

 def test_javascript_syntax(self):
  scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",self.u3,re.S)
  self.assertEqual(len(scripts),1)
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/"main.js"
   f.write_text(scripts[0],encoding="utf8")
   subprocess.run(["node","--check",str(f)],check=True,capture_output=True,text=True)
if __name__=="__main__":unittest.main()

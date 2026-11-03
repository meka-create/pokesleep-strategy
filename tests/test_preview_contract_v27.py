"""U3-A v27: stage-based screen priority without resurrecting daytime edits."""
from pathlib import Path
import hashlib, re, subprocess, tempfile, unittest

PREVIEWS=Path(__file__).resolve().parents[1]/"previews"
V26_U2="U2_Prep_Local_Ingredients_20261104_v26.html"
V26_U3="U3_Strategy_UI_20261104_v26.html"
V27_U2="U2_Prep_Local_Ingredients_20261104_v27.html"
V27_U3="U3_Strategy_UI_20261104_v27.html"

def sha(data):
 return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()

class U3AContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.old2=(PREVIEWS/V26_U2).read_text(encoding="utf8")
  cls.old3=(PREVIEWS/V26_U3).read_text(encoding="utf8")
  cls.new2=(PREVIEWS/V27_U2).read_text(encoding="utf8")
  cls.new3=(PREVIEWS/V27_U3).read_text(encoding="utf8")

 def test_latest_v26_immutable_sources(self):
  self.assertEqual(sha((PREVIEWS/V26_U2).read_bytes()),"f15e0f97656b9bbc6b4dafeed818ecfed543377d")
  self.assertEqual(sha((PREVIEWS/V26_U3).read_bytes()),"c382275084063c72823fb4182c338fdfe350e78b")

 def test_u2_bridge_only_changes_navigation_to_v27(self):
  self.assertEqual(self.new2,self.old2.replace(
    "new URL('U3_Strategy_UI_20261104_v26.html',location.href)",
    "new URL('U3_Strategy_UI_20261104_v27.html',location.href)"))
  self.assertEqual(self.new3.count("U2_Prep_Local_Ingredients_20261104_v27.html"),4)
  self.assertNotIn("U2_Prep_Local_Ingredients_20261104_v26.html",self.new3)
  self.assertTrue((PREVIEWS/V27_U2).exists())
  self.assertTrue((PREVIEWS/V27_U3).exists())

 def test_keep_19_icons_and_contracts(self):
  images=lambda s:re.findall(r"data:image/png;base64,[A-Za-z0-9+/=]+",s)
  self.assertEqual(images(self.old3),images(self.new3))
  self.assertEqual(len(images(self.new3)),19)
  for marker in (
   'id="auto-sleep"','id="sleep-open"','id="sleep-change"',
   'id="sleep-copy"','id="sleep-dialog"',
   'id="event-gate"','id="stock-gate"',
   'id="event-source-fetch"','id="event-source-apply"',
   'id="review-dialog"','id="review-adopt"','id="resume-draft"',
   'id="week-content"','id="day-nav"','id="repropose"',
   "function restoreState(week,resetIfMissing=false)",
   'function storeState()',
   'function eventBlockers()',
   "if(slot!=='sleep'||isPastSlot(day,'sleep')",
   "localizeEventName('meal prep week vol1')"
  ):
   with self.subTest(marker=marker):self.assertIn(marker,self.new3)
  for old in ('id="view-tabs"','id="stock-dialog"','id="stock-open"','id="daytime-edit"'):
   self.assertNotIn(old,self.new3)

 def test_stage_layout_guards_and_native_dom_priority(self):
  s=self.new3
  for marker in (
   'id="phase-intro"','id="phase-intro-title"','id="phase-intro-u2"',
   'let visiblePhaseStage=null',
   'function arrangePhaseLayout(phase,activePlan,blockers)',
   "phase==='before'?'preparation'",
   "phase==='ended'?'ended':activePlan?'active':'start'",
   "main.dataset.phaseStage=stage",
   "stage==='preparation'",
   "[intro,conditions,sleep,actions,week]",
   "[conditions,actions,sleep,week,intro]",
   "[week,sleep,actions,conditions,intro]",
   "for(const node of nodes)main.appendChild(node)",
   "if(stage==='start')conditions.open=blockers.length>0;",
   "visiblePhaseStage=stage",
   "arrangePhaseLayout(phase,activePlan,blockers);"
  ):self.assertIn(marker,s)
  self.assertEqual(s.count('id="phase-intro"'),1)
  self.assertEqual(s.count('id="week-content"'),1)
  self.assertNotIn("function getCurrentGameDay",s) # U3-B is separate and not yet done

 def test_javascript_syntax(self):
  scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",self.new3,re.S)
  self.assertTrue(scripts)
  with tempfile.TemporaryDirectory() as d:
   for i,script in enumerate(scripts):
    p=Path(d)/f"script-{i}.js"
    p.write_text(script,encoding="utf8")
    subprocess.run(["node","--check",str(p)],check=True,capture_output=True,text=True)

if __name__=="__main__":
 unittest.main()

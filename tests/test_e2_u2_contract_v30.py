"""E2 source/asset audit: original v29 preserved; U2 stock UX unchanged; U3 bridge only."""
from pathlib import Path
import re,hashlib,subprocess,tempfile,unittest

ROOT=Path(__file__).resolve().parents[1]; P=ROOT/"previews"
def blob(b):return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
class E2Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.old2=(P/"U2_Prep_Local_Ingredients_20261104_v29.html").read_text()
  cls.old3=(P/"U3_Strategy_UI_20261104_v29.html").read_text()
  cls.new2=(P/"U2_Prep_Local_Ingredients_20261104_v30.html").read_text()
  cls.new3=(P/"U3_Strategy_UI_20261104_v30.html").read_text()
 def test_frozen_v29_blobs(self):
  self.assertEqual(blob((P/"U2_Prep_Local_Ingredients_20261104_v29.html").read_bytes()),"9857040cc46cd0269b8261e779c3b2da24d897d9")
  self.assertEqual(blob((P/"U3_Strategy_UI_20261104_v29.html").read_bytes()),"6f258db5f053641ab0b31b37addcce80e8cfd31a")
 def test_u2_static_ui_is_identical_except_title_and_script(self):
  old=self.old2[:self.old2.rindex("<script>")]
  new=self.new2[:self.new2.rindex("<script>")]
  self.assertEqual(new,old.replace(
   "<title>ポケスリ作戦室 U2準備画面 ローカル画像版</title>",
   "<title>ポケスリ作戦室 U2 v30（E2食材在庫）</title>"))
  self.assertEqual(len(re.findall(r'data:image/png;base64,',new)),38)
  self.assertEqual(len(re.findall(r'<input\b[^>]*data-key=',new)),19)
 def test_u3_exact_bridge_not_editor_reintroduction(self):
  expected=self.old3.replace("U2_Prep_Local_Ingredients_20261104_v29.html",
   "U2_Prep_Local_Ingredients_20261104_v30.html")
  a="url.searchParams.set('eventStart',eventInfo.start);\n document.querySelectorAll('.u2-nav').forEach(link=>link.href=url.href);"
  b="url.searchParams.set('eventStart',eventInfo.start);\n if(eventPhase()==='during')url.searchParams.set('tab','inventory');\n url.searchParams.set('return','plan');\n const mock=new URLSearchParams(location.search).get('previewNow');\n if(mock)url.searchParams.set('previewNow',mock);\n document.querySelectorAll('.u2-nav').forEach(link=>link.href=url.href);"
  self.assertEqual(self.new3,expected.replace(a,b))
  self.assertNotIn('id="recipe-editor"',self.new3)
  self.assertNotIn('id="recipe-choice"',self.new3)
 def test_embedded_e1_is_exact_source_no_fork(self):
  model=(ROOT/"src/ux-phase-state.js").read_text()
  model=re.sub(r'\bexport (const|function) ',r'\1 ',model)
  start="const E1=(()=>{\n"+model+"\nreturn {INGREDIENT_NAMES,validWeekStart,phaseForEvent,newInventoryTimeline,validateInventoryTimeline,applyInventorySave,previewLegacyU2V3};\n})();"
  self.assertIn(start,self.new2)
 def test_no_implicit_demo_week_or_old_keys_written(self):
  for term in ("pokesleep-strategy-u2-e2-v1:","E1.applyInventorySave",
               "E1.previewLegacyU2V3","U3_Strategy_UI_20261104_v30.html",
               "eventStart","pokesleepStock","作戦へ戻る","作戦へ","tab"):
   self.assertIn(term,self.new2)
  self.assertNotIn("DEFAULT_EVENT_WEEK",self.new2)
  self.assertNotIn("U3で作戦を提案",self.new2)
  self.assertEqual(self.new2.count("localStorage.setItem("),1)
 def test_u2_js_syntax(self):
  scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",self.new2,re.S)
  self.assertEqual(len(scripts),1)
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/"source.js";f.write_text(scripts[0])
   subprocess.run(["node","--check",str(f)],check=True,capture_output=True,text=True)

if __name__=="__main__":unittest.main()

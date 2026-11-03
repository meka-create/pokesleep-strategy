"""U2/U3 v26 Japanese event display regression: v23-v25 immutable, v26 assets and source parity."""
from pathlib import Path
import hashlib, json, re, subprocess, tempfile, unittest

BASE=Path(__file__).resolve().parents[1]/"previews"
U2_V25="U2_Prep_Local_Ingredients_20261104_v25.html"
U3_V25="U3_Strategy_UI_20261104_v25.html"
U2_V26="U2_Prep_Local_Ingredients_20261104_v26.html"
U3_V26="U3_Strategy_UI_20261104_v26.html"

def sha(raw):
 return hashlib.sha1(b"blob "+str(len(raw)).encode("ascii")+b"\0"+raw).hexdigest()

class V26Regression(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.old_u2=(BASE/U2_V25).read_text(encoding="utf8")
  cls.old_u3=(BASE/U3_V25).read_text(encoding="utf8")
  cls.u2=(BASE/U2_V26).read_text(encoding="utf8")
  cls.u3=(BASE/U3_V26).read_text(encoding="utf8")
  cls.source=json.loads((BASE/"U3_EVENT_NAMES_JA_20261104.json").read_text(encoding="utf8"))

 def test_pin_v25_source_files(self):
  self.assertEqual(sha(self.old_u2.encode()),"0ae3752d4892d71fea59d24daa010684c004b3f1")
  self.assertEqual(sha(self.old_u3.encode()),"5a1012b291a3ccf948ab31056ee815241ba1b37d")

 def test_u2_bridge_only_changes_one_link(self):
  self.assertEqual(self.u2,self.old_u2.replace("new URL('U3_Strategy_UI_20261104_v25.html',location.href)",
     "new URL('U3_Strategy_UI_20261104_v26.html',location.href)"))
  self.assertNotIn("new URL('U3_Strategy_UI_20261104_v25.html',location.href)",self.u2)
  self.assertNotIn("U2_Prep_Local_Ingredients_20261104_v25.html",self.u3)
  self.assertEqual(self.u3.count("U2_Prep_Local_Ingredients_20261104_v26.html"),3)

 def test_upstream_dictionary_embedded_exactly(self):
  m=re.search(r"const EVENT_NAMES_JA=(\{.*?\});",self.u3)
  self.assertIsNotNone(m)
  names=json.loads(m.group(1))
  self.assertEqual(names,self.source["names"])
  self.assertEqual(self.source["source_blob_sha"],"ac7dea16071443f0504ef0dd5b06ca6b98e382ed")
  self.assertEqual(self.source["event_json_blob_sha"],"c13698296c5c2378bc42c1d3a9c08bffed21a926")
  self.assertEqual(names["meal prep week vol1"],"したごしらえウィーク vol.1")
  self.assertEqual(names["halloween 2026"],"ハロウィン2026")
  self.assertEqual(names["super skill week"],"連発！スキルウィーク")
  self.assertEqual(names["super skill week part 3"],"$t(events.super skill week) vol.3")
  self.assertGreaterEqual(len(names),57)

 def test_previous_features_and_assets_unchanged(self):
  img=lambda s:re.findall(r"data:image/png;base64,[a-zA-Z0-9+/=]+",s)
  self.assertEqual(img(self.old_u3),img(self.u3))
  self.assertEqual(len(img(self.u3)),19)
  for x in ("id=\"event-gate\"","id=\"stock-gate\"",
            "id=\"auto-sleep\"","id=\"repropose\"","id=\"review-adopt\"",
            "id=\"resume-draft\"","function eventBlockers()",
            "function storeState()","function restoreState(week,resetIfMissing=false)",
            "function eventDisplayName(source)","function localizeEventName(key)",
            "const EVENT_FIXTURES=","sourceKey:'meal prep week vol1'",
            "sourceKey:entry.sourceKey", "function renderReview()"):
   with self.subTest(marker=x):self.assertIn(x,self.u3)
  self.assertNotIn('id="stock-dialog"',self.u3)
  self.assertEqual(self.u3.count('id="auto-sleep"'),1)

 def test_js_parses_and_translate_nested_reference(self):
  scripts=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",self.u3,re.S)
  self.assertEqual(len(scripts),1)
  with tempfile.TemporaryDirectory() as tmp:
   f=Path(tmp)/"preview.js";f.write_text(scripts[0],encoding="utf8")
   subprocess.run(["node","--check",str(f)],check=True,capture_output=True,text=True)
   # Evaluate the exact helper code from U3 in isolation.
   start=scripts[0].index("const EVENT_NAMES_JA=")
   end=scripts[0].index("const EVENT_WEEK_KEY=",start)
   mini=scripts[0][start:end]
   sample=mini+"\nif(localizeEventName('super skill week part 3')!=='連発！スキルウィーク vol.3')throw Error('nested name not resolved');\n"
   f.write_text(sample,encoding="utf8")
   subprocess.run(["node",str(f)],check=True,capture_output=True,text=True)

if __name__=="__main__":
 unittest.main()

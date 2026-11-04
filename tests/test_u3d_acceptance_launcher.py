"""U3-D acceptance launcher safety: all hyperlinks resolve and source goldens remain immutable."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,parse_qs
import hashlib
import unittest

ROOT=Path(__file__).resolve().parents[1]
PREVIEWS=ROOT/"previews"
LAUNCHER=PREVIEWS/"U3D_Android_Acceptance_Launcher_20261104.html"
EXPECTED={
 "u2":("U2_Prep_Local_Ingredients_20261104_v29.html",None),
 "preparation":("U3_Strategy_UI_20261104_v29.html","2026-11-08T12:00"),
 "start":("U3_Strategy_UI_20261104_v29.html","2026-11-09T07:00"),
 "tuesday_before":("U3_Strategy_UI_20261104_v29.html","2026-11-10T03:59"),
 "tuesday_after":("U3_Strategy_UI_20261104_v29.html","2026-11-10T04:00"),
 "wednesday":("U3_Strategy_UI_20261104_v29.html","2026-11-11T15:00"),
 "ended":("U3_Strategy_UI_20261104_v29.html","2026-11-16T05:00"),
}
class Collector(HTMLParser):
 def __init__(self):
  super().__init__();self.links={}
 def handle_starttag(self,tag,attrs):
  if tag=="a":
   attrs=dict(attrs)
   if "data-test" in attrs:
    assert attrs["data-test"] not in self.links
    self.links[attrs["data-test"]]=attrs.get("href","")
def gitsha(data):
 return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()

class U3DAcceptanceContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  parser=Collector();parser.feed(LAUNCHER.read_text(encoding="utf-8"))
  cls.links=parser.links

 def test_v29_original_sources_never_changed(self):
  self.assertEqual(gitsha((PREVIEWS/"U3_Strategy_UI_20261104_v29.html").read_bytes()),
                   "6f258db5f053641ab0b31b37addcce80e8cfd31a")
  self.assertEqual(gitsha((PREVIEWS/"U2_Prep_Local_Ingredients_20261104_v29.html").read_bytes()),
                   "9857040cc46cd0269b8261e779c3b2da24d897d9")

 def test_every_scenario_is_one_tap_and_resolves(self):
  self.assertEqual(set(self.links),set(EXPECTED))
  for key,(file_name,clock) in EXPECTED.items():
   with self.subTest(key=key):
    href=urlsplit(self.links[key]);self.assertFalse(href.scheme);self.assertFalse(href.netloc)
    self.assertEqual(href.path,file_name)
    self.assertTrue((PREVIEWS/href.path).is_file())
    params=parse_qs(href.query)
    self.assertEqual(params.get("eventStart"),["2026-11-09"])
    self.assertEqual(params.get("previewNow"),[clock] if clock else None)

 def test_no_live_app_modified_or_network_code_embedded(self):
  content=LAUNCHER.read_text(encoding="utf-8")
  self.assertNotIn("<script",content.lower())
  self.assertNotIn("localStorage",content)
  self.assertNotIn("fetch(",content)
  self.assertIn("U3-D 実機確認",content)

if __name__=="__main__": unittest.main()

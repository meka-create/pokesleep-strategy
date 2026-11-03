from pathlib import Path
import unittest
BASE=Path(__file__).resolve().parents[1]/"previews"
class Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.a=(BASE/"U2_Prep_Local_Ingredients_20261103.html").read_text(encoding="utf-8")
  cls.b=(BASE/"U3_Strategy_UI_20261103.html").read_text(encoding="utf-8")
 def test_week_sync(self):
  for s in ("activeEventWeek(preferLink=false)","syncWeekUrl();showWeekLabel()"):self.assertIn(s,self.a)
  for s in ("const activePlan=hasApplied&&appliedEventStart===eventInfo.start","url.searchParams.delete('pokesleepStock')"):self.assertIn(s,self.b)
 def test_sleep_adoption(self):
  self.assertNotIn("if(hasApplied&&!applied.autoSleep)applied.days",self.b)
  self.assertIn("appliedEventInfo=clone(eventInfo)",self.b)
  self.assertNotIn("appliedStale",self.b)
 def test_legacy_features_and_zero(self):
  self.assertIn("const value=raw===''?0:Number(raw)",self.a)
  self.assertIn("item.values[name]===null?0:item.values[name]",self.b)
  self.assertIn("className='iv-ingredient-quantity'",self.b)
  self.assertIn("className='iv-nature-pill'",self.b)
  self.assertIn(".iv-skill.locked{opacity:.64}",self.b)
  self.assertIn("id=\"repropose\"",self.b)
  self.assertIn("実ゲームの最適化計算は未接続",self.b)
 def test_error_toast(self):
  for s in (self.a,self.b):self.assertIn("showToast(",s)
  self.assertIn("showToast('開始日は月曜日を指定してください。',true)",self.b)
if __name__=="__main__":unittest.main()

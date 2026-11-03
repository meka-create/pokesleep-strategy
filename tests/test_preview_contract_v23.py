from pathlib import Path
import unittest

BASE=Path(__file__).resolve().parents[1]/"previews"
class V23Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.u2=(BASE/"U2_Prep_Local_Ingredients_20261103.html").read_text(encoding="utf-8")
  cls.u3=(BASE/"U3_Strategy_UI_20261103.html").read_text(encoding="utf-8")
 def test_two_tabs_and_popup(self):
  a=self.u2
  self.assertEqual(a.count('role="tab"'),2)
  for s in ('id="btn-inventory"','id="prep-skill-open"','id="prep-skill-popover"','role="dialog" aria-label="準備スキル"'):self.assertIn(s,a)
  self.assertNotIn('class="prep-fixed"',a)
  self.assertEqual(a.count('class="target-chip"'),5)
  self.assertEqual(a.count('class="food-media"'),38)
 def test_zero_input_and_week_scoped_save(self):
  a=self.u2
  for s in ("if(input.value==='0')input.select()","input.type='text';input.inputMode='numeric'","raw===''?0:Number(raw)","const recordKey=week=>","version:3,weekStart:eventWeek,source:'inventory'","initialValues:previous?.initialValues"):self.assertIn(s,a)
  self.assertIn('class="inventory-actions"',a)
 def test_initial_lock_and_plan_persistence(self):
  b=self.u3
  for s in ('id="stock-gate"','id="resume-draft"',"'#generate').disabled=phase==='ended'||!hasInventory","function normalizeInventory(item)","function refreshInventory()","function storeState()","function restoreState(week,resetIfMissing=false)","function syncEventControls()","localStorage.setItem(strategyKey(eventInfo.start)"):self.assertIn(s,b)
  self.assertIn('if(changed&&oldStart!==next.start)storeState();',b)
  self.assertIn("document.querySelectorAll('.u2-nav').forEach",b)
  self.assertNotIn('id="stock-dialog"',b)
 def test_frozen_status_and_separate_event(self):
  b=self.u3
  for s in ("const activePlan=hasApplied&&appliedEventStart===eventInfo.start;","className='iv-nature-pill'",".iv-skill.locked{opacity:.64}","className='iv-ingredient-quantity'"):self.assertIn(s,b)
if __name__=="__main__":unittest.main()

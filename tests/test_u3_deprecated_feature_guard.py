"""Latest product decision gate: abolished daytime edits must never return.
U3 v26 is the approved source baseline; historical design docs do not override it.
"""
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ROADMAP=ROOT/"development/ROADMAP_CURRENT.md"
PREVIEW=ROOT/"previews/U3_Strategy_UI_20261104_v29.html"
GOLDEN=ROOT/"previews/U3_Strategy_UI_20261104_v26.html"
DECISIONS=ROOT/"development/PRODUCT_DECISIONS_CURRENT_20261104.md"

class AbolishedUIRegression(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.s=PREVIEW.read_text(encoding="utf-8")
  cls.golden=GOLDEN.read_text(encoding="utf-8")
  cls.rules=DECISIONS.read_text(encoding="utf-8")
  cls.roadmap=ROADMAP.read_text(encoding="utf-8")

 def test_latest_decision_is_explicit(self):
  for phrase in ("日中21枠","個別手動編集UIは廃案","料理を個別に手動編集",
                 "「運用中／提案」の独立切替","食材在庫のみ更新"):
   self.assertIn(phrase,self.rules)
  for phrase in ("日中21枠の個別手動編集UI：**廃案。実装しない。**",
                  "料理の手動編集UI：**廃案。実装しない。**",
                  "運用中／提案の独立切替タブ：**廃案。実装しない。**"):
   self.assertIn(phrase,self.roadmap)

 def test_daytime_slots_are_readonly(self):
  s=self.s
  begin=s.index("function renderSlots(container,plan,dayIndex){")
  end=s.index("function renderSleepSettings(){",begin)
  part=s[begin:end]
  self.assertIn("for(const id of data[slot])roster.append(avatar(id))",part)
  self.assertIn("meal.textContent=RECIPES[plan.foodMode][data.recipes[i]]",part)
  for invalid in ("openEdit(", "showEdit(", "edit-dialog", "recipe-editor", "edit-save",
                  "section.addEventListener('click'", "section.onclick", "contentEditable"):
   self.assertNotIn(invalid,part,"abolished daytime manual editing reintroduced")

 def test_sleep_only_editor_is_the_only_manual_team_editor(self):
  s=self.s
  start=s.index("function openEdit(day,slot){")
  end=s.index("function drawPicker(",start)
  editor=s[start:end]
  self.assertIn("if(slot!=='sleep'",editor)
  self.assertIn("slot:'sleep'",editor)
  self.assertIn("$('#recipe-editor').hidden=true",editor)
  start=s.index("function saveEdit(){")
  end=s.index("$('#edit-close').onclick",start)
  self.assertIn("edit.slot!=='sleep'",s[start:end])
  self.assertIn("manualSleep[day]",s[start:end])
  self.assertNotIn("applied.days[day]",s[start:end])
  self.assertEqual(s.count("openEdit(selectedSleepDay,'sleep')"),1)
  self.assertNotIn("openEdit(selectedDay,",s)
  self.assertNotIn("openEdit(day,'morning')",s)
  self.assertNotIn("openEdit(day,'noon')",s)
  self.assertNotIn("openEdit(day,'evening')",s)

 def test_v27_does_not_reintroduce_editing_when_moving_cards(self):
  for rendered in (self.golden,self.s):
   anchor=rendered.index("function renderSlots(container,plan,dayIndex){")
   tail=rendered.index("function renderSleepSettings(){",anchor)
   part=rendered[anchor:tail]
   self.assertNotIn("openEdit(",part)
   self.assertNotIn("edit-dialog",part)
   self.assertNotIn("recipe-editor",part)
   self.assertNotIn("section.onclick",part)

 def test_no_abandoned_active_proposal_switch(self):
  s=self.s
  self.assertNotIn('id="view-tabs"',s)
  self.assertNotIn('id="daytime-edit"',s)
  self.assertNotIn('id="recipe-edit-open"',s)
  self.assertIn('id="review-adopt"',s)
  self.assertIn('id="auto-sleep"',s)
  self.assertIn('id="sleep-change"',s)
  self.assertIn('id="sleep-copy"',s)
  self.assertIn('id="event-gate"',s)
  self.assertIn('id="repropose"',s)

if __name__=="__main__":
 unittest.main()

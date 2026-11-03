"""Phase-aware UX product contract for U3 roadmap (Nov 04, 2026).

This test checks signed-off DECISIONS and frozen preview artifacts. It does NOT
claim that today's weekday auto-selection or stage-specific layout is implemented.
Those features require new runtime E2E/Android tests before U3 can be approved.
"""
import hashlib
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
DEV = ROOT / "development"
PREVIEW = ROOT / "previews"

def git_blob_hash(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()

class PhaseAwareRoadmapContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.history = (DEV / "DECISION_HISTORY_PHASE_FLOW_20261104.md").read_text(encoding="utf-8")
        cls.current = (DEV / "PRODUCT_DECISIONS_CURRENT_20261104.md").read_text(encoding="utf-8")
        cls.roadmap = (DEV / "ROADMAP_CURRENT.md").read_text(encoding="utf-8")
        cls.acceptance = (DEV / "PHASE_FLOW_ACCEPTANCE_20261104.md").read_text(encoding="utf-8")

    def test_pinned_original_u2_and_u3_v26_unchanged(self):
        for path, expected in (
            ("U2_Prep_Local_Ingredients_20261104_v26.html", "f15e0f97656b9bbc6b4dafeed818ecfed543377d"),
            ("U3_Strategy_UI_20261104_v26.html", "c382275084063c72823fb4182c338fdfe350e78b"),
        ):
            with self.subTest(path=path):
                self.assertEqual(git_blob_hash((PREVIEW / path).read_bytes()), expected)

    def test_original_user_intent_and_priority_retained(self):
        for text in ("準備週→イベント開始→イベント中", "火曜日", "水曜日",
                     "イベント期間中に一番閲覧", "2026-11-03"):
            with self.subTest(text=text):
                self.assertIn(text, self.history)
        for text in ("準備週", "イベント開始", "イベント中", "04:00", "未実装",
                     "当日週間編成", "日中21枠"):
            self.assertIn(text, self.current)
        self.assertIn("イベント条件カード", self.history)

    def test_milestones_do_not_drop_phase_and_weekday_acceptance(self):
        for label in ("U3-A", "U3-B", "U3-C", "U3-D", "U4", "U5", "U6",
                      "F1", "F2", "F3", "F4", "F5", "F6",
                      "JST04:00", "当日曜日の自動初期表示", "未実装",
                      "U3-D未合格", "廃案・復活禁止", "旧CSV16列"):
            with self.subTest(label=label):
                self.assertIn(label, self.roadmap)

    def test_critical_realistic_browser_scenarios_documented(self):
        for label in ("FLOW-01", "FLOW-02", "FLOW-03", "FLOW-04",
                      "DAY-01", "DAY-02", "DAY-03", "DAY-04", "DAY-05",
                      "NOEDIT-01", "NOEDIT-02", "SLEEP-01", "REPLAN-01",
                      "PLAN-01", "PLAN-02", "STOCK-01", "2026-11-10T03:59",
                      "2026-11-10T04:00", "2026-11-11T15:00",
                      "実施済み（記録なし）"):
            with self.subTest(label=label):
                self.assertIn(label, self.acceptance)

    def test_no_reinstating_rejected_ui_or_falsely_claiming_implementation(self):
        for doc in (self.roadmap, self.current, self.history):
            for term in ("廃案", "日中21枠", "睡眠7晩", "食材在庫", "未実装"):
                with self.subTest(term=term):
                    self.assertIn(term, doc)
        self.assertIn("v28実装候補・Chromium／Android受入待ち", self.roadmap)
        self.assertIn("U3-B v28", self.acceptance)
        self.assertIn("未実装", self.acceptance)
        self.assertIn("ユーザー明示承認", self.roadmap)

if __name__ == "__main__":
    unittest.main()

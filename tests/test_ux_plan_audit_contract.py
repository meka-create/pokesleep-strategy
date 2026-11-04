"""Static consistency checks for the PRE-IMPLEMENTATION audited UX plan.

These assertions intentionally do not claim that any of the proposed UX
workflows are implemented or that the user has approved the design.
Actual user-journey acceptance must be demonstrated by E5/E6/E7 tests.
"""
from pathlib import Path
import unittest

D = Path(__file__).resolve().parents[1] / "development"

class UXPlanAuditContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audit = (D / "UX_PHASE_PLAN_AUDIT_20261104.md").read_text(encoding="utf-8")
        cls.plan = (D / "UX_PHASE_MINIMAL_IMPLEMENTATION_PLAN_AUDITED_20261104.md").read_text(encoding="utf-8")
        cls.old = (D / "UX_PHASE_MINIMAL_IMPLEMENTATION_PLAN_20261104.md").read_text(encoding="utf-8")
        cls.roadmap = (D / "ROADMAP_CURRENT.md").read_text(encoding="utf-8")

    def test_all_seventeen_findings_remain_recorded(self):
        for i in range(1, 18):
            with self.subTest(i=i):
                self.assertIn(f"A{i:02d}", self.audit)
        self.assertIn("P0", self.audit)
        self.assertIn("P1", self.audit)
        self.assertIn("P2", self.audit)

    def test_no_wizard_merged_pages_or_rejected_daytime_editor(self):
        for term in ("3主画面", "折りたたみ", "日中21", "21食", "廃案",
                     "運用中/提案", "フェーズ", "睡眠7晩", "自動OFF",
                     "同じイベント週"):
            self.assertIn(term, self.plan)
        for term in ("一画面に合体", "手動編集", "常設タブ"):
            self.assertIn(term, self.plan)
        self.assertIn("主操作**0〜1個**", self.plan)

    def test_preparation_target_baseline_and_explicit_event(self):
        for term in ("未選択", "準備", "カレー・サラダ・デザート",
                     "同優先度", "同数", "初回保存値に固定しない",
                     "開始在庫", "現在庫", "savedAt",
                     "未保存と19種0個", "候補", "ユーザー明示反映",
                     "last-known-good", "U4未開発", "EX/きのみ"):
            with self.subTest(term=term):
                self.assertIn(term, self.plan)

    def test_acceptance_gates_separated_by_dependency(self):
        for marker in ("E0", "E1", "E2", "E3", "E4", "E5", "E6",
                       "E7=U4→U5→U6", "F1〜F6",
                       "JST04:00", "対象週未選択", "U5", "U3-D",
                       "戻り先", "再提案", "採用", "先頭", "実機"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.plan)

    def test_current_roadmap_only_proposes_not_approves(self):
        self.assertIn("提案段階でユーザー承認待ち", self.roadmap)
        self.assertIn("UX_PHASE_MINIMAL_IMPLEMENTATION_PLAN_AUDITED_20261104.md", self.roadmap)
        self.assertIn("UX_PHASE_PLAN_AUDIT_20261104.md", self.roadmap)
        self.assertIn("このまま実装しない", self.old)
        self.assertIn("v29", self.roadmap)
        self.assertIn("U3-D実機NG", self.roadmap)

if __name__ == "__main__":
    unittest.main()

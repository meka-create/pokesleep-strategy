# ポケスリ作戦室 — E3 U3開始時の入口（2026-11-05）

## 開発基準
ユーザー承認済み `development/UX_PHASE_MINIMAL_IMPLEMENTATION_PLAN_AUDITED_20261104.md` を最上位とする。
E2 `feat/e2-u2-stock-flow-v30-20261104` から派生。v29/v30原本、旧main、旧CSV/JSONには書き込まない。

## E3 v31実装候補
- `previews/U3_Strategy_UI_20261105_v31.html` — E1の純粋状態判定を同一ソースから組み込む（モック単体HTMLのfile://対応）。
- `previews/U2_Prep_Local_Ingredients_20261105_v31.html` — E2の19食材UIを維持、E3イベントID付きU3への返却リンク・保存記録を追加。
- 対象イベントは明示保存まで未選択。E3専用選択キー `pokesleep-strategy-u3-e3-v1:selected`。旧デモ週の自動選択はしない。
- イベント候補は適用操作までフォームに反映しない。明示保存でE1 ledger `candidate/editing/confirmed` 規則に従う。EX・きのみなど未確定条件は引き続きロック。
- 主操作はE1判定に合わせて `イベントを選択／イベント条件を設定／食材在庫を登録／7日間の作戦を提案／残り期間を再提案` のいずれか高々1つ。採用後、変更なしの場合は0。
- E2在庫と返却用プレビューURLのイベントIDを照合。保存済み旧U2 v3やイベントID無しの値を、新イベントの確定在庫へ無断昇格させない。
- 採用前の提案はドラフトのまま、採用済み作戦を上書きしない。日中21枠と料理21食は閲覧専用、睡眠7晩は手動・自動を維持。
- プレビュー用の仮パーティ・レシピ計算は本番エナジー最適化ではない。既存シミュレーター接続はF工程。

## 実施した開発
- U3 v31/U2 v31、E3イベントID・保存済み条件・週別在庫の導線
- `tests/test_e3_event_flow_v31.py` — JS構文・E1ソース・廃案UI不在・新保存キー
- `tests/e3-ux-v31.test.cjs` — 既存 `npm test` で上記検査を起動する橋渡し
- `tests/preview_browser_e3_v31.py` — 選択→条件保存→在庫0個保存→提案→レビュー→採用→在庫更新→再提案のブラウザ実操作

## E3自動検証結果（2026-11-05）
- GitHub Actions [Validate PokeSleep Strategy #41875702817](https://github.com/meka-create/pokesleep-strategy/actions/runs/41875702817)：**success、558テストPASS、0失敗**。
- `tests/test_e3_event_flow_v31.py`：E1原本・JS構文・旧廃案UI不在・E3イベントID保存の監査PASS。
- `tests/preview_browser_e3_v31.py`：Android相当サイズのオフラインChromiumで、イベント明示選択→条件保存→19食材0個明示保存→U2/U3往復→7日提案→レビュー・採用→当日水曜日表示→在庫更新後の旧作戦保持と再提案の導線PASS。
- 異常系：旧週だけの保存キーによる自動イベント選択なし／EX未確定ロック／破損E2在庫のURLフォールバック拒否をブラウザで確認。
- GitHub Actions [Validate STEP 2 #41875702765](https://github.com/meka-create/pokesleep-strategy/actions/runs/41875702765)：success。
- E3は**対象範囲の実装と自動回帰がPASS**。ただし実機Android Chrome／E4の期間中表示／E5総合回帰／E6ユーザー受入は別ゲート。Draft PR #111は未main統合。

## 未受入・注意
- 独立した新規CIワークフロー追加はコネクタ制約で拒否されたが、既存のValidate PokeSleep StrategyにE3のChromium実操作を組み込んで成功を確認した。
- E3の自動検証はPASS、Android Chrome実機は未確認。自動検証の成功と実機のUX受入は混同しない。
- U2 v31とU3 v31はプレビュー用の２つのHTMLであり、共通タブ／同一オリジンの正式保存はU5で実施する。
- E4のイベント中の通常閲覧の最終構成、およびE5/E6の総合受入は未実施。
- 本番mainへ統合してはいけない。現状は開発候補として保持し、動作検証が通るまでDraftのまま。

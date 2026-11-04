# ポケスリ作戦室 — E5 独立監査・画面間総合回帰（2026-11-05）

## 1. 起点と保護対象

- 正本：`development/UX_PHASE_MINIMAL_IMPLEMENTATION_PLAN_AUDITED_20261104.md`。
- **E4 v32 自動検証ログ**：GitHub Actions [Validate PokeSleep Strategy #41878697988](https://github.com/meka-create/pokesleep-strategy/actions/runs/41878697988) 560 tests / 560 PASS / 0 FAIL、E4 Chromium実操作PASS。併せて [STEP2 #41878697429](https://github.com/meka-create/pokesleep-strategy/actions/runs/41878697429) の560 PASS、0 FAILログを確認。E4の自動検証を通過したためE5へ進行。
- E5作業は `feat/e5-u2-u3-integration-audit-20261105`、[Draft PR #113](https://github.com/meka-create/pokesleep-strategy/pull/113) にのみ配置。E4 v32、E3 v31、E2 v30、v29原本、mainを変更しない。
- E5修正候補は `previews/U2_Prep_Local_Ingredients_20261105_v33.html` / `previews/U3_Strategy_UI_20261105_v33.html`。U2 v33の差分はU3 v33への遷移先のみ。U3 v33は独立監査で発見した欠陥を修正。

## 2. 独立監査で確認・修正した点

1. **未採用ドラフトが保存済みでも再表示導線が隠れていた（要修正）**：E4 v32では `resume-draft` ボタンが常に非表示の `plan-actions` に属していた。E5 v33は保存済みでなお有効なドラフトについて唯一の主操作を「未採用の提案を確認」に切り替える。古いドラフトは無条件に復活しない。
2. **未保存イベント条件のときに再提案ボタンが表示された（要修正）**：E4 v32では条件ledgerの `confirmed` は有効なまま、フォームの未保存変更で `REPROPOSE` が先に表示され、クリックして初めてブロックされた。E5 v33では純粋E1状態へ `dirty:true` を渡し、「イベント条件を設定」を最優先にする。
3. **睡眠の個別変更／全7晩コピー／自動トグルの保存失敗（要修正）**：以前はローカル保存失敗でも変更が残り、成功トーストが表示され得た。E5 v33ではそれぞれ保存結果を確認し、失敗時に手動設定やトグルを復元し、明示的なエラー表示を行う。
4. **提案作成が保存できなくてもレビューが開いた（要修正）**：提案の状態スナップショットを保存できなかった場合、旧ドラフトと在庫スナップショットを復元し、レビューを開かないようにした。
5. **過去/現在の編成と料理の書換え禁止**：E4の `isPastSlot` 時刻固定と `unknownPast`「実施済み（記録なし）」を保護。E5は曜日と在庫を跨ぐ実操作で既存作戦JSON自体を比較する。
6. **同週別イベントの自動データ移用禁止**：E2在庫の `eventId` と選択中イベントを照合し、不一致や破損を新しいイベントへ黙って流用しない。同週別イベントへ切替えた後の在庫再利用/移行は自動実施しない。U5の正本データ移行時にユーザーの明示操作とバックアップ条件を設計する。
7. **仮データと実ゲーム精度の区別**：v33のパーティ・料理はプレビュー用の仮案。実エナジーの値はUIに出さない。F工程の計算精度完了を偽らない。

## 3. E5総合回帰テスト

- `tests/preview_browser_e5_integration.py`：オフラインChromiumで準備（日曜の訂正保存）→U3へ往復→イベント開始後に提案→保存済み未採用案を再読込で再表示→明示採用→当日4枠閲覧→未保存条件による提案ロック→U2途中在庫更新→別タブで競合更新中に古い提案の採用拒否→新規提案採用時の過去2日と当日開始済み枠/料理不変→終了後read-only→破損旧キーのfail-closed。
- 同ブラウザ試験：モバイル320/360/393/430pxの横スクロール、保存失敗時の提案作成拒否・手動睡眠/自動トグルの巻戻し。
- `tests/test_e5_contract_v33.py`：U2 E4基準からの非破壊派生、U3のイベント条件フォーム1つ、主操作1つ、禁じた日中枠・料理編集UIが復活していないこと、JS構文。
- `tests/e5-integration.test.cjs`：既存 `npm test` へ上記静的＋ブラウザ実操作を統合。E1〜E4と既存のCSV16列/JSON/計算テストも合わせて全実行。

## 4. 未確認ゲート

- **E5最新版のGitHub Actions回帰・Chromium結果：PASS**。下記の2系統のログで562テストPASS・0失敗を確認。
- **Android Pixel 7a Chrome実機受入**：E6で利用者が1回にまとめて実施。「画面を見て次の操作がわかる」「今日の4枠が見やすい」を明示受入するまでHOLD。
- **U5/F工程**：同一オリジン保存、U4実個体データ、実イベント最新ボーナス、食材エナジー最適化はE5の範囲外。

## 5. E5完了条件と次工程

1. `npm test` + ビルド、E5実ブラウザ、E1〜E4不退化の全CI成功。
2. 既知の保存失敗・別タブ競合・04:00境界・旧保存保護の検査成功。
3. E5自動受入合格ならE6へ進み、Pixel 7a実機確認手順をまとめて提示。合格前にmain統合しない。

## 6. 独立監査・最終自動受入結果（2026-11-05）

- **自動受入判定：PASS**。GitHub Actions [Validate PokeSleep Strategy #41883545715](https://github.com/meka-create/pokesleep-strategy/actions/runs/41883545715) は `562 tests / 562 pass / 0 fail`、CIジョブの最終結論 `success`。
- 既存互換 [Validate STEP 2 #41883545898](https://github.com/meka-create/pokesleep-strategy/actions/runs/41883545898) も `562 tests / 562 pass / 0 fail`、ジョブ最終結論 `success`。
- E3/E4旧版の静的・実Chromium検証も全体npmテスト内で再実行済み。E5では `test_e5_contract_v33.py` と `preview_browser_e5_integration.py` を追加し、2つの新規NodeテストがPASS。
- **独立監査の重要発見：** 旧コードで条件変更リスナーが `addEventListener('change',render)` と実装され、E3/E4が後で差し替えた `render` 関数を参照せず、イベント編集直後の主操作が更新されないことが実操作テストで判明。v33では `addEventListener('change',()=>render())` に修正してテストPASS。静的監査にも旧書式禁止を追加。
- E5の未採用案の再開、未保存条件ゲート、保存失敗ロールバック、準備週と途中在庫更新の往復、別タブ更新レース、04:00境界、終了後read-onlyを自動確認。
- 凍結したE4 v32など既存原本は変更せず、`compare_commits` では E4ベースに対してE5がahead・behind 0であり、変更ファイルはv33新規プレビュー・E5の試験・E5開発文書・ロードマップのみ。
- **E6（Pixel 7a / Android Chrome実機受入）・U5同一オリジン保存・F工程の実ゲーム精度は未受入**。自動受入PASSを実機確認済み・main統合済みと混同しない。

### 次工程

**E6：Pixel 7a Android Chromeで1回にまとめて受入検証。** 準備→イベント開始→提案採用→当日閲覧→途中在庫更新→再提案→保存を確認し、読みやすさと次の操作の分かりやすさを利用者が判定する。NGならE3〜E5の該当工程へ戻って修正。E6承認前はDraft PR #113をmainへ統合しない。

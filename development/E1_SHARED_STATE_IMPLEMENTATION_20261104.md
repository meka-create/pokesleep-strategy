# ポケスリ作戦室 E1 — 共通状態・保存設計とE2引継ぎ（2026-11-04）

**基準：ユーザーが2026-11-04 20:26 JSTに監査修正版v2を承認。E0完了。**
本ファイルはE1の実装説明。**U2/U3のUI・本番main/PR #109・v29プレビュー原本は未変更**。E1のCI PASSだけでE2の導線やE6実機受入を合格としない。

## 実装物
- `src/ux-phase-state.js` — ブラウザ/Node共用のES module。DOM・localStorage・fetch・タイマーなしの純粋関数。
- `tests/e1-ux-phase-state.test.cjs` — 04:00 JST、週またぎ/年またぎ、イベント未選択、在庫、条件の候補/編集中/確定、ドラフト採用保護等のNode単体試験。
- `.github/workflows/e1-ux-state-contract.yml` — JS単体試験、既存HTMLの先祖返り検査、ロードマップ契約を自動実行。

## 状態を3軸＋イベント選択で扱う
**ユーザーに新しいフェーズ切替ボタンは作らない**。内部だけで以下を判定する。

1. **対象イベント** `null`（未選択）または `{id,weekStart}`（開催イベントが明示選択された状態）。**v29のデモ `2026-11-09` を自動選択しない。** 同じ週の別イベントも `id` で隔離する。
2. **開催時刻 `phaseForEvent`** — 未選択/開始前/開催中/終了。JST月曜04:00〜翌週月曜04:00。今日の曜日は `gameWeekdayIndex`（0=月、6=日）。
3. **条件 `conditionViewFromLedger`** — 上流から得た `candidate`、入力中の `editing`、明示保存された `confirmed` を区別。取得だけでは確定せず、**適用→保存の二段階をユーザー操作で要求**。不足項目があれば `MISSING`（途中保存は許容するが週間作戦は提案不可）。
4. **食材 `validateInventoryTimeline`** — 未保存 `null` と全19種0個の明示保存を区別。事前最新 `preparationLatest`／開始在庫 `startInventory`／現在庫 `currentInventory` を別スナップショットで保持。
5. **作戦** — `adoptedPlan` と `draft` は独立。依存する条件・在庫・睡眠が変わった未採用案は `canAdoptDraft=false`。採用済みの当日閲覧は、条件不備や途中変更があっても消さない。

## 表示用の単一主操作
`getPrimaryViewState({selectedEvent,nowISO,conditions,inventoryTimeline,adoptedPlan,draft,dirtyFlags})` で `{phase,screen,primaryAction,compactWarning,lockReasons,canPropose,canRepropose,canAdoptDraft,adoption,gameDayIndex}` を返す。

- `SELECT_EVENT` — イベント未選択。過去のデモ週を開催中と誤認させない
- `SET_EVENT` — 開始後に必要な条件が不足、または未保存/編集途中
- `SET_INVENTORY` — 条件は揃ったが今週の保存済み在庫がない
- `PROPOSE` — 開始後、条件と在庫が揃い、採用済み作戦なし
- `REPROPOSE` — 採用済み作戦があり、条件/在庫/睡眠の依存が変わった
- `NONE` — 準備中、通常の当日閲覧、イベント終了後等。**通常閲覧時には大ボタンを表示しない**
- `primaryAction` は常に**1つの値**。これを複数の主ボタンへ二重描画しない。
- `screen='ADOPTED_PLAN'` はこのイベントの採用作戦だけ。別週/別イベントの古い作戦は出さない。
- 前提条件が未確定でも、過去の採用済み作戦は閲覧可能。**未確定のまま再提案は不可**。

## 19食材の保存形式と移行
- **既存U2プレビューの食材キーは日本語19種類**。旧本番 `src/storage.js` の英語19キーとは形式が違う。今E1のモジュールは**U2 v29が実際に使う日本語名19種類**を固定して検証する。
- `newInventoryTimeline(week)` は `version:2` の未保存モデルを返す。
- `applyInventorySave(timeline,{savedAt,values,revision})` は**純粋なコピー処理**。JST開始前に保存するたび `preparationLatest` と `startInventory` を最新値へ更新。開始後は `currentInventory` **だけ**更新する。開始前に記録がなければ開始在庫は `null` のまま。
- 単調な `savedAt` による上書き保護、同時刻の矛盾拒否、週別分離、19種全件の範囲検査、合計10000個までをチェック。終了後の追記を拒否。**現段階では保存日時とrevisionは呼び出し側の明示入力**。
- `previewLegacyU2V3(record,week)` は旧 `pokesleep-strategy-u2-v3:<week>:inventory` データを**読み取るだけ**。`requiresExplicitCommit:true` を返す。キーが違う/必要19項目が欠落/値が不正ならエラー。自動で新形式を保存しない。
- 旧 `initialValues` は「最初の事前入力」であり、**日曜最終訂正値ではない可能性**がある。旧データの最後の保存日時が開始後なら、開始在庫は不明として `null` + `START_STOCK_UNKNOWN_FROM_LEGACY` を返す。勝手に補完しない。
- **保存キー新設/旧データ移行の実際の書込みはE2以降**。先にバックアップ・旧形式読み取り・失敗時にデータ不変を確認。旧CSV16列/JSONや`pokesleep-event-planner/step1/v1`は一切変更していない。
- `version:2` はこの**在庫スナップショット専用**のスキーマ版。旧本番の `state.version:1` と同一ファイルのメジャー版ではない。

## E1自動検証結果（2026-11-04）
- **E1実装・対象範囲の自動検証：完了（PASS）**。GitHub Actions [run #41823339629](https://github.com/meka-create/pokesleep-strategy/actions/runs/41823339629)。
- 新規 `tests/e1-ux-phase-state.test.cjs`：**30件PASS**（日本時間04:00、年跨ぎ、19食材、条件の候補/明示反映/確定、在庫の開始/現在分離、旧v3読取、同じ週の別イベント条件の隔離、変更識別子の再利用拒否）。
- UI設計・廃案・v29原本契約：**20件PASS**。旧保存/主要UI互換：**22件PASS**。対象テスト合計 **72件PASS**。既存アプリの `npm run build` も成功。
- **全シミュレーション・最適化の重量級ベンチマークはE1完了ゲートに含めない**。本番の計算精度/7日探索、U2/U3画面の使いやすさを合格としたものではない。
- E2へ接続する際は上記の純粋関数の戻り値から実UIを描画し、U2 v3を**読み取り互換→バックアップ→明示移行**の順で統合。E1から旧キーへ自動書込はしない。

## E1独立の完了ゲート
- [x] 週未選択/同じ週の別イベントで混同なし
- [x] JST04:00境界・火曜/水曜・月跨ぎ/年跨ぎ
- [x] 条件取得候補→ユーザー明示適用→ユーザー明示保存。未確定EX/きのみを含む条件で提案不可
- [x] 19食材すべて0個の明示保存と未保存を区別
- [x] 日曜の最後の訂正が開始在庫に反映され、イベント中の現在庫更新で開始在庫不変
- [x] 開始後最初の在庫から架空の開始在庫を捏造しない
- [x] 旧U2 v3データを破壊せず、`initialValues`を根拠なく開始在庫にしない
- [x] 採用済み作戦と未採用ドラフトの安全な分離、失効した案の採用禁止
- [x] CIと既存の廃案/原本保護テストPASS

## E2へ渡す接続作業（E1では実装しない）
- `src/ux-phase-state.js` をU2/U3の新HTMLプレビューから明示読み込み、既存 `localStorage` キーとは別の安全な保存モデルへ接続。旧v3データはバックアップと明示移行を通して採用。
- U2の `transferLink()` が準備週でも「U3で作戦を提案」と誤表示する件を修正。イベント開始中/在庫更新からなら `tab=inventory&return=plan&eventStart=<week>` により在庫へ直接遷移できること。
- U2保存後はトースト＋「作戦へ戻る」を表示するが**自動遷移しない**。U3へ戻る際に同じイベントの在庫を新しい形式で確認。AndroidローカルHTMLのlocalStorage共有を仮定しない。
- 実機UXの受入はE6にまとめる。**E1 PASSをもってU3-D/本番のUI完成と宣言しない**。

# F3着手前・最終独立監査 — F2 v87（2026-11-13）

## 監査対象と原本
- 監査開始基準：main `2c31c2f4286cfd11c9a1af598afff1ce41e49794`（F2 v86, PR #177）。
- mainの4つの既存ワークフロー（Validate PokeSleep Strategy / Validate STEP 2 / Verify E7 preview publication inputs / Pages）は監査時点で全SUCCESS。v86でPRの692/692件PASSを確認。
- 上流実データ：`nitoyon/pokesleep-tool/src/data/event.json` と `src/i18n/ja/events.json`。監査時のblobは `c3072ca75daf59acdac52c7e726f3013659fceb0` と `fac0d8516bdc24566c1525ddedd9cd687121e394`。59週イベント・12日別記録。上流コミットは更新しうるため、F2実行時には必ず同一commit SHAから両ファイルを取得する。
- この監査ではF3の備蓄最適化／F4の7日最適化には着手しない。旧正式rootとSTEP2計算、PWAアイコン/ID、69個体CSV等の私有情報、66種族・フォームF1計算、E7受入済みUI・イベント別在庫/作戦を保護する。

## 独立確認と是正事項

| 区分 | 監査結果 | v87対応 |
|---|---|---|
| F2-01 オフライン原典整合 | 同梱の11/16イベントには`extraIng:nuts`と`carryLimitAdd:10`しかなく、実原典にある`ingredient:+1`が欠けていた。初回オフラインで異なる説明となる | 同梱11/16データに`ingredient:1`追加。11/23候補、日本語名称、JST週境界も試験対象へ |
| F2-02 LKGの局所破損 | v86の「正常候補が前回の65%以上」だけでは、既知の11/16イベント1件や11/23日別の値が不正になっても正常キャッシュを書き換える可能性がある | 前回検証済みの**将来/開催中候補が今回も原典に存在するのに妥当性を失った**更新は全体不採用にし、LKGを保持。削除済み候補の復活推測はしない。古い歴史的異常はこれまでどおり個別隔離 |
| F2-03 翻訳更新の明示反映 | イベントの効果が同じで日本語名称だけ変わった場合、v86は更新選択を表示しなかった | 候補の名称も差分判定に含め、ユーザーが更新候補を選び既存「保存」を押した時だけ反映 |
| F2-04 ブラウザ受入の不足 | F2のv86回帰はDOM静的照合と純関数が主体。実タップに近い確認は新機能部分が薄かった | `tests/preview_browser_f2_pre_f3.py` とNode起動試験追加。上流の同一SHAペア取得、選択しただけでは保存されない、明示保存、名称変更時の更新選択、未保存状態の保護、オフラインLKGの復旧を実ブラウザで試験 |
| F2-05 F3計算境界 | `verifiedEffects`/`verifiedTarget`と週bonus/日別drowsyは取得/検証/保存可能だが、それだけでF1-Dの総エナジー計算は正確にならない | PROVISIONALを維持。未知効果は未加算。F3/F4で評価式・条件適用を実装 |

## 先祖返り・データ安全の独立監査
- E7モック3画面・3タブのヘッダー、モーダル、イベントID別在庫/計画、カレンダー削除隔離、保存ロールバック、ステータスモデル、フィールド・EX未確定インターロックは維持。
- 元69個体CSV・ニックネーム等の個人データは公開リポジトリへ追加しない。
- F2の公開原典キャッシュキーは `pokesleep-strategy-f2-upstream-catalog-v1`。Box固有キー `pokesleep-strategy-e7-` に一致せず、公開候補更新でボックスのタブが無駄に再読み込みされない。
- 「開催フィールド」は上流`target`や`fixedAreas`のインデックスから決めない。`fixedBerries`中の`null`も確定扱いしない。
- 週bonusの7日/JST 04:00、6日・14日・逆転・タイムゾーン付日時の隔離と、日別drowsyの分離を維持。
- 古い正式root `index.html` と `src/simulator.js`、PWA manifest/Pixelアイコン、F1-Dの5匹28枠参考試算には触れない。正式URLへの切替はF6まで保留。

## 独立品質ゲート
1. v87最終PRの2系統CIで、対象NodeテストとChromium実操作、E7全体回帰、旧rootを検証。
2. main統合後にもValidate STEP 2・Validate PokeSleep Strategyの2系統CI、およびE7公開前検証とPages公開を別々に確認。
3. Android Chromeによるv79〜v87 UI変更の最終一括受入は**未確認**。自動回帰PASSをAndroid実機PASSと称さない。F3実装の度に無変更UIの細かな受入を要求せず、次の影響あるUI変更にまとめる。
4. 重大障害・CI失敗はF3の着手前に是正して再試験する。F1-C/Dの計算はPROVISIONALのままF3へ引継ぎ。

**F3着手条件**：v87変更PRが全自動回帰をPASSし、main統合とPagesが成功した時点で「F3着手前コード・公開基盤監査PASS」。Android実機UI受入と計算精度の独立ゲートを引き続き残す。

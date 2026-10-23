# STEP 2 M1 — 週まとめ観測を週終了まで受付けない（v0.2.73、2026-10-24）

## 再現条件・重大度
v0.2.72の `makeReport` は `confirmedSummary=true` と実測の整数値があれば、まだ終了していない任意の未来週について「週間実測JSON」を作成できた。証拠の整理で、1週間が完了した実ゲーム週まとめと誤認する恐れがある。ゲーム計算式のP0ではなく、**M1の実測証拠の時間整合性を守るためのデータ品質問題**。

## 変更
- Web UIが実測JSONを保存するときだけ `makeReport(snapshot,form,new Date().toISOString())` とし、`provenance.summaryRecordedAt` にISO記録時刻を保存する。
- `summaryRecordingTime` はゲーム週の終了（対象月曜04:00 JSTから7日後の**翌月曜04:00 JST**）まで記録を拒否する。試算保存日時が週まとめ入力より後であるという矛盾も拒否する。丁度04:00は受け付ける。
- 記録時刻をアプリの保存結果と再読み込み結果に表示する。新しい記録時刻を持つJSONが改変されて週途中へ移された場合はプレビュー・再読込・CLIのすべてで拒否する。
- `summaryRecordedAt` が**存在しない旧形式の観測JSONは従来どおり読み取る**。旧記録を新形式の時刻証拠とみなさない。従来の `step2-m1-weekly-observation-v1` スキーマ、CSV16列、保存JSON、計算式、M1凍結基準は不変。
- `summaryRecordedAt` は端末の時計と編集可能なJSONによる自己申告。真正性、原画面、ログ、実ゲーム誤差を独立に証明しない。事前予測ファイルは**対象週開始前**、週まとめは**対象週終了後**と使い分ける。

## 人工回帰
`tests/step2-m1-week-completion.test.cjs`：JST週終了の1ms手前、ぴったり04:00、保存時刻逆転、ISO書式、改変・旧JSON互換、UI/CLI共有判定を確認。単独ゲーム週の数値差・順位真値の証明ではない。

**M1限定B 10/14、完全混成週間の外部照合0/4、外部順位0/5、実ゲーム週間観測0件。M0 DONE、M1/M2/M3 PARTIAL、M4 NOT STARTED。STEP2精度HOLD／STEP3未着手。**

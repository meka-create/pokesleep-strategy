# STEP2 M1監査：料理大成功期待値OFFの実測比較保留（v0.2.63）

## 再現と危険性

モデルの`successMode='none'`では料理大成功をゼロとして料理エナジーを試算する。一方、ゲームではスキルの有無にかかわらず料理大成功が確率で発生する。料理計上のある観測週でOFF試算を期待値と同等に比較すると、料理大成功による差分を編成精度の差と誤認し得る。

従来はこのモデル限界が`knownModelLimitations`で検出されず、他の条件が整えば`UNCALIBRATED_OBSERVATION`として扱われ得た。`rankOrAccuracyValidated=false`は維持されるが、不一致の構造的理由を隠すP1の比較判定漏れである。

## 修正の範囲

- 計算済み料理エナジーが正、かつ`successMode='none'`のときに比較保留理由を付与。
- 保存プレビューへ保存済み`modelAtCapture.cooking`を渡し、再読込・CLIと同じモデル限界にする。
- 料理0、期待値ONではOFF固有の警告を付けない。週間エナジー式、凍結M1基準、CSV16列、固定睡眠、週境界は変更しない。
- 月〜土約10%・日曜約30%はゲーム攻略資料上の推定値であり、単発週のゲーム精度や発動乱数を検証したものではない。

ゲームの通常大成功と日曜差・倍率の参考：<https://stats.serebii.net/pokemonsleep/dishes.shtml>、<https://bulbapedia.bulbagarden.net/wiki/Cooking_%28Sleep%29>。いずれもゲーム公式の一次情報ではないため、実測A級には格上げしない。

## 検証

`tests/step2-m1-observation-import-replay.test.cjs`に人工の初期確定りんご147個・21食・OFFを追加し、プレビュー・ブラウザ再読込・CLIの3経路で`CONFOUNDED_OBSERVATION`と`accuracyGate=HOLD`を照合。料理0と期待値ONの負例も確認。全体CIと生成HTML一致の実行結果はPR・mainのrunで確認する。実ゲームの独立週間観測を取得した証拠ではない。

## 精度ゲート

M1限定10/14、M01〜M04完全混成週間外部比較0/4、R01〜R05外部順位0/5、実ゲーム週間観測0。M1/M2/M3 PARTIAL、M4 NOT_STARTED。**STEP2精度HOLD・STEP3未着手**。

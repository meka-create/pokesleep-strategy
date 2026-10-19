# STEP 2 M2 — 直接エナジースキル報酬の「1発動ごと切り上げ」独立監査

対象：v0.2.48（2026-10-20）。**M1/M2/M3 PARTIAL／STEP2精度HOLD／STEP3未着手**。

## 根拠となる外部一次実装

いずれも `nitoyon/pokesleep-tool` の公開ソースを2026-10-20に確認したもの。引用元は**ゲームの完全な正解を証明する公式実測**ではなく、外部計算器とのB級に限定した実装照合である。

- [ChargeStrengthS.ts](https://github.com/nitoyon/pokesleep-tool/blob/main/src/util/Team/Skill/ChargeStrengthS.ts)（blob `7ef12766bb172d043af3c121250f674b756982e0`）は S/M のスキル値にフィールドボーナスを乗じて `Math.ceil` し、その整数値を発動ごとに加算する。
- [ChargeStrengthMBadDream.ts](https://github.com/nitoyon/pokesleep-tool/blob/main/src/util/Team/Skill/ChargeStrengthMBadDream.ts)（blob `f8ee9a6f54682dcbe73b0dce9a0b1f2dd98007ff`）も直接エナジー報酬は同じ `Math.ceil`。チームげんき減少のランダム相関は別課題。
- [BerryZonePsystrike.ts](https://github.com/nitoyon/pokesleep-tool/blob/main/src/util/Team/Skill/BerryZonePsystrike.ts)（blob `46f18955c8fb468ad3c056fee8f03ab158f6cd43`）の直接エナジーも `Math.ceil`。強化されるきのみゾーンの持続／上限は未実装のまま。
- [ChargeStrengthSRandom.ts](https://github.com/nitoyon/pokesleep-tool/blob/main/src/util/Team/Skill/ChargeStrengthSRandom.ts)（blob `f9be22eab03d1fea5d596362436e57c1dbfca28c`）は `floor(rng()*151)` の **151個の離散結果**で毎回報酬値を作り、フィールドボーナス適用後に `Math.ceil`。最小・最大値は同リポジトリ `src/util/MainSkill.ts` のレベル別配列。Sランダムの「中点値だけ切り上げ」とは異なる。

## 数学的な限定修正

決定的な1回のスキル基礎値 `v`、フィールド補正 `b`（%）、モデル期待発動回数 `n` に対して、旧計上は `n*v*(1+b/100)`。上流照合後は `n*ceil(v*(1+b/100))` とする。この変更は**スキル発動回数・確率そのものを変えない**。

Sランダムは `i=0..150`、`v_i=min+(max-min)*i/150` の各枝で `ceil(v_i*(1+b/100))` を求め、151枝を算術平均してモデルの `n` を掛ける。個々のゲーム発動が必ず151枝の一様抽選であるという直接測定ではない。

独立した手計算例：
- S Lv2、補正25%：`569*1.25=711.25` → **712**／発動、旧との差 **+0.75**／発動。
- M Lv2、補正25%：`1251*1.25=1563.75` → **1564**／発動、差 **+0.25**。
- ナイトメア Lv2、補正25%：`3753*1.25=4691.25` → **4692**／発動、差 **+0.75**。
- ランダムSは各レベルで151枝を独立列挙する回帰により確認する。

**未適用**：たくわえるの確率蓄積報酬・乱数履歴、ナイトメアのげんき相関、サイコブレイクのゾーン部分、ヒーラー/料理/所持数の不確実性。独立根拠のない週間補正は加えない。

## 不変条件と凍結資産

- `docs/STEP2_M1_BASELINE_V0230_20261017.json` を**絶対に上書きしない**。元のM01〜M04・R01〜R05・R02感度・R05人工条件について、現行計算値から出力の `directStrengthRoundingCorrection` を引けば、元のv0.2.30モデル値へ復元することをテストする。
- `directStrengthRoundingCorrection` は「新しい直接エナジーの切り上げ報酬 − 同じ発動回数での旧報酬」だけを足し上げた**モデル内の純算術差**。真のゲーム週間エナジーに対する改善幅、上下界、正しい順位の根拠ではない。
- ランキングの優劣がこの変化で維持されても、実ゲームのR01〜R05の5順位はいずれも**独立未検証**。保存済みゲーム観測の旧モデル値との比較では、版数・変更差を明示する。
- CSV16列・局所保存・固定睡眠5匹・月曜04:00・朝昼夜のチームと回収間隔・除外7効果を変えない。
- M4の実機検証とユーザー承認なしにSTEP2 DONE／STEP3着手へ移行しない。

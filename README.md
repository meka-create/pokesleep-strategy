# ポケスリ作戦室 – STEP 1

## いま使えるもの
- pokesleep-tool の16列CSV/TSVの読み込み（文字列の引用符・改行・BOM対応）。不正な行がある場合は読み込みを中止し、既存ボックスを保持します。
- インポートした個体を一覧・検索。同名個体も別個体として保持。
- 育成用睡眠パーティの5匹選択。
- イベント名・日付・1/2週・フィールド・料理方針・補正メモ・各週のいいキャンプチケットON/OFF。
- ブラウザ保存、JSONバックアップと復元。保存はブラウザの同一オリジン単位で行われます。

## 未実装（意図的）
エナジー予測、編成の自動最適化、レシピ/食材マスター、イベントの自動取得、イベントのランダム条件の評価、マスター自動更新は後続のSTEP 2～6で実装します。STEP 1の画面に計算結果のダミー数値は表示しません。

## Android Chromeで試す
`index.html`（または `dist/index.html`）はCSSとJSをすべて内蔵した **単独HTMLファイル** です。ZIPを展開して `index.html` をChromeで開きます。ファイルを開く方法によってはAndroidのファイルマネージャーがプレビューを表示することがあります。その場合は「Chromeで開く」を選択してください。ファイルURL上のlocalStorageは端末や起動方法により動作が異なるため、**JSONバックアップを保存**してください。

PCの場合は `index.html` を直接開けます。開発時は `python3 -m http.server 8765 --bind 127.0.0.1` 等でローカル配信できます（LANには公開しません）。

## 開発
Node.js 22以上。依存パッケージ不要。
```
npm run check
```
ビルドは `src/index.template.html`, `src/styles.css`, `src/{csv,storage,app}.js` を結合して `index.html` と `dist/index.html` を生成します。

## 非公開運用
この成果物は**インターネット公開していません**。GitHubの個人アカウントで非公開リポジトリを作る場合は、GitHub PagesをONにしても通常はサイトが一般公開されます。個人向けの正式ホスティング方式は非公開アクセス制御の用意後に決めます。個人CSVやJSONバックアップはリポジトリへコミットしないでください。

## データ・計算資産の再利用予定
- [nitoyon/pokesleep-tool](https://github.com/nitoyon/pokesleep-tool)（MIT）: CSV仕様は `src/util/Formatter/BoxExporter.ts`、`BoxImporter.ts` を確認。データ・計算の具体的な移植はSTEP 2以降。
- [akirahaan-blip/pksl.teams](https://github.com/akirahaan-blip/pksl.teams)（MIT）: 料理・編成UI等の設計参考。現時点でコードは複製していません。

## STEP終了時の監査観点
CSVの取り込み互換、異常CSVでデータが消えないこと、睡眠パーティ選択、イベント期間と料理モードの保存、JSON復元、狭い画面での操作。ユーザーの監査指示を受けるまでSTEP 2へ移行しません。

## GitHubへアップロードする場合
ZIPを**展開してから**、`index.html` と `src/`、`tests/`、`docs/` などをリポジトリの**最上位**へアップロードします。ZIPファイル単体のアップロードでは中身は展開されません。`index.html` が最上位にある状態が正解です。

**重要：** Privateリポジトリに `index.html` を配置しただけでは、誰でも開けるWebサイトにはなりません。GitHub Pagesがそのリポジトリと契約プランで利用可能か、サイトが一般公開にならないかを別途確認してください。サイトの非公開アクセス方式は未導入です。

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

## 開発中の公開設定とデータ保護
開発中は **Public リポジトリ＋GitHub Pages** を使用します。開発サイト（公開設定が有効な場合）：https://meka-create.github.io/pokesleep-strategy/
サイトは一般公開されます。個人CSV・JSONバックアップ・秘密鍵・パスワードを公開リポジトリにアップロードしないでください。
CSV/バックアップの処理はブラウザ内で行い、アプリから個人データを外部送信する機能はありません。
**完成後は認証付き非公開運用へ移行**します。Privateリポジトリへの変更だけではサイトは非公開になりません。公開済みソースのコピーを取り消すこともできません。

## STEP 1 中間監査・修正
- 不正なCSV引用符・不明な色違い値を拒否し、既存のボックスを保護。
- CSVの再インポートで識別可能な睡眠用5匹を引き継ぐ。同名個体が曖昧なら誤対応を避ける。
- JSONバックアップのデータ構造を厳格に検証。破損したローカルデータを無断上書きしない。
- 保存に失敗した場合は画面上部に警告を残し、成功と誤表示しない。
- Node自動テスト14件、Chromiumモバイル幅UI試験でCSV・設定・バックアップ復元などを確認。

## ビルド・公開
ソース変更後は `npm run check` を実行し、生成されたルートの `index.html` と `dist/index.html` をコミットします。GitHub Pagesの配信元は `main` / `/(root)` です。Android Chromeの最終実機検証は利用者が行います。

## データ・計算資産の再利用予定
- [nitoyon/pokesleep-tool](https://github.com/nitoyon/pokesleep-tool)（MIT）: CSV仕様は `src/util/Formatter/BoxExporter.ts`、`BoxImporter.ts` を確認。データ・計算の具体的な移植はSTEP 2以降。
- [akirahaan-blip/pksl.teams](https://github.com/akirahaan-blip/pksl.teams)（MIT）: 料理・編成UI等の設計参考。現時点でコードは複製していません。

## STEP終了時の監査観点
CSVの取り込み互換、異常CSVでデータが消えないこと、睡眠パーティ選択、イベント期間と料理モードの保存、JSON復元、狭い画面での操作。ユーザーの監査指示を受けるまでSTEP 2へ移行しません。

## GitHubへのアップロード
ZIPを展開し、`index.html`、`src/`、`tests/`、`docs/` をリポジトリ最上位に配置してください。ZIP単体は自動展開されません。
個人CSVやバックアップファイルをコミットしないでください。

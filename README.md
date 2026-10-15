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

## 公開方針（開発中と完成後）
**開発中はリポジトリをPublicにしてGitHub Pagesで実機試験する。完成後は認証付きの非公開運用へ移行する。** ソースコードをPrivateに変更するだけでは、サイトのアクセス制限は実現しません。完成後の公開先はSTEP 6で確定します。

開発中のURL（Pagesを設定して公開が成功した場合）：https://meka-create.github.io/pokesleep-strategy/
GitHubの Settings → Pages で Source: Deploy from a branch、Branch: main、Folder: /(root) を選択して Save してください。

**公開リポジトリに個人CSV、JSONバックアップ、パスワード、APIキー、機密データをコミットしないこと。** インポートしたボックス・個人設定は原則ブラウザ内に保存されます。公開後にPrivateへ戻しても、第三者が取得したソースコードや公開フォークを取り消すことはできません。

## データ・計算資産の再利用予定
- [nitoyon/pokesleep-tool](https://github.com/nitoyon/pokesleep-tool)（MIT）: CSV仕様は `src/util/Formatter/BoxExporter.ts`、`BoxImporter.ts` を確認。データ・計算の具体的な移植はSTEP 2以降。
- [akirahaan-blip/pksl.teams](https://github.com/akirahaan-blip/pksl.teams)（MIT）: 料理・編成UI等の設計参考。現時点でコードは複製していません。

## STEP終了時の監査観点
CSVの取り込み互換、異常CSVでデータが消えないこと、睡眠パーティ選択、イベント期間と料理モードの保存、JSON復元、狭い画面での操作。ユーザーの監査指示を受けるまでSTEP 2へ移行しません。

## GitHubへアップロードする場合
ZIPを**展開してから**、`index.html` と `src/`、`tests/`、`docs/` などをリポジトリの**最上位**へアップロードします。ZIPファイル単体のアップロードでは中身は展開されません。`index.html` が最上位にある状態が正解です。

**重要：** 開発中はPublicリポジトリでGitHub Pagesを利用します。`index.html` の配置に加えて、Settings → Pagesから公開元を設定する必要があります。完成後の認証付き非公開サイトは未構築です。

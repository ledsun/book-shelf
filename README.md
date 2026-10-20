# BookShelf

[BookShelfを開く](https://ledsun.github.io/book-shelf/)

Kindleからエクスポートした蔵書JSONを、Android端末内で検索する個人用PWAです。

## 操作デモ

スマートフォンサイズ（390 × 844px）で、検索・書籍詳細・漫画の巻切り替えを紹介する動画です。蔵書・著者はすべて架空で、表紙もデモ用に自作しています。

<img src="docs/videos/bookshelf-demo.gif" width="300" alt="BookShelfの操作デモ。検索・書籍詳細・漫画の巻切り替え。">

[動画をダウンロード（WebM）](https://raw.githubusercontent.com/ledsun/book-shelf/main/docs/videos/bookshelf-demo.webm)してChromeなどで再生できます。

## 表示データ

- タイトル
- 著者
- ASIN
- 漫画・コミック判定フラグ
- 商品リンク

## 技術スタック

- HTML/CSS
- Vanilla JavaScript ES Modules
- IndexedDB
- Service Worker

ビルドと外部ランタイム依存はありません。

初回アクセスでアプリの静的ファイルをキャッシュします。
準備完了後はオフライン起動・検索・インポートができます。
書影の表示やAmazonリンクを開くには通信が必要です。

## Android Chromeでの使い方

1. 公開URLにオンラインでアクセスします。
2. Chromeメニューから「ホーム画面に追加」または「アプリをインストール」を選択します（表記は端末で異なります）。
3. 「データ管理」からJSONファイルを選択します。結果に取込冊数、不正・重複のスキップ件数が表示されます。
4. 更新時は新しいJSONを選び、既存データの全件置換します。

ファイル選択画面でGoogleドライブを選べる端末では、事前のダウンロードは不要です。

### Androidの共有から取り込む（試験対応）

インストール済みのBookShelfをJSONファイルの共有先として選べます。Googleへの認可やトークンは使用しません。

1. ファイル管理アプリなどで蔵書JSONを選び、「共有」からBookShelfを選択します。
2. BookShelfに表示されるファイル名を確認し、「このファイルを取り込む」を押します。
3. 登録済みの蔵書がある場合は、全件置換の確認に進みます。「取り込まずに閉じる」なら蔵書は変わりません。

Googleドライブでは、リンクの「共有」ではなくファイル本体を送る「コピーを送信」などを使用してください。名称・対応はアプリによって異なり、実機での確認が必要です。JSONを1ファイルずつ受け付けます。共有先にBookShelfが出ない場合は、更新後にオンラインで一度起動し、必要に応じてPWAを再インストールしてください。再インストール前には元のJSONを保管してください。通常のファイル選択も引き続き使用できます。


## 入力データの作成

BookShelf本体はAmazonへのログインや直接同期を行いません。
[Kindle蔵書エクスポートツール（ExportKindle.js）](https://gist.github.com/ledsun/21f83c4e48cf6fe51e4b6848e8671656) で、BookShelfに取り込む `books.json` を作成できます。

1. PCのChromeで [Kindle Cloud Reader](https://read.amazon.co.jp/) を開き、Amazonにログインします。
2. Chromeの開発者ツールを開き、Consoleタブを選択します。
3. Gistの `ExportKindle.js` の内容を確認し、Consoleで実行します。
4. 取得が完了すると `books.json` がダウンロードされます。
5. ファイルをAndroid端末へ移し、BookShelfの「データ管理」からインポートします。

## 保存データとプライバシー

認証Cookie、Amazonログイン情報、外部フォントは使用しません。

JSONファイルや蔵書一覧をインターネット上へアップロードしません。
解析サービスは使用しません。
入力データから以下のデータを抽出し、ブラウザのIndexedDBに保存します。

- タイトル
- 著者
- ASIN
- 検証済み書影URL
- 漫画フラグ
- 検索用文字列
- 漫画のシリーズ判定用キー・表示名・巻数

共有で受け取ったJSONは、画面への受け渡しのため別のIndexedDBに一時保存します。画面が受け取る際に一時保存を削除し、その後は取り込み・破棄・画面終了までメモリ上で保持します。未受領のファイルは1時間で期限切れになり、次の共有受信または受領時に削除します。画面を再読み込みした場合は、もう一度共有してください。

Service WorkerのCache Storageには静的アプリファイルのみ保存します。

詳細を開くと`coverImageUrl`の画像を読み込みます。画像リクエストに認証情報やRefererは付けません。

異なる端末・ブラウザへは再インポートが必要です。

## 開発者向け情報

ローカル起動・テスト、GitHub Pagesへのデプロイ、入力JSONの仕様は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

# BookShelf

Kindleからエクスポートした蔵書JSONを、Android端末内で検索する個人用PWAです。

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

Service WorkerのCache Storageには静的アプリファイルのみ保存します。

詳細を開くと`productUrl`の画像を読み込ます。画像リクエストに認証情報やRefererは付けません。

異なる端末・ブラウザへは再インポートが必要です。

## 書影

`books.json` の `productUrl` は商品ページではなく画像URLとして観測されました。HTTPSの `m.media-amazon.com/images/I/` または `/images/P/` 以下の画像URLのみ受け付けます。詳細表示時にオンラインで取得し、Service Workerには保存しません。オフライン・URL欠損・取得失敗の場合は説明を表示します。ブラウザの通常のHTTPキャッシュが画像を保持する可能性はありますが、オフライン書影は保証しません。以前のインポートでは画像URLを保存していないため、新しいJSONを再インポートしてください。

一覧にはタイトル・著者と、`mangaOrComicAsin` が `true` の場合「漫画・コミック」、`false` の場合「通常の書籍」を表示します。値の欠損・真偽値以外の場合は「種別不明」です。これは入力フラグに基づく表示で、アプリが分類を推定するものではありません。ASINは検索と詳細表示で使用し、一覧には表示しません。既存データへ種別を反映するにはJSONを再インポートしてください。

## 開発者向け情報

ローカル起動・テスト、GitHub Pagesへのデプロイ、入力JSONの仕様は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

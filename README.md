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

## 開発者向け情報
### ローカル起動・テスト

```sh
python3 -m http.server 8000 --directory app
# http://localhost:8000 を開く（file://では動作しません）
npm ci
npm test
npx playwright install chromium
npm run test:browser
# インストール済みChromeを使う場合
BROWSER_PATH=/usr/bin/google-chrome npm run test:browser
```

テストは架空の書籍のみを生成します。ブラウザテストはプロジェクトサブパスとモバイルサイズで実施します。

### GitHub Pages

GitHubリポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定してください。

mainへのpushでテスト後に公式Pages Actionsが `app/` を公開します。公開URLは通常 `https://<user>.github.io/<repository-name>/` です。

静的ファイルを更新するときは `app/sw.js` のCACHEバージョンを変更してください。
更新したService Workerは既存タブを閉じて再度開くと適用されます。
更新時にIndexedDBは削除しません。

### 入力JSON

現在のエクスポートツールは、次の6フィールドを持つ書籍オブジェクトの配列を `books.json` に出力します。以下は架空の例です。フィールドの意味はツールの出力と取込処理に基づくもので、Amazonの正式なAPI仕様ではありません。

```json
[
  {
    "asin": "B000000001",
    "title": "架空のRuby設計入門",
    "authors": ["架空 太郎"],
    "productUrl": "https://m.media-amazon.com/images/I/fiction-book._SY400_.jpg",
    "mangaOrComicAsin": false,
    "originType": null
  },
  {
    "asin": "B000000002",
    "title": "架空の漫画",
    "authors": ["架空 花子", "架空 次郎"],
    "productUrl": null,
    "mangaOrComicAsin": true,
    "originType": null
  }
]
```

画像URLも架空であり、このサンプルの書影は取得できません。

| フィールド | 想定する型 | BookShelfでの扱い |
| --- | --- | --- |
| `title` | 文字列 | 必須。前後の空白を除去し、空または文字列でないタイトルのレコードはスキップ。検索・一覧・詳細に使用。 |
| `asin` | 文字列 | 任意。前後の空白を除去して大文字に正規化し、重複排除・検索・詳細に使用。一覧には表示しない。 |
| `authors` | 文字列配列 | 任意。著者名を「、」で結合し、検索・一覧・詳細に使用。欠損時は著者情報なしとして取り込む。 |
| `productUrl` | 文字列または `null` | 任意。商品ページではなく書影の画像URL。検証を通るURLだけを保存し、詳細表示時に読み込む。 |
| `mangaOrComicAsin` | 真偽値または `null` | 任意。`true` は「漫画・コミック」、`false` は「通常の書籍」、欠損・それ以外の値は「種別不明」と表示。 |
| `originType` | ツールが出力する値または `null` | 使用・保存しない。上記以外のフィールドも取り込まない。 |

書影URLはHTTPSの `m.media-amazon.com` に限定し、パスは `/images/I/` または `/images/P/` 直下、ファイル名は英数字・`.`・`_`・`+`・`-`、拡張子は `jpg` / `jpeg` / `png` / `webp` を受け付けます。認証情報、標準以外のポート、クエリ、フラグメントを含むURLは拒否します。不正な書影URLでも書籍自体は取り込めます。

互換形式として `{"itemsList":[...]}` も受け付けます。タイトルは `title` / `Title` / `name`、ASINは `asin` / `ASIN`、著者は `authors` / `author` / `Authors` / `Author` に対応します。著者には文字列、文字列配列、`name` または `displayName` を持つオブジェクトとその配列も使用できます。これらは取込処理が対応する追加形式です。

ASIN・著者なしでも有効なタイトルがあれば取り込みます。ASINの重複は最初の有効なレコードを採用し、ASINのないレコードは重複排除しません。商品リンクは正規化後のASINが英数字10文字の場合だけ生成します。JSONの構文エラー、配列以外の構造、空の配列、有効な書籍が0件のファイルは拒否し、既存データを保持します（削除は専用操作を使用）。

## 保存とプライバシー

元ファイルからタイトル・著者・ASIN・検証済み書影URL・漫画フラグと検索用文字列のみを抽出し、ブラウザのIndexedDBに保存します。JSONファイルや蔵書一覧をアップロードしません。詳細を開くときだけ、`productUrl`の画像をAmazonの画像配信サーバーから読み込むため、その画像URLと接続情報はAmazon側に伝わります。画像リクエストに認証情報やRefererは付けません。認証Cookie、Amazonログイン情報、解析サービス、外部フォントは使用しません。Service WorkerのCache Storageには静的アプリファイルだけを保存します。

**ブラウザのサイトデータ削除、ブラウザの保存領域の回収、端末変更でデータを失う可能性があります。元のJSONを別途保管してください。** 保存先はオリジン単位です。同じGitHub Pagesホストで動く別アプリからも原理的にアクセスできるため、そのホストには信頼できるアプリだけを置いてください。異なる端末・ブラウザへは再インポートが必要です。保存容量不足などの保存失敗時はトランザクションを中止し既存データを保持します。

`.gitignore` はJSONエクスポート全般とWindows付随ファイルを除外し、package設定だけを許可します。実データを `app/` に置かないでください。すでに追跡済みのファイルにはignoreが効かないため、コミット前に確認してください。

## 制約

JSON全体をメモリに読み込み、正規化・検索はメインスレッドで行います。約10,000冊を想定し、著しく大きいファイルは端末のメモリに制約されます。日本語分かち書き、曖昧検索、本文検索、同期、アカウント、サーバー処理はありません。複数タブ間の表示は自動同期しません（再読み込みで反映）。HTTPSまたはlocalhostが必要です。プライベートモードやストレージを禁止した環境では保存・PWA機能が制限される場合があります。


## 書影

`books.json` の `productUrl` は商品ページではなく画像URLとして観測されました。HTTPSの `m.media-amazon.com/images/I/` または `/images/P/` 以下の画像URLのみ受け付けます。詳細表示時にオンラインで取得し、Service Workerには保存しません。オフライン・URL欠損・取得失敗の場合は説明を表示します。ブラウザの通常のHTTPキャッシュが画像を保持する可能性はありますが、オフライン書影は保証しません。以前のインポートでは画像URLを保存していないため、新しいJSONを再インポートしてください。

一覧にはタイトル・著者と、`mangaOrComicAsin` が `true` の場合「漫画・コミック」、`false` の場合「通常の書籍」を表示します。値の欠損・真偽値以外の場合は「種別不明」です。これは入力フラグに基づく表示で、アプリが分類を推定するものではありません。ASINは検索と詳細表示で使用し、一覧には表示しません。既存データへ種別を反映するにはJSONを再インポートしてください。

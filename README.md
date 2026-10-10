# BookShelf

Kindleからエクスポートした蔵書JSONを、Android端末内で検索する個人用PWAです。タイトル・著者・ASINの部分一致、空白区切りのAND検索、詳細表示、Amazon商品リンク、JSONによる全件更新、データ削除に対応します。大文字小文字を区別せず、Unicode NFKCで全角英数字も正規化します。

HTML/CSS・Vanilla JavaScript ES Modules・IndexedDB・Service Workerで構成し、ビルドと外部ランタイム依存はありません。検索文字列を事前生成し、入力を120ms debounce、結果は50件ずつ追加表示します。

## ローカル起動・テスト

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

## GitHub Pages

GitHubリポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定してください。mainへのpushでテスト後に公式Pages Actionsが `app/` のみを公開します。初回はActionsの実行許可も確認してください。公開URLは通常 `https://<user>.github.io/<repository-name>/` です。相対URLで任意のプロジェクトサブパスに対応します。実データ、テスト、開発依存はデプロイしません。

静的ファイルを更新するときは `app/sw.js` のCACHEバージョン（`v1`）を変更してください。更新したService Workerは既存タブを閉じて再度開くと適用されます。IndexedDBは更新時に削除しません。

## Android Chromeでの使い方

1. 公開URLにオンラインでアクセスします。
2. Chromeメニューから「ホーム画面に追加」または「アプリをインストール」を選択します（表記は端末で異なります）。
3. 「データ管理」からJSONファイルを選択します。結果に取込冊数、不正・重複のスキップ件数が表示されます。
4. 更新時も新しいJSONを選び、既存データの全件置換を確認します。差分追加ではありません。

初回アクセスでアプリの静的ファイルをキャッシュします。準備完了後はオフライン起動・検索・インポートができます。Amazonリンクを開くには通信が必要です。

## 入力JSON

リポジトリに置かれていた非公開の入力ファイルでは、トップレベル配列と `asin`（文字列）、`title`（文字列）、`authors`（文字列配列）、`productUrl`（Amazon画像URL）を確認しました。これは観測した形式であり、Amazonの正式なAPI仕様ではありません。

以下は架空の例です。

```json
[
  {"asin":"B000000001","title":"架空のRuby設計入門","authors":["架空 太郎"]},
  {"title":"架空の日本語の本","author":"架空 花子"}
]
```

`{"itemsList":[...]}` も受け付けます。タイトルは `title` / `Title` / `name`、ASINは `asin` / `ASIN`、著者は `authors` / `author` / `Authors` / `Author` を想定します。著者は文字列、文字列配列、`name` または `displayName` を持つオブジェクトとその配列を受け付けます。この追加形式は互換性のための仮定です。

空・不正なタイトルを持つレコードはスキップします。ASIN・著者なしでもタイトルがあれば取り込みます。ASINは大文字に正規化し、重複は先に出現したレコードを採用します。ASINのないレコードは重複排除しません。商品リンクは英数字10文字のASINだけ生成します。空の配列・有効な書籍が0件のファイルは拒否します（削除は専用操作を使用）。

## 保存とプライバシー

元ファイルからタイトル・著者・ASIN・検証済み書影URLと検索用文字列のみを抽出し、ブラウザのIndexedDBに保存します。JSONファイルや蔵書一覧をアップロードしません。詳細を開くときだけ、`productUrl`の画像をAmazonの画像配信サーバーから読み込むため、その画像URLと接続情報はAmazon側に伝わります。画像リクエストに認証情報やRefererは付けません。認証Cookie、Amazonログイン情報、解析サービス、外部フォントは使用しません。Service WorkerのCache Storageには静的アプリファイルだけを保存します。

**ブラウザのサイトデータ削除、ブラウザの保存領域の回収、端末変更でデータを失う可能性があります。元のJSONを別途保管してください。** 保存先はオリジン単位です。同じGitHub Pagesホストで動く別アプリからも原理的にアクセスできるため、そのホストには信頼できるアプリだけを置いてください。異なる端末・ブラウザへは再インポートが必要です。保存容量不足などの保存失敗時はトランザクションを中止し既存データを保持します。

`.gitignore` はJSONエクスポート全般とWindows付随ファイルを除外し、package設定だけを許可します。実データを `app/` に置かないでください。すでに追跡済みのファイルにはignoreが効かないため、コミット前に確認してください。

## 制約

JSON全体をメモリに読み込み、正規化・検索はメインスレッドで行います。約10,000冊を想定し、著しく大きいファイルは端末のメモリに制約されます。日本語分かち書き、曖昧検索、本文検索、同期、アカウント、サーバー処理はありません。複数タブ間の表示は自動同期しません（再読み込みで反映）。HTTPSまたはlocalhostが必要です。プライベートモードやストレージを禁止した環境では保存・PWA機能が制限される場合があります。


## 書影

`books.json` の `productUrl` は商品ページではなく画像URLとして観測されました。HTTPSの `m.media-amazon.com/images/I/` または `/images/P/` 以下の画像URLのみ受け付けます。詳細表示時にオンラインで取得し、Service Workerには保存しません。オフライン・URL欠損・取得失敗の場合は説明を表示します。ブラウザの通常のHTTPキャッシュが画像を保持する可能性はありますが、オフライン書影は保証しません。以前のインポートでは画像URLを保存していないため、新しいJSONを再インポートしてください。

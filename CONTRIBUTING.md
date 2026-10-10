# 開発者向け情報

[READMEに戻る](README.md)

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

## README用動画

開発依存とChrome、PlaywrightのFFmpegを用意した後、次のコマンドで撮影できます。

```sh
npx playwright install ffmpeg
node scripts/demo-video.js
# 別のChromeを使う場合
BROWSER_PATH=/path/to/chrome node scripts/demo-video.js
```

390 × 844pxのモバイル表示で、検索・書籍詳細・漫画3巻の切り替えを録画します。動画とプレビュー画像は `docs/videos/` に保存します。架空の蔵書を生成し、書影のリクエストは撮影時だけ自作SVGで応答します。実データや外部の書影は使用しません。アプリ本体の書影処理は通常どおり動作します。動画・撮影スクリプトはPagesの公開対象に含まれません。README・動画・撮影スクリプトのみの変更ではGitHub Actionsは起動しません（`package.json` の変更は起動対象です）。

README内で再生するGIFは、通常版のFFmpegを使って動画から生成できます（Playwright同梱版はGIF変換に対応していません）。

```sh
ffmpeg -y -i docs/videos/bookshelf-demo.webm -filter_complex "fps=5,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse" -loop 0 docs/videos/bookshelf-demo.gif
```

## README用スクリーンショット

開発依存とChromeを用意した後、次のコマンドで撮影できます。

```sh
node scripts/screenshots.js
# インストール済みChromeを使う場合
BROWSER_PATH=/usr/bin/google-chrome node scripts/screenshots.js
```

架空の蔵書をインポートして検索し、390 × 844pxのモバイル表示をライト・ダーク両方で撮影します。画像は `docs/screenshots/` に保存します。実データは読み込まず、外部の書影も取得しません。画像・撮影スクリプトはPagesの公開対象に含まれません。

## GitHub Pages

GitHubリポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定してください。

テストとデプロイは別のワークフローで実行します。

- テスト（`test.yml`）: mainへのpushとPRで、`app/`・`tests/`・`package.json`・`package-lock.json`・テストワークフローの変更時に起動します。
- デプロイ（`pages.yml`）: mainへのpushで、`app/` またはデプロイワークフローの変更時に、公式Pages Actionsが `app/` を公開します。
- どちらもActions画面から手動実行できます。デプロイはmainブランチに限定します。

アプリ変更時は両方が独立して起動し、デプロイはテスト完了を待ちません。README・動画・撮影スクリプトだけの変更では、どちらも起動しません。公開URLは通常 `https://<user>.github.io/<repository-name>/` です。

静的ファイルを更新するときは `app/sw.js` のCACHEバージョンを変更してください。
更新したService Workerは既存タブを閉じて再度開くと適用されます。
更新時にIndexedDBは削除しません。

## 入力JSON

現在のエクスポートツールは、次の6フィールドを持つ書籍オブジェクトの配列を `books.json` に出力します。以下は架空の例です。

```json
[
  {
    "asin": "B000000001",
    "title": "架空のRuby設計入門",
    "authors": ["架空 太郎"],
    "coverImageUrl": "https://m.media-amazon.com/images/I/fiction-book._SY400_.jpg",
    "mangaOrComicAsin": false,
    "originType": null
  },
  {
    "asin": "B000000002",
    "title": "架空の漫画",
    "authors": ["架空 花子", "架空 次郎"],
    "coverImageUrl": null,
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
| `coverImageUrl` | 文字列または `null` | 任意。商品ページではなく書影の画像URL。検証を通るURLだけを保存し、詳細表示時に読み込む。 |
| `mangaOrComicAsin` | 真偽値または `null` | 任意。`true` は「漫画・コミック」、`false` は「通常の書籍」、欠損・それ以外の値は「種別不明」と表示。 |
| `originType` | ツールが出力する値または `null` | 使用・保存しない。上記以外のフィールドも取り込まない。 |

書影URLはHTTPSの `m.media-amazon.com` に限定し、パスは `/images/I/` または `/images/P/` 直下、ファイル名は英数字・`.`・`_`・`+`・`-`、拡張子は `jpg` / `jpeg` / `png` / `webp` を受け付けます。認証情報、標準以外のポート、クエリ、フラグメントを含むURLは拒否します。不正な書影URLでも書籍自体は取り込めます。

書影は `coverImageUrl` のみを使用します。欠損・`null`・不正な値の場合は書影なしとして取り込みます。

互換形式として `{"itemsList":[...]}` も受け付けます。タイトルは `title` / `Title` / `name`、ASINは `asin` / `ASIN`、著者は `authors` / `author` / `Authors` / `Author` に対応します。著者には文字列、文字列配列、`name` または `displayName` を持つオブジェクトとその配列も使用できます。これらは取込処理が対応する追加形式です。

ASIN・著者なしでも有効なタイトルがあれば取り込みます。ASINの重複は最初の有効なレコードを採用し、ASINのないレコードは重複排除しません。商品リンクは正規化後のASINが英数字10文字の場合だけ生成します。JSONの構文エラー、配列以外の構造、空の配列、有効な書籍が0件のファイルは拒否し、既存データを保持します（削除は専用操作を使用）。

## シリーズの保存情報

`app/series.js` が漫画のタイトルから `seriesKey`（比較用キー）、`seriesTitle`（共通タイトル）、`volume`（巻数、判定不能時は `null`）を生成します。`parseLibrary` が漫画の取り込み時だけ追加し、既存の書籍レコードと同じIndexedDBストアに保存します。入力JSONの属性追加やDBバージョン変更は不要です。元タイトルと検索用文字列は保持します。

読み込み時は保存済みキーで表示項目を集約し、シリーズを再判定しません。キーのない旧レコードは単独表示を維持します。ルール変更を反映する場合は再インポートします。

テストは架空データで巻数・表記ゆれ・再掲タイトル・続編の分離・旧レコード・検索絞り込みを確認します。ブラウザテストは、巻切り替え時の書影リクエストとオフラインでのシリーズ情報の保持も検証します。

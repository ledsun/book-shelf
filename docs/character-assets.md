# ブックロウの画像素材

キャラクターの基本仕様は[ブックロウの設定](mascot.md)を参照してください。

提供された「BookShelf UIとブックロウのデザインガイド.png」を参照し、組み込みのimagegenで背景透過の画像を作成しました。Web用に512 × 512pxへ縮小しています。UIの文字は画像に含めずHTMLで表示します。

| 保存先 | 用途 |
| --- | --- |
| `app/images/bookrow.png` | ヘッダー、アイコンの原画 |
| `app/images/bookrow-welcome.png` | 蔵書未登録時 |
| `app/images/bookrow-empty.png` | 検索結果なし |

PWA用192px・512px・maskable 512px、Apple Touch Icon 180px、Favicon 32pxは、原画から次のコマンドで再生成できます。

```sh
BROWSER_PATH=/usr/bin/google-chrome node scripts/build-icons.js
```

maskableアイコンは背景を不透明にし、キャラクター全体が中央の安全領域に収まる余白を設けています。全画像とアイコンをService Workerのキャッシュに含め、オフラインでも表示します。

## 使用したプロンプト

### ヘッダー・アイコン

Use case: background-extraction. Create one clean isolated production asset of the brown owl mascot reading the green book from the top left header / bottom right icon in the supplied BookShelf design guide. Preserve character identity, round black glasses, cream face, yellow beak, brown wings holding open green book, subtle hand painted flat illustration style. Single owl only centered filling 85% of a square canvas, actual transparent background. No lettering, no UI, no speech bubbles, no shadows outside character, no extra objects. Output is for website header, empty state and app icon.

### 初回の空状態

Use case: background-extraction. Extract and recreate as a clean isolated transparent production illustration the owl sitting on two stacked books from the lower left welcome panel of the reference BookShelf design guide. Preserve the exact brown owl character with circular black glasses, large cream face, yellow beak, wings holding a green open book; stacked cream books with brown and teal covers underneath; small yellow joy rays at upper right. Match subtle textured flat painted illustration. Single centered illustration filling 85% square image. Transparent background, no text, no UI, no panels. Keep all character and book edges intact.

### 検索結果なし

Use case: background-extraction. Create isolated transparent production illustration matching the middle illustration of the top right 'no search results' panel of supplied BookShelf design guide. Brown owl with black circular glasses, cream face, yellow beak, puzzled wide eyes looking over a large teal blue open book. Pale blue small cloud shape behind owl, grey outline thought bubble containing three dots above to right. Preserve exact mascot identity and textured hand-painted flat style. Single illustration centered filling 85% of square canvas. Actual transparent background outside illustration. No text, no UI, no layout panels.

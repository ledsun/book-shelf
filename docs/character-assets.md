# ブックロウの画像素材

基本仕様は[ブックロウの設定](mascot.md)を参照してください。

ユーザー提供の「眼鏡をかけた本好きフクロウ司書.png」を基準に、組み込みのimagegenで背景と足元の影を除いた透過素材を作成しました。丸眼鏡、クリーム色の顔とお腹、淡い茶色の羽、葉柄の緑色のしおりを共通のデザインとしています。Web用は512 × 512pxです。

| 保存先 | 用途 |
| --- | --- |
| `app/images/bookrow.png` | ヘッダー、アイコンの原画 |
| `app/images/bookrow-welcome.png` | 蔵書未登録時 |
| `app/images/bookrow-empty.png` | 検索結果なし |

同じ立ち絵を使用し、ヘッダーではCSSで顔を拡大して円形に切り出します。淡いベージュの背景を敷き、ダークモードでも表情を読み取りやすくしています。空状態とアプリアイコンは全身像です。UIの文字はHTMLで表示します。

PWA用192px・512px・maskable 512px、Apple Touch Icon 180px、Favicon 32pxは次のコマンドで再生成できます。

```sh
BROWSER_PATH=/usr/bin/google-chrome node scripts/build-icons.js
```

maskableアイコンは不透明な背景と安全領域内の余白を設けています。全画像とアイコンをService Workerでキャッシュし、オフラインでも表示します。画像差し替え時には`app/sw.js`のキャッシュバージョンも更新します。

## 使用したプロンプト

Use case: background-extraction. Input image: edit target, supplied owl librarian. Create a clean transparent cutout of this exact character for a BookShelf website mascot. Preserve the full body, gently tilted head, round dark navy glasses, big dark brown eyes with white highlights, pale cream heart-shaped face and belly, light warm tan plumage with subtle feather spots, peach cheeks, small golden beak and feet, and olive green bookmark with cream leaf motif and brown cord held in its wing. Preserve the same pose, proportions and soft painted illustration style. Remove only the white background and ground shadow. Center the entire owl on a square transparent canvas with 6% margin above and below. No text, no extra objects, no open book. Actual transparent background.

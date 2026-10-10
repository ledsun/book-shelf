import { parseLibrary, searchBooks, amazonUrl, safeCoverUrl } from './library.js';
import { openDatabase, readLibrary, replaceLibrary } from './storage.js';
const $ = id => document.getElementById(id);
let db, books = [], matches = [], shown = 0, importedAt = null, busy = false, timer;
function summary() {
  $('summary').textContent = `登録済み: ${books.length.toLocaleString()}冊 / 最終インポート: ${importedAt ? new Date(importedAt).toLocaleString('ja-JP') : '未実施'}`;
}
function renderMore() {
  const fragment = document.createDocumentFragment();
  for (const book of matches.slice(shown, shown + 50)) {
    const li = document.createElement('li'), button = document.createElement('button');
    const title = document.createElement('strong'), author = document.createElement('span'), type = document.createElement('small');
    title.textContent = book.title; author.textContent = book.author || '著者情報なし'; type.textContent = book.mangaOrComic === true ? '漫画・コミック' : book.mangaOrComic === false ? '通常の書籍' : '種別不明';
    button.append(title, author, type); button.onclick = () => showDetail(book); li.append(button); fragment.append(li);
  }
  shown = Math.min(shown + 50, matches.length); $('results').append(fragment);
  $('more').hidden = shown >= matches.length;
}
function search() {
  matches = searchBooks(books, $('search').value); shown = 0; $('results').replaceChildren();
  $('counts').textContent = `登録済み ${books.length.toLocaleString()}冊 · 検索結果 ${matches.length.toLocaleString()}件`;
  $('message').textContent = books.length ? matches.length ? '' : '該当する書籍はありません。' : 'データ管理から蔵書JSONをインポートしてください。';
  renderMore(); summary();
}
function clearCover() { $('cover-image').onload = null; $('cover-image').onerror = null; $('cover-image').removeAttribute('src'); $('cover-image').hidden = true; }
$('detail').addEventListener('close', clearCover);
function showDetail(book) {
  clearCover();
  const image = $('cover-image');
  const coverUrl = safeCoverUrl(book.coverUrl);
  $('cover-status').textContent = coverUrl ? navigator.onLine ? '書影を読み込み中…' : 'オフラインのため書影を表示できません。' : '書影情報がありません。新しいJSONを再インポートすると反映されます。';
  if (coverUrl && navigator.onLine) {
    image.alt = `${book.title}の書影`;
    image.onload = () => { image.hidden = false; $('cover-status').textContent = ''; };
    image.onerror = () => { image.hidden = true; $('cover-status').textContent = '書影を取得できませんでした。'; };
    image.src = coverUrl;
  }
  $('detail-title').textContent = book.title; $('detail-author').textContent = book.author || '著者情報なし'; $('detail-asin').textContent = book.asin || 'なし';
  const url = amazonUrl(book.asin); $('amazon').hidden = !url;
  if (url) $('amazon').href = url; else $('amazon').removeAttribute('href');
  $('detail').showModal();
}
function setBusy(value) { busy = value; $('file').disabled = value || !db; $('delete').disabled = value || !db; $('management').setAttribute('aria-busy', String(value)); }
$('settings').onclick = () => { summary(); $('management').showModal(); };
$('close-management').onclick = () => { if (!busy) $('management').close(); };
$('management').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('close-detail').onclick = () => $('detail').close();
$('more').onclick = renderMore;
$('search').oninput = () => { clearTimeout(timer); timer = setTimeout(search, 120); };
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file || busy || !db) return;
  setBusy(true); $('import-status').textContent = 'インポート中…ファイルを確認しています。';
  try {
    await new Promise(resolve => setTimeout(resolve, 30));
    const result = parseLibrary(await file.text());
    if (books.length && !confirm(`既存の${books.length}冊を${result.books.length}冊で全件置換しますか？`)) { $('import-status').textContent = 'インポートをキャンセルしました。'; return; }
    const date = new Date().toISOString();
    $('import-status').textContent = 'インポート中…端末に保存しています。';
    await replaceLibrary(db, result.books, date);
    books = result.books; importedAt = date; search();
    $('import-status').textContent = `${books.length.toLocaleString()}冊を取り込みました（入力${result.total}件、不正${result.skipped}件、重複${result.duplicates}件をスキップ）。`;
  } catch (error) { $('import-status').textContent = `インポート失敗: ${error.message} 既存データは保持されています。`; }
  finally { $('file').value = ''; setBusy(false); }
};
$('delete').onclick = async () => {
  if (busy || !db || !confirm('端末内の全蔵書データを削除しますか？')) return;
  setBusy(true);
  try { await replaceLibrary(db, [], null); books = []; importedAt = null; search(); $('import-status').textContent = '全データを削除しました。'; }
  catch (error) { $('import-status').textContent = `削除失敗: ${error.message}`; }
  finally { setBusy(false); }
};
setBusy(false);
try { db = await openDatabase(); ({ books, importedAt } = await readLibrary(db)); search(); setBusy(false); }
catch (error) { $('message').textContent = `保存領域を開けません: ${error.message} ブラウザ設定を確認して再読み込みしてください。`; }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { $('message').textContent += ' オフライン準備に失敗しました。オンラインで再読み込みしてください。'; });

import { driveConfig } from './drive-config.js';
import { prepareDrive, readDriveFile } from './drive.js';
import { createReviewPrompt } from './review-prompt.js';
import { parseLibrary, searchBooks, amazonUrl, safeCoverUrl } from './library.js';
import { openDatabase, readLibrary, replaceLibrary, readDriveSource, forgetDriveSource } from './storage.js';
import { libraryItems, sortVolumes, volumeLabel } from './series.js';
const $ = id => document.getElementById(id);
for (const id of ['welcome-guide', 'management-guide']) {
  $(id).prepend($('usage-guide-template').content.cloneNode(true));
}
let driveFile = null, driveReady = false;
const driveConfigured = Boolean(driveConfig.clientId && driveConfig.apiKey && driveConfig.appId);
let db, books = [], matches = [], items = [], shown = 0, importedAt = null, busy = false, timer;
function summary() {
  $('summary').textContent = `登録済み: ${books.length.toLocaleString()}冊 / ${items.filter(item => item.isSeries).length.toLocaleString()}シリーズ / 最終インポート: ${importedAt ? new Date(importedAt).toLocaleString('ja-JP') : '未実施'}`;
}
function renderMore() {
  const fragment = document.createDocumentFragment();
  for (const item of matches.slice(shown, shown + 50)) {
    const li = document.createElement('li'), button = document.createElement('button');
    const title = document.createElement('strong'), author = document.createElement('span'), type = document.createElement('small');
    const book = item.books[0];
    title.textContent = item.title; author.textContent = item.author || '著者情報なし'; type.textContent = item.isSeries ? `漫画・コミック · 一致${item.books.length}冊 / 所有${item.total}冊` : book.mangaOrComic === true ? '漫画・コミック' : book.mangaOrComic === false ? '通常の書籍' : '種別不明';
    button.className = 'book-detail';
    button.append(title, author, type); button.onclick = () => showDetail(item);
    const promptButton = document.createElement('button');
    promptButton.className = 'review-prompt'; promptButton.textContent = '文豪風の紹介文を作る';
    promptButton.setAttribute('aria-label', `${item.title}の文豪風の紹介文を作る`);
    promptButton.onclick = () => {
      const { writer, text } = createReviewPrompt(item);
      $('prompt-writer').textContent = `今回の文豪：${writer}`;
      $('prompt-text').value = text; $('copy-status').textContent = '';
      $('review-prompt').showModal();
    };
    li.append(button, promptButton); fragment.append(li);
  }
  shown = Math.min(shown + 50, matches.length); $('results').append(fragment);
  $('more').hidden = shown >= matches.length;
}
function search() {
  $('welcome-guide').hidden = books.length !== 0;
  const found = new Set(searchBooks(books, $('search').value));
  matches = items.map(item => ({ ...item, books: item.books.filter(book => found.has(book)) })).filter(item => item.books.length); shown = 0; $('results').replaceChildren();
  $('counts').textContent = `登録済み ${books.length.toLocaleString()}冊 / ${items.filter(item => item.isSeries).length.toLocaleString()}シリーズ · 検索結果 ${matches.reduce((sum, item) => sum + item.books.length, 0).toLocaleString()}冊 / ${matches.length.toLocaleString()}件`;
  $('message').textContent = books.length ? matches.length ? '' : '該当する書籍はありません。' : 'データ管理から蔵書JSONをインポートしてください。';
  const empty = books.length === 0;
  $('state-art').hidden = matches.length !== 0;
  $('state-image').src = empty ? './images/bookrow-welcome.png' : './images/bookrow-empty.png';
  $('state-title').hidden = !empty;
  $('search-help').hidden = empty || matches.length !== 0;
  $('message').classList.toggle('empty-message', !empty && matches.length === 0);
  renderMore(); summary();
}
function clearCover() { $('cover-image').onload = null; $('cover-image').onerror = null; $('cover-image').removeAttribute('src'); $('cover-image').hidden = true; }
$('detail').addEventListener('close', clearCover);
function showDetail(item) {
  const volumes = sortVolumes(item.books);
  $('detail-heading').textContent = item.isSeries ? 'シリーズ詳細' : '書籍詳細';
  $('series-detail').hidden = !item.isSeries;
  $('series-title').textContent = item.isSeries ? item.title : '';
  $('series-count').textContent = item.isSeries ? `一致${volumes.length}冊 / 所有${item.total}冊` : '';
  $('volume-list').replaceChildren();
  const buttons = [];
  for (const book of item.isSeries ? volumes : []) {
    const li = document.createElement('li'), button = document.createElement('button');
    button.textContent = volumeLabel(book);
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => {
      for (const entry of buttons) entry.button.setAttribute('aria-pressed', String(entry.book === book));
      showBook(book);
    };
    buttons.push({ button, book }); li.append(button); $('volume-list').append(li);
  }
  if (buttons.length) buttons[0].button.setAttribute('aria-pressed', 'true');
  showBook(volumes[0]);
  $('detail').showModal();
}
function showBook(book) {
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
}
function setBusy(value) { busy = value; $('file').disabled = value || !db; $('delete').disabled = value || !db; $('management').setAttribute('aria-busy', String(value)); updateDriveControls(); }
function updateDriveControls() {
  $('drive-select').disabled = busy || !db || !driveReady;
  $('drive-update').disabled = busy || !db || !driveReady || !driveFile;
  $('drive-forget').disabled = busy || !db || !driveFile;
  $('drive-update').hidden = $('drive-forget').hidden = !driveFile;
  $('drive-source').textContent = driveFile ? `前回のファイル：${driveFile.name}` : '';
}
function openManagement() {
  summary(); $('management').showModal();
  if (driveConfigured && !driveReady) {
    $('drive-status').textContent = 'Googleドライブを準備しています…';
    prepareDrive().then(() => {
      driveReady = true; $('drive-status').textContent = ''; updateDriveControls();
    }).catch(error => { $('drive-status').textContent = error.message; });
  }
}
$('drive-status').textContent = driveConfigured ? '' : 'Googleドライブ連携は未設定です。ファイル選択画面からドライブを利用できます。';
$('settings').onclick = openManagement;
$('start-import').onclick = openManagement;
$('close-management').onclick = () => { if (!busy) $('management').close(); };
$('management').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('close-detail').onclick = () => $('detail').close();
$('close-prompt').onclick = () => $('review-prompt').close();
$('copy-prompt').onclick = async () => {
  const text = $('prompt-text').value;
  try {
    await navigator.clipboard.writeText(text);
    $('copy-status').textContent = 'コピーしました。ChatAIアプリに貼り付けてください。';
  } catch {
    $('prompt-text').focus(); $('prompt-text').select();
    $('copy-status').textContent = '自動コピーできませんでした。選択されたプロンプトを手動でコピーしてください。';
  }
};
for (const id of ['detail', 'review-prompt']) $(id).addEventListener('click', event => {
  if (event.target !== $(id)) return;
  const bounds = $(id).getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    $(id).close();
  }
});
$('more').onclick = renderMore;
$('search').oninput = () => { clearTimeout(timer); timer = setTimeout(search, 120); };
async function importText(text, source = null) {
  const result = parseLibrary(text);
  if (books.length && !confirm(`既存の${books.length}冊を${result.books.length}冊で全件置換しますか？`)) {
    $('import-status').textContent = 'インポートをキャンセルしました。'; return;
  }
  const date = new Date().toISOString();
  $('import-status').textContent = 'インポート中…端末に保存しています。';
  await replaceLibrary(db, result.books, date, source);
  driveFile = source;
  books = result.books; items = libraryItems(books); importedAt = date; search();
  $('import-status').textContent = `${books.length.toLocaleString()}冊を取り込みました（入力${result.total}件、不正${result.skipped}件、重複${result.duplicates}件をスキップ）。`;
}
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file || busy || !db) return;
  setBusy(true); $('import-status').textContent = 'インポート中…ファイルを確認しています。';
  try { await importText(await file.text()); }
  catch (error) { $('import-status').textContent = `インポート失敗: ${error.message} 既存データは保持されています。`; }
  finally { $('file').value = ''; setBusy(false); }
};
async function importDrive(previous) {
  if (busy || !db || !driveReady) return;
  setBusy(true); $('import-status').textContent = 'Googleの認可後にファイルを取得します…';
  let restorePickerView;
  try {
    const result = await readDriveFile(driveConfig, previous, {
      beforePick: () => {
        const x = window.scrollX, y = window.scrollY;
        const dialogScroll = $('management').scrollTop;
        const bodyStyle = document.body.getAttribute('style');
        $('management').close();
        // Picker focuses an iframe appended to the document. Keep its focus
        // changes from scrolling the library behind the picker, including errors.
        Object.assign(document.body.style, {
          position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%'
        });
        restorePickerView = () => {
          if (bodyStyle === null) document.body.removeAttribute('style');
          else document.body.setAttribute('style', bodyStyle);
          $('management').showModal();
          $('management').scrollTop = dialogScroll;
          window.scrollTo(x, y);
          restorePickerView = null;
        };
      },
      afterPick: () => restorePickerView?.()
    });
    if (result) await importText(result.text, result.file);
    else $('import-status').textContent = 'インポートをキャンセルしました。';
  } catch (error) { $('import-status').textContent = `インポート失敗: ${error.message} 既存データは保持されています。`; }
  finally { setBusy(false); }
}
$('drive-select').onclick = () => importDrive(null);
$('drive-update').onclick = () => importDrive(driveFile);
$('drive-forget').onclick = async () => {
  if (busy || !db) return;
  setBusy(true);
  try { await forgetDriveSource(db); driveFile = null; $('import-status').textContent = '前回のファイルを忘れました。'; }
  catch { $('import-status').textContent = '前回のファイル情報を削除できませんでした。'; }
  finally { setBusy(false); }
};
$('delete').onclick = async () => {
  if (busy || !db || !confirm('端末内の全蔵書データを削除しますか？')) return;
  setBusy(true);
  try { await replaceLibrary(db, [], null); books = []; items = []; importedAt = null; driveFile = null; search(); $('import-status').textContent = '全データを削除しました。'; }
  catch (error) { $('import-status').textContent = `削除失敗: ${error.message}`; }
  finally { setBusy(false); }
};
setBusy(false);
try { db = await openDatabase(); ({ books, importedAt } = await readLibrary(db)); driveFile = await readDriveSource(db); items = libraryItems(books); search(); setBusy(false); }
catch (error) { $('message').textContent = `保存領域を開けません: ${error.message} ブラウザ設定を確認して再読み込みしてください。`; }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { $('message').textContent += ' オフライン準備に失敗しました。オンラインで再読み込みしてください。'; });

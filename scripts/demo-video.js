import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rename } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Only application assets are served. All books and covers below are original fiction.
const appRoot = new URL('../app/', import.meta.url);
const output = new URL('../docs/videos/', import.meta.url);
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', svg: 'image/svg+xml', webmanifest: 'application/manifest+json' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = new URL(`.${path === '/' ? '/index.html' : path}`, appRoot);
    if (!file.href.startsWith(appRoot.href)) throw new Error('Invalid path');
    response.setHeader('Content-Type', types[file.pathname.split('.').pop()] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
const coverUrl = id => `https://m.media-amazon.com/images/I/demo-${id}.png`;
const books = [
  ...[1, 2, 3].map(volume => ({ title: `本と喫茶のある街 ${volume} (架空コミックス)`, authors: ['架空 さくら'], mangaOrComicAsin: true, coverImageUrl: coverUrl(volume) })),
  { title: 'Rubyではじめる小さな道具', authors: ['架空 太郎'], mangaOrComicAsin: false, coverImageUrl: coverUrl('ruby') },
  { title: 'Rubyの設計ノート', authors: ['架空 花子'], mangaOrComicAsin: false, coverImageUrl: coverUrl('notes') },
  { title: '週末の読書と散歩', authors: ['架空 さくら'], mangaOrComicAsin: false },
];
function cover(id) {
  const comic = /^[123]$/.test(id);
  const color = ({ 1: '#46776c', 2: '#ac654e', 3: '#526b97', ruby: '#944f5d', notes: '#526b97' })[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="510" viewBox="0 0 360 510"><rect width="360" height="510" fill="#f6efdf"/><rect x="18" y="18" width="324" height="474" fill="${color}"/><text x="42" y="66" fill="#f6efdf" font-family="sans-serif" font-size="14" letter-spacing="3">BOOKSHELF / ORIGINAL DEMO</text><text x="42" y="133" fill="#fff" font-family="sans-serif" font-size="32" font-weight="bold">${comic ? '本と喫茶の' : id === 'notes' ? 'Rubyの' : 'Rubyではじめる'}</text><text x="42" y="177" fill="#fff" font-family="sans-serif" font-size="32" font-weight="bold">${comic ? 'ある街' : id === 'notes' ? '設計ノート' : '小さな道具'}</text><circle cx="240" cy="292" r="67" fill="#e9c985"/><path d="M55 354V269L130 245L205 269V354L130 330Z" fill="#f6efdf"/><path d="M130 245V330M65 284L117 267M65 302L117 285M143 267L192 283M143 285L192 301" stroke="${color}" stroke-width="4" fill="none"/><text x="42" y="424" fill="#fff" font-family="sans-serif" font-size="${comic ? 46 : 22}">${comic ? `第 ${id} 巻` : 'つくって、育てる。'}</text><text x="42" y="465" fill="#f6efdf" font-family="sans-serif" font-size="16">${comic ? '架空 さくら' : id === 'notes' ? '架空 花子' : '架空 太郎'} / 架空出版</text></svg>`;
}
let browser, context;
try {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || '/usr/bin/google-chrome' });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ja-JP', colorScheme: 'light', serviceWorkers: 'block', recordVideo: { dir: output.pathname, size: { width: 390, height: 844 } } });
  // Synthetic Amazon URLs satisfy normal validation; no request reaches Amazon.
  await context.route('https://m.media-amazon.com/**', route => {
    const id = /demo-([\w]+)\.png$/.exec(route.request().url())?.[1];
    assert.ok(id, 'Only fictional demo covers may be requested');
    return route.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: cover(id) });
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'm.media-amazon.com') return route.fallback();
    throw new Error(`Unexpected external request: ${url.origin}`);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !document.querySelector('#file').disabled);
  await page.locator('#settings').click();
  await page.locator('#file').setInputFiles({ name: 'demo-books.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(books)) });
  await page.waitForFunction(() => document.querySelector('#import-status').textContent.startsWith('6冊'));
  await page.locator('#close-management').click();
  await page.addStyleTag({ content: 'body::after{content:"デモ用の架空の蔵書・自作の表紙";position:fixed;bottom:0;left:0;right:0;text-align:center;padding:6px;background:#284d46;color:white;font:12px sans-serif;z-index:9999;pointer-events:none}' });
  const pause = ms => page.waitForTimeout(ms);
  const tap = async locator => {
    await locator.evaluate(element => { element.style.outline = '3px solid #dba754'; });
    await pause(350);
    await locator.click();
    await locator.evaluate(element => { element.style.outline = ''; });
  };
  await pause(1800);
  await page.locator('#search').pressSequentially('Ruby', { delay: 180 });
  await page.waitForFunction(() => document.querySelector('#results').children.length === 2);
  await page.locator('#search').blur();
  await pause(1600);
  await tap(page.locator('#results button').first());
  await page.locator('#cover-image').waitFor({ state: 'visible' });
  await pause(2300);
  await tap(page.locator('#close-detail'));
  await page.locator('#search').fill('喫茶');
  await page.waitForFunction(() => document.querySelector('#results').children.length === 1);
  await page.locator('#search').blur();
  await pause(1400);
  await tap(page.locator('#results button'));
  await page.locator('#cover-image').waitFor({ state: 'visible' });
  assert.match(await page.locator('#detail-title').textContent(), /3/);
  await pause(2300);
  for (const volume of ['1', '2']) {
    await tap(page.locator('#volume-list').getByRole('button', { name: volume, exact: true }));
    await page.waitForFunction(v => document.querySelector('#cover-image').getAttribute('src').endsWith(`demo-${v}.png`) && !document.querySelector('#cover-image').hidden, volume);
    await pause(2000);
  }
  await tap(page.locator('#close-detail'));
  await page.locator('#search').fill('');
  await pause(1600);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: new URL('poster.png', output).pathname });
  const video = page.video();
  await context.close();
  context = null;
  await rename(await video.path(), new URL('bookshelf-demo.webm', output));
  console.log('Saved docs/videos/bookshelf-demo.webm (fictional books and original SVG covers)');
} finally {
  await context?.close();
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

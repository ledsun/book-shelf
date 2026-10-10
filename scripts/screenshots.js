import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Serve only application assets; private JSON exports never enter the browser.
const appRoot = new URL('../app/', import.meta.url);
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', webmanifest: 'application/manifest+json', png: 'image/png', svg: 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = new URL(`.${path === '/' ? '/index.html' : path}`, appRoot);
    if (!file.href.startsWith(appRoot.href)) throw new Error('Invalid path');
    response.setHeader('Content-Type', types[file.pathname.split('.').pop()] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
const books = [
  { title: 'Rubyではじめる設計の基本', authors: ['架空 太郎'], mangaOrComicAsin: false },
  { title: '小さなアプリの育て方 — Ruby実践', authors: ['架空 花子'], mangaOrComicAsin: false },
  { title: 'まんがで学ぶRubyのしくみ', authors: ['架空 次郎', '架空 さくら'], mangaOrComicAsin: true },
  { title: 'Rubyでつくる日々の道具', authors: ['架空 太郎'], mangaOrComicAsin: false },
  { title: 'Rubyのある暮らし', authors: ['架空 花子'], mangaOrComicAsin: true },
  { title: '週末の読書ノート', authors: ['架空 さくら'], mangaOrComicAsin: false },
  { title: 'はじめてのJavaScript', authors: ['架空 次郎'], mangaOrComicAsin: false },
  { title: '散歩と本と喫茶店', authors: ['架空 花子'], mangaOrComicAsin: false },
];
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await mkdir(new URL('../docs/screenshots/', import.meta.url), { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP', colorScheme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('インポートしてください'));
    await page.locator('#settings').click();
    await page.locator('#file').setInputFiles({ name: 'fiction.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(books)) });
    await page.waitForFunction(() => document.querySelector('#import-status').textContent.startsWith('8冊'));
    await page.locator('#close-management').click();
    await page.locator('#search').fill('Ruby');
    await page.waitForFunction(() => document.querySelector('#results').children.length === 5);
    await page.locator('#search').blur();
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`../docs/screenshots/search-${colorScheme}.png`, import.meta.url).pathname });
    await context.close();
    console.log(`Saved search-${colorScheme}.png (390 × 844 CSS pixels, fictional books)`);
  }
} finally {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

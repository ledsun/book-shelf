import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

// The header illustration is also the source for every home-screen/tab icon.
const source = await readFile(new URL('../app/images/bookrow.png', import.meta.url));
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
try {
  const page = await browser.newPage();
  for (const [name, size, fraction, background] of [
    ['icon-192.png', 192, .9, '#f5f4ee'],
    ['icon-512.png', 512, .9, '#f5f4ee'],
    // Entire square artwork fits inside the central safe circle (radius 40%).
    ['icon-maskable-512.png', 512, .56, '#ffe8b3'],
    ['apple-touch-icon.png', 180, .9, '#f5f4ee'],
    ['favicon-32.png', 32, 1, null],
  ]) {
    const png = await page.evaluate(async ({ source, size, fraction, background }) => {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, size, size); }
      ctx.imageSmoothingQuality = 'high';
      const edge = size * fraction, offset = (size - edge) / 2;
      ctx.drawImage(image, offset, offset, edge, edge);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { source: `data:image/png;base64,${source.toString('base64')}`, size, fraction, background });
    await writeFile(new URL(`../app/icons/${name}`, import.meta.url), Buffer.from(png, 'base64'));
  }
} finally { await browser.close(); }

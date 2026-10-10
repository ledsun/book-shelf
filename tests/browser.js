import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const types={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',png:'image/png',svg:'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/book-shelf/'))throw Error();const file=path.slice('/book-shelf/'.length)||'index.html';if(file.includes('..'))throw Error();res.setHeader('Content-Type',types[file.split('.').pop()]||'application/octet-stream');res.end(await readFile(new URL('../app/'+file,import.meta.url)));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error));
 let imageRequests = 0;
 await context.route('https://m.media-amazon.com/**', async route => {
   imageRequests++;
   assert.equal(route.request().headers()['referer'], undefined);
   assert.equal(route.request().headers()['cookie'], undefined);
   if (route.request().url().includes('missing')) return route.abort();
   await route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:await readFile(new URL('../app/icons/icon-192.png',import.meta.url))});
 });
 const root=`http://127.0.0.1:${server.address().port}/book-shelf/`;
 await page.goto(root);await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('インポートしてください'));
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.locator('#settings').click();
 const upload=async records=>page.locator('#file').setInputFiles({name:'fiction.json',mimeType:'application/json',buffer:Buffer.from(typeof records==='string'?records:JSON.stringify(records))});
 const data=Array.from({length:10000},(_,i)=>({asin:`B${String(i).padStart(9,'0')}`,title:`架空 Ruby 設計 第${i}の本`,authors:['架空 太郎'],mangaOrComicAsin:i%2===0,coverImageUrl:`https://m.media-amazon.com/images/I/${i===9998?'missing':'fiction'}._SY400_.jpg`}));
 await upload(data);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('10,000冊'));
 assert.equal(await page.locator('#results li').count(),50); assert.equal(imageRequests,0); assert.match(await page.locator('#results li').nth(0).textContent(),/漫画・コミック/); assert.match(await page.locator('#results li').nth(1).textContent(),/通常の書籍/); assert.equal((await page.locator('#results').textContent()).includes('B000000000'),false);
 await upload('{');await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('インポート失敗'));assert.match(await page.locator('#summary').textContent(),/10,000/);
 await page.locator('#close-management').click();await page.locator('#search').fill('Ruby 9999');await page.waitForFunction(()=>document.querySelector('#results').children.length===1);await page.locator('#results button').click();assert.equal(await page.locator('#amazon').getAttribute('href'),'https://www.amazon.co.jp/dp/B000009999');await page.waitForFunction(()=>!document.querySelector('#cover-image').hidden); assert.equal(imageRequests,1); await page.locator('#close-detail').click();
 await page.locator('#search').fill('Ruby 9998');await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('9998'));await page.locator('#results button').click();await page.waitForFunction(()=>document.querySelector('#cover-status').textContent.includes('取得できません'));assert.equal(await page.locator('#cover-image').isVisible(),false);await page.locator('#close-detail').click();
 await page.locator('#settings').click();page.once('dialog',dialog=>dialog.dismiss());await upload([{title:'置換拒否'}]);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('キャンセル'));assert.match(await page.locator('#summary').textContent(),/10,000/);
 page.once('dialog',dialog=>dialog.accept());await upload([{title:'置換成功',author:'テスト'}]);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('1冊'));
 await page.locator('#close-management').click();await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 1冊'));await page.locator('#search').fill('置換');await page.waitForFunction(()=>document.querySelector('#results').children.length===1);
 assert.match(await page.locator('#results').textContent(),/種別不明/);await page.locator('#results button').click();assert.match(await page.locator('#cover-status').textContent(),/書影情報がありません/);await page.locator('#close-detail').click();
 await page.locator('#settings').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#delete').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('登録済み: 0冊'));
 await context.setOffline(false);
 const seriesData = [
   ...[1,2,12].map(volume => ({title:`架空連作 ${volume} (架空コミックス)`,asin:`B1000000${String(volume).padStart(2,'0')}`,authors:['架空著者'],mangaOrComicAsin:true,coverImageUrl:`https://m.media-amazon.com/images/I/volume-${volume}.jpg`})),
   ...[1,2].map(volume => ({title:`架空連作NEO ${volume}`,mangaOrComicAsin:true})),
   {title:'架空の単独漫画 1',mangaOrComicAsin:true}, {title:'架空の通常書籍',mangaOrComicAsin:false},
 ];
 await upload(seriesData);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('7冊'));
 assert.match(await page.locator('#summary').textContent(),/7冊 \/ 2シリーズ/);
 await page.locator('#close-management').click();await page.locator('#search').fill('');
 await page.waitForFunction(()=>document.querySelector('#results').children.length===4);
 const beforeSeries = imageRequests;
 assert.equal(await page.locator('#results li strong').first().textContent(),'架空連作');
 await page.locator('#results button').first().click();
 await page.waitForFunction(()=>!document.querySelector('#cover-image').hidden);
 assert.equal(imageRequests,beforeSeries+1);
 assert.equal(await page.locator('#volume-list button').count(),3);
 assert.match(await page.locator('#detail-title').textContent(),/12/);
 assert.match(await page.locator('#volume-list button').first().textContent(),/12/);
 assert.equal(await page.locator('#amazon').getAttribute('href'),'https://www.amazon.co.jp/dp/B100000012');
 await page.locator('#volume-list button').last().click();
 await page.waitForFunction(()=>!document.querySelector('#cover-image').hidden);
 assert.equal(imageRequests,beforeSeries+2);
 assert.equal(await page.locator('#amazon').getAttribute('href'),'https://www.amazon.co.jp/dp/B100000001');
 assert.equal(await page.locator('#volume-list button').last().getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('dialog[open]').count(),1);
 await page.locator('#close-detail').click();
 await page.waitForFunction(()=>document.querySelector('#cover-image').getAttribute('src')===null);
 await page.locator('#search').fill('12');
 await page.waitForFunction(()=>document.querySelector('#results').children.length===1);
 assert.equal(await page.locator('#results strong').textContent(),'架空連作');
 assert.match(await page.locator('#results').textContent(),/一致1冊 \/ 所有3冊/);
 assert.match(await page.locator('#counts').textContent(),/登録済み 7冊 \/ 2シリーズ/);
 await page.locator('#results button').click();
 assert.equal(await page.locator('#volume-list button').count(),1);
 assert.match(await page.locator('#detail-title').textContent(),/12/);
 await page.locator('#close-detail').click();
 await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 7冊 / 2シリーズ'));
 assert.equal(await page.locator('#results li').count(),4);
 const beforeOffline = imageRequests;
 await page.locator('#results button').first().click();
 assert.match(await page.locator('#cover-status').textContent(),/オフライン/);
 assert.match(await page.locator('#detail-title').textContent(),/12/);
 assert.equal(imageRequests,beforeOffline);
 await page.locator('#close-detail').click();
 // Saved pre-feature records remain individual until the next import.
 await page.evaluate(async()=>{
   const {openDatabase,replaceLibrary}=await import('./storage.js');const db=await openDatabase();
   await replaceLibrary(db,[1,2].map(id=>({id,title:`架空旧蔵書 ${id}`,search:`架空旧蔵書 ${id}`,author:'',asin:'',mangaOrComic:true,coverUrl:null})));db.close();
 });
 await page.reload();await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 2冊 / 0シリーズ'));
 assert.equal(await page.locator('#results li').count(),2);
 await page.locator('#results button').first().click();assert.equal(await page.locator('#series-detail').isVisible(),false);await page.locator('#close-detail').click();
 assert.deepEqual(errors,[]);console.log('Series Browser PASS: import grouping, series totals, maximum volume, text-only volume selection, selected-cover requests, filtered details, offline metadata persistence, legacy records');console.log('Browser PASS: subpath, 10,000-book import, limited DOM, search, detail, invalid JSON protection, replacement cancel/accept, offline reload/search, deletion');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

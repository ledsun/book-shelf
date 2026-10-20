import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const types={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',png:'image/png',svg:'image/svg+xml'};
let postedToServer = 0;
const server=createServer(async(req,res)=>{if(req.method==='POST')postedToServer++;try{const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/book-shelf/'))throw Error();const file=path.slice('/book-shelf/'.length)||'index.html';if(file.includes('..'))throw Error();res.setHeader('Content-Type',types[file.split('.').pop()]||'application/octet-stream');res.end(await readFile(new URL('../app/'+file,import.meta.url)));}catch{res.writeHead(404);res.end();}});
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
 assert.equal(await page.locator('#state-art').isVisible(),true);
 assert.match(await page.locator('#state-image').getAttribute('src'),/bookrow-welcome/);
 assert.equal(await page.locator('#search-help').isVisible(),false);
 assert.equal(await page.locator('.header-mascot').evaluate(img=>img.complete && img.naturalWidth>0),true);
 for (const [asset, size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180],['favicon-32.png',32]]) {
   assert.deepEqual(await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();return [img.naturalWidth,img.naturalHeight];},`./icons/${asset}`),[size,size]);
 }
 for (const width of [320,390,760]) {
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#welcome-guide').isVisible(),true);
 assert.match(await page.locator('#welcome-guide').textContent(),/books.json/);
 assert.equal(await page.locator('#welcome-guide a').count(),2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
 await page.locator('#start-import').click();
 assert.equal(await page.locator('#management-guide').isVisible(),true);
 assert.match(await page.locator('#management-guide').textContent(),/空白で区切る/);
 const upload=async records=>page.locator('#file').setInputFiles({name:'fiction.json',mimeType:'application/json',buffer:Buffer.from(typeof records==='string'?records:JSON.stringify(records))});
 const data=Array.from({length:10000},(_,i)=>({asin:`B${String(i).padStart(9,'0')}`,title:`架空 Ruby 設計 第${i}の本`,authors:['架空 太郎'],mangaOrComicAsin:i%2===0,coverImageUrl:`https://m.media-amazon.com/images/I/${i===9998?'missing':'fiction'}._SY400_.jpg`}));
 await upload(data);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('10,000冊'));
 assert.equal(await page.locator('#results li').count(),50); assert.equal(imageRequests,0); assert.match(await page.locator('#results li').nth(0).textContent(),/漫画・コミック/); assert.match(await page.locator('#results li').nth(1).textContent(),/通常の書籍/); assert.equal((await page.locator('#results').textContent()).includes('B000000000'),false);
 assert.equal(await page.locator('#state-art').isVisible(),false);
 await upload('{');await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('インポート失敗'));assert.match(await page.locator('#summary').textContent(),/10,000/);
 await page.locator('#close-management').click();assert.equal(await page.locator('#welcome-guide').isVisible(),false);await page.locator('#search').fill('存在しない書籍');await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('該当する書籍'));assert.equal(await page.locator('#welcome-guide').isVisible(),false);await page.locator('#search').fill('Ruby 9999');await page.waitForFunction(()=>document.querySelector('#results').children.length===1);await page.locator('#results .book-detail').click();assert.equal(await page.locator('#amazon').getAttribute('href'),'https://www.amazon.co.jp/dp/B000009999');await page.waitForFunction(()=>!document.querySelector('#cover-image').hidden); assert.equal(imageRequests,1); await page.locator('#close-detail').click();
 await page.locator('#search').fill('Ruby 9998');await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('9998'));await page.locator('#results .book-detail').click();await page.waitForFunction(()=>document.querySelector('#cover-status').textContent.includes('取得できません'));assert.equal(await page.locator('#cover-image').isVisible(),false);await page.locator('#close-detail').click();
 await page.locator('#settings').click();assert.equal(await page.locator('#management-guide').isVisible(),true);page.once('dialog',dialog=>dialog.dismiss());await upload([{title:'置換拒否'}]);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('キャンセル'));assert.match(await page.locator('#summary').textContent(),/10,000/);
 page.once('dialog',dialog=>dialog.accept());await upload([{title:'置換成功',author:'テスト'}]);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('1冊'));
 await page.locator('#close-management').click();await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 1冊'));await page.locator('#search').fill('置換');await page.waitForFunction(()=>document.querySelector('#results').children.length===1);
 await page.locator('#results .review-prompt').click();
 assert.match(await page.locator('#prompt-text').inputValue(), /対象書籍名："置換成功"/);
 await page.locator('#close-prompt').click();
 assert.match(await page.locator('#results').textContent(),/種別不明/);await page.locator('#results .book-detail').click();assert.match(await page.locator('#cover-status').textContent(),/書影情報がありません/);await page.locator('#close-detail').click();
 await page.locator('#search').fill('オフラインでも該当なし');
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('該当する書籍'));
 assert.equal(await page.locator('#state-art').isVisible(),true);
 assert.equal(await page.locator('#search-help').isVisible(),true);
 assert.match(await page.locator('#state-image').getAttribute('src'),/bookrow-empty/);
 assert.equal(await page.locator('#state-image').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true);
 assert.equal(await page.locator('.header-mascot').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true);
 await page.locator('#settings').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#delete').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('登録済み: 0冊'));
 await page.locator('#close-management').click();
 assert.equal(await page.locator('#welcome-guide').isVisible(),true);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('インポートしてください'));
 assert.equal(await page.locator('#welcome-guide').isVisible(),true);
 await page.locator('#start-import').click();
 assert.equal(await page.locator('#management-guide').isVisible(),true);
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
 // Prompt generation uses the series title even when search matches a single volume.
 await page.locator('#results .review-prompt').first().click();
 const prompt = await page.locator('#prompt-text').inputValue();
 assert.match(prompt, /対象シリーズ名：「?"架空連作"/);
 assert.match(await page.locator('#prompt-writer').textContent(), /横溝正史|与謝野晶子|夏目漱石/);
 assert.equal(await page.locator('#detail').evaluate(el=>el.open), false);
 await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async text=>{window.copiedPrompt=text;}}}));
 await page.locator('#copy-prompt').click();
 await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes('コピーしました'));
 assert.equal(await page.evaluate(()=>window.copiedPrompt), prompt);
 await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
 await page.locator('#copy-prompt').click();
 await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes('手動でコピー'));
 assert.equal(await page.locator('#prompt-text').evaluate(el=>el.selectionEnd-el.selectionStart), prompt.length);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#review-prompt').evaluate(el=>el.open), false);
 const beforeSeries = imageRequests;
 assert.equal(await page.locator('#results li strong').first().textContent(),'架空連作');
 await page.locator('#results .book-detail').first().click();
 await page.waitForFunction(()=>!document.querySelector('#cover-image').hidden);
 assert.equal(imageRequests,beforeSeries+1);
 assert.equal(await page.locator('#volume-list button').count(),3);
 assert.match(await page.locator('#detail-title').textContent(),/12/);
 assert.deepEqual(await page.locator('#volume-list button').allTextContents(), ['12', '2', '1']);
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
 await page.locator('#results .book-detail').click();
 assert.equal(await page.locator('#volume-list button').count(),1);
 assert.match(await page.locator('#detail-title').textContent(),/12/);
 await page.locator('#close-detail').click();
 await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 7冊 / 2シリーズ'));
 assert.equal(await page.locator('#results li').count(),4);
 const beforeOffline = imageRequests;
 await page.locator('#results .book-detail').first().click();
 assert.match(await page.locator('#cover-status').textContent(),/オフライン/);
 assert.match(await page.locator('#detail-title').textContent(),/12/);
 assert.equal(imageRequests,beforeOffline);
 await page.locator('#close-detail').click();
 // Desktop clicks inside the dialog (including padding) keep it open; backdrop clicks close it.
 await page.setViewportSize({width:1280,height:900});
 await page.locator('#results .book-detail').first().click();
 await page.locator('#detail-title').click();
 assert.equal(await page.locator('#detail').evaluate(dialog=>dialog.open),true);
 const detailBounds = await page.locator('#detail').boundingBox();
 await page.mouse.click(detailBounds.x+5,detailBounds.y+5);
 assert.equal(await page.locator('#detail').evaluate(dialog=>dialog.open),true);
 await page.mouse.click(10,10);
 await page.waitForFunction(()=>!document.querySelector('#detail').open);
 await page.waitForFunction(()=>document.querySelector('#cover-image').getAttribute('src')===null);
 await page.locator('#results .book-detail').first().click();
 await page.locator('#close-detail').click();
 // Saved pre-feature records remain individual until the next import.
 await page.evaluate(async()=>{
   const {openDatabase,replaceLibrary}=await import('./storage.js');const db=await openDatabase();
   await replaceLibrary(db,[1,2].map(id=>({id,title:`架空旧蔵書 ${id}`,search:`架空旧蔵書 ${id}`,author:'',asin:'',mangaOrComic:true,coverUrl:null})));db.close();
 });
 await page.reload();await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 2冊 / 0シリーズ'));
 assert.equal(await page.locator('#results li').count(),2);
 await page.locator('#results .book-detail').first().click();assert.equal(await page.locator('#series-detail').isVisible(),false);await page.locator('#close-detail').click();
 // Exercise actual multipart navigation intercepted by the service worker.
 const manifest = await (await page.request.get(root+'manifest.webmanifest')).json();
 assert.equal(manifest.share_target.action, './share-target');
 assert.equal(manifest.share_target.method, 'POST');
 await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
 const share = async (files) => {
   await Promise.all([
     page.waitForNavigation({waitUntil:'load'}),
     page.evaluate(files => {
       const form = document.createElement('form');
       form.method = 'POST'; form.enctype = 'multipart/form-data'; form.action = './share-target';
       const input = document.createElement('input'); input.type = 'file'; input.name = 'books'; input.multiple = true;
       const transfer = new DataTransfer();
       for (const file of files) transfer.items.add(new File([file.text], file.name, {type:'application/json'}));
       input.files = transfer.files; form.append(input); document.body.append(form); form.submit();
     }, files)
   ]);
   await page.waitForFunction(() => document.querySelector('#management').open);
 };
 await context.setOffline(true);
 await share([{name:'共有.json',text:JSON.stringify([{title:'架空共有蔵書'}])}]);
 await page.waitForSelector('#shared-file:not([hidden])');
 assert.equal(await page.locator('#shared-name').textContent(),'共有.json');
 assert.match(await page.locator('#summary').textContent(),/登録済み: 2冊/);
 assert.equal(new URL(page.url()).searchParams.has('share'),false);
 page.once('dialog', dialog=>dialog.dismiss());
 await page.locator('#import-shared').click();
 await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('キャンセル'));
 assert.match(await page.locator('#summary').textContent(),/登録済み: 2冊/);
 page.once('dialog', dialog=>dialog.accept());
 await page.locator('#import-shared').click();
 await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('1冊'));
 assert.equal(await page.locator('#shared-file').isVisible(),false);
 await share([{name:'不正.json',text:'{'}]);
 await page.locator('#import-shared').click();
 await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('インポート失敗'));
 assert.match(await page.locator('#summary').textContent(),/登録済み: 1冊/);
 await page.locator('#discard-shared').click();
 await page.waitForFunction(()=>document.querySelector('#shared-file').hidden);
 await share([{name:'a.json',text:'[]'},{name:'b.json',text:'[]'}]);
 await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('1つ共有'));
 assert.match(await page.locator('#summary').textContent(),/登録済み: 1冊/);
 await share([]);
 await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('リンクの共有'));
 assert.equal(postedToServer,0);
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 1冊'));
 assert.equal(await page.locator('#shared-file').isVisible(),false);
 console.log('Share Browser PASS: real multipart POST, subpath redirect, offline reception, explicit import, replacement cancellation, invalid JSON, discard, multiple/missing files, no server upload');
 assert.deepEqual(errors,[]);console.log('Series Browser PASS: import grouping, series totals, maximum volume, text-only volume selection, selected-cover requests, filtered details, offline metadata persistence, legacy records');console.log('Browser PASS: subpath, 10,000-book import, limited DOM, search, detail, invalid JSON protection, replacement cancel/accept, offline reload/search, deletion');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

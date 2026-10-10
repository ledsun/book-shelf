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
 const root=`http://127.0.0.1:${server.address().port}/book-shelf/`;
 await page.goto(root);await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('インポートしてください'));
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.locator('#settings').click();
 const upload=async records=>page.locator('#file').setInputFiles({name:'fiction.json',mimeType:'application/json',buffer:Buffer.from(typeof records==='string'?records:JSON.stringify(records))});
 const data=Array.from({length:10000},(_,i)=>({asin:`B${String(i).padStart(9,'0')}`,title:`架空 Ruby 設計 ${i}`,authors:['架空 太郎']}));
 await upload(data);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('10,000冊'));
 assert.equal(await page.locator('#results li').count(),50);
 await upload('{');await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('インポート失敗'));assert.match(await page.locator('#summary').textContent(),/10,000/);
 await page.locator('#close-management').click();await page.locator('#search').fill('Ruby 9999');await page.waitForFunction(()=>document.querySelector('#results').children.length===1);await page.locator('#results button').click();assert.equal(await page.locator('#amazon').getAttribute('href'),'https://www.amazon.co.jp/dp/B000009999');await page.locator('#close-detail').click();
 await page.locator('#settings').click();page.once('dialog',dialog=>dialog.dismiss());await upload([{title:'置換拒否'}]);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('キャンセル'));assert.match(await page.locator('#summary').textContent(),/10,000/);
 page.once('dialog',dialog=>dialog.accept());await upload([{title:'置換成功',author:'テスト'}]);await page.waitForFunction(()=>document.querySelector('#import-status').textContent.startsWith('1冊'));
 await page.locator('#close-management').click();await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('登録済み 1冊'));await page.locator('#search').fill('置換');await page.waitForFunction(()=>document.querySelector('#results').children.length===1);
 await page.locator('#settings').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#delete').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('登録済み: 0冊'));
 assert.deepEqual(errors,[]);console.log('Browser PASS: subpath, 10,000-book import, limited DOM, search, detail, invalid JSON protection, replacement cancel/accept, offline reload/search, deletion');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

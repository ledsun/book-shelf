import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import 'fake-indexeddb/auto';
import { parseLibrary, searchBooks, amazonUrl, safeCoverUrl } from '../app/library.js';
import { openDatabase, readLibrary, replaceLibrary } from '../app/storage.js';
const data = [{asin:'B000000001',title:'Ruby 設計入門',authors:['架空 太郎']},{ASIN:'b000000002',Title:'JavaScript GUIDE',author:{name:'Example Author'}},{title:'日本語の本'}];
const parse = values => parseLibrary(JSON.stringify(values));
test('正常なJSON・フィールド揺れ・欠損', () => { assert.equal(parse(data).books.length,3); assert.equal(parse({itemsList:data}).books[1].author,'Example Author'); });
test('不正なJSON・構造・空のインポートを拒否', () => { for(const value of ['{','null','{}','[]']) assert.throws(()=>parseLibrary(value)); });
test('不正レコードをスキップしASINを重複排除', () => { const result=parse([...data,null,{},42,{title:'別タイトル',asin:'b000000001'}]); assert.equal(result.skipped,3);assert.equal(result.duplicates,1);assert.equal(result.books.length,3); });
for(const [label,query,expected] of [['日本語','日本語',1],['英語',' javascript guide ',1],['著者','架空',1],['AND','Ruby 架空 設計',1],['AND不一致','Ruby GUIDE',0],['ASIN','b000000002',1],['空検索',' ',3],['全角','Ｒｕｂｙ',1]]) test(label+'検索',()=>assert.equal(searchBooks(parse(data).books,query).length,expected));
test('Amazonリンクの検証',()=>{assert.equal(amazonUrl('B000000001'),'https://www.amazon.co.jp/dp/B000000001');assert.equal(amazonUrl('../x'),null);});
test('IndexedDB全件置換・失敗時の既存データ保護・削除',async()=>{
 const db=await openDatabase(); const initial=parse(data).books;
 await replaceLibrary(db,initial,'2026-01-01T00:00:00Z');
 await replaceLibrary(db,[initial[0]],'2026-02-01T00:00:00Z');
 await new Promise((resolve,reject)=>{
   const tx=db.transaction('meta','readwrite');
   tx.objectStore('meta').put({id:'old-drive-file',name:'books.json'},'driveFile');
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
 });
 assert.equal((await readLibrary(db)).books.length,1);
 assert.equal(await new Promise((resolve,reject)=>{
   const tx=db.transaction('meta','readonly');const request=tx.objectStore('meta').get('driveFile');
   tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error);
 }),undefined);
 await assert.rejects(replaceLibrary(db,[initial[1],initial[1]]));
 assert.deepEqual((await readLibrary(db)).books,[initial[0]]);
 assert.equal((await readLibrary(db)).importedAt,'2026-02-01T00:00:00Z');
 await assert.rejects(replaceLibrary(db,[{id:1,bad:()=>{}}]));
 assert.deepEqual((await readLibrary(db)).books,[initial[0]]);
 await replaceLibrary(db,[],null);assert.deepEqual(await readLibrary(db),{books:[],importedAt:null});db.close();
});
test('10,000冊の検索性能',()=>{
 const records=Array.from({length:10000},(_,i)=>({title:`架空の書籍 ${i} Ruby 設計`,authors:['テスト著者'],asin:`B${String(i).padStart(9,'0')}`}));
 const books=parse(records).books;const start=performance.now();
 for(let i=0;i<100;i++)assert.equal(searchBooks(books,'Ruby 設計').length,10000);
 const average=(performance.now()-start)/100;console.log(`10,000冊 AND検索 平均 ${average.toFixed(2)}ms (Node.js)`);assert.ok(average<100);
});

test('coverImageUrlの書影URLを検証して取り込む', () => {
 const url='https://m.media-amazon.com/images/I/fiction+image._SY400_.jpg';
 assert.equal(parse([{title:'架空の書籍',coverImageUrl:url}]).books[0].coverUrl,url);
 for(const value of ['javascript:alert(1)','https://example.com/cover.jpg','https://m.media-amazon.com.evil.test/images/I/x.jpg','https://user:pass@m.media-amazon.com/images/I/x.jpg','https://m.media-amazon.com/images/I/x.jpg?tracking=1','https://www.amazon.co.jp/dp/B000000001',null]) assert.equal(safeCoverUrl(value),null);
});

test('漫画フラグは真偽値のみを採用し欠損は不明', () => {
 const values=[true,false,undefined,'false',1];
 const books=parse(values.map((value,i)=>({title:`架空の書籍${i}`,mangaOrComicAsin:value}))).books;
 assert.deepEqual(books.map(b=>b.mangaOrComic),[true,false,null,null,null]);
});

test('書影はcoverImageUrlのみから取り込む', () => {
 const url='https://m.media-amazon.com/images/I/fiction.jpg';
 for (const coverImageUrl of [undefined,null,'https://example.com/cover.jpg']) {
  const book=parse([{title:'架空の書籍',coverImageUrl,productUrl:url}]).books[0];
  assert.equal(book.coverUrl,null);
 }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLibrary, searchBooks } from '../app/library.js';
import { deriveSeries, libraryItems, sortVolumes } from '../app/series.js';
const parse = titles => parseLibrary(JSON.stringify(titles.map(title => ({ title, mangaOrComicAsin: true })))).books;

test('巻数表記を揃え、作品名の数字・続編名を保持する', () => {
  const books = parse(['架空13（１） (コミックス)', '架空13 2 (コミックス)', '架空13NEO 1 (コミックス)', '架空13NEO 2 (コミックス)', '架空13 外伝 第1巻 (コミックス)']);
  const items = libraryItems(books);
  assert.deepEqual(items.map(item => [item.title, item.total, item.isSeries]), [['架空13', 2, true], ['架空13NEO', 2, true], ['架空13 外伝 第1巻 (コミックス)', 1, false]]);
  assert.deepEqual(sortVolumes(items[0].books).map(book => book.volume), [2, 1]);
});
test('判定キーのみ空白・波線・ハイフンを揃え、表示タイトルを保持する', () => {
  const titles = ['架空譚 ～旅の記録～ 1', '架空譚〜旅の記録〜 2'];
  const books = parse(titles);
  assert.equal(libraryItems(books).length, 1);
  assert.deepEqual(books.map(book => book.title), titles);
  assert.equal(libraryItems(books)[0].title, '架空譚 ～旅の記録～');
  assert.equal(deriveSeries('架空記―旅の記録― 1').seriesKey, deriveSeries('架空記−旅の記録－ 2').seriesKey);
  assert.notEqual(deriveSeries('カー 1').seriesKey, deriveSeries('カ- 2').seriesKey);
});
test('副題と特典の後ろに再掲されたシリーズ名を優先する', () => {
  const titles = Array.from({ length: 20 }, (_, i) => `架空小町 ${i % 2 ? '山の旅' : '海の旅'} ${i + 1}【特典イラスト付】 架空小町 【コミック版】 (架空コミックス) (Japanese Edition)`);
  const items = libraryItems(parse(titles));
  assert.equal(items.length, 1); assert.equal(items[0].title, '架空小町');
  assert.deepEqual(sortVolumes(items[0].books).map(book => book.volume), Array.from({ length: 20 }, (_, i) => 20 - i));
  assert.equal(deriveSeries('架空の別作品 1 架空小町 【コミック版】 (架空コミックス)').seriesTitle, '架空の別作品');
});
test('単独・通常書籍・既存データは単独項目を維持する', () => {
  const books = parse(['架空漫画 1', '架空漫画 2']);
  const legacy = books.map(({ seriesKey, seriesTitle, volume, ...book }) => book);
  assert.equal(libraryItems(legacy).length, 2);
  assert.ok(libraryItems(legacy).every(item => !item.isSeries));
  const regular = parseLibrary(JSON.stringify([{ title: '架空漫画 3', mangaOrComicAsin: false }])).books;
  assert.equal(regular[0].seriesKey, undefined);
  assert.equal(libraryItems([...books, ...regular]).length, 2);
  assert.equal(libraryItems(books.slice(0, 1))[0].title, books[0].title);
});
test('検索は元タイトル・著者・ASINに一致する巻だけを返す', () => {
  const books = parseLibrary(JSON.stringify([
    { title: '架空漫画 1', authors: ['架空著者'], asin: 'B000000001', mangaOrComicAsin: true },
    { title: '架空漫画 12', authors: ['架空著者'], asin: 'B000000012', mangaOrComicAsin: true },
  ])).books;
  const item = libraryItems(books)[0];
  for (const query of ['12', 'b000000012']) {
    const found = searchBooks(item.books, query);
    assert.equal(found.length, 1); assert.equal(found[0].volume, 12);
    assert.equal(item.total, 2); assert.equal(item.isSeries, true);
  }
  assert.equal(searchBooks(item.books, '架空著者').length, 2);
});
test('ローマ数字・漢数字・上下巻の最大巻を選ぶ', () => {
  for (const [titles, expected] of [
    [['架空譚IX', '架空譚X', '架空譚IV'], [10, 9, 4]],
    [['架空譚 第十巻', '架空譚 第十二巻'], [12, 10]],
    [['架空譚（上）', '架空譚（下）'], [3, 1]],
  ]) assert.deepEqual(sortVolumes(parse(titles)).map(book => book.volume), expected);
});
test('巻数不明は末尾にタイトル順、全冊不明なら先頭を選ぶ', () => {
  const books = [{ id: 1, title: 'い', volume: null }, { id: 2, title: 'あ', volume: null }, { id: 3, title: '巻3', volume: 3 }, { id: 4, title: '巻12', volume: 12 }];
  assert.deepEqual(sortVolumes(books).map(book => book.id), [4, 3, 2, 1]);
  assert.deepEqual(sortVolumes(books.slice(0, 2)).map(book => book.id), [2, 1]);
});

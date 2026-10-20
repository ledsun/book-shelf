import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLibrary, searchBooks } from '../app/library.js';
import { deriveSeries, libraryItems, sortVolumes, volumeLabel, seriesComparisonKey } from '../app/series.js';
const parse = titles => parseLibrary(JSON.stringify(titles.map(title => ({ title, mangaOrComicAsin: true })))).books;

test('巻ラベルは作品名の数字を除き、元の巻表記を短く表示する', () => {
  for (const [suffix, expected] of [
    [' 第３巻', '3'], ['（１７）', '17'], [' 第三巻', '三'], ['（五）【電子限定特典付き】', '五'],
    ['Ⅲ', 'Ⅲ'], [' IX', 'Ⅸ'], ['（上）', '上'], [' 下巻', '下'], ['（後編）', '後編'],
    [' 特別編', '特別編'], [' 3巻【特典付き】', '3'],
  ]) {
    const seriesTitle = '架空13Ⅱ';
    assert.equal(volumeLabel({ title: seriesTitle + suffix, seriesTitle, seriesKey: seriesComparisonKey(seriesTitle) }), expected);
  }
  const seriesTitle = '架空令嬢～旅～';
  for (const title of [`${seriesTitle}1 ${seriesTitle}【単行本】`, `${seriesTitle}1【電子書籍限定版】 ${seriesTitle}【単行本】`]) {
    assert.equal(volumeLabel({ title, ...deriveSeries(title) }), '1');
  }
  const subtitle = '架空小町 海の旅 20【特典付き】 架空小町【コミック版】';
  assert.equal(volumeLabel({ title: subtitle, ...deriveSeries(subtitle) }), '20');
});

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
test('単行本の再掲タイトルから特典付き・限定版を同じシリーズにまとめる', () => {
  const series = '架空令嬢！～魔法の力で旅をします～';
  const titles = [
    `${series}1 ${series}【単行本】 (架空コミックス) (Japanese Edition)`,
    `${series}1【電子書籍限定版】 ${series}【単行本】【電子書籍限定版】 (架空コミックス) (Japanese Edition)`,
    ...[2, 3, 4, 5].map(volume => `${series}${volume}【kindle特典付き】 ${series}【単行本】 (架空コミックス) (Japanese Edition)`),
  ];
  const books = parse(titles), items = libraryItems(books);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, series);
  assert.equal(items[0].total, 6);
  assert.deepEqual(books.map(book => book.title), titles);
  assert.deepEqual(sortVolumes(books).map(book => book.volume), [5, 4, 3, 2, 1, 1]);
  assert.equal(deriveSeries('架空の別作品1 架空令嬢【単行本】 (架空コミックス)').seriesTitle, '架空の別作品1 架空令嬢【単行本】');
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
test('続編名のローマ数字より巻数表記を優先してシリーズを分離する', () => {
  const books = parse([
    '架空譚　1巻', '架空譚　2巻',
    '架空譚ＩＩ　～太陽の旅～　1巻 (Japanese Edition)',
    '架空譚ＩＩ　～太陽の旅～　2巻 (Japanese Edition)',
    '架空譚ＩＩ　～太陽の旅～　3巻 (Japanese Edition)',
    '架空譚ＩＩ　～太陽の旅～　4巻 (Japanese Edition)',
  ]);
  const items = libraryItems(books);
  assert.deepEqual(items.map(item => [item.title, item.total]), [['架空譚', 2], ['架空譚ＩＩ　～太陽の旅～', 4]]);
  assert.deepEqual(sortVolumes(items[1].books).map(book => book.volume), [4, 3, 2, 1]);
  for (const marker of ['第3巻', '第三巻', '（３）', '3']) {
    const result = deriveSeries(`架空譚Ⅱ ～太陽の旅～ ${marker}`);
    assert.equal(result.seriesTitle, '架空譚Ⅱ ～太陽の旅～');
    assert.equal(result.volume, 3);
  }
});
test('巻数不明は末尾にタイトル順、全冊不明なら先頭を選ぶ', () => {
  const books = [{ id: 1, title: 'い', volume: null }, { id: 2, title: 'あ', volume: null }, { id: 3, title: '巻3', volume: 3 }, { id: 4, title: '巻12', volume: 12 }];
  assert.deepEqual(sortVolumes(books).map(book => book.id), [4, 3, 2, 1]);
  assert.deepEqual(sortVolumes(books.slice(0, 2)).map(book => book.id), [2, 1]);
});

test('巻数の前後に移動した副題が一致するグループを取り込み時に統合する', () => {
  const titles = ['架空譚 ９ レベル１からの旅 (旧コミックス) (Japanese Edition)', '架空譚～レベル1からの旅～ 10 (新コミックス) (Japanese Edition)', '架空譚〜レベル１からの旅〜 11【特典付き】 (新コミックス)'];
  const records = titles.map((title, i) => ({ title, mangaOrComicAsin: true, authors: [i ? '架空著者・作画' : '架空 著者'] }));
  for (const input of [records, [...records].reverse()]) {
    const books = parseLibrary(JSON.stringify(input)).books, items = libraryItems(books);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, '架空譚');
    assert.deepEqual(sortVolumes(books).map(book => book.volume), [11, 10, 9]);
    assert.deepEqual(sortVolumes(books).map(volumeLabel), ['11', '10', '9']);
    assert.deepEqual(books.map(book => book.title), input.map(book => book.title));
    assert.equal(searchBooks(books, 'レベル').length, 3);
  }
});

test('副題・主題の相違や情報不足があるグループは統合しない', () => {
  for (const other of ['架空譚～月の旅～ 10', '架空譚 外伝～太陽の旅～ 10', '架空譚II～太陽の旅～ 10', '架空譚～太陽の旅～ 特別編']) {
    assert.equal(libraryItems(parse(['架空譚 9 太陽の旅', other])).length, 2);
  }
  assert.equal(libraryItems(parse(['架空譚 9', '架空譚～太陽の旅～ 10'])).length, 2);
  const regular = parseLibrary(JSON.stringify([{ title: '架空譚～太陽の旅～ 10', mangaOrComicAsin: false }])).books;
  assert.equal(libraryItems([...parse(['架空譚 9 太陽の旅']), ...regular]).length, 2);
});

test('同じ主題に複数副題や判定不能巻があれば既存グループを統合しない', () => {
  for (const extra of ['架空譚 2 月の旅', '架空譚', '架空譚～太陽の旅～']) {
    const titles = ['架空譚 1 太陽の旅', '架空譚～太陽の旅～ 3', extra];
    for (const input of [titles, [...titles].reverse()]) {
      const books = parse(input);
      assert.deepEqual(books.map(book => book.seriesKey), input.map(title => deriveSeries(title).seriesKey));
    }
  }
});

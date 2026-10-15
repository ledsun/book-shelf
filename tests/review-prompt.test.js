import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewPrompt } from '../app/review-prompt.js';

test('random ranges select all three writers and preserve the target title', () => {
  for (const [random, name] of [[0, '横溝正史'], [1 / 3, '与謝野晶子'], [2 / 3, '夏目漱石'], [0.99999, '夏目漱石']]) {
    const result = createReviewPrompt({title: '架空の本「春」', author: '架空著者', isSeries: false}, () => random);
    assert.equal(result.writer, name);
    assert.ok(result.text.includes(JSON.stringify('架空の本「春」')));
    assert.match(result.text, /対象書籍名/);
    assert.match(result.text, /架空著者/);
    assert.match(result.text, /ページ名とURL/);
    assert.match(result.text, /Web検索ができない場合/);
  }
});

test('series prompts request reviews for the whole series with missing authors supported', () => {
  const { text } = createReviewPrompt({title: '架空連作', isSeries: true}, () => 0);
  assert.match(text, /対象シリーズ名："架空連作"/);
  assert.match(text, /シリーズ全体の評判/);
  assert.match(text, /著者："不明"/);
});

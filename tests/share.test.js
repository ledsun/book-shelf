import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { saveSharedFile, takeSharedFile } from '../app/share-inbox.js';
import { receiveShare } from '../app/share-target.js';
globalThis.indexedDB = indexedDB;
const scope = 'https://example.test/book-shelf/';
function post(files) {
  const form = new FormData();
  for (const file of files) form.append('books', file);
  return new Request(new URL('share-target', scope), { method: 'POST', body: form });
}
test('a share redirects within the project and is consumed only once', async () => {
  const response = await receiveShare(post([new File(['[{"title":"架空"}]'], 'books.json', { type: 'application/json' })]), scope);
  assert.equal(response.status, 303);
  const url = new URL(response.headers.get('location'));
  assert.equal(url.pathname, '/book-shelf/');
  const id = url.searchParams.get('share');
  assert.ok(id);
  const [first, second] = await Promise.all([takeSharedFile(id), takeSharedFile(id)]);
  assert.equal(first.name, 'books.json'); assert.match(first.text, /架空/);
  assert.equal(second, null);
});
test('parallel shares stay independent and old deliveries expire', async () => {
  const [a, b] = await Promise.all([saveSharedFile({name:'a.json',text:'A'}), saveSharedFile({name:'b.json',text:'B'})]);
  assert.notEqual(a, b);
  assert.equal((await takeSharedFile(b)).text, 'B');
  assert.equal((await takeSharedFile(a)).text, 'A');
  const oldNow = Date.now;
  const id = await saveSharedFile({name:'old.json',text:'old'});
  try {
    Date.now = () => oldNow() + 61 * 60 * 1000;
    assert.equal(await takeSharedFile(id), null);
  } finally { Date.now = oldNow; }
});
test('reject links, empty, non-JSON and multiple files without storing them', async () => {
  for (const files of [[], ['https://example.test/books.json'], [new File([''], 'books.json')], [new File(['hello'], 'hello.txt')], [new File(['[]'], 'a.json'), new File(['[]'], 'b.json')]]) {
    const response = await receiveShare(post(files), scope);
    assert.equal(new URL(response.headers.get('location')).searchParams.get('share-error'), 'file');
  }
  const malformed = new Request(new URL('share-target', scope), { method:'POST', body:'not multipart' });
  assert.match((await receiveShare(malformed, scope)).headers.get('location'), /share-error=file/);
});

test('inbox storage failure returns a readable landing error', async () => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = { open() { throw new Error('storage unavailable'); } };
  try {
    const response = await receiveShare(post([new File(['[]'], 'books.json')]), scope);
    assert.equal(new URL(response.headers.get('location')).searchParams.get('share-error'), 'storage');
  } finally { globalThis.indexedDB = original; }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { downloadDriveFile, readDriveFile } from '../app/drive.js';
import { openDatabase, replaceLibrary, readDriveSource, readLibrary, forgetDriveSource } from '../app/storage.js';

test('Drive downloads use a bearer header and never caches or includes cookies', async () => {
  const text = await downloadDriveFile({ id: 'a/b ?' }, 'temporary', async (url, options) => {
    assert.equal(url, 'https://www.googleapis.com/drive/v3/files/a%2Fb%20%3F?alt=media');
    assert.equal(options.headers.Authorization, 'Bearer temporary');
    assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return new Response('[{"title":"架空"}]');
  });
  assert.match(text, /架空/);
  for (const status of [401, 403, 404, 500]) {
    await assert.rejects(downloadDriveFile({ id: 'fiction' }, 'temporary', async () => new Response('', { status })),
      status === 401 ? /有効期限/ : status === 500 ? /取得できません/ : /選び直して/);
  }
});

test('every update requests consent again, errors recover, and picker is disposed', async () => {
  const oldGoogle = globalThis.google, oldFetch = globalThis.fetch, oldLocation = globalThis.location;
  let calls = 0, mode = 'ok', disposed = 0;
  globalThis.location = { origin: 'https://example.test' };
  globalThis.google = { accounts: { oauth2: {
    hasGrantedAllScopes: () => mode !== 'scope',
    initTokenClient(config) {
      assert.equal(config.include_granted_scopes, false);
      return { requestAccessToken(options) {
        calls++; assert.equal(options.prompt, 'consent select_account');
        if (mode === 'closed') config.error_callback({ type: 'popup_closed' });
        else config.callback({ access_token: `token-${calls}` });
      } };
    }
  } }, picker: { Action: { CANCEL: 'cancel', PICKED: 'picked' } } };
  class Builder {
    addView() { return this; } setOAuthToken() { return this; } setDeveloperKey() { return this; }
    setAppId() { return this; } setOrigin() { return this; } setLocale() { return this; }
    setCallback(callback) { this.callback = callback; return this; }
    build() { return { setVisible: visible => { if (visible) queueMicrotask(() => this.callback(mode === 'cancel' ? { action: 'cancel' } : { action: 'picked', docs: [{ id: 'chosen', name: 'books.json' }] })); }, dispose() { disposed++; } }; }
  }
  google.picker.PickerBuilder = Builder;
  google.picker.DocsView = class { setIncludeFolders() { return this; } setSelectFolderEnabled() { return this; } };
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, `Bearer token-${calls}`);
    return new Response('[{"title":"架空"}]');
  };
  try {
    const config = { clientId: 'public-client', apiKey: 'public-key', appId: '123' };
    const previous = { id: 'known', name: 'books.json' };
    assert.deepEqual((await readDriveFile(config, previous)).file, previous);
    await readDriveFile(config, previous); assert.equal(calls, 2);
    mode = 'closed'; await assert.rejects(readDriveFile(config, previous), /中止/);
    mode = 'scope'; await assert.rejects(readDriveFile(config, previous), /許可/);
    mode = 'cancel'; assert.equal(await readDriveFile(config, null), null);
    mode = 'ok'; assert.equal((await readDriveFile(config, null)).file.id, 'chosen');
    assert.equal(disposed, 2);
  } finally { globalThis.google = oldGoogle; globalThis.fetch = oldFetch; globalThis.location = oldLocation; }
});

test('source metadata is atomic with the library, excludes tokens, and can be forgotten', async () => {
  globalThis.indexedDB = indexedDB;
  const db = await openDatabase();
  try {
    const source = { id: 'fiction', name: 'books.json', access_token: 'must-not-persist' };
    await replaceLibrary(db, [{ id: 1, title: '架空' }], 'date', source);
    assert.deepEqual(await readDriveSource(db), { id: 'fiction', name: 'books.json' });
    await assert.rejects(replaceLibrary(db, [{ id: 2 }, { id: 2 }], 'new-date', { id: 'new', name: 'new' }));
    assert.equal((await readDriveSource(db)).id, 'fiction');
    assert.equal((await readLibrary(db)).books[0].title, '架空');
    await forgetDriveSource(db); assert.equal(await readDriveSource(db), null);
    assert.equal((await readLibrary(db)).books.length, 1);
    await replaceLibrary(db, [], null, source);
    await replaceLibrary(db, [], null);
    assert.equal(await readDriveSource(db), null);
  } finally { db.close(); }
});

// Temporary delivery between a share POST and the newly opened app window.
// Separate from the library DB so replacing books cannot erase another share.
const DATABASE = 'bookshelf-share-inbox';
const MAX_AGE = 60 * 60 * 1000;
function openInbox() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact(operation) {
  const db = await openInbox();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      let result = null;
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (entry) {
          if (entry.value.createdAt < Date.now() - MAX_AGE) entry.delete();
          entry.continue();
        } else operation(store, value => { result = value; });
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('共有ファイルを保存できませんでした。'));
    });
  } finally { db.close(); }
}
export async function saveSharedFile(file) {
  const id = crypto.randomUUID();
  await transact(store => store.add({ id, name: file.name, text: file.text, createdAt: Date.now() }));
  return id;
}
export function takeSharedFile(id) {
  return transact((store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      done(request.result || null);
      store.delete(id);
    };
  });
}

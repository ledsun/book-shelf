export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bookshelf', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('books', { keyPath: 'id' });
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('別のBookShelfタブを閉じて再試行してください。'));
  });
}
export function readLibrary(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['books', 'meta'], 'readwrite');
    // Clean up metadata from the removed Google Drive integration.
    tx.objectStore('meta').delete('driveFile');
    const books = tx.objectStore('books').getAll();
    const date = tx.objectStore('meta').get('importedAt');
    tx.oncomplete = () => resolve({ books: books.result, importedAt: date.result || null });
    tx.onabort = () => reject(tx.error);
  });
}
export function replaceLibrary(db, books, importedAt = new Date().toISOString()) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['books', 'meta'], 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('保存を中止しました。'));
    try {
      const store = tx.objectStore('books');
      store.clear();
      for (const book of books) store.add(book);
      const meta = tx.objectStore('meta');
      meta.clear();
      if (importedAt) meta.put(importedAt, 'importedAt');
    } catch (error) { tx.abort(); reject(error); }
  });
}

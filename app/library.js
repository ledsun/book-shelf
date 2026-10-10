export function fold(value) { return value.normalize('NFKC').toLocaleLowerCase('ja'); }
function first(record, keys) { return keys.map(k => record[k]).find(v => typeof v === 'string' && v.trim())?.trim() || ''; }
export function parseLibrary(text) {
  const input = JSON.parse(text);
  const records = Array.isArray(input) ? input : input?.itemsList;
  if (!Array.isArray(records)) throw new Error('書籍の配列、または itemsList 配列を含むJSONを選んでください。');
  const books = [], seen = new Set();
  let skipped = 0, duplicates = 0;
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) { skipped++; continue; }
    const title = first(record, ['title', 'Title', 'name']);
    if (!title) { skipped++; continue; }
    const asin = first(record, ['asin', 'ASIN']).toUpperCase();
    if (asin && seen.has(asin)) { duplicates++; continue; }
    if (asin) seen.add(asin);
    const source = record.authors ?? record.author ?? record.Authors ?? record.Author;
    const authors = (Array.isArray(source) ? source : [source]).map(a => typeof a === 'string' ? a.trim() : a && typeof a === 'object' ? first(a, ['name', 'displayName']) : '').filter(Boolean);
    const author = authors.join('、');
    const coverUrl = safeCoverUrl(record.productUrl);
    books.push({ coverUrl, id: books.length + 1, title, author, asin, search: fold([title, author, asin].join('\n')) });
  }
  if (!books.length) throw new Error('取り込める書籍がありません。既存データは変更していません。');
  return { books, skipped, duplicates, total: records.length };
}
export function searchBooks(books, query) {
  const words = fold(query.trim()).split(/\s+/u).filter(Boolean);
  return books.filter(book => words.every(word => book.search.includes(word)));
}
export function amazonUrl(asin) { return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.co.jp/dp/${encodeURIComponent(asin)}` : null; }

export function safeCoverUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'm.media-amazon.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/images\/[IP]\/[A-Za-z0-9._+-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

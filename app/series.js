// Series metadata is derived only on import. Existing records stay ungrouped.
const bonus = /【[^】]*(?:特典|おまけ|イラスト|描き下ろし)[^】]*】/gu;
const normalize = value => value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
export function seriesComparisonKey(value) {
  return normalize(value).replace(/\s/gu, '').replace(/[〜～~]/gu, '~').replace(/[‐‑‒–—―−﹘﹣－]/gu, '-');
}
function displayTitle(title, key, fallback) {
  let prefix = '';
  // Keep the original typography for display; only the comparison key is folded.
  for (const character of title.replace(bonus, '').trim()) {
    prefix += character;
    if (seriesComparisonKey(prefix) === key) return prefix.trim();
  }
  return fallback;
}
function volumeNumber(value) {
  const digits = value.match(/\d+/u);
  if (digits) return Number(digits[0]);
  const roman = value.trim().replace(/^(?:vol\.?|その)\s*/iu, '');
  if (/^[IVX]+$/iu.test(roman)) {
    const numbers = { I: 1, V: 5, X: 10 }, letters = [...roman.toUpperCase()];
    return letters.reduce((sum, letter, i) => sum + (numbers[letter] < numbers[letters[i + 1]] ? -numbers[letter] : numbers[letter]), 0);
  }
  const kanji = value.match(/[一二三四五六七八九十]+/u)?.[0];
  if (kanji) {
    const numbers = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (kanji.includes('十')) { const [tens, ones] = kanji.split('十'); return (numbers[tens] || 1) * 10 + (numbers[ones] || 0); }
    return numbers[kanji] ?? null;
  }
  if (/上|前編/u.test(value)) return 1;
  if (/中/u.test(value)) return 2;
  if (/下|後編/u.test(value)) return 3;
  return null;
}
export function deriveSeries(title) {
  const text = normalize(title).replace(bonus, '').trim();
  const tail = text.replace(/\s*\(Japanese Edition\)$/u, '').replace(/\s+\([^()]*\)$/u, '');
  for (const match of tail.matchAll(/(?<!\d)(\d+)(?:【電子書籍限定版】)?\s+(.+?)\s*【(?:コミック版|単行本)】(?:【電子書籍限定版】)?$/gu)) {
    const seriesTitle = match[2].trim(), seriesKey = seriesComparisonKey(seriesTitle);
    if (seriesKey && seriesComparisonKey(tail.slice(0, match.index)).startsWith(seriesKey)) {
      return { seriesKey, seriesTitle: displayTitle(title, seriesKey, seriesTitle), volume: Number(match[1]) };
    }
  }
  const patterns = [
    /[\(〈<\[]\s*(?:第\s*)?\d+\s*(?:巻|集)?\s*[\)〉>\]]/u,
    /(?:\s|[:：])(?:第\s*)?\d+(?:\s*[巻集])?(?=\s|$|[【(])/u,
    /第\s*\d+\s*[巻集]/u, /(?<=[^\d])\d+\s*[巻集]/u, /(?<=COMIC)\s*\d+(?=\s|$|[【(])/u,
    /(?:vol\.?|その)\s*\d+/iu, /(?:第)?[一二三四五六七八九十]+巻/u,
    /[\(〈<](?:上|中|下|前編|後編)[\)〉>]/u,
    /(?:\s|(?<=[。!】]))(?:上|中|下)(?:巻)?(?=\s|$|[<(])/u,
    /\d+(?=\s*(?:\((?!\d)|【|<|$))/u, /\s+\d+(?=[\-~])/u,
  ];
  // Prefer other volume markers so Roman numerals in sequel names stay in the title.
  const candidates = patterns.map(pattern => text.match(pattern)).filter(Boolean).sort((a, b) => a.index - b.index);
  const roman = text.match(/(?<=[^A-Za-z])(?:XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|IX|VIII|VII|VI|IV|III|II|V|X|I)(?=\s|$|~)/iu);
  const match = candidates.find(candidate => candidate.index > 0) ?? roman;
  const seriesTitle = match ? text.slice(0, match.index).replace(/[ :]+$/u, '') : tail;
  const seriesKey = seriesComparisonKey(seriesTitle);
  return { seriesKey, seriesTitle: displayTitle(title, seriesKey, seriesTitle), volume: match ? volumeNumber(match[0]) : null };
}
function subtitleIdentity(book) {
  if (!Number.isFinite(book.volume)) return null;
  const clean = value => normalize(value).replace(bonus, '').trim().replace(/(?:\s+\([^()]*\))+$/u, '').trim();
  const text = clean(book.title), title = clean(book.seriesTitle);
  let prefix = '', end = null;
  for (const character of text) {
    prefix += character;
    if (seriesComparisonKey(prefix) === book.seriesKey) { end = prefix.length; break; }
  }
  if (end === null) return null;
  const remainder = text.slice(end).trim(), marker = remainder.match(/^(\d+)(?=\s|$)/u);
  if (!marker || Number(marker[1]) !== book.volume) return null;
  const subtitle = remainder.slice(marker[0].length).trim();
  if (subtitle) return { main: book.seriesKey, subtitle: seriesComparisonKey(subtitle), kind: 'middle' };
  const match = title.match(/^(.+?)[〜～~](.+)[〜～~]$/u);
  return match ? { main: seriesComparisonKey(match[1]), subtitle: seriesComparisonKey(match[2]), kind: 'end' } : null;
}
// Reconcile only complete, unambiguous groups; a shared prefix alone is insufficient.
export function reconcileSeries(books) {
  const groups = new Map(), identities = new Map();
  for (const book of books) {
    if (book.mangaOrComic !== true || !book.seriesKey) continue;
    if (!groups.has(book.seriesKey)) groups.set(book.seriesKey, []);
    groups.get(book.seriesKey).push(book);
    const identity = subtitleIdentity(book);
    if (!identity) continue;
    if (!identities.has(identity.main)) identities.set(identity.main, []);
    identities.get(identity.main).push({ book, ...identity });
  }
  for (const [main, matches] of identities) {
    if (new Set(matches.map(match => match.subtitle)).size !== 1) continue;
    if (new Set(matches.map(match => match.kind)).size !== 2) continue;
    const keys = new Set(matches.map(match => match.book.seriesKey));
    if (keys.size !== 2 || !keys.has(main)) continue;
    const matched = new Set(matches.map(match => match.book));
    if ([...keys].some(key => groups.get(key).some(book => !matched.has(book)))) continue;
    const title = groups.get(main)[0].seriesTitle;
    for (const { book } of matches) { book.seriesKey = main; book.seriesTitle = title; }
  }
  return books;
}
export function libraryItems(books) {
  const grouped = new Map(), items = [];
  for (const book of books) {
    const key = book.mangaOrComic === true && book.seriesKey;
    if (key && grouped.has(key)) { grouped.get(key).books.push(book); continue; }
    const item = { books: [book] }; items.push(item);
    if (key) grouped.set(key, item);
  }
  return items.map(item => {
    const book = item.books[0], isSeries = item.books.length > 1;
    return { ...item, isSeries, title: isSeries ? book.seriesTitle : book.title, author: book.author, total: item.books.length };
  });
}
export function volumeLabel(book) {
  // Remove the series prefix before looking for numbers, including sequel names.
  const key = book.seriesKey || seriesComparisonKey(book.seriesTitle || '');
  let remainder = book.title;
  if (key) {
    let prefix = '';
    for (const character of book.title) {
      prefix += character;
      if (seriesComparisonKey(prefix.replace(bonus, '')) === key) {
        remainder = book.title.slice(prefix.length);
        break;
      }
    }
  }
  const text = normalize(remainder).replace(bonus, '').trim();
  const digits = text.match(/^[\s:(〈<\[]*(?:第\s*|vol\.?\s*|その\s*)?(\d+)(?=\s|$|[巻集)〉>\]【(])/iu);
  if (digits) return String(Number(digits[1]));
  const kanji = text.match(/^[\s:(〈<\[]*(?:第\s*)?([〇零一二三四五六七八九十百千壱弐参]+)(?=\s|$|[巻集)〉>\]【(])/u);
  if (kanji) return kanji[1];
  const roman = text.match(/^[\s:(〈<\[]*(?:vol\.?\s*)?([IVX]+)(?=\s|$|[巻集)〉>\]【(~])/iu);
  if (roman) {
    const number = volumeNumber(roman[1]);
    const glyphs = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ'];
    return glyphs[number - 1] || roman[1].toUpperCase();
  }
  const named = text.match(/^[\s:(〈<\[]*(上|中|下|前編|後編)(?=\s|$|巻|[)〉>\]【(])/u);
  if (named) return named[1];
  // Import already identifies volumes after subtitles and before repeated titles.
  if (Number.isFinite(book.volume)) return String(book.volume);
  // Repeated series names are redundant even when a volume cannot be identified.
  const fallback = book.seriesTitle ? remainder.split(book.seriesTitle).join('').trim() : remainder.trim();
  return fallback || book.title;
}
export function sortVolumes(books) {
  return [...books].sort((a, b) => {
    const av = Number.isFinite(a.volume) ? a.volume : null, bv = Number.isFinite(b.volume) ? b.volume : null;
    if (av !== null || bv !== null) { if (av === null) return 1; if (bv === null) return -1; if (av !== bv) return bv - av; }
    return a.title.localeCompare(b.title, 'ja') || a.id - b.id;
  });
}

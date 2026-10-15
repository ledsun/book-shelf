const PREFIX = `bookshelf-shell-${self.registration.scope}-`;
const CACHE = `${PREFIX}v15`;
const ASSETS = ['./', './index.html', './style.css', './main.js', './library.js', './series.js', './review-prompt.js', './storage.js', './manifest.webmanifest', './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './images/bookrow.png', './images/bookrow-welcome.png', './images/bookrow-empty.png'];
const urls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !urls.has(event.request.url)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});

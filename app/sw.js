import { receiveShare } from './share-target.js';
const PREFIX = `bookshelf-shell-${self.registration.scope}-`;
const CACHE = `${PREFIX}v26`;
const ASSETS = ['./', './index.html', './style.css', './main.js', './share-inbox.js', './share-target.js', './library.js', './series.js', './review-prompt.js', './storage.js', './manifest.webmanifest', './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './images/bookrow.png', './images/bookrow-welcome.png', './images/bookrow-empty.png'];
const urls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method === 'POST' && event.request.url === new URL('./share-target', self.registration.scope).href) {
    // Consume locally: never forward a shared library to the hosting server.
    event.respondWith(receiveShare(event.request, self.registration.scope));
    return;
  }
  const url = new URL(event.request.url);
  const home = new URL('./', self.registration.scope);
  const sharedLanding = url.origin === home.origin && url.pathname === home.pathname &&
    (url.searchParams.has('share') || url.searchParams.has('share-error'));
  const resource = sharedLanding ? home.href : url.href;
  if (event.request.method !== 'GET' || !urls.has(resource)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(resource)) || fetch(event.request)));
});

/* Character Tavern – Service Worker: macht die ganze Seite offline nutzbar. */
'use strict';
const CACHE = 'character-tavern-v1';
const CORE = [
  './', 'index.html', 'admin.html', 'css/tavern.css', 'css/admin.css',
  'js/app.js', 'js/admin.js', 'js/zip.js', 'data/site.json',
  'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/logo-8bithorizon.png'
];

function filesFromSite(site) {
  const out = [];
  const add = (p) => { if (p) out.push(p); };
  (site.nav || []).forEach((t) => {
    add(t.file); add(t.logo);
    (t.children || []).forEach((c) => { add(c.file); add(c.logo); });
  });
  ((site.downloads || {}).categories || []).forEach((c) =>
    (c.items || []).forEach((i) => add(i.file))
  );
  return out;
}

async function precache() {
  const cache = await caches.open(CACHE);
  const list = new Set(CORE);
  try {
    const r = await fetch('data/site.json', { cache: 'no-cache' });
    if (r.ok) {
      await cache.put('data/site.json', r.clone());
      filesFromSite(await r.json()).forEach((p) => list.add(p));
    }
  } catch (e) { /* offline: mit dem Vorhandenen weitermachen */ }
  let ok = 0;
  await Promise.all([...list].map(async (u) => {
    try {
      const r = await fetch(u, { cache: 'no-cache' });
      if (r.ok) { await cache.put(u, r); ok++; }
    } catch (e) { /* ignorieren */ }
  }));
  // Dateien entfernen, die nicht mehr zur Seite gehören
  const keep = new Set([...list].map((u) => new URL(u, self.registration.scope).href));
  for (const req of await cache.keys()) {
    if (!keep.has(req.url) && !keep.has(req.url.split('?')[0])) await cache.delete(req);
  }
  return ok;
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'precache') {
    e.waitUntil(precache().then(async (count) => {
      const all = await self.clients.matchAll();
      all.forEach((c) => c.postMessage({ type: 'precache-done', count }));
    }));
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req, { cache: 'no-cache' });
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = await cache.match('index.html');
        if (home) return home;
      }
      return new Response('Offline – diese Datei ist noch nicht gespeichert.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});

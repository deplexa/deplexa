/* يخزّن ملفات التطبيق للعمل بدون إنترنت. لا يلمس كلمات المستخدم أبدًا لأنها في localStorage وليست في الكاش.
   يفتح من الكاش فورًا ويحدّث في الخلفية، فلا ينتظر الشبكة عند الفتح. غيّر رقم VERSION عند كل إصدار. */
const VERSION = 'words-v153';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const fresh = url.searchParams.has('_');
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  const net = () => fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => {
        if (fresh) { c.put('./index.html', copy.clone()); c.put('./', copy); } else c.put(req, copy);
      }).catch(() => {});
    }
    return res;
  });
  if (fresh) { e.respondWith(net().catch(() => Response.error())); return; }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((m) => {
      if (m) { e.waitUntil(new Promise((r) => setTimeout(r, isDoc ? 15000 : 0)).then(() => net()).catch(() => {})); return m; }
      return net().catch(() => (isDoc ? caches.match('./index.html') : null) || Response.error());
    })
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { try { d = { body: e.data.text() }; } catch (__) {} }
  e.waitUntil(self.registration.showNotification(d.title || 'Deplexa', {
    body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', dir: 'auto',
    data: { url: d.url || './' }, tag: d.tag || undefined, renotify: !!d.tag
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const pb = new URL(target).searchParams.get('pb');
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { if (pb) c.postMessage({ pb }); return c.focus(); }
    }
    return clients.openWindow(target);
  }));
});

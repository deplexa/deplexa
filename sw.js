/* يخزّن ملفات التطبيق للعمل بدون إنترنت. لا يلمس كلمات المستخدم أبدًا لأنها في localStorage وليست في الكاش.
   يفتح من الكاش فورًا ويحدّث في الخلفية، فلا ينتظر الشبكة عند الفتح. غيّر رقم VERSION عند كل إصدار. */
const VERSION = 'words-v89';
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
      if (m) { e.waitUntil(net().catch(() => {})); return m; }
      return net().catch(() => (isDoc ? caches.match('./index.html') : null) || Response.error());
    })
  );
});

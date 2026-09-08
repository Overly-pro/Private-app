// Mon Espace — Service Worker
// 1) Cache de la coquille de l'app : sans lui, l'app installée ne démarre pas
//    hors ligne. Les DONNÉES, elles, sont déjà gérées par la persistance
//    Firestore (db.enablePersistence), qui rejoue les écritures au retour du
//    réseau — le service worker ne s'en occupe pas.
// 2) Notifications planifiées en arrière-plan.

let notifTimers = [];

const CACHE = 'overly-shell-v2';   /* v2 : purge les anciens GIF (39 Mo) restes en cache */
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'brand/logo-mark-white.png',
  'brand/logo-detailed-white.png',
  'brand/logo-tribal.png',
  'brand/logo-tribal-wide.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // addAll échoue en bloc si un seul fichier manque : on tolère les absents
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(SHELL.map(u => c.add(u).catch(() => null)))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // On ne touche ni à Firebase ni aux CDN : ils gèrent leur propre hors-ligne
  if (url.origin !== self.location.origin) return;

  // La page elle-même : réseau d'abord pour avoir la dernière version,
  // cache en secours quand il n'y a pas de réseau.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(rep => { const c = rep.clone(); caches.open(CACHE).then(x => x.put(req, c)); return rep; })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Le reste (images, icônes) : cache d'abord, et on rafraîchit en fond.
  e.respondWith(
    caches.match(req).then(hit => {
      const reseau = fetch(req)
        .then(rep => { if (rep && rep.status === 200) { const c = rep.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return rep; })
        .catch(() => hit);
      return hit || reseau;
    })
  );
});


self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SCHEDULE_NOTIFS') {
    notifTimers.forEach(t => clearTimeout(t));
    notifTimers = [];
    (event.data.items || []).forEach(item => {
      const delay = item.fireAt - Date.now();
      if (delay <= 0) return;
      notifTimers.push(setTimeout(() => {
        self.registration.showNotification(item.title, {
          body: item.body,
          icon: item.icon || 'brand/logo-mark-white.png',
          badge: item.icon || 'brand/logo-mark-white.png',
          tag: item.tag || 'mon-espace',
          renotify: false,
          vibrate: [200, 100, 200]
        });
      }, delay));
    });
  }
});

// Clic sur une notification → ouvre l'app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

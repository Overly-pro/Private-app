// Mon Espace — Service Worker
// Planifie les notifications en arrière-plan via setTimeout

let notifTimers = [];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

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

const CACHE_NAME = 'sara-os-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

const scheduledReminderTimers = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SARA_SHOW_PERSISTENT_BG') {
    event.waitUntil(
      self.registration.showNotification('SARA está a ouvir - Clica para voltar', {
        body: 'Segundo plano ativo. Toca aqui para voltar rapidamente à conversa.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'sara-bg-persistent',
        renotify: false,
        requireInteraction: true,
        silent: true,
        data: { kind: 'return_to_chat' },
      }).catch(() => {})
    );
    return;
  }

  if (msg.type === 'SARA_CLEAR_PERSISTENT_BG') {
    event.waitUntil(
      self.registration.getNotifications({ tag: 'sara-bg-persistent' }).then((list) => {
        list.forEach((n) => n.close());
      }).catch(() => {})
    );
    return;
  }

  if (msg.type === 'SARA_SHOW_NOTIFICATION') {
    const title = msg.title || 'SARA OS';
    const options = {
      body: msg.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: msg.tag || `sara-notif-${Date.now()}`,
      requireInteraction: Boolean(msg.requireInteraction),
      vibrate: [250, 120, 250],
      actions: Array.isArray(msg.actions) ? msg.actions : [],
      data: msg.data || { kind: 'general' },
    };
    event.waitUntil(self.registration.showNotification(title, options).catch(() => {}));
    return;
  }

  if (msg.type === 'SARA_LOC_REQUEST_NOTIFY' && msg.request) {
    const req = msg.request;
    event.waitUntil(
      self.registration.showNotification(`Pedido de Localização • ${req.fromCallName}`, {
        body: `${req.fromCallName} (${req.fromSaraId}) pediu a tua localização em tempo real.`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `sara-locreq-${req.id}`,
        requireInteraction: true,
        vibrate: [300, 120, 300],
        actions: [
          { action: 'accept_30m', title: 'Aceitar 30min' },
          { action: 'accept_1h', title: 'Aceitar 1h' },
          { action: 'decline', title: 'Recusar' },
        ],
        data: { kind: 'location_request', request: req },
      }).catch(() => {})
    );
    return;
  }

  if (msg.type === 'SARA_SCHEDULE_REMINDER' && msg.reminder) {
    const rem = msg.reminder;
    if (scheduledReminderTimers.has(rem.id)) {
      clearTimeout(scheduledReminderTimers.get(rem.id));
    }
    const delayMs = Math.max(0, Number(rem.targetMs || 0) - Date.now());
    if (delayMs <= 2147483647) {
      const tid = setTimeout(() => {
        scheduledReminderTimers.delete(rem.id);
        self.registration.showNotification(`Lembrete SARA (${rem.timeHHmm})`, {
          body: rem.title || 'Está na hora do teu lembrete.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `sara-reminder-${rem.id}`,
          requireInteraction: true,
          vibrate: [400, 150, 400, 150, 400],
          data: { kind: 'reminder', reminderId: rem.id },
        }).catch(() => {});
      }, delayMs);
      scheduledReminderTimers.set(rem.id, tid);
    }
    return;
  }

  if (msg.type === 'SARA_CANCEL_REMINDER' && msg.id) {
    if (scheduledReminderTimers.has(msg.id)) {
      clearTimeout(scheduledReminderTimers.get(msg.id));
      scheduledReminderTimers.delete(msg.id);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action || '';
  const data = event.notification?.data || {};
  if (event.notification?.tag !== 'sara-bg-persistent') {
    event.notification?.close();
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'SARA_NOTIFICATION_CLICK',
            action,
            data,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

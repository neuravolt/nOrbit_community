/* NeuraVolt OS Employee Service Worker (PWA + Task Push Notifications) */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'NeuraVolt OS',
      body: event.data ? event.data.text() : 'New notification received',
      priority: 'NORMAL',
    };
  }

  const isCall = (data.title || '').includes('Incoming Audio Call') || (data.tag || '').startsWith('call-');
  const isCritical = data.priority === 'CRITICAL' || isCall;
  const title = data.title || (isCall ? '📞 Incoming Audio Call' : isCritical ? '🚨 URGENT TASK ASSIGNED' : '📋 New Task Assigned');
  const targetUrl = data.url || (isCall ? '/chat' : '/tasks');

  const notificationOptions = {
    body: data.body || (isCall ? 'Incoming audio call. Tap to answer.' : 'You have been assigned a task.'),
    icon: '/norbit-icon.png',
    badge: '/favicon.png',
    tag: data.tag || (isCall ? `call-${Date.now()}` : `task-${Date.now()}`),
    vibrate: isCall ? [600, 200, 600, 200, 800] : isCritical ? [300, 100, 300, 100, 500] : [150, 75, 150],
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      priority: data.priority,
      spokenText: data.spokenText,
      title,
    },
  };

  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: isCall ? 'CALL_PUSH_RECEIVED' : 'TASK_PUSH_RECEIVED',
            payload: {
              ...data,
              title,
              isCritical,
              url: targetUrl,
              spokenText: data.spokenText || `Incoming audio call from ${data.callerName || 'Colleague'}`,
            },
          });
        }
      }),
      self.registration.showNotification(title, notificationOptions),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const url = notifData.url || '/tasks';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(url);
          client.postMessage({
            type: 'NOTIFICATION_OPENED',
            payload: notifData,
          });
          return client.focus();
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

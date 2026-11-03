/* Guardian browser notifications. Only handles push + click; no caching, no fetch interception. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Guardian', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Guardian alert';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || undefined,
    icon: '/norbit-icon.png',
    badge: '/favicon.png',
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/guardian/overview' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/guardian/overview';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});

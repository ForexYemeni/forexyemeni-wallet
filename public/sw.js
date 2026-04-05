const CACHE_NAME = 'forexyemeni-v2'

// Assets to pre-cache (shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/sounds/notification.wav',
  '/sounds/success.wav',
  '/sounds/alert.wav',
]

// Install: pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
  // Activate immediately without waiting
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  // Claim all clients immediately
  self.clients.claim()
})

// Fetch: Network-first for HTML & API, Stale-while-revalidate for JS/CSS chunks
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return

  // Network-first for HTML pages and API routes
  if (url.pathname === '/' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname.startsWith('/api/')) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned)
            })
          }
          return response
        })
        .catch(() => {
          if (url.pathname.startsWith('/api/')) {
            return caches.match(request)
          }
          // For HTML pages, show offline fallback
          return caches.match('/')
        })
    )
    return
  }

  // Network-first for Next.js JS/CSS chunks (always get latest version)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the new version
          if (response.ok) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned)
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request).then((cached) => {
            return cached || fetch(request)
          })
        })
    )
    return
  }

  // Cache-first for static assets (images, sounds, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned)
          })
        }
        return response
      })
    })
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          return
        }
      }
      return self.clients.openWindow('/')
    })
  )
})

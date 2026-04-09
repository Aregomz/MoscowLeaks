const STATIC_CACHE = 'moscow-static-v1'
const AUDIO_CACHE = 'moscow-audio-v2'

const isCacheableResponse = (response) =>
  response && (response.ok || response.type === 'opaque')

const isAudioRequest = (request) => {
  if (request.destination === 'audio') {
    return true
  }

  const pathname = new URL(request.url).pathname.toLowerCase()
  return /\.(mp3|wav|aac|m4a|ogg)$/i.test(pathname)
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type !== 'WARM_AUDIO_CACHE' || !Array.isArray(data.urls)) {
    return
  }

  event.waitUntil(
    (async () => {
      const cache = await caches.open(AUDIO_CACHE)
      const uniqueUrls = [...new Set(data.urls.filter(Boolean))]

      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const request = new Request(url, { mode: 'cors' })
            const cached = await cache.match(request)
            if (cached) {
              return
            }

            const response = await fetch(request)
            if (isCacheableResponse(response)) {
              await cache.put(request, response.clone())
            }
          } catch {
            // Ignore warm-up failures; runtime fetch handler will retry.
          }
        }),
      )
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  if (isAudioRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE)
        const cached = await cache.match(request)
        if (cached) {
          return cached
        }

        const response = await fetch(request)
        if (isCacheableResponse(response)) {
          event.waitUntil(cache.put(request, response.clone()))
        }

        return response
      })(),
    )
    return
  }

  const shouldHandleStatic =
    url.origin === self.location.origin &&
    ['script', 'style', 'image', 'font'].includes(request.destination)

  if (!shouldHandleStatic) {
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cached = await cache.match(request)
      const networkPromise = fetch(request)
        .then(async (response) => {
          if (isCacheableResponse(response)) {
            await cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => null)

      if (cached) {
        networkPromise.catch(() => null)
        return cached
      }

      const networkResponse = await networkPromise
      if (networkResponse) {
        return networkResponse
      }

      return Response.error()
    })(),
  )
})

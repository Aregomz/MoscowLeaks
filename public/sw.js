const STATIC_CACHE = 'moscow-static-v1'
const AUDIO_CACHE = 'moscow-audio-v3'

const isCacheableResponse = (response) =>
  response && (response.ok || response.type === 'opaque')

const isAudioRequest = (request) => {
  if (request.destination === 'audio') {
    return true
  }

  const pathname = new URL(request.url).pathname.toLowerCase()
  return /\.(mp3|wav|aac|m4a|ogg)$/i.test(pathname)
}

const canCacheAudioResponse = (request, response) => {
  if (!response || response.status !== 200) {
    return false
  }

  if (request.headers.has('range')) {
    return false
  }

  return isCacheableResponse(response)
}

const parseRangeHeader = (rangeHeader, size) => {
  const match = /bytes=(\d*)-(\d*)/i.exec(rangeHeader || '')
  if (!match) {
    return null
  }

  const startValue = match[1]
  const endValue = match[2]

  let start = startValue ? Number(startValue) : 0
  let end = endValue ? Number(endValue) : size - 1

  if (!Number.isFinite(start) || Number.isNaN(start)) {
    return null
  }

  if (!Number.isFinite(end) || Number.isNaN(end) || end >= size) {
    end = size - 1
  }

  if (start > end || start >= size) {
    return null
  }

  return { start, end }
}

const respondFromCachedAudio = async (request, cache) => {
  const cached = await cache.match(request.url)
  if (!cached) {
    return null
  }

  const rangeHeader = request.headers.get('range')
  if (!rangeHeader) {
    return cached
  }

  const arrayBuffer = await cached.arrayBuffer()
  const size = arrayBuffer.byteLength
  const range = parseRangeHeader(rangeHeader, size)
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${size}`,
      },
    })
  }

  const slicedBuffer = arrayBuffer.slice(range.start, range.end + 1)
  const headers = new Headers(cached.headers)
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
  headers.set('Content-Length', String(slicedBuffer.byteLength))
  headers.set('Accept-Ranges', 'bytes')

  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
}

const warmFullAudioInBackground = async (request, cache) => {
  try {
    const fullRequest = new Request(request.url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    })

    const alreadyCached = await cache.match(fullRequest)
    if (alreadyCached) {
      return
    }

    const response = await fetch(fullRequest)
    if (canCacheAudioResponse(fullRequest, response)) {
      await cache.put(fullRequest, response.clone())
    }
  } catch {
    // Ignore background warm-up failures.
  }
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
        const cachedResponse = await respondFromCachedAudio(request, cache)
        if (cachedResponse) {
          return cachedResponse
        }

        const cached = await cache.match(request.url)
        if (cached) {
          return cached
        }

        if (request.headers.has('range')) {
          event.waitUntil(warmFullAudioInBackground(request, cache))
        }

        const response = await fetch(request)
        if (canCacheAudioResponse(request, response)) {
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

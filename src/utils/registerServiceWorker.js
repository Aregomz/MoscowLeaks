export const registerAppServiceWorker = (audioUrls = []) => {
  if (!('serviceWorker' in navigator)) {
    return
  }

  const shouldWarmUpAudio = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!connection) {
      return true
    }

    if (connection.saveData) {
      return false
    }

    const effectiveType = connection.effectiveType || ''
    return !effectiveType.includes('2g')
  }

  const scheduleWhenIdle = (callback) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 3500 })
      return
    }

    window.setTimeout(callback, 1500)
  }

  const warmAudioCache = (registration) => {
    if (!registration?.active || !audioUrls.length || !shouldWarmUpAudio()) {
      return
    }

    const warmUpTargets = audioUrls.slice(0, 2)
    scheduleWhenIdle(() => {
      registration.active.postMessage({
        type: 'WARM_AUDIO_CACHE',
        urls: warmUpTargets,
      })
    })
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        warmAudioCache(registration)

        navigator.serviceWorker.ready.then((readyRegistration) => {
          warmAudioCache(readyRegistration)
        })
      })
      .catch(() => {
        // Ignore service worker registration failures.
      })
  })
}

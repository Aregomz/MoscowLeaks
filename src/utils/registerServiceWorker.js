export const registerAppServiceWorker = (audioUrls = []) => {
  if (!('serviceWorker' in navigator)) {
    return
  }

  const warmAudioCache = (registration) => {
    if (!registration?.active || !audioUrls.length) {
      return
    }

    registration.active.postMessage({
      type: 'WARM_AUDIO_CACHE',
      urls: audioUrls,
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

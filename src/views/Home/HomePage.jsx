import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Howl } from 'howler'
import logo from '../../img/moscow_logo.png'
import { songs } from '../../data/songs'

const formatTime = (seconds) => {
  const safeValue = Math.max(0, Math.floor(seconds || 0))
  const mins = Math.floor(safeValue / 60)
  const secs = safeValue % 60

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const getInitials = (title) =>
  title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')

const isHexColor = (value) => /^#[0-9A-F]{6}$/i.test(value)

const gradientById = (id) => {
  const gradients = [
    'linear-gradient(135deg, #2a2a2a 0%, #7a7a7a 100%)',
    'linear-gradient(135deg, #1a1a1a 0%, #5f5f5f 100%)',
    'linear-gradient(135deg, #0f0f0f 0%, #737373 100%)',
    'linear-gradient(135deg, #252525 0%, #8a8a8a 100%)',
  ]

  return gradients[id % gradients.length]
}

const Cover = ({ song, size = 'md' }) => {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = getInitials(song.title)
  const usePlaceholder = imageFailed || !song.cover || isHexColor(song.cover)
  const dimensionClass = size === 'lg' ? 'h-44 w-44' : 'h-11 w-11'

  if (usePlaceholder) {
    const backgroundStyle = isHexColor(song.cover)
      ? { background: `linear-gradient(135deg, ${song.cover}, #111111)` }
      : { background: gradientById(song.id) }

    return (
      <div
        className={`${dimensionClass} flex shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-neutral-200`}
        style={backgroundStyle}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={song.cover}
      alt={song.title}
      className={`${dimensionClass} rounded-2xl object-cover shadow-[0_12px_30px_rgba(0,0,0,0.45)]`}
      onError={() => setImageFailed(true)}
      loading="lazy"
    />
  )
}

const ControlIcon = ({ name }) => {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.1,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
    className: 'h-5 w-5',
    'aria-hidden': true,
  }

  if (name === 'previous') {
    return (
      <svg {...commonProps}>
        <path d="M6 5v14" />
        <path d="M18 6l-8 6 8 6V6z" />
      </svg>
    )
  }

  if (name === 'next') {
    return (
      <svg {...commonProps}>
        <path d="M18 5v14" />
        <path d="M6 6l8 6-8 6V6z" />
      </svg>
    )
  }

  if (name === 'pause') {
    return (
      <svg {...commonProps}>
        <path d="M8 6v12" />
        <path d="M16 6v12" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

const HomePage = () => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(songs[0]?.duration || 0)
  const [trackDurations, setTrackDurations] = useState(() =>
    songs.reduce((accumulator, song) => {
      accumulator[song.id] = song.duration || 0
      return accumulator
    }, {}),
  )
  const [volume, setVolume] = useState(0.8)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)

  const howlRef = useRef(null)
  const autoplayRef = useRef(false)
  const tickerRef = useRef(null)
  const volumeRef = useRef(volume)
  const seekRef = useRef(0)

  const activeSong = songs[activeIndex]
  const shownDuration = useMemo(
    () => Math.floor(duration || activeSong?.duration || 0),
    [duration, activeSong],
  )

  const clearTicker = useCallback(() => {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }, [])

  const startTicker = useCallback(() => {
    clearTicker()
    tickerRef.current = window.setInterval(() => {
      const howl = howlRef.current
      if (!howl || !howl.playing() || isSeeking) {
        return
      }

      const nextTime = Number(howl.seek() || 0)
      setCurrentTime(nextTime)
      setSeekValue(nextTime)
    }, 250)
  }, [clearTicker, isSeeking])

  const goToTrack = useCallback((nextIndex, shouldPlay = true) => {
    setCurrentTime(0)
    setSeekValue(0)
    setDuration(songs[nextIndex]?.duration || 0)
    setIsPlaying(false)
    seekRef.current = 0
    autoplayRef.current = shouldPlay
    setActiveIndex(nextIndex)
  }, [])

  const goToNext = useCallback(() => {
    const nextIndex = (activeIndex + 1) % songs.length
    goToTrack(nextIndex, true)
  }, [activeIndex, goToTrack])

  const goToPrevious = useCallback(() => {
    const prevIndex = (activeIndex - 1 + songs.length) % songs.length
    goToTrack(prevIndex, true)
  }, [activeIndex, goToTrack])

  useEffect(() => {
    if (!activeSong) {
      return
    }

    clearTicker()
    const previousHowl = howlRef.current
    if (previousHowl) {
      previousHowl.stop()
      previousHowl.unload()
    }

    const newHowl = new Howl({
      src: [activeSong.url],
      html5: false,
      preload: true,
      volume: volumeRef.current,
      onload: () => {
        const loadedDuration = newHowl.duration()
        if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
          setDuration(loadedDuration)
        }
      },
      onplay: () => {
        setIsPlaying(true)
        startTicker()
      },
      onpause: () => {
        setIsPlaying(false)
      },
      onstop: () => {
        setIsPlaying(false)
      },
      onend: () => {
        goToNext()
      },
      onloaderror: () => {
        setIsPlaying(false)
      },
      onplayerror: () => {
        setIsPlaying(false)
      },
    })

    howlRef.current = newHowl

    if (autoplayRef.current) {
      if (seekRef.current > 0) {
        newHowl.seek(seekRef.current)
      }

      newHowl.play()
    }

    autoplayRef.current = false

    return () => {
      clearTicker()
      newHowl.unload()
    }
  }, [activeSong, clearTicker, goToNext, startTicker])

  useEffect(() => {
    const howl = howlRef.current
    volumeRef.current = volume
    if (!howl) {
      return
    }

    howl.volume(volume)
  }, [volume])

  useEffect(() => {
    const audios = songs.map((song) => {
      const audio = new Audio(song.url)
      audio.preload = 'metadata'

      const onLoadedMetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setTrackDurations((current) => {
            const nextDuration = Math.floor(audio.duration)
            if (current[song.id] === nextDuration) {
              return current
            }

            return {
              ...current,
              [song.id]: nextDuration,
            }
          })
        }
      }

      audio.addEventListener('loadedmetadata', onLoadedMetadata)
      audio.load()

      return { audio, onLoadedMetadata }
    })

    return () => {
      audios.forEach(({ audio, onLoadedMetadata }) => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      })
    }
  }, [])

  useEffect(
    () => () => {
      clearTicker()
      const howl = howlRef.current
      if (howl) {
        howl.stop()
        howl.unload()
      }
    },
    [clearTicker],
  )

  const togglePlay = () => {
    const howl = howlRef.current
    if (!howl) {
      return
    }

    if (howl.playing()) {
      howl.pause()
      clearTicker()
      return
    }

    if (seekRef.current > 0) {
      howl.seek(seekRef.current)
    }

    howl.play()
    startTicker()
  }

  const onSongClick = (index) => {
    if (index === activeIndex) {
      togglePlay()
      return
    }

    goToTrack(index, true)
  }

  const commitSeek = (value) => {
    const howl = howlRef.current
    if (!howl) {
      return
    }

    const wasPlaying = howl.playing()
    seekRef.current = value
    howl.seek(value)
    setCurrentTime(value)
    setSeekValue(value)
    if (wasPlaying && !howl.playing()) {
      howl.play()
    }

    if (wasPlaying) {
      startTicker()
    }
  }

  const displayedProgress = isSeeking ? seekValue : currentTime

  return (
    <div className="min-h-screen overflow-hidden bg-[#0a0a0a] text-neutral-100">
      <div className="relative isolate min-h-screen">
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="bg-noise absolute inset-0 opacity-35" />
          <div className="wave-wave wave-one absolute -left-24 top-8 h-72 w-[34rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.16)_0%,_rgba(255,255,255,0.06)_28%,_transparent_72%)] blur-3xl" />
          <div className="wave-wave wave-two absolute right-[-10%] top-[-4%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(180,180,180,0.12)_0%,_rgba(120,120,120,0.05)_32%,_transparent_72%)] blur-3xl" />
          <div className="ray-burst absolute inset-0 opacity-70" />
          <div className="fire-bloom fire-bloom-a absolute left-[6%] top-[10%] h-40 w-40 rounded-full" />
          <div className="fire-bloom fire-bloom-b absolute right-[9%] top-[20%] h-48 w-48 rounded-full" />
          <div className="fire-bloom fire-bloom-c absolute left-[52%] top-[42%] h-36 w-36 rounded-full" />
          <div className="purple-lightning purple-lightning-a absolute left-[10%] top-2 h-[24rem] w-16" />
          <div className="purple-lightning purple-lightning-b absolute right-[12%] top-10 h-[22rem] w-14" />
        </div>

        <main className="relative z-[1] mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-64 pt-8 sm:px-6 lg:px-8">
          <section className="flex flex-1 flex-col items-center justify-start text-center">
            <div className="pointer-events-none mb-6 flex items-center justify-center">
              <img
                src={logo}
                alt="Moscow Leaks"
                className="hero-logo h-40 w-40 object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.16)] sm:h-56 sm:w-56 md:h-64 md:w-64"
              />
            </div>

            <h1 className="text-3xl font-semibold tracking-[0.26em] text-white sm:text-4xl md:text-5xl">
              MOSCOW LEAKS
            </h1>

            <div className="mt-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.36em] text-neutral-500">
              <span className="h-px w-10 bg-white/20" />
              <span>Playlist</span>
              <span className="h-px w-10 bg-white/20" />
            </div>

            <ul className="mt-6 w-full max-w-3xl space-y-1 px-1 pb-10 sm:px-0 sm:pb-14">
              {songs.map((song, index) => {
                const isActive = index === activeIndex

                return (
                  <li key={song.id}>
                    <button
                      type="button"
                      onClick={() => onSongClick(index)}
                      className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-300 ${
                        isActive
                          ? 'bg-white/10 ring-1 ring-white/15'
                          : 'hover:bg-white/[0.04] hover:translate-x-1'
                      }`}
                    >
                      <Cover song={song} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white transition group-hover:text-neutral-100 sm:text-base">
                          {song.title}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs tracking-[0.22em] transition ${
                          isActive ? 'text-neutral-200' : 'text-neutral-500'
                        }`}
                      >
                        {formatTime(trackDurations[song.id] ?? song.duration)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-20 bg-transparent px-3 py-3">
          <div className="liquid-player mx-auto flex w-full max-w-6xl flex-col gap-3 overflow-hidden rounded-[1.5rem] px-4 py-4 shadow-[0_14px_45px_rgba(0,0,0,0.52)] sm:px-5">
            <div className="liquid-player__sheen" />
            <div className="liquid-player__glow" />

            <div className="relative z-[1] flex flex-col gap-3">
            <div className="flex items-center gap-3 md:gap-4">
              <Cover song={activeSong} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{activeSong.title}</p>
                <p className="truncate text-xs uppercase tracking-[0.22em] text-neutral-500">
                  {activeSong.artist}
                </p>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <span className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Vol</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="metal-range h-1 w-28"
                  aria-label="Volumen"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-lg text-neutral-200 transition hover:bg-white/10"
                  aria-label="Anterior"
                >
                    <span className="flex items-center justify-center">
                      <ControlIcon name="previous" />
                    </span>
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-12 w-12 rounded-full bg-white text-xl text-black transition duration-300 hover:scale-[1.04] hover:bg-neutral-100"
                  aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                    <span className="flex items-center justify-center">
                      <ControlIcon name={isPlaying ? 'pause' : 'play'} />
                    </span>
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-lg text-neutral-200 transition hover:bg-white/10"
                  aria-label="Siguiente"
                >
                    <span className="flex items-center justify-center">
                      <ControlIcon name="next" />
                    </span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-10 text-right text-xs text-neutral-500">
                  {formatTime(displayedProgress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(shownDuration, 1)}
                  step={0.1}
                  value={displayedProgress}
                  onMouseDown={() => setIsSeeking(true)}
                  onMouseUp={() => {
                    commitSeek(seekValue)
                    setIsSeeking(false)
                  }}
                  onTouchStart={() => setIsSeeking(true)}
                  onTouchEnd={() => {
                    commitSeek(seekValue)
                    setIsSeeking(false)
                  }}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value)
                    setSeekValue(nextValue)
                    if (!isSeeking) {
                      commitSeek(nextValue)
                    }
                  }}
                  className="metal-range h-1.5 flex-1"
                  aria-label="Barra de progreso"
                />
                <span className="w-10 text-xs text-neutral-500">{formatTime(shownDuration)}</span>
              </div>

              <div className="flex items-center gap-2 md:hidden">
                <span className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Vol</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="metal-range h-1 w-full"
                  aria-label="Volumen"
                />
              </div>
            </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default HomePage

/**
 * Elcoral's own video/audio-less media player.
 *
 * The browser's default <video controls> chrome is Chrome's (or Safari's)
 * and looks like an embedded YouTube frame — grey bar, alien play button,
 * a context menu we don't want. Telegram, X and WhatsApp all draw their
 * own, so this does too:
 *
 *   · lemon play badge centred on the poster frame
 *   · slim scrubber + elapsed/total time that fades in on hover / while paused
 *   · mute and fullscreen on the same row, no download / picture-in-picture
 *   · the frame takes the clip's REAL aspect ratio once metadata loads,
 *     so nothing is letterboxed or cropped into a 16:9 box
 *
 * Everything is a theme token, so it follows light/dark with the app.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/* `fill` makes the player fill its parent box instead of taking the
   clip's own aspect ratio — used by message bubbles, where every photo
   and clip shares one fixed frame size. */
export default function MediaPlayer({ src, poster, ratio: ratioProp, onRatio, rounded = true, fill = false }) {
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const [ratio, setRatio] = useState(ratioProp ?? null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [started, setStarted] = useState(false)

  const toggle = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      setStarted(true)
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [])

  const seek = (e) => {
    const el = videoRef.current
    if (!el || !duration) return
    const box = e.currentTarget.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    el.currentTime = pct * duration
    setTime(el.currentTime)
  }

  const fullscreen = () => {
    const node = wrapRef.current
    if (!node) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else node.requestFullscreen?.()
  }

  useEffect(() => {
    setStarted(false)
    setPlaying(false)
    setTime(0)
  }, [src])

  const pct = duration ? (time / duration) * 100 : 0

  return (
    <div
      ref={wrapRef}
      className={`mp ${rounded ? 'mp-round' : ''} ${fill ? 'mp-fill-box' : ''} ${playing ? 'mp-playing' : ''} ${started ? 'mp-started' : ''}`}
      style={!fill && ratio ? { aspectRatio: ratio } : undefined}
      data-stop="true"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        className="mp-video"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); setStarted(false) }}
        onLoadedMetadata={(e) => {
          const { videoWidth: w, videoHeight: h, duration: d } = e.currentTarget
          if (Number.isFinite(d)) setDuration(d)
          if (w && h) {
            setRatio(w / h)
            onRatio?.(w / h)
          }
        }}
      />

      {/* Elcoral play badge — the only affordance before playback starts. */}
      {!playing && (
        <button type="button" className="mp-play" onClick={toggle} aria-label="Play video">
          <Play size={26} strokeWidth={0} fill="currentColor" />
        </button>
      )}

      {duration > 0 && !started && (
        <span className="mp-duration">{clock(duration)}</span>
      )}

      <div className="mp-bar">
        <button type="button" className="mp-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} />}
        </button>
        <span className="mp-time">{clock(time)}</span>
        <span
          className="mp-track"
          role="presentation"
          onClick={seek}
        >
          <span className="mp-fill" style={{ width: `${pct}%` }}>
            <i className="mp-knob" />
          </span>
        </span>
        <span className="mp-time">{clock(duration)}</span>
        <button
          type="button"
          className="mp-btn"
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            el.muted = !el.muted
            setMuted(el.muted)
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} strokeWidth={2} /> : <Volume2 size={16} strokeWidth={2} />}
        </button>
        <button type="button" className="mp-btn" onClick={fullscreen} aria-label="Fullscreen">
          <Maximize2 size={16} strokeWidth={2} />
        </button>
      </div>

      <style>{`
        .mp {
          position: relative; display: block; width: 100%;
          max-height: 82vh; overflow: hidden;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
        }
        .mp-round { border-radius: 16px; }
        /* Fixed-frame mode (message bubbles): fill the parent exactly. */
        .mp-fill-box { width: 100%; height: 100%; max-height: none; }
        .mp-fill-box .mp-video { object-fit: cover; }
        .mp-video {
          display: block; width: 100%; height: 100%;
          object-fit: contain; background: #000;
        }
        .mp-play {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 62px; height: 62px; border-radius: 999px; border: 0;
          display: grid; place-items: center; cursor: pointer;
          padding-left: 4px;
          background: var(--lemon); color: var(--on-accent);
          box-shadow: 0 8px 26px rgba(0,0,0,.38);
          transition: transform 160ms ease;
        }
        @media (hover: hover) and (pointer: fine) { .mp-play:hover { transform: translate(-50%, -50%) scale(1.06); } }
        .mp-started .mp-play {
          width: 52px; height: 52px;
          background: color-mix(in srgb, var(--lemon) 92%, transparent);
        }
        .mp-duration {
          position: absolute; left: 10px; bottom: 10px;
          padding: 3px 8px; border-radius: 999px;
          background: color-mix(in srgb, #000 55%, transparent);
          color: #fff; font-size: 11.5px; font-weight: 600;
          font-variant-numeric: tabular-nums; letter-spacing: .2px;
        }
        .mp-bar {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 10px 9px;
          background: linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0));
          opacity: 0; transition: opacity 160ms ease; pointer-events: none;
        }
        .mp-started .mp-bar, .mp:hover .mp-bar, .mp:focus-within .mp-bar {
          opacity: 1; pointer-events: auto;
        }
        .mp-started .mp-duration { display: none; }
        .mp-btn {
          display: grid; place-items: center; flex: none;
          width: 28px; height: 28px; border: 0; border-radius: 999px;
          background: none; color: #fff; cursor: pointer;
        }
        @media (hover: hover) and (pointer: fine) { .mp-btn:hover { background: rgba(255,255,255,.16); } }
        .mp-time {
          flex: none; font-size: 11.5px; color: #fff; opacity: .9;
          font-variant-numeric: tabular-nums;
        }
        .mp-track {
          flex: 1; min-width: 0; height: 14px; display: flex; align-items: center;
          cursor: pointer;
        }
        .mp-track::before {
          content: ''; position: absolute; left: 0; right: 0;
        }
        .mp-track {
          position: relative;
        }
        .mp-track::after {
          content: ''; position: absolute; left: 0; right: 0; height: 3px;
          border-radius: 999px; background: rgba(255,255,255,.28);
        }
        .mp-fill {
          position: relative; z-index: 1; height: 3px; border-radius: 999px;
          background: var(--lemon); display: block;
        }
        .mp-knob {
          position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
          width: 10px; height: 10px; border-radius: 999px; background: var(--lemon);
        }
        @media (prefers-reduced-motion: reduce) {
          .mp-play, .mp-bar { transition: none; }
        }
      `}</style>
    </div>
  )
}

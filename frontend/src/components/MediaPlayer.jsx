/**
 * Elcoral's own video player.
 *
 * The browser's default <video controls> chrome is Chrome's (or Safari's)
 * and looks like an embedded YouTube frame — grey bar, alien play button,
 * a context menu we don't want. Telegram, X and WhatsApp all draw their
 * own, so this does too:
 *
 *   · lemon play badge centred on the poster frame
 *   · a real scrubber: drag it, click anywhere on it, or use the arrow
 *     keys; a buffered bar sits behind the played portion
 *   · skip -10s / +10s buttons on the bar
 *   · IN FULLSCREEN ONLY: double-tap the right half to jump forward 10s
 *     and the left half to jump back 10s, with a ripple that names the
 *     jump — the YouTube/TikTok gesture. It is deliberately NOT active in
 *     the feed, where a double-tap is a scroll or a like, and where a
 *     stray seek would be infuriating.
 *   · mute and fullscreen on the same row, no download / picture-in-picture
 *   · the frame takes the clip's REAL aspect ratio once metadata loads,
 *     so nothing is letterboxed or cropped into a 16:9 box
 *
 * Everything is a theme token, so it follows light/dark with the app.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Maximize2, Minimize2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX,
} from 'lucide-react'
import MediaFallback from './MediaFallback.jsx'

const SKIP_SECONDS = 10
// Two taps closer together than this on the same side are a double-tap.
const DOUBLE_TAP_MS = 320

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/* `fill` makes the player fill its parent box instead of taking the
   clip's own aspect ratio — used by message bubbles, where every photo
   and clip shares one fixed frame size.

   `immersive` says the player is ALREADY on a full-screen canvas (the
   in-app MediaViewer), so the tap gestures, the always-visible bar and
   the large chrome switch on without waiting for the browser's own
   fullscreen. That is what makes "open a clip fullscreen" continue from
   where the small frame left off: the viewer passes `startAt` and reads
   `onTime`, so the two players hand the playhead back and forth instead
   of restarting at 0:00.

   `onRequestFullscreen` lets the embedder (feed card / DM bubble) take
   over the expand button and open the in-app viewer instead of the
   browser's fullscreen, which on iOS would replace our chrome with
   Safari's. */
export default function MediaPlayer({
  src,
  poster,
  ratio: ratioProp,
  onRatio,
  rounded = true,
  fill = false,
  immersive = false,
  startAt = 0,
  autoPlay = false,
  onTime,
  onRequestFullscreen,
  onError,
  onRetry,
  forceDarkFallback = false,
}) {
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const lastTap = useRef({ at: 0, side: null })
  const reportTime = useRef(onTime)
  reportTime.current = onTime

  const [ratio, setRatio] = useState(ratioProp ?? null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(startAt || 0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [started, setStarted] = useState(immersive)
  const [scrubbing, setScrubbing] = useState(false)
  const [browserFullscreen, setBrowserFullscreen] = useState(false)
  const [failed, setFailed] = useState(false)
  // { side: 'back' | 'forward', amount } — the double-tap ripple.
  const [jump, setJump] = useState(null)

  // Immersive (in-app fullscreen viewer) counts as fullscreen for every
  // gesture and every piece of chrome.
  const isFullscreen = immersive || browserFullscreen


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

  const skip = useCallback((delta) => {
    const el = videoRef.current
    if (!el || !Number.isFinite(el.duration)) return
    const next = Math.min(Math.max(0, el.currentTime + delta), el.duration)
    el.currentTime = next
    setTime(next)
    reportTime.current?.(next)
  }, [])


  // ---------------------------------------------------------- scrubbing
  // Pointer events (not click) so the same code path handles a mouse
  // drag, a touch drag and a single tap on the track.
  const seekToClientX = useCallback((clientX) => {
    const el = videoRef.current
    const track = trackRef.current
    if (!el || !track || !duration) return
    const box = track.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    const next = pct * duration
    el.currentTime = next
    setTime(next)
    reportTime.current?.(next)
  }, [duration])

  const onTrackPointerDown = (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setScrubbing(true)
    seekToClientX(event.clientX)
  }

  const onTrackPointerMove = (event) => {
    if (!scrubbing) return
    event.preventDefault()
    seekToClientX(event.clientX)
  }

  const endScrub = (event) => {
    if (!scrubbing) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setScrubbing(false)
  }

  const onTrackKeyDown = (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); skip(5) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); skip(-5) }
    else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle() }
  }

  // -------------------------------------------------------- fullscreen
  // When the embedder hands us `onRequestFullscreen` the expand button
  // opens the in-app viewer (which resumes at the current playhead)
  // instead of the browser's own fullscreen — one consistent chrome on
  // every platform, iOS included.
  const fullscreen = () => {
    if (onRequestFullscreen) {
      onRequestFullscreen(videoRef.current?.currentTime ?? time)
      return
    }
    const node = wrapRef.current
    if (!node) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else (node.requestFullscreen?.() ?? node.webkitRequestFullscreen?.())
  }

  useEffect(() => {
    const onChange = () => setBrowserFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])


  // Keyboard shortcuts only while the player is the fullscreen element,
  // so typing elsewhere in the app never seeks a video.
  useEffect(() => {
    if (!isFullscreen) return undefined
    const onKey = (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); skip(SKIP_SECONDS) }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); skip(-SKIP_SECONDS) }
      else if (event.key === ' ' || event.key === 'k') { event.preventDefault(); toggle() }
      else if (event.key === 'm') {
        const el = videoRef.current
        if (el) { el.muted = !el.muted; setMuted(el.muted) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen, skip, toggle])

  // --------------------------------------------------------- double-tap
  // Fullscreen only. Outside fullscreen the surface stays a plain
  // play/pause tap, which is what the feed and DM bubbles expect.
  const onSurfaceClick = (event) => {
    if (!isFullscreen) { toggle(); return }
    const box = event.currentTarget.getBoundingClientRect()
    const side = event.clientX - box.left < box.width / 2 ? 'back' : 'forward'
    const now = Date.now()
    const previous = lastTap.current

    if (previous.side === side && now - previous.at < DOUBLE_TAP_MS) {
      lastTap.current = { at: 0, side: null }
      skip(side === 'forward' ? SKIP_SECONDS : -SKIP_SECONDS)
      setJump({ side, at: now })
      window.setTimeout(() => {
        setJump((current) => (current && current.at === now ? null : current))
      }, 520)
      return
    }

    lastTap.current = { at: now, side }
    // A single tap still plays/pauses — but only once we know a second
    // tap isn't coming, otherwise every skip would also pause the clip.
    window.setTimeout(() => {
      if (lastTap.current.at === now) {
        lastTap.current = { at: 0, side: null }
        toggle()
      }
    }, DOUBLE_TAP_MS)
  }

  // A NEW clip resets the playhead; the same clip re-mounted at a handed
  // over `startAt` (small frame -> fullscreen viewer and back) keeps it.
  useEffect(() => {
    setStarted(immersive)
    setPlaying(false)
    setTime(startAt || 0)
    setBuffered(0)
    setFailed(false)
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = duration ? (time / duration) * 100 : 0
  const bufferedPct = duration ? Math.min(100, (buffered / duration) * 100) : 0

  if (failed) {
    return (
      <div
        className={['mp', 'mp-failed', rounded ? 'mp-round' : '', fill ? 'mp-fill-box' : ''].join(' ')}
        style={!fill && ratio ? { aspectRatio: ratio } : undefined}
      >
        <MediaFallback
          kind="video"
          compact={!immersive}
          onDark={immersive || forceDarkFallback}
          onRetry={
            onRetry
              ? async () => {
                  const ok = await onRetry()
                  if (ok !== false) setFailed(false)
                }
              : undefined
          }
        />
        <style>{`
          /* Transparent, not tinted: in fill mode this sits inside a
             frame the PARENT already colored (e.g. Attachment.jsx's
             always-black .ma-video) — a second background here would
             fight it instead of blending in. */
          .mp { position: relative; display: block; width: 100%; overflow: hidden; }
          .mp:not(.mp-fill-box) { background: color-mix(in srgb, var(--ink) 7%, transparent); }
          .mp-round { border-radius: 16px; }
          .mp-fill-box { width: 100%; height: 100%; }
          .mp-failed:not(.mp-fill-box) { min-height: 180px; }
        `}</style>
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className={[
        'mp',
        rounded ? 'mp-round' : '',
        fill ? 'mp-fill-box' : '',
        playing ? 'mp-playing' : '',
        started ? 'mp-started' : '',
        scrubbing ? 'mp-scrubbing' : '',
        isFullscreen ? 'mp-fs' : '',
        immersive ? 'mp-immersive' : '',
      ].join(' ')}
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
        onPointerUp={onSurfaceClick}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); onError?.() }}
        onTimeUpdate={(e) => {
          if (scrubbing) return
          const at = e.currentTarget.currentTime
          setTime(at)
          reportTime.current?.(at)
        }}
        onProgress={(e) => {
          const el = e.currentTarget
          if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1))
        }}
        onEnded={() => { setPlaying(false); setStarted(immersive) }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget
          const { videoWidth: w, videoHeight: h, duration: d } = el
          if (Number.isFinite(d)) setDuration(d)
          if (w && h) {
            setRatio(w / h)
            onRatio?.(w / h)
          }
          // THE SYNC: pick up the playhead the small frame was at rather
          // than starting the clip over, then carry on playing if it was
          // playing when the viewer opened.
          if (startAt > 0 && Number.isFinite(d) && startAt < d) {
            el.currentTime = startAt
            setTime(startAt)
          }
          if (autoPlay) {
            setStarted(true)
            el.play().catch(() => {})
          }
        }}
      />


      {/* Double-tap ripple. Only ever rendered in fullscreen. */}
      {jump && (
        <span className={`mp-jump mp-jump-${jump.side}`} aria-live="polite">
          {jump.side === 'forward'
            ? <RotateCw size={26} strokeWidth={2} />
            : <RotateCcw size={26} strokeWidth={2} />}
          {SKIP_SECONDS}s
        </span>
      )}

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
        <button
          type="button"
          className="mp-btn mp-skip"
          onClick={() => skip(-SKIP_SECONDS)}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
        >
          <RotateCcw size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="mp-btn mp-skip"
          onClick={() => skip(SKIP_SECONDS)}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
        >
          <RotateCw size={15} strokeWidth={2} />
        </button>
        <span className="mp-time">{clock(time)}</span>
        <span
          ref={trackRef}
          className="mp-track"
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onKeyDown={onTrackKeyDown}
        >
          <span className="mp-buffered" style={{ width: `${bufferedPct}%` }} aria-hidden="true" />
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
        <button
          type="button"
          className="mp-btn"
          onClick={fullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={16} strokeWidth={2} /> : <Maximize2 size={16} strokeWidth={2} />}
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
        /* Fullscreen is a black canvas with the clip letterboxed inside —
           never cropped, whatever the frame it came from. */
        .mp-fs { max-height: none; height: 100%; border-radius: 0; background: #000; }
        /* In-app immersive viewer: same canvas, and never cropped even
           though the box is fixed to the screen. */
        .mp-immersive { height: 100%; max-height: none; border-radius: 0; background: #000; }
        .mp-immersive .mp-video { height: 100%; object-fit: contain; }

        .mp-fs .mp-video { object-fit: contain; }
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

        /* Double-tap ripple: a soft half-disc on the side you tapped,
           with the jump amount written inside it. */
        .mp-jump {
          position: absolute; top: 50%; transform: translateY(-50%);
          display: grid; place-items: center; gap: 2px;
          width: 108px; height: 108px; border-radius: 999px;
          background: rgba(0,0,0,.42); color: #fff;
          font-size: 13px; font-weight: 700; letter-spacing: .3px;
          pointer-events: none; animation: mp-pop 520ms ease-out forwards;
        }
        .mp-jump-back { left: 8%; }
        .mp-jump-forward { right: 8%; }
        @keyframes mp-pop {
          0% { opacity: 0; transform: translateY(-50%) scale(.7); }
          25% { opacity: 1; transform: translateY(-50%) scale(1); }
          100% { opacity: 0; transform: translateY(-50%) scale(1.1); }
        }

        .mp-bar {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; gap: 6px;
          padding: 10px 10px 9px;
          background: linear-gradient(to top, rgba(0,0,0,.66), rgba(0,0,0,0));
          opacity: 0; transition: opacity 160ms ease; pointer-events: none;
        }
        .mp-started .mp-bar, .mp:hover .mp-bar, .mp:focus-within .mp-bar, .mp-scrubbing .mp-bar {
          opacity: 1; pointer-events: auto;
        }
        .mp-fs .mp-bar {
          opacity: 1; pointer-events: auto; gap: 10px;
          padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
        }
        .mp-started .mp-duration { display: none; }
        .mp-btn {
          display: grid; place-items: center; flex: none;
          width: 28px; height: 28px; border: 0; border-radius: 999px;
          background: none; color: #fff; cursor: pointer;
        }
        .mp-fs .mp-btn { width: 36px; height: 36px; }
        @media (hover: hover) and (pointer: fine) { .mp-btn:hover { background: rgba(255,255,255,.16); } }
        /* The skip pair is desktop/fullscreen chrome; on a small feed card
           the double-tap gesture and the scrubber are enough. */
        .mp-skip { display: none; }
        .mp-fs .mp-skip { display: grid; }
        @media (min-width: 700px) { .mp-skip { display: grid; } }
        .mp-time {
          flex: none; font-size: 11.5px; color: #fff; opacity: .9;
          font-variant-numeric: tabular-nums;
        }
        .mp-fs .mp-time { font-size: 13px; }

        /* Scrubber. The hit area is 18px tall (24px in fullscreen) so it
           can actually be grabbed with a thumb, while the drawn rail
           stays a 3px hairline. */
        .mp-track {
          position: relative; flex: 1; min-width: 0; height: 18px;
          display: flex; align-items: center; cursor: pointer;
          touch-action: none; -webkit-tap-highlight-color: transparent;
        }
        .mp-fs .mp-track { height: 24px; }
        .mp-track:focus-visible { outline: 2px solid var(--lemon); outline-offset: 3px; border-radius: 999px; }
        .mp-track::after {
          content: ''; position: absolute; left: 0; right: 0; height: 3px;
          border-radius: 999px; background: rgba(255,255,255,.28);
        }
        .mp-fs .mp-track::after { height: 4px; }
        .mp-buffered {
          position: absolute; left: 0; z-index: 1; height: 3px; border-radius: 999px;
          background: rgba(255,255,255,.4);
        }
        .mp-fs .mp-buffered { height: 4px; }
        .mp-fill {
          position: relative; z-index: 2; height: 3px; border-radius: 999px;
          background: var(--lemon); display: block;
        }
        .mp-fs .mp-fill { height: 4px; }
        .mp-knob {
          position: absolute; right: -6px; top: 50%; transform: translateY(-50%);
          width: 12px; height: 12px; border-radius: 999px; background: var(--lemon);
          box-shadow: 0 1px 4px rgba(0,0,0,.45);
          transition: transform 120ms ease;
        }
        .mp-fs .mp-knob { width: 15px; height: 15px; right: -7px; }
        .mp-scrubbing .mp-knob { transform: translateY(-50%) scale(1.25); }

        @media (prefers-reduced-motion: reduce) {
          .mp-play, .mp-bar, .mp-knob { transition: none; }
          .mp-jump { animation-duration: 1ms; }
        }
      `}</style>
    </div>
  )
}

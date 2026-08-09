/**
 * Voice-note / audio player.
 *
 * The native <audio> control can't be themed, so this is a small custom
 * player: play/pause, a scrubbable progress bar and an elapsed/total
 * duration readout. It's driven entirely by a hidden <audio> element, so
 * seeking, buffering and background playback still come from the browser.
 *
 * Accessibility: the progress bar is a real <input type="range"> so it is
 * keyboard-operable and announced as a slider; the button label flips
 * between Play and Pause.
 */
import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VoiceNote({ src, title = 'Voice note' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    const onTime = () => setCurrent(audio.currentTime)
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('pause', () => setPlaying(false))
    audio.addEventListener('play', () => setPlaying(true))
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [src])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }

  const seek = (value) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    audio.currentTime = (value / 100) * duration
    setCurrent(audio.currentTime)
  }

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  return (
    <div className="vn">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="vn-play"
        onClick={toggle}
        aria-label={playing ? `Pause ${title}` : `Play ${title}`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <div className="vn-track">
        <input
          className="vn-range"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={pct}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={`Seek ${title}`}
          aria-valuetext={`${clock(current)} of ${clock(duration)}`}
          style={{ '--vn-pct': `${pct}%` }}
        />
        <span className="vn-time">
          <span>{clock(current)}</span>
          <span>{clock(duration)}</span>
        </span>
      </div>

      <style>{`
        .vn {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px 8px 8px; border-radius: 999px;
          background: color-mix(in srgb, var(--ink) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
          color: inherit; width: 100%; max-width: 300px; min-width: 220px;
        }
        .vn-play {
          flex: none; width: 36px; height: 36px; border: 0; border-radius: 999px;
          display: grid; place-items: center; cursor: pointer;
          background: var(--lemon, var(--accent-ink)); color: var(--on-accent, #111);
          transition: transform 120ms ease, filter 120ms ease;
        }
        .vn-play:hover { filter: brightness(1.05); }
        .vn-play:active { transform: scale(0.94); }
        .vn-play:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
        .vn-track { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .vn-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; border-radius: 999px; cursor: pointer;
          background: linear-gradient(
            to right,
            currentColor 0 var(--vn-pct),
            color-mix(in srgb, currentColor 22%, transparent) var(--vn-pct) 100%
          );
        }
        .vn-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 13px; height: 13px; border-radius: 999px;
          background: currentColor; border: 2px solid var(--panel);
          box-shadow: 0 1px 3px rgba(0,0,0,.35);
        }
        .vn-range::-moz-range-thumb {
          width: 13px; height: 13px; border: 2px solid var(--panel); border-radius: 999px;
          background: currentColor; box-shadow: 0 1px 3px rgba(0,0,0,.35);
        }
        .vn-range:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 3px; }
        .vn-time {
          display: flex; justify-content: space-between;
          font-size: 10.5px; font-variant-numeric: tabular-nums; opacity: 0.7;
        }
        @media (max-width: 420px) { .vn { max-width: 100%; } }
      `}</style>
    </div>
  )
}

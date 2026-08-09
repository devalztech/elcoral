/**
 * Message composer: text, attachments and voice notes.
 *
 * Uploading is separated from sending. Files go to /api/media/upload as
 * soon as they're picked, so the person sees per-file progress and a
 * failed upload never blocks the text they've already typed; the send
 * POST then carries only the returned refs.
 *
 * Voice notes use MediaRecorder with whatever container the browser
 * gives us (webm on Chrome/Firefox, mp4 on Safari) — the backend accepts
 * both and stores the MIME type so playback picks the right decoder.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Paperclip, Send, Square, X } from 'lucide-react'
import { api } from '../../api/client.js'

const MAX_ATTACHMENTS = 10

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(type)) return type
  }
  return ''
}

function secondsLabel(total) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Composer({ token, disabled, onSend, onTyping }) {
  const [text, setText] = useState('')
  // [{ id, name, status: 'uploading'|'ready'|'error', ref, mime_type }]
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const fileRef = useRef(null)
  const textRef = useRef(null)

  const readyRefs = attachments.filter((a) => a.status === 'ready')
  const busy = attachments.some((a) => a.status === 'uploading')
  const canSend = !disabled && !sending && !busy && (text.trim() || readyRefs.length)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stream?.getTracks?.().forEach((t) => t.stop())
  }, [])

  const upload = useCallback(async (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setAttachments((list) => [...list, { id, name: file.name || 'Attachment', status: 'uploading' }])
    try {
      const result = await api.uploadMedia(file, token)
      setAttachments((list) => list.map((a) => (
        a.id === id ? { ...a, status: 'ready', ref: result.ref, mime_type: result.mime_type } : a
      )))
    } catch (err) {
      setAttachments((list) => list.map((a) => (
        a.id === id ? { ...a, status: 'error', error: err.message } : a
      )))
      setError(err.message || 'Upload failed.')
    }
  }, [token])

  const onPick = (event) => {
    const files = Array.from(event.target.files ?? [])
    const room = MAX_ATTACHMENTS - attachments.length
    if (files.length > room) setError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
    files.slice(0, Math.max(0, room)).forEach(upload)
    event.target.value = ''
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        // Empty recording (tapped stop instantly) — nothing worth sending.
        if (blob.size > 0) {
          const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
          upload(new File([blob], `voice-note.${ext}`, { type: type.split(';')[0] }))
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setError('Microphone permission is needed to record a voice note.')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false)
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  const submit = async (event) => {
    event?.preventDefault?.()
    if (!canSend) return
    setSending(true)
    setError('')
    try {
      await onSend({ body: text.trim(), attachments: readyRefs.map(({ ref, mime_type }) => ({ ref, mime_type })) })
      setText('')
      setAttachments([])
      onTyping?.(false)
      if (textRef.current) textRef.current.style.height = 'auto'
    } catch (err) {
      setError(err.message || 'Could not send. Try again.')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (event) => {
    // Enter sends on a desktop keyboard; Shift+Enter is a newline. On
    // touch keyboards Enter is always a newline, since there's a button.
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(min-width: 860px)').matches) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className="mc" onSubmit={submit}>
      {(attachments.length > 0 || error) && (
        <div className="mc-tray">
          {attachments.map((a) => (
            <span key={a.id} className={`mc-chip mc-${a.status}`}>
              <span className="mc-chip-name">{a.name}</span>
              {a.status === 'uploading' && <span className="mc-chip-state">uploading…</span>}
              {a.status === 'error' && <span className="mc-chip-state">failed</span>}
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {error && <span className="mc-error">{error}</span>}
        </div>
      )}

      <div className="mc-row">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={onPick}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rtf"
        />
        <button
          type="button"
          className="mc-icon"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || recording}
          aria-label="Attach a file"
        >
          <Paperclip size={19} />
        </button>

        {recording ? (
          <span className="mc-recording">
            <i aria-hidden="true" /> Recording {secondsLabel(elapsed)}
          </span>
        ) : (
          <textarea
            ref={textRef}
            className="mc-input"
            rows={1}
            value={text}
            placeholder="Message…"
            disabled={disabled}
            onKeyDown={onKeyDown}
            onChange={(e) => {
              setText(e.target.value)
              onTyping?.(e.target.value.length > 0)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = `${Math.min(120, el.scrollHeight)}px`
            }}
            onBlur={() => onTyping?.(false)}
          />
        )}

        {text.trim() || readyRefs.length ? (
          <button type="submit" className="mc-send" disabled={!canSend} aria-label="Send message">
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            className={`mc-icon ${recording ? 'mc-icon-rec' : ''}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled}
            aria-label={recording ? 'Stop and send voice note' : 'Record a voice note'}
          >
            {recording ? <Square size={17} /> : <Mic size={19} />}
          </button>
        )}
      </div>

      <style>{`
        .mc {
          position: sticky; bottom: 0;
          background: var(--panel);
          border-top: 1px solid var(--border);
          padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
        }
        .mc-tray { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 2px 8px; }
        .mc-chip {
          display: inline-flex; align-items: center; gap: 6px;
          max-width: 200px; padding: 5px 6px 5px 10px; border-radius: 999px;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
          font-size: 12px;
        }
        .mc-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mc-chip-state { font-size: 11px; color: var(--ink-faint); }
        .mc-chip.mc-error { background: color-mix(in srgb, crimson 14%, transparent); }
        .mc-chip button { display: grid; place-items: center; color: var(--ink-faint); }
        .mc-error { font-size: 12px; color: crimson; align-self: center; }
        .mc-row { display: flex; align-items: flex-end; gap: 6px; }
        .mc-icon {
          display: grid; place-items: center; width: 38px; height: 38px; flex: none;
          border-radius: 999px; color: var(--ink-dim);
        }
        .mc-icon:disabled { opacity: 0.45; }
        .mc-icon-rec { color: crimson; }
        .mc-input {
          flex: 1; resize: none; border: 1px solid var(--border); border-radius: 20px;
          padding: 9px 14px; font: inherit; font-size: 14.5px; line-height: 1.35;
          background: var(--bg); color: var(--ink); max-height: 120px;
        }
        .mc-input:focus { outline: none; border-color: var(--accent-ink); }
        .mc-recording {
          flex: 1; display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 20px; font-size: 14px;
          background: color-mix(in srgb, crimson 10%, transparent); color: crimson;
        }
        .mc-recording i {
          width: 9px; height: 9px; border-radius: 999px; background: crimson;
          animation: mc-pulse 1.1s infinite;
        }
        @keyframes mc-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } }
        .mc-send {
          display: grid; place-items: center; width: 38px; height: 38px; flex: none;
          border-radius: 999px; background: var(--lemon); color: var(--on-accent);
        }
        .mc-send:disabled { opacity: 0.5; }
        @media (prefers-reduced-motion: reduce) { .mc-recording i { animation: none } }
      `}</style>
    </form>
  )
}

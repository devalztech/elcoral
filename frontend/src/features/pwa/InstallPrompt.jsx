/**
 * "Get the app" prompt.
 *
 * Elcoral is installable as a home-screen app — a web app manifest, no
 * service worker, because nothing here asked for offline use and an
 * app-shell cache is the usual source of "my app won't update".
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which we hold onto and
 * replay when the person taps Install. iOS Safari has no such event and
 * only installs through Share -> Add to Home Screen, so there we show
 * the instruction instead of a button that couldn't work.
 *
 * Dismissal is remembered for two weeks so the bar can't become nagware.
 */
import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

const DISMISS_KEY = 'elcoral:install-dismissed-until'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    && !/crios|fxios/i.test(window.navigator.userAgent)
}

function snoozed() {
  const until = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
  return Number.isFinite(until) && until > Date.now()
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone() || snoozed()) return undefined

    const onPrompt = (event) => {
      // Chrome shows its own mini-infobar unless we take over.
      event.preventDefault()
      setDeferred(event)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // iOS never fires the event, so surface the manual route ourselves.
    if (isIos()) setVisible(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS))
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) { setIosHelp(true); return }
    deferred.prompt()
    try { await deferred.userChoice } catch { /* dismissed */ }
    setDeferred(null)
    setVisible(false)
  }

  return (
    <div className="ip" role="region" aria-label="Install Elcoral">
      <img className="ip-icon" src="/icons/icon-192.png" alt="" width={40} height={40} />
      <div className="ip-text">
        <strong>Get the Elcoral app</strong>
        <span>
          {iosHelp || (!deferred && isIos())
            ? <>Tap <Share size={13} aria-hidden="true" /> Share, then “Add to Home Screen”.</>
            : 'Install it for full-screen, one-tap access.'}
        </span>
      </div>
      {!isIos() && (
        <button type="button" className="ip-cta" onClick={install}>
          <Download size={15} aria-hidden="true" /> Install
        </button>
      )}
      <button type="button" className="ip-close" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>

      <style>{`
        .ip {
          position: fixed; z-index: 60;
          left: 12px; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom));
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 16px;
          background: var(--panel); border: 1px solid var(--border);
          box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.35);
        }
        .ip-icon { border-radius: 10px; flex: none; }
        .ip-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .ip-text strong { font-family: var(--font-head); font-size: 13.5px; color: var(--ink); }
        .ip-text span { font-size: 12px; color: var(--ink-dim); display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .ip-cta {
          flex: none; display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 13px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-size: 12.5px; font-weight: 700;
        }
        .ip-close { flex: none; color: var(--ink-faint); display: grid; place-items: center; width: 26px; height: 26px; }
        @media (min-width: 860px) {
          .ip { left: auto; right: 24px; bottom: 24px; max-width: 380px; }
        }
      `}</style>
    </div>
  )
}

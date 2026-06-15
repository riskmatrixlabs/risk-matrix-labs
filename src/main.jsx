import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoot from './AppRoot.jsx'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/react'

// ── PostHog ──────────────────────────────────────────────────────────────────
// Opt-out by default — only capture after explicit cookie consent (rml_cookie_ok=accept)
posthog.init('phc_rAec6z6YAWLnAzkNih3rv9dMUCxAYfQdq94DxLJbHeJz', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
  capture_pageleave: true,
  opt_out_capturing_by_default: true,
})
// Expose on window so cookie banner can call opt_in_capturing after consent
window.posthog = posthog
// Re-enable if user already consented in a prior session
try {
  if (localStorage.getItem('rml_cookie_ok') === 'accept') posthog.opt_in_capturing()
} catch { /* localStorage unavailable */ }

// ── Sentry ───────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: 'https://9f097148f69641e8a0f5c61ad3450aa5@o4511486431133696.ingest.us.sentry.io/4511486703435776',
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
  integrations: [Sentry.browserTracingIntegration()],
})

// ── Crisp chat removed ───────────────────────────────────────────────────────

// ── Service Worker ───────────────────────────────────────────────────────────
// One-time reset: service workers installed before sw.js learned to skip /api could cache
// API responses (serving a stale index.html for /api/* calls). Unregister + purge caches
// once per browser, then reload, so the current /api-skipping worker takes control cleanly.
if ('serviceWorker' in navigator) {
  const RESET_KEY = 'rml_sw_reset_v145'
  let didReset = false
  try { didReset = localStorage.getItem(RESET_KEY) === '1' } catch {}
  if (!didReset) {
    try { localStorage.setItem(RESET_KEY, '1') } catch {}
    Promise.resolve()
      .then(() => navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))))
      .then(() => (self.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : null))
      .then(() => location.reload())
      .catch(() => {})
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)

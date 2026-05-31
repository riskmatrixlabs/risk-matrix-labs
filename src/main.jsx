import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoot from './AppRoot.jsx'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/react'

// ── PostHog ──────────────────────────────────────────────────────────────────
posthog.init('phc_rAec6z6YAWLnAzkNih3rv9dMUCxAYfQdq94DxLJbHeJz', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
  capture_pageleave: true,
})

// ── Sentry ───────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: 'https://9f097148f69641e8a0f5c61ad3450aa5@o4511486431133696.ingest.us.sentry.io/4511486703435776',
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
  integrations: [Sentry.browserTracingIntegration()],
})

// ── Crisp ────────────────────────────────────────────────────────────────────
window.$crisp = []
window.CRISP_WEBSITE_ID = '470f77af-d0cb-4f5c-a540-44cbf5d7465c'
;(function () {
  const s = document.createElement('script')
  s.src = 'https://client.crisp.chat/l.js'
  s.async = true
  document.head.appendChild(s)
})()

// ── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)

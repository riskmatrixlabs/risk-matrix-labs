const R = 'Rajdhani, sans-serif'
const I = 'Inter, sans-serif'
const NEON = '#BDFF00'
const BG   = '#0A0A0A'

export default function PressKit({ onBack }) {
  const SCREENSHOTS = [
    { file: '/brand/screenshots/desktop-analytics.png', label: 'Analytics Tab' },
    { file: '/brand/screenshots/desktop-overview.png',  label: 'Overview Tab' },
    { file: '/brand/screenshots/desktop-ladder.png',    label: 'Ladder Tab' },
    { file: '/brand/screenshots/desktop-bet-log.png',   label: 'Bet Log' },
    { file: '/brand/screenshots/desktop-rr-engine.png', label: 'RR Engine' },
    { file: '/brand/screenshots/mobile-analytics.png',  label: 'Mobile View' },
  ]

  const STATS = [
    { label: 'Founded',   value: '2026' },
    { label: 'Market',    value: '$150B US sports betting' },
    { label: 'Pricing',   value: '$29/mo or $149/yr' },
    { label: 'Free Trial', value: '3-day, no credit card required' },
    { label: 'Platform',  value: 'Web app (iOS + Android via browser)' },
    { label: 'Category',  value: 'Bankroll simulation & analytics' },
  ]

  const COLORS = [
    { name: 'Neon Green',   hex: '#BDFF00', bg: '#BDFF00', fg: '#0A0A0A' },
    { name: 'Background',   hex: '#0A0A0A', bg: '#0A0A0A', fg: '#BDFF00', border: '1px solid #2a2a2a' },
    { name: 'Danger Red',   hex: '#FF3B3B', bg: '#FF3B3B', fg: '#fff' },
  ]

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: R }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#555', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>← Back</button>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: '#555', textTransform: 'uppercase' }}>Press Kit — Risk Matrix Labs</div>
        <div style={{ width: '60px' }} />
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <img src="/brand/logos/logo-labs.png" alt="Risk Matrix Labs" style={{ height: '48px', marginBottom: '24px' }} />
          <h1 style={{ fontFamily: R, fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', margin: '0 0 12px', textTransform: 'uppercase' }}>
            Press Kit
          </h1>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            For media, podcasts, and editorial use. Last updated June 2026.
          </p>
          <div style={{ marginTop: '20px' }}>
            <a href="mailto:hello@riskmatrixlabs.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.25)', borderRadius: '4px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: NEON, textDecoration: 'none' }}>
              Media Inquiries → hello@riskmatrixlabs.com
            </a>
          </div>
        </div>

        {/* About */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>About Risk Matrix Labs</SectionHead>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, margin: '0 0 14px' }}>
            Risk Matrix Labs is the Bankroll Simulator for serious sports bettors. We give operators the tools to simulate bankroll growth, manage risk with precision, and execute a disciplined betting system — without emotion.
          </p>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, margin: 0 }}>
            Most bettors track wins and losses. Risk Matrix Labs operators track units, risk exposure, ROI, Kelly fractions, and ladder progressions — the same metrics professional bankroll managers use. We're building the infrastructure layer for the $150B US sports betting market.
          </p>
        </section>

        {/* Boilerplate */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>Boilerplate (copy-paste)</SectionHead>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderLeft: `3px solid ${NEON}`, borderRadius: '4px', padding: '16px 20px' }}>
            <p style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, margin: 0, fontStyle: 'italic' }}>
              "Risk Matrix Labs is a bankroll simulation platform for disciplined sports bettors. Operators use it to model unit sizing, track risk exposure, analyze performance, and run ladder progressions — all in one system. Try it free at riskmatrixlabs.com."
            </p>
          </div>
        </section>

        {/* Key Facts */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>Key Facts</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '14px 16px' }}>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Brand Assets */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>Logos</SectionHead>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { src: '/brand/logos/logo-labs.png',      label: 'Full Logo (Dark BG)',  bg: '#111' },
              { src: '/brand/logos/logo-dashboard.png', label: 'Dashboard Logo',        bg: '#111' },
            ].map(l => (
              <div key={l.label} style={{ flex: '1 1 220px' }}>
                <div style={{ background: l.bg, border: '1px solid #1e1e1e', borderRadius: '8px', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                  <img src={l.src} alt={l.label} style={{ maxHeight: '48px', maxWidth: '100%' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase' }}>{l.label}</span>
                  <a href={l.src} download style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: NEON, textDecoration: 'none', textTransform: 'uppercase' }}>Download</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Brand Colors */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>Brand Colors</SectionHead>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c.hex} style={{ flex: '1 1 160px' }}>
                <div style={{ height: '72px', background: c.bg, border: c.border || 'none', borderRadius: '6px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: c.fg }}>{c.hex}</span>
                </div>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: '#555', textTransform: 'uppercase' }}>{c.name}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', fontFamily: R, fontSize: '9px', letterSpacing: '0.1em', color: '#444', textTransform: 'uppercase' }}>
            Fonts: Rajdhani (headlines) · Inter (body)
          </div>
        </section>

        {/* Screenshots */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>Screenshots</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {SCREENSHOTS.map(s => (
              <div key={s.file}>
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', overflow: 'hidden', marginBottom: '6px' }}>
                  <img src={s.file} alt={s.label} style={{ width: '100%', display: 'block' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: '#555', textTransform: 'uppercase' }}>{s.label}</span>
                  <a href={s.file} download style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: NEON, textDecoration: 'none', textTransform: 'uppercase' }}>Download</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Messaging */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHead>Key Messages</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              'The Bankroll Simulator for the $150B sports betting market.',
              'Built for operators, not gamblers. Discipline over hunches.',
              'Unit sizing, risk exposure, ROI analytics, and ladder simulation — all in one system.',
              '"Operate With Discipline." — the standard for serious bankroll management.',
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '12px 16px' }}>
                <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 800, color: NEON, flexShrink: 0, marginTop: '1px' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{m}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section>
          <SectionHead>Contact</SectionHead>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '8px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Media inquiries', value: 'hello@riskmatrixlabs.com' },
              { label: 'Website',         value: 'riskmatrixlabs.com' },
              { label: 'App',             value: 'app.riskmatrixlabs.com' },
              { label: 'Affiliates',      value: 'risk-matrix-labs.getrewardful.com/signup' },
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: '#555', textTransform: 'uppercase', minWidth: '120px' }}>{c.label}</span>
                <span style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{c.value}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

function SectionHead({ children }) {
  return (
    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.26em', color: '#BDFF00', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #1a1a1a' }}>
      {children}
    </div>
  )
}

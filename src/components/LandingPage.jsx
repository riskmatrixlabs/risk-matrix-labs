import { useState, useEffect, useRef } from 'react'
import LandingPageV1 from './LandingPageV1'

// ─── Risk Matrix Labs — landing page. Dark "trading terminal" aesthetic: neon (#BDFF00)
// rationed as the signal, grain + masked-grid atmosphere, mono microtype for machine data,
// framed product panels, a live results ticker, and the self-grading record as the centerpiece.
// All CSS is scoped under #rml-landing so it can't collide with the app shell.

const TICKER = [
  ['KBO TOT O8.5', 'hit'], ['SPOTLIGHT U9.5', 'miss'], ['PHLT PRIME', 'hit'],
  ['NBA U221', 'miss'], ['MLB O8.5', 'hit'], ['KBO U9.1', 'hit'],
  ['NHL O6', 'miss'], ['SPOTLIGHT O7.5', 'hit'],
]

const BENTO = [
  { tag: 'FREE', label: 'GAME CENTER', title: 'See the edge', desc: 'Open any game at $0 — live odds, line movement since open, win probability, and the by-sportsbook chart.', ph: '[ GAME CENTER ]' },
  { tag: 'EV', label: 'MATRIX BOT', title: 'Grade the bet', desc: 'Player props grouped by player, best price across books, and the EV edge on every line — at a glance.', ph: '[ PROPS BY PLAYER ]' },
  { tag: 'GRADED', label: 'SPOTLIGHT + KBO', title: 'Trust the read', desc: 'Over/under models ranked by conviction — every lean snapshotted and graded in public, wins and misses.', ph: '[ SPOTLIGHT ]' },
  { tag: null, label: 'CH3 · BEAT THE CLOSE', title: 'Track CLV', desc: 'Log a play and we grade it on closing-line value — the truest measure of whether a bet was actually sharp.', ph: null },
]

const RECORD_ROWS = [
  { m: 'LAA @ ATH', d: 'SPOTLIGHT · UNDER 9.5', proj: '9.5', act: '11', chip: 'miss', t: '✗ MISS' },
  { m: 'Lotte @ Kiwoom', d: 'KBO · UNDER 9.1', proj: '9.1', act: '3', chip: 'hit', t: '✓ HIT' },
  { m: 'Kia @ KT', d: 'KBO · no pick', proj: '10.0', act: '14', chip: 'np', t: '— N/A' },
]

const STEPS = [
  ['01', 'See the edge', 'Open any game free — live odds, movement since open, win probability, by-sportsbook chart.'],
  ['02', 'Grade the bet', "Models and EV scoring show where value is — and where it isn't. Every read shown honestly."],
  ['03', 'Check the record', 'Every lean graded in public — wins and misses, today, yesterday, all-time.'],
  ['04', 'Operate with discipline', 'Size every bet, run the ladder, track CLV. Act on real edges — not on tilt.'],
]

const PRICE_FEATURES = [
  'Free live odds + Game Center', 'Spotlight O/U models', 'Player props by player',
  'EV + CLV tracking', 'Line movement + line shop', 'PHLT™ ladder + sizing',
  'Public model record', 'All future features',
]

function CookieBanner() {
  const [visible, setVisible] = useState(() => { try { return !localStorage.getItem('rml_cookie_ok') } catch { return true } })
  const accept = () => { try { localStorage.setItem('rml_cookie_ok', 'accept'); if (window.posthog?.opt_in_capturing) window.posthog.opt_in_capturing() } catch {} setVisible(false) }
  const dismiss = () => { try { localStorage.setItem('rml_cookie_ok', 'dismiss') } catch {} setVisible(false) }
  if (!visible) return null
  return (
    <div className="rl-cookie">
      <p>We use cookies to operate the site and analyze usage. By continuing you agree to our <a href="/privacy">Privacy Policy</a>.</p>
      <div className="rl-cookie-btns">
        <button onClick={accept} className="rl-cookie-accept">Accept</button>
        <button onClick={dismiss} className="rl-cookie-dismiss">Dismiss</button>
      </div>
    </div>
  )
}

export default function LandingPage({ onLogin }) {
  // ?old=1 → the original v1 landing (dope background, original layout) for side-by-side comparison.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('old') === '1') {
    return <LandingPageV1 onLogin={onLogin} />
  }
  const open = (e) => { if (onLogin) { e?.preventDefault?.(); onLogin() } }

  // Ticker fill + scroll-reveal + count-up — all CSS-light, runs once after mount.
  useEffect(() => {
    const root = document.getElementById('rml-landing')
    if (!root) return
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.14 })
    root.querySelectorAll('.rl-reveal').forEach(el => io.observe(el))
    const co = new IntersectionObserver((es) => es.forEach(e => {
      if (!e.isIntersecting) return
      const el = e.target, to = +el.dataset.to; let s = null
      const stp = (t) => { s = s || t; const p = Math.min((t - s) / 900, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(stp) }
      requestAnimationFrame(stp); co.unobserve(el)
    }), { threshold: 0.5 })
    root.querySelectorAll('[data-to]').forEach(el => co.observe(el))
    return () => { io.disconnect(); co.disconnect() }
  }, [])

  const ticker = [...TICKER, ...TICKER]

  return (
    <div id="rml-landing">
      <style>{CSS}</style>

      <nav className="rl-nav">
        <div className="rl-brand"><img className="rl-mark" src="/brand/logos/logo-mark.png" alt="Risk Matrix Labs" /><div className="rl-nm">RISK MATRIX LABS</div></div>
        <a href="/pricing" onClick={open} className="rl-btn">Open Terminal</a>
      </nav>

      <header className="rl-hero">
        <div className="rl-grid" />
        <div className="rl-hero-in">
          <span className="rl-label rl-kick">RISK MATRIX LABS // EST. 2026</span>
          <h1 className="rl-h1">Operate with<br /><span className="rl-g">discipline.</span></h1>
          <p className="rl-hsub"><b>We don't sell picks. We show the numbers.</b> Free live odds, models that show their record — wins and misses — and the discipline to act. The decisions are yours.</p>
          <div className="rl-cta-row">
            <a href="/pricing" className="rl-btn rl-btn-lg">Start free →</a>
            <a href="#rl-record" className="rl-btn rl-btn-lg rl-btn-ghost">See the record</a>
          </div>
          <div className="rl-fine">$0 to start · 3 days free · $29/mo after · cancel anytime</div>

          <div className="rl-frame">
            <div className="rl-frame-bar"><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-fdot" />
              <span className="rl-path">rml://game-center/live</span>
              <span className="rl-live"><span className="rl-ld" />LIVE</span>
            </div>
            <img className="rl-screenshot" src="/brand/screenshots/sc-game-detail.jpg" alt="Risk Matrix Labs game insights — odds, model and weather" loading="lazy" />
          </div>
        </div>
      </header>

      <div className="rl-ticker-wrap"><div className="rl-ticker">
        {ticker.map(([t, r], i) => <span className="rl-tk" key={i}><span className="rl-dot" />{t} <span className={r === 'hit' ? 'rl-hit' : 'rl-miss'}>{r === 'hit' ? '✓ HIT' : '✗ MISS'}</span></span>)}
      </div></div>

      <div className="rl-trust">FREE LIVE ODDS · EV ENGINE · LINE MOVEMENT · KBO · <b>NO PICKS, NO HYPE</b></div>

      <section className="rl-sect">
        <div className="rl-stats rl-reveal">
          <div className="rl-stat"><div className="rl-n rl-acc rl-mono">289K+</div><div className="rl-l">odds tracked</div></div>
          <div className="rl-stat"><div className="rl-n rl-mono">27–21</div><div className="rl-l">Spotlight O/U</div></div>
          <div className="rl-stat"><div className="rl-n rl-mono">39K+</div><div className="rl-l">prop lines</div></div>
        </div>
      </section>

      {/* ── FEATURE 1 — GAME CENTER (hero) ── */}
      <section className="rl-sect">
        <span className="rl-label rl-kick">THE TABS // 01 · GAME CENTER</span>
        <h2 className="rl-h2">See the edge.<br /><span className="rl-g">Free.</span></h2>
        <p className="rl-sub">Open any game at $0 — live odds, win probability, and line movement since open across every sportsbook. The whole board, before you risk a dollar.</p>
        <div className="rl-frame rl-reveal" style={{ marginTop: 22 }}>
          <div className="rl-frame-bar"><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-path">rml://game-center</span><span className="rl-live"><span className="rl-ld" />LIVE</span></div>
          <img className="rl-screenshot" src="/brand/screenshots/sc-game-center.jpg" alt="Risk Matrix Labs Game Center — live games and odds" loading="lazy" />
        </div>
      </section>

      {/* ── FEATURE 2 — MATRIX BOT / EV (hero) ── */}
      <section className="rl-sect">
        <span className="rl-label rl-kick">THE TABS // 02 · MATRIX BOT</span>
        <h2 className="rl-h2">Every prop.<br /><span className="rl-g">Graded for value.</span></h2>
        <p className="rl-sub">Player props grouped by player, the best price across every book, and a true EV edge on every line. The bot runs the math — you see the value at a glance.</p>
        <div className="rl-frame rl-reveal" style={{ marginTop: 22 }}>
          <div className="rl-frame-bar"><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-path">rml://matrix-bot</span><span className="rl-live"><span className="rl-ld" />EV</span></div>
          <img className="rl-screenshot" src="/brand/screenshots/sc-matrix-bot.jpg" alt="Risk Matrix Labs Matrix Bot — scan and EV" loading="lazy" />
        </div>
      </section>

      {/* ── FEATURE 3 — DASHBOARD (supporting, real screenshot) ── */}
      <section className="rl-sect">
        <span className="rl-label rl-kick">THE TABS // 03 · DASHBOARD</span>
        <h2 className="rl-h2">Run it like<br /><span className="rl-g">an operator.</span></h2>
        <p className="rl-sub">Bankroll and unit sizing, the PHLT™ ladder, round-robin engine, and a discipline score on every session. Turn an edge into a system that compounds.</p>
        <div className="rl-frame rl-reveal" style={{ marginTop: 22 }}>
          <div className="rl-frame-bar"><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-fdot" /><span className="rl-path">rml://dashboard</span></div>
          <img className="rl-screenshot" src="/brand/screenshots/sc-dashboard.jpg" alt="Risk Matrix Labs dashboard" loading="lazy" />
        </div>
      </section>

      <section className="rl-sect" id="rl-record">
        <span className="rl-label rl-kick">SECTION 04 // THE RECORD</span>
        <h2 className="rl-h2">We show our work.<br /><span className="rl-g">Wins and misses.</span></h2>
        <p className="rl-sub">Every model lean is snapshotted before the game and graded against the real result. No hidden losses. No cherry-picked screenshots. Most apps won't show you this.</p>
        <div className="rl-board rl-reveal">
          <div className="rl-board-h"><span className="rl-bt">Spotlight · model record</span><span className="rl-live"><span className="rl-ld" />LIVE</span></div>
          <div className="rl-bstats">
            <div className="rl-bstat"><div className="rl-bn rl-mono">27–21</div><div className="rl-bl">all-time</div></div>
            <div className="rl-bstat"><div className="rl-bn rl-mono">5–3</div><div className="rl-bl">yesterday</div></div>
            <div className="rl-bstat"><div className="rl-bn rl-mono">56%</div><div className="rl-bl">hit rate</div></div>
          </div>
          {RECORD_ROWS.map((r, i) => (
            <div className="rl-row" key={i}>
              <div><div className="rl-mtch">{r.m}</div><div className="rl-md">{r.d}</div></div>
              <div className="rl-num">{r.proj}</div><div className="rl-num">{r.act}</div>
              <span className={`rl-chip rl-${r.chip}`}>{r.t}</span>
            </div>
          ))}
          <div className="rl-board-f">Snapshot of the live record — still calibrating, shown good and bad. <a href="/pricing" onClick={open}>See it live in the app →</a></div>
        </div>
      </section>

      <section id="vs-touts" className="vs-section" aria-labelledby="vs-heading">
        <div className="vs-kicker">SECTION 05 // VS THE TOUTS</div>
        <h2 id="vs-heading" className="vs-headline">Built the opposite way<br /><span className="vs-headline-accent">from a tout.</span></h2>
        <p className="vs-sub">Picks services sell certainty they can't back. We hand operators the receipts and the system — and never the lie.</p>
        <div className="vs-table" role="table" aria-label="Risk Matrix Labs versus a typical picks service">
          <div className="vs-colhead" role="row">
            <div className="vs-colhead-spacer" role="columnheader" />
            <div className="vs-colhead-rml" role="columnheader"><span className="vs-brand-mark">RML</span><span className="vs-colhead-tag">Operator</span></div>
            <div className="vs-colhead-tout" role="columnheader"><span className="vs-tout-mark">Typical</span><span className="vs-colhead-tag">Picks service</span></div>
          </div>
          <div className="vs-row" role="row">
            <div className="vs-criterion" role="cell">Sells picks &amp; "locks"</div>
            <div className="vs-cell vs-cell-rml" role="cell"><span className="vs-mark vs-no" aria-hidden="true" /><span className="vs-val">Never. We don't sell picks.</span></div>
            <div className="vs-cell vs-cell-tout" role="cell"><span className="vs-mark vs-bad" aria-hidden="true" /><span className="vs-val">It's the whole business.</span></div>
          </div>
          <div className="vs-row" role="row">
            <div className="vs-criterion" role="cell">Real graded record — wins <em>and</em> losses</div>
            <div className="vs-cell vs-cell-rml" role="cell"><span className="vs-mark vs-yes" aria-hidden="true" /><span className="vs-val">Public. All of it.</span></div>
            <div className="vs-cell vs-cell-tout" role="cell"><span className="vs-mark vs-bad" aria-hidden="true" /><span className="vs-val">Losses quietly deleted.</span></div>
          </div>
          <div className="vs-row" role="row">
            <div className="vs-criterion" role="cell">Free live odds</div>
            <div className="vs-cell vs-cell-rml" role="cell"><span className="vs-mark vs-yes" aria-hidden="true" /><span className="vs-val">$0 to open a game.</span></div>
            <div className="vs-cell vs-cell-tout" role="cell"><span className="vs-mark vs-warn" aria-hidden="true" /><span className="vs-val">Rarely — behind a paywall.</span></div>
          </div>
          <div className="vs-row" role="row">
            <div className="vs-criterion" role="cell">Model methodology shown</div>
            <div className="vs-cell vs-cell-rml" role="cell"><span className="vs-mark vs-yes" aria-hidden="true" /><span className="vs-val">Transparent. Read the math.</span></div>
            <div className="vs-cell vs-cell-tout" role="cell"><span className="vs-mark vs-bad" aria-hidden="true" /><span className="vs-val">Black box. "Trust us."</span></div>
          </div>
          <div className="vs-row" role="row">
            <div className="vs-criterion" role="cell">Discipline &amp; bankroll system</div>
            <div className="vs-cell vs-cell-rml" role="cell"><span className="vs-mark vs-yes" aria-hidden="true" /><span className="vs-val">Built in.</span></div>
            <div className="vs-cell vs-cell-tout" role="cell"><span className="vs-mark vs-bad" aria-hidden="true" /><span className="vs-val">None. Just chase.</span></div>
          </div>
          <div className="vs-row" role="row">
            <div className="vs-criterion" role="cell">Guarantees wins</div>
            <div className="vs-cell vs-cell-rml" role="cell"><span className="vs-mark vs-no" aria-hidden="true" /><span className="vs-val">Never. Nobody honest can.</span></div>
            <div className="vs-cell vs-cell-tout" role="cell"><span className="vs-mark vs-bad" aria-hidden="true" /><span className="vs-val">Implies it, every time.</span></div>
          </div>
        </div>
        <p className="vs-foot"><span className="vs-foot-key">THE WEDGE //</span> Everything they hide, we publish. That's the product.</p>
      </section>

      <section className="rl-sect">
        <span className="rl-label rl-kick">SECTION 06 // HOW IT WORKS</span>
        <h2 className="rl-h2">Scan. Grade.<br /><span className="rl-g">Decide.</span></h2>
        <div style={{ marginTop: 18 }}>
          {STEPS.map(([n, t, d]) => (
            <div className="rl-step rl-reveal" key={n}><div className="rl-sn rl-mono">{n}</div><div><div className="rl-st">{t}</div><p>{d}</p></div></div>
          ))}
        </div>
      </section>

      <section className="rl-mani"><h2 className="rl-h2">We build for <span className="rl-g">operators.</span><br />Not gamblers.</h2></section>

      <section className="rl-sect">
        <span className="rl-label rl-kick">SECTION 07 // PRICING</span>
        <h2 className="rl-h2">One price.<br /><span className="rl-g">Everything in.</span></h2>
        <div className="rl-price rl-reveal">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="rl-amt">$29</span><span className="rl-per">/month</span></div>
          <div className="rl-yr">or $149/yr · $12.42/mo · 3-day free trial</div>
          <div className="rl-plist">
            {PRICE_FEATURES.map(f => <div className="rl-pi" key={f}><i>✓</i>{f}</div>)}
          </div>
          <a href="/pricing" className="rl-btn rl-btn-lg" style={{ display: 'block', textAlign: 'center' }}>Start my free trial →</a>
        </div>
      </section>

      <section className="rl-sect" id="rl-faq">
        <span className="rl-label rl-kick">SECTION 08 // FAQ</span>
        <h2 className="rl-h2">Common<br /><span className="rl-g">questions.</span></h2>
        <div className="rl-faq">
          {[
            ['Do you sell picks?', "No. We never sell picks and we never will. Our models surface where there may be value, and we grade every lean in public — wins and misses. We give you the numbers and the discipline; the decisions are yours."],
            ['Do you guarantee wins?', "No — and anyone who does is lying. Our models are continuously back-tested and still calibrating, and we show the real record, good and bad. We sell honesty and discipline, not a crystal ball."],
            ['Is it free?', "Opening any game is $0 — live odds and the board, no card. Full access (props, EV, models, bankroll system) is $29/mo or $149/yr with a 3-day free trial."],
            ['How does the free trial work?', "3 days free — no charge until day 4. You see the exact billing date and amount before you enter a card. Cancel anytime, no questions."],
            ['Does it work on mobile?', "Yes — built mobile-first. Open the board, grade props, run the ladder from your phone; everything syncs across your devices."],
          ].map(([q, a], i) => (
            <details className="rl-faq-item" key={i}>
              <summary className="rl-faq-q"><span>{q}</span><span className="rl-faq-x">+</span></summary>
              <div className="rl-faq-a">{a}</div>
            </details>
          ))}
        </div>
      </section>

      <footer className="rl-foot">
        <div className="rl-foot-top">
          <div className="rl-foot-brand">
            <div className="rl-brand"><img className="rl-mark" src="/brand/logos/logo-mark.png" alt="Risk Matrix Labs" /><div className="rl-nm">RISK MATRIX LABS</div></div>
            <div className="rl-foot-tag">Operate with discipline.</div>
            <div className="rl-socials">
              <a href="https://instagram.com/riskmatrixlabs" aria-label="Instagram">IG</a>
              <a href="https://tiktok.com/@riskmatrixlabs" aria-label="TikTok">TT</a>
              <a href="https://x.com/riskmatrixlabs" aria-label="X">X</a>
              <a href="https://youtube.com/@riskmatrixlabs" aria-label="YouTube">YT</a>
              <a href="https://discord.gg/smHv7CHc4p" aria-label="Discord">DC</a>
            </div>
          </div>
          <div className="rl-foot-cols">
            <div className="rl-fcol"><div className="rl-fch">Product</div><a href="/pricing" onClick={open}>Game Center</a><a href="/pricing" onClick={open}>Matrix Bot</a><a href="/pricing" onClick={open}>Spotlight</a><a href="/pricing">Pricing</a></div>
            <div className="rl-fcol"><div className="rl-fch">Company</div><a href="#rl-record">Record</a><a href="/affiliates">Affiliates</a><a href="mailto:support@riskmatrixlabs.com">Contact</a></div>
            <div className="rl-fcol"><div className="rl-fch">Legal</div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/privacy">Responsible Play</a></div>
          </div>
        </div>
        <div className="rl-fnote">We don't sell picks or guarantee winners. Models are continuously back-tested and still calibrating — past results don't predict future ones. Information and tools, not betting advice.<br /><br />21+ · If you or someone you know has a gambling problem, call 1-800-GAMBLER.<br /><span style={{ color: 'var(--rl-ink-2)' }}>© 2026 Risk Matrix Labs. All rights reserved.</span></div>
      </footer>

      <CookieBanner />
    </div>
  )
}

const CSS = `
#rml-landing{
  --rl-bg-0:#0A0A0A;--rl-bg-1:#101110;--rl-bg-2:#161817;
  --rl-line:#1E211F;--rl-line-2:#2A2E2B;
  --rl-ink-0:#F2F4F0;--rl-ink-1:#9DA39A;--rl-ink-2:#878D85;
  --rl-signal:#BDFF00;--rl-signal-dim:#8FBF00;--rl-signal-2:rgba(189,255,0,.12);--rl-signal-glow:rgba(189,255,0,.45);
  --rl-pos:#5BE38B;--rl-neg:#FF5C5C;
  --rl-d:'Rajdhani',sans-serif;--rl-b:'Inter',sans-serif;--rl-m:'JetBrains Mono','IBM Plex Mono',monospace;
  background:var(--rl-bg-0);color:var(--rl-ink-0);font-family:var(--rl-b);-webkit-font-smoothing:antialiased;
  overflow-x:hidden;position:relative;box-shadow:inset 0 0 240px rgba(0,0,0,.9);min-height:100vh;
}
#rml-landing::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:60;opacity:.04;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
#rml-landing *{margin:0;padding:0;box-sizing:border-box}
#rml-landing .rl-mono{font-family:var(--rl-m);font-variant-numeric:tabular-nums}
#rml-landing .rl-label{font:500 11px/1 var(--rl-m);letter-spacing:.14em;text-transform:uppercase;color:var(--rl-ink-1)}
#rml-landing .rl-kick{color:var(--rl-signal);opacity:.85;margin-bottom:14px;display:block}
#rml-landing .rl-g{color:var(--rl-signal)}
#rml-landing .rl-sect{max-width:480px;margin:0 auto;padding:64px 22px;position:relative;border-top:1px solid var(--rl-line)}
#rml-landing .rl-h2{font-family:var(--rl-d);font-weight:700;font-size:clamp(26px,8vw,40px);line-height:1.0;letter-spacing:-.01em;margin-bottom:14px}
#rml-landing .rl-sub{font-size:14px;color:var(--rl-ink-1);line-height:1.65;max-width:380px;margin-bottom:24px}
#rml-landing .rl-nav{position:sticky;top:0;z-index:80;display:flex;align-items:center;justify-content:space-between;padding:14px 22px;backdrop-filter:blur(14px);background:rgba(10,10,10,.72);border-bottom:1px solid var(--rl-line);max-width:480px;margin:0 auto}
#rml-landing .rl-brand{display:flex;align-items:center;gap:10px}
#rml-landing .rl-mark{height:30px;width:auto;display:block;object-fit:contain}
#rml-landing .rl-screenshot{width:100%;display:block;max-height:600px;object-fit:cover;object-position:top center;-webkit-mask-image:linear-gradient(#000 88%,transparent);mask-image:linear-gradient(#000 88%,transparent)}
#rml-landing .rl-faq{display:flex;flex-direction:column;border-top:1px solid var(--rl-line);margin-top:8px}
#rml-landing .rl-faq-item{border-bottom:1px solid var(--rl-line)}
#rml-landing .rl-faq-q{display:flex;align-items:center;justify-content:space-between;gap:14px;cursor:pointer;list-style:none;padding:18px 2px;font-family:var(--rl-d);font-weight:700;font-size:16px;color:var(--rl-ink-0)}
#rml-landing .rl-faq-q::-webkit-details-marker{display:none}
#rml-landing .rl-faq-x{font-family:var(--rl-m);font-size:20px;color:var(--rl-signal);transition:transform .2s;flex:none}
#rml-landing .rl-faq-item[open] .rl-faq-x{transform:rotate(45deg)}
#rml-landing .rl-faq-item[open] .rl-faq-q{color:var(--rl-signal)}
#rml-landing .rl-faq-a{font-family:var(--rl-b);font-size:13.5px;line-height:1.65;color:var(--rl-ink-1);padding:0 2px 18px}
#rml-landing .rl-nm{font-family:var(--rl-d);font-weight:700;letter-spacing:.04em;font-size:15px}
#rml-landing .rl-btn{font-family:var(--rl-m);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--rl-bg-0);background:var(--rl-signal);border:none;border-radius:6px;padding:9px 14px;cursor:pointer;text-decoration:none;box-shadow:0 0 24px -6px var(--rl-signal-glow);transition:transform .15s,opacity .15s;display:inline-block}
#rml-landing .rl-btn:hover{opacity:.9;transform:translateY(-1px)}
#rml-landing .rl-btn-lg{padding:13px 22px;font-size:12px}
#rml-landing .rl-btn-ghost{color:var(--rl-signal);background:transparent;border:1px solid var(--rl-line-2);box-shadow:none}
#rml-landing .rl-hero{position:relative;max-width:480px;margin:0 auto;padding:48px 22px 56px;overflow:hidden;background:radial-gradient(60% 50% at 50% 0%,rgba(189,255,0,.06),transparent 70%),radial-gradient(90% 60% at 50% 120%,#0d0e0d,var(--rl-bg-0))}
#rml-landing .rl-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(var(--rl-line) 1px,transparent 1px),linear-gradient(90deg,var(--rl-line) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse 80% 55% at 50% 25%,#000 35%,transparent 100%);mask-image:radial-gradient(ellipse 80% 55% at 50% 25%,#000 35%,transparent 100%)}
#rml-landing .rl-hero-in{position:relative;z-index:1}
#rml-landing .rl-h1{font-family:var(--rl-d);font-weight:700;font-size:clamp(38px,12vw,56px);line-height:.96;letter-spacing:-.015em;margin:18px 0 16px}
#rml-landing .rl-h1 .rl-g{text-shadow:0 0 22px rgba(189,255,0,.28)}
#rml-landing .rl-hsub{font-size:15px;color:var(--rl-ink-1);line-height:1.6;max-width:380px;margin-bottom:26px}
#rml-landing .rl-hsub b{color:var(--rl-ink-0);font-weight:500}
#rml-landing .rl-cta-row{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
#rml-landing .rl-fine{font-family:var(--rl-m);font-size:10.5px;color:var(--rl-ink-2);letter-spacing:.02em}
#rml-landing .rl-frame{background:var(--rl-bg-1);border:1px solid var(--rl-line-2);border-radius:14px;overflow:hidden;margin-top:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 40px 80px -34px rgba(0,0,0,.9),0 0 0 1px rgba(189,255,0,.06)}
#rml-landing .rl-frame-bar{height:34px;display:flex;align-items:center;gap:6px;padding:0 13px;background:var(--rl-bg-2);border-bottom:1px solid var(--rl-line)}
#rml-landing .rl-fdot{width:9px;height:9px;border-radius:50%;background:var(--rl-line-2)}
#rml-landing .rl-path{font:500 10px var(--rl-m);color:var(--rl-ink-2);margin-left:8px;letter-spacing:.04em}
#rml-landing .rl-live{margin-left:auto;font:700 9px var(--rl-m);letter-spacing:.14em;color:var(--rl-pos);display:flex;align-items:center;gap:5px}
#rml-landing .rl-ld{width:6px;height:6px;border-radius:50%;background:var(--rl-pos);box-shadow:0 0 8px var(--rl-pos);animation:rl-pulse 1.6s infinite}
@keyframes rl-pulse{50%{opacity:.35}}
#rml-landing .rl-shot{padding:16px}
#rml-landing .rl-ph{border:1px dashed var(--rl-line-2);border-radius:8px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 10px,transparent 10px 20px);display:grid;place-items:center;color:var(--rl-ink-2);font:500 11px var(--rl-m);letter-spacing:.08em;text-transform:uppercase;text-align:center;padding:8px;line-height:1.6}
#rml-landing .rl-ticker-wrap{max-width:480px;margin:0 auto;border-top:1px solid var(--rl-line);border-bottom:1px solid var(--rl-line);overflow:hidden;padding:11px 0;background:rgba(189,255,0,.02)}
#rml-landing .rl-ticker{display:flex;gap:30px;white-space:nowrap;width:max-content;animation:rl-scroll 32s linear infinite}
#rml-landing .rl-ticker:hover{animation-play-state:paused}
@keyframes rl-scroll{to{transform:translateX(-50%)}}
#rml-landing .rl-tk{font:500 12px var(--rl-m);letter-spacing:.04em;color:var(--rl-ink-1);display:inline-flex;gap:7px;align-items:center}
#rml-landing .rl-tk .rl-hit{color:var(--rl-pos)}#rml-landing .rl-tk .rl-miss{color:var(--rl-neg)}
#rml-landing .rl-tk .rl-dot{width:4px;height:4px;border-radius:50%;background:var(--rl-signal);opacity:.5}
#rml-landing .rl-trust{max-width:480px;margin:0 auto;padding:16px 22px;border-bottom:1px solid var(--rl-line);font:500 10.5px var(--rl-m);letter-spacing:.1em;color:var(--rl-ink-2);text-transform:uppercase;text-align:center;line-height:1.9}
#rml-landing .rl-trust b{color:var(--rl-signal-dim);font-weight:500}
#rml-landing .rl-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#rml-landing .rl-stat{background:var(--rl-bg-1);border:1px solid var(--rl-line);border-radius:10px;padding:16px 10px;text-align:center}
#rml-landing .rl-n{font:700 24px var(--rl-m);font-variant-numeric:tabular-nums;color:var(--rl-ink-0);line-height:1}
#rml-landing .rl-n.rl-acc{color:var(--rl-signal)}
#rml-landing .rl-l{font:500 9px var(--rl-m);letter-spacing:.08em;text-transform:uppercase;color:var(--rl-ink-2);margin-top:7px}
#rml-landing .rl-bento{display:flex;flex-direction:column;gap:12px}
#rml-landing .rl-cell{background:var(--rl-bg-1);border:1px solid var(--rl-line);border-radius:14px;padding:20px;position:relative;overflow:hidden}
#rml-landing .rl-ci{font-family:var(--rl-d);font-weight:700;font-size:20px;margin:10px 0 6px}
#rml-landing .rl-cell p{font-size:13px;color:var(--rl-ink-1);line-height:1.6}
#rml-landing .rl-tag{position:absolute;top:16px;right:16px;font:700 9px var(--rl-m);letter-spacing:.12em;color:var(--rl-signal-dim);border:1px solid var(--rl-signal-2);background:var(--rl-signal-2);border-radius:5px;padding:3px 7px}
#rml-landing .rl-board{background:var(--rl-bg-1);border:1px solid var(--rl-line-2);border-radius:14px;overflow:hidden;box-shadow:0 40px 80px -40px rgba(0,0,0,.9)}
#rml-landing .rl-board-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--rl-line)}
#rml-landing .rl-bt{font:700 11px var(--rl-m);letter-spacing:.12em;color:var(--rl-ink-1);text-transform:uppercase}
#rml-landing .rl-bstats{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--rl-line)}
#rml-landing .rl-bstat{padding:18px 8px;text-align:center;border-right:1px solid var(--rl-line)}
#rml-landing .rl-bstat:last-child{border-right:none}
#rml-landing .rl-bn{font:700 28px var(--rl-m);font-variant-numeric:tabular-nums;color:var(--rl-signal);line-height:1}
#rml-landing .rl-bl{font:500 9px var(--rl-m);letter-spacing:.08em;text-transform:uppercase;color:var(--rl-ink-2);margin-top:8px}
#rml-landing .rl-row{display:grid;grid-template-columns:1.4fr .7fr .7fr .9fr;gap:8px;padding:12px 16px;border-bottom:1px solid var(--rl-line);align-items:center;font-family:var(--rl-m);font-size:12px}
#rml-landing .rl-row:last-of-type{border-bottom:none}
#rml-landing .rl-mtch{color:var(--rl-ink-0);font-weight:500}
#rml-landing .rl-md{color:var(--rl-ink-2);font-size:9.5px;margin-top:2px}
#rml-landing .rl-num{color:var(--rl-ink-1);text-align:center;font-variant-numeric:tabular-nums}
#rml-landing .rl-chip{justify-self:end;font:700 10px var(--rl-m);letter-spacing:.06em;padding:4px 8px;border-radius:5px}
#rml-landing .rl-chip.rl-hit{color:var(--rl-pos);background:rgba(91,227,139,.1)}
#rml-landing .rl-chip.rl-miss{color:var(--rl-neg);background:rgba(255,92,92,.1)}
#rml-landing .rl-chip.rl-np{color:var(--rl-ink-2);background:rgba(255,255,255,.04)}
#rml-landing .rl-board-f{padding:13px 16px;font:400 11px var(--rl-b);color:var(--rl-ink-2);line-height:1.6;text-align:center}
#rml-landing .rl-board-f a{color:var(--rl-signal);text-decoration:none}
#rml-landing .rl-step{display:flex;gap:16px;padding:18px 0;border-bottom:1px solid var(--rl-line)}
#rml-landing .rl-step:last-child{border-bottom:none}
#rml-landing .rl-sn{font-family:var(--rl-d);font-weight:700;font-size:34px;color:var(--rl-line-2);line-height:1;min-width:42px}
#rml-landing .rl-st{font-family:var(--rl-d);font-weight:700;font-size:18px;margin-bottom:4px}
#rml-landing .rl-step p{font-size:13px;color:var(--rl-ink-1);line-height:1.6}
#rml-landing .rl-mani{max-width:480px;margin:0 auto;text-align:center;padding:72px 22px;border-top:1px solid var(--rl-line)}
#rml-landing .rl-mani .rl-h2{font-size:clamp(30px,9vw,44px);line-height:1.05}
#rml-landing .rl-price{background:var(--rl-bg-1);border:1px solid var(--rl-signal-2);border-radius:16px;padding:28px 22px;margin-top:8px}
#rml-landing .rl-amt{font-family:var(--rl-d);font-weight:700;font-size:52px;color:var(--rl-signal);line-height:1;text-shadow:0 0 30px rgba(189,255,0,.22)}
#rml-landing .rl-per{font-size:15px;color:var(--rl-ink-1)}
#rml-landing .rl-yr{font:500 12px var(--rl-m);color:var(--rl-ink-2);margin-top:6px}
#rml-landing .rl-plist{display:grid;grid-template-columns:1fr 1fr;gap:9px 16px;margin:22px 0}
#rml-landing .rl-pi{display:flex;gap:8px;font-size:12px;color:var(--rl-ink-1);line-height:1.4}
#rml-landing .rl-pi i{color:var(--rl-signal);font-weight:700;font-style:normal}
#rml-landing .rl-foot{max-width:480px;margin:0 auto;padding:44px 22px 56px;border-top:1px solid var(--rl-line)}
#rml-landing .rl-foot-top{display:flex;flex-direction:column;gap:30px}
#rml-landing .rl-foot-tag{font:500 12px var(--rl-m);letter-spacing:.06em;color:var(--rl-ink-2);margin-top:12px}
#rml-landing .rl-socials{display:flex;gap:8px;margin-top:16px}
#rml-landing .rl-socials a{width:34px;height:34px;border:1px solid var(--rl-line-2);border-radius:7px;display:grid;place-items:center;font:700 10px var(--rl-m);letter-spacing:.04em;color:var(--rl-ink-1);text-decoration:none}
#rml-landing .rl-socials a:hover{border-color:var(--rl-signal);color:var(--rl-signal);background:var(--rl-signal-2)}
#rml-landing .rl-foot-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
#rml-landing .rl-fcol{display:flex;flex-direction:column;gap:9px}
#rml-landing .rl-fch{font:500 10px var(--rl-m);letter-spacing:.14em;text-transform:uppercase;color:var(--rl-signal-dim);margin-bottom:3px}
#rml-landing .rl-fcol a{font-size:12.5px;color:var(--rl-ink-1);text-decoration:none}
#rml-landing .rl-fcol a:hover{color:var(--rl-ink-0)}
#rml-landing .rl-fnote{font:400 11px var(--rl-m);color:var(--rl-ink-2);line-height:1.8;letter-spacing:.02em;margin-top:30px;padding-top:22px;border-top:1px solid var(--rl-line)}
#rml-landing .rl-reveal{opacity:0;transform:translateY(16px)}
#rml-landing .rl-reveal.in{opacity:1;transform:none;transition:opacity .5s,transform .5s cubic-bezier(.2,.7,.2,1)}
#rml-landing .rl-cookie{position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(10,10,10,.97);border-top:1px solid var(--rl-signal-2);padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
#rml-landing .rl-cookie p{font:400 12px var(--rl-b);color:var(--rl-ink-1);margin:0;flex:1;min-width:220px}
#rml-landing .rl-cookie a{color:var(--rl-signal);text-decoration:none}
#rml-landing .rl-cookie-btns{display:flex;gap:10px}
#rml-landing .rl-cookie-accept{font:700 11px var(--rl-m);letter-spacing:.1em;text-transform:uppercase;padding:8px 18px;border-radius:5px;cursor:pointer;background:var(--rl-signal);border:none;color:var(--rl-bg-0)}
#rml-landing .rl-cookie-dismiss{font:700 11px var(--rl-m);letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;border-radius:5px;cursor:pointer;background:none;border:1px solid var(--rl-line-2);color:var(--rl-ink-1)}
@media(prefers-reduced-motion:reduce){#rml-landing .rl-reveal{opacity:1;transform:none}#rml-landing .rl-reveal.in{transition:none}#rml-landing .rl-ticker,#rml-landing .rl-ld{animation:none}#rml-landing .rl-btn,#rml-landing .rl-btn:hover{transition:none;transform:none}}

/* a11y + tap targets */
#rml-landing a:focus-visible,#rml-landing button:focus-visible{outline:2px solid var(--rl-signal);outline-offset:2px;border-radius:4px}
#rml-landing .rl-btn:focus-visible{outline-offset:3px}
#rml-landing .rl-btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center}
#rml-landing .rl-btn-ghost{border-color:rgba(189,255,0,.25)}
#rml-landing .rl-socials a{width:44px;height:44px}
#rml-landing .rl-cookie-accept,#rml-landing .rl-cookie-dismiss{min-height:44px}
#rml-landing .rl-fcol a,#rml-landing .rl-board-f a{display:inline-block;padding:5px 0}
#rml-landing .rl-row>*{min-width:0}
#rml-landing .rl-mtch{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* desktop framing — keep the terminal column, mount it on a wall instead of floating in a void */
@media(min-width:1024px){
  #rml-landing{background:radial-gradient(120% 60% at 50% -10%,rgba(189,255,0,.05),transparent 60%),repeating-linear-gradient(90deg,var(--rl-bg-0) 0 38px,#0c0d0c 38px 40px),var(--rl-bg-0);background-attachment:fixed}
  #rml-landing .rl-hero,#rml-landing .rl-ticker-wrap,#rml-landing .rl-trust,#rml-landing .rl-sect,#rml-landing .rl-mani,#rml-landing .rl-foot,#rml-landing .vs-section{max-width:560px;border-left:1px solid var(--rl-line);border-right:1px solid var(--rl-line);background-color:rgba(10,10,10,.82)}
  #rml-landing .rl-nav{max-width:560px;border-left:1px solid var(--rl-line);border-right:1px solid var(--rl-line);border-top:1px solid var(--rl-line);box-shadow:0 0 0 1px rgba(189,255,0,.05),0 40px 120px -40px rgba(0,0,0,.9)}
  #rml-landing .rl-foot{box-shadow:0 60px 120px -50px rgba(0,0,0,.9)}
}

/* ── Game Center card (hero product render) ── */
#rml-landing .gc-card{width:100%;box-sizing:border-box;font-family:var(--rl-b);background:#101110;border:1px solid #2A2E2B;border-radius:14px;padding:12px 14px;color:#F2F4F0}
#rml-landing .gc-card *{box-sizing:border-box}
#rml-landing .gc-row{display:flex;align-items:center}
#rml-landing .gc-matchup{justify-content:space-between;gap:8px}
#rml-landing .gc-team{display:flex;align-items:center;gap:9px;min-width:0}
#rml-landing .gc-team-home{justify-content:flex-end}
#rml-landing .gc-logo{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#161817;border:1px solid #2A2E2B}
#rml-landing .gc-logo img{width:22px;height:22px;object-fit:contain;display:block}
#rml-landing .gc-team-meta{display:flex;flex-direction:column;line-height:1.05;min-width:0}
#rml-landing .gc-team-home .gc-team-meta{align-items:flex-end}
#rml-landing .gc-abbr{font-family:var(--rl-d);font-weight:700;font-size:18px;color:#F2F4F0}
#rml-landing .gc-record{font-family:var(--rl-m);font-variant-numeric:tabular-nums;font-size:10px;color:#9DA39A;margin-top:1px}
#rml-landing .gc-center{display:flex;flex-direction:column;align-items:center;gap:3px;flex:0 0 auto;padding:0 4px}
#rml-landing .gc-score{display:flex;align-items:center;gap:8px}
#rml-landing .gc-runs{font-family:var(--rl-m);font-variant-numeric:tabular-nums;font-weight:600;font-size:22px;color:#F2F4F0}
#rml-landing .gc-bases{font-size:8px;color:#5E635D;letter-spacing:-1px}
#rml-landing .gc-inning{display:flex;align-items:center;gap:5px;background:#161817;border:1px solid #1E211F;border-radius:999px;padding:2px 8px}
#rml-landing .gc-live-dot{width:5px;height:5px;border-radius:50%;background:#5BE38B;flex:0 0 5px;box-shadow:0 0 5px rgba(91,227,139,.6)}
#rml-landing .gc-inning-arrow{font-size:8px;color:#5BE38B;line-height:1}
#rml-landing .gc-inning-num{font-family:var(--rl-m);font-variant-numeric:tabular-nums;font-size:10px;font-weight:600;color:#F2F4F0}
#rml-landing .gc-odds{justify-content:space-between;gap:6px;margin-top:11px;padding:7px 0;border-top:1px solid #1E211F;border-bottom:1px solid #1E211F}
#rml-landing .gc-odds-cell{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:6px}
#rml-landing .gc-odds-total{border-left:1px solid #1E211F;border-right:1px solid #1E211F}
#rml-landing .gc-odds-label{font-family:var(--rl-b);font-size:9px;font-weight:600;letter-spacing:.6px;color:#878D85;text-transform:uppercase}
#rml-landing .gc-odds-val{font-family:var(--rl-m);font-variant-numeric:tabular-nums;font-size:13px;font-weight:600;color:#F2F4F0}
#rml-landing .gc-pos{color:#5BE38B}
#rml-landing .gc-footer{justify-content:space-between;gap:8px;margin-top:10px}
#rml-landing .gc-pitchers{display:flex;align-items:center;gap:6px;font-size:11px;color:#9DA39A;min-width:0;overflow:hidden}
#rml-landing .gc-pitcher{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rml-landing .gc-vs{color:#5E635D;font-size:9px;flex:0 0 auto}
#rml-landing .gc-lean{display:flex;align-items:center;gap:5px;flex:0 0 auto;background:rgba(189,255,0,.08);border:1px solid rgba(189,255,0,.35);border-radius:6px;padding:3px 7px}
#rml-landing .gc-lean-tag{font-family:var(--rl-m);font-size:7px;font-weight:700;color:#BDFF00;opacity:.7}
#rml-landing .gc-lean-flag{font-size:9px;color:#BDFF00}
#rml-landing .gc-lean-text{font-family:var(--rl-d);font-weight:700;font-size:12px;color:#BDFF00}

/* ── Spotlight panel ── */
#rml-landing .sp-panel{width:100%;box-sizing:border-box;background:#0d0e0d;border:1px solid #1E211F;border-radius:10px;padding:8px 9px;font-family:var(--rl-b);color:#F2F4F0}
#rml-landing .sp-head{display:flex;align-items:center;gap:7px;padding:1px 2px 7px;border-bottom:1px solid #1E211F}
#rml-landing .sp-head-label{font-family:var(--rl-d);font-weight:700;font-size:12px;letter-spacing:.12em;color:#F2F4F0}
#rml-landing .sp-head-sub{font-family:var(--rl-m);font-size:8.5px;letter-spacing:.08em;color:#878D85}
#rml-landing .sp-beta{margin-left:auto;font-family:var(--rl-m);font-size:8px;font-weight:600;letter-spacing:.1em;color:#BDFF00;border:1px solid #2A2E2B;border-radius:4px;padding:1px 5px}
#rml-landing .sp-row{display:flex;align-items:center;gap:8px;padding:7px 3px;border-bottom:1px solid #1E211F}
#rml-landing .sp-row:last-child{border-bottom:none}
#rml-landing .sp-rank{font-family:var(--rl-m);font-size:11px;font-weight:700;color:#BDFF00;min-width:18px;font-variant-numeric:tabular-nums}
#rml-landing .sp-rank-dim{color:#878D85}
#rml-landing .sp-main{flex:1;min-width:0}
#rml-landing .sp-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#rml-landing .sp-match{font-family:var(--rl-m);font-size:11px;font-weight:600;color:#F2F4F0;font-variant-numeric:tabular-nums}
#rml-landing .sp-side{font-family:var(--rl-d);font-weight:700;font-size:11px;letter-spacing:.04em;padding:0 4px;border-radius:3px}
#rml-landing .sp-over{color:#5BE38B;background:rgba(91,227,139,.1)}
#rml-landing .sp-under{color:#FF5C5C;background:rgba(255,92,92,.1)}
#rml-landing .sp-tag{font-family:var(--rl-m);font-size:8.5px;font-weight:500;color:#9DA39A;border:1px solid #2A2E2B;border-radius:3px;padding:1px 4px;font-variant-numeric:tabular-nums}
#rml-landing .sp-edge{color:#5BE38B;border-color:#1E211F;background:#161817}
#rml-landing .sp-miss{color:#FF5C5C;border-color:#1E211F}
#rml-landing .sp-meta{display:flex;align-items:center;gap:5px;margin-top:4px}
#rml-landing .sp-hit{display:inline-flex;align-items:center;gap:3px;font-family:var(--rl-m);font-size:8.5px;color:#5BE38B;font-variant-numeric:tabular-nums}
#rml-landing .sp-miss-txt{display:inline-flex;align-items:center;gap:3px;font-family:var(--rl-m);font-size:8.5px;color:#FF5C5C;font-variant-numeric:tabular-nums}
#rml-landing .sp-dot{color:#5E635D;font-size:8px}
#rml-landing .sp-factors{font-family:var(--rl-m);font-size:8.5px;color:#9DA39A}
#rml-landing .sp-slip{display:inline-flex;align-items:center;gap:2px;font-family:var(--rl-d);font-weight:700;font-size:9.5px;letter-spacing:.05em;color:#101110;background:#BDFF00;border:none;border-radius:4px;padding:3px 7px;white-space:nowrap}
#rml-landing .sp-row-graded{opacity:.78}
#rml-landing .sp-result{font-family:var(--rl-m);font-size:8px;font-weight:600;letter-spacing:.08em;color:#878D85;border:1px solid #1E211F;border-radius:4px;padding:2px 6px;white-space:nowrap}

/* ── Props-by-player panel ── */
#rml-landing .pp-panel{width:100%;box-sizing:border-box;background:#0d0e0d;border:1px solid #1E211F;border-radius:10px;padding:8px 9px;font-family:var(--rl-b);color:#F2F4F0}
#rml-landing .pp-head{display:flex;align-items:center;gap:7px;padding:1px 2px 7px;border-bottom:1px solid #1E211F}
#rml-landing .pp-head-label{font-family:var(--rl-d);font-weight:700;font-size:12px;letter-spacing:.12em;color:#F2F4F0}
#rml-landing .pp-head-sub{font-family:var(--rl-m);font-size:8.5px;letter-spacing:.08em;color:#878D85}
#rml-landing .pp-beta{margin-left:auto;font-family:var(--rl-m);font-size:8px;font-weight:600;letter-spacing:.1em;color:#BDFF00;border:1px solid #2A2E2B;border-radius:4px;padding:1px 5px}
#rml-landing .pp-player{border-bottom:1px solid #1E211F;padding:6px 2px}
#rml-landing .pp-player:last-child{border-bottom:none}
#rml-landing .pp-open{background:#161817;border:1px solid #1E211F;border-radius:8px;padding:7px 8px;margin-top:6px}
#rml-landing .pp-prow{display:flex;align-items:center;gap:8px}
#rml-landing .pp-ava{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--rl-d);font-weight:700;font-size:9.5px;color:#F2F4F0;flex-shrink:0}
#rml-landing .pp-pid{display:flex;flex-direction:column;line-height:1.2;min-width:0}
#rml-landing .pp-name{font-family:var(--rl-d);font-weight:700;font-size:12px;color:#F2F4F0}
#rml-landing .pp-team{font-family:var(--rl-m);font-size:8px;letter-spacing:.06em;color:#9DA39A}
#rml-landing .pp-count{margin-left:auto;font-family:var(--rl-m);font-size:8.5px;color:#878D85}
#rml-landing .pp-chev{margin-left:6px;font-size:13px;color:#878D85}
#rml-landing .pp-open .pp-chev{margin-left:auto}
#rml-landing .pp-prop{display:flex;align-items:center;gap:8px;margin-top:7px;padding-top:7px;border-top:1px solid #1E211F}
#rml-landing .pp-stat{font-family:var(--rl-b);font-weight:500;font-size:11px;color:#F2F4F0;flex:1;min-width:0}
#rml-landing .pp-prices{display:flex;align-items:center;gap:5px}
#rml-landing .pp-best{font-family:var(--rl-m);font-size:10px;font-weight:600;color:#5BE38B;background:rgba(91,227,139,.1);border:1px solid #1E211F;border-radius:4px;padding:2px 5px;font-variant-numeric:tabular-nums}
#rml-landing .pp-alt{font-family:var(--rl-m);font-size:10px;color:#9DA39A;border:1px solid #2A2E2B;border-radius:4px;padding:2px 5px;font-variant-numeric:tabular-nums}
#rml-landing .pp-ev{font-family:var(--rl-m);font-size:8.5px;font-weight:600;color:#101110;background:#BDFF00;border-radius:3px;padding:2px 4px;font-variant-numeric:tabular-nums}

/* ── vs the touts ── */
#rml-landing .vs-section{background:#0d0e0d;color:#F2F4F0;font-family:var(--rl-b);padding:64px 22px;max-width:480px;margin:0 auto;border-top:1px solid var(--rl-line)}
#rml-landing .vs-kicker{font-family:var(--rl-m);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--rl-signal);opacity:.85;margin:0 0 14px}
#rml-landing .vs-headline{font-family:var(--rl-d);font-weight:700;font-size:clamp(26px,8vw,38px);line-height:1.02;letter-spacing:-.01em;margin:0 0 14px}
#rml-landing .vs-headline-accent{color:var(--rl-signal)}
#rml-landing .vs-sub{font-size:14px;line-height:1.55;color:#9DA39A;margin:0 0 24px;max-width:360px}
#rml-landing .vs-table{display:flex;flex-direction:column;border:1px solid #1E211F;border-radius:12px;overflow:hidden;background:#101110}
#rml-landing .vs-colhead,#rml-landing .vs-row{display:grid;grid-template-columns:1.15fr 1fr 1fr}
#rml-landing .vs-colhead{background:#161817;border-bottom:1px solid #2A2E2B}
#rml-landing .vs-colhead-spacer{padding:14px 12px}
#rml-landing .vs-colhead-rml,#rml-landing .vs-colhead-tout{display:flex;flex-direction:column;gap:3px;padding:14px 10px;text-align:center;align-items:center;justify-content:center}
#rml-landing .vs-colhead-rml{border-left:1px solid #BDFF00;background:rgba(189,255,0,.04)}
#rml-landing .vs-colhead-tout{border-left:1px solid #2A2E2B}
#rml-landing .vs-brand-mark{font-family:var(--rl-d);font-weight:700;font-size:18px;color:#BDFF00}
#rml-landing .vs-tout-mark{font-family:var(--rl-d);font-weight:700;font-size:18px;color:#9DA39A}
#rml-landing .vs-colhead-tag{font-family:var(--rl-m);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#878D85}
#rml-landing .vs-row{border-bottom:1px solid #1E211F}
#rml-landing .vs-row:last-of-type{border-bottom:0}
#rml-landing .vs-criterion{padding:14px 12px;font-size:12.5px;line-height:1.35;font-weight:500;color:#F2F4F0;align-self:center;border-right:1px solid #1E211F}
#rml-landing .vs-criterion em{font-style:normal;color:#BDFF00}
#rml-landing .vs-cell{display:flex;flex-direction:column;gap:7px;padding:14px 10px;align-items:flex-start}
#rml-landing .vs-cell-rml{background:rgba(189,255,0,.035);border-left:1px solid #BDFF00}
#rml-landing .vs-cell-tout{border-left:1px solid #2A2E2B}
#rml-landing .vs-val{font-size:11.5px;line-height:1.3;color:#9DA39A}
#rml-landing .vs-cell-rml .vs-val{color:#F2F4F0}
#rml-landing .vs-mark{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;position:relative}
#rml-landing .vs-mark::before,#rml-landing .vs-mark::after{content:"";position:absolute;background:currentColor}
#rml-landing .vs-yes{color:#5BE38B;box-shadow:inset 0 0 0 1px rgba(91,227,139,.5)}
#rml-landing .vs-yes::before{width:7px;height:2px;border-radius:1px;transform:rotate(45deg) translate(-2px,2px)}
#rml-landing .vs-yes::after{width:3px;height:2px;border-radius:1px;transform:rotate(45deg) translate(-4px,1px)}
#rml-landing .vs-no{color:#BDFF00;box-shadow:inset 0 0 0 1px rgba(189,255,0,.55)}
#rml-landing .vs-no::before{width:8px;height:2px;border-radius:1px}
#rml-landing .vs-warn{color:#9DA39A;box-shadow:inset 0 0 0 1px rgba(157,163,154,.5)}
#rml-landing .vs-warn::before{width:2px;height:2px;border-radius:50%}
#rml-landing .vs-bad{color:#FF5C5C;box-shadow:inset 0 0 0 1px rgba(255,92,92,.5)}
#rml-landing .vs-bad::before,#rml-landing .vs-bad::after{width:9px;height:2px;border-radius:1px}
#rml-landing .vs-bad::before{transform:rotate(45deg)}
#rml-landing .vs-bad::after{transform:rotate(-45deg)}
#rml-landing .vs-foot{margin:24px 0 0;font-size:12.5px;line-height:1.5;color:#9DA39A}
#rml-landing .vs-foot-key{font-family:var(--rl-m);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#BDFF00;margin-right:6px}

/* full-screen renders fit flush inside the terminal frame */
#rml-landing .rl-frame .gcf-screen,#rml-landing .rl-frame .mbf-screen{max-width:none;width:100%;min-height:auto;border:none;border-radius:0;background:#0A0A0A}
#rml-landing .rl-dash-shot{width:100%;display:block;-webkit-mask-image:linear-gradient(#000 86%,transparent);mask-image:linear-gradient(#000 86%,transparent)}

/* ── Game Center full screen ── */
#rml-landing .gcf-screen{color:#F2F4F0;font-family:var(--rl-b);padding:12px 12px 16px;display:flex;flex-direction:column;gap:12px}
#rml-landing .gcf-spotlight{display:flex;align-items:center;gap:7px;background:#101110;border:1px solid #1E211F;border-radius:8px;padding:8px 10px;overflow:hidden;white-space:nowrap}
#rml-landing .gcf-hex{width:12px;height:12px;flex:none;background:#BDFF00;clip-path:polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)}
#rml-landing .gcf-spot-label{font-family:var(--rl-d);font-weight:700;font-size:12px;letter-spacing:.12em;color:#BDFF00}
#rml-landing .gcf-spot-count{font-family:var(--rl-m);font-size:11px;color:#9DA39A}
#rml-landing .gcf-beta,#rml-landing .gcf-lbeta{font-family:var(--rl-m);font-size:8px;font-weight:700;letter-spacing:.1em;color:#0A0A0A;background:#BDFF00;border-radius:3px;padding:2px 4px}
#rml-landing .gcf-spot-lean{font-family:var(--rl-m);font-size:11px;color:#9DA39A;margin-left:2px;overflow:hidden;text-overflow:ellipsis}
#rml-landing .gcf-spot-lean b{color:#F2F4F0}
#rml-landing .gcf-rank{color:#BDFF00}
#rml-landing .gcf-chips{display:flex;gap:7px;flex-wrap:wrap}
#rml-landing .gcf-chip{font-family:var(--rl-b);font-size:12px;font-weight:500;color:#9DA39A;background:#161817;border:1px solid #2A2E2B;border-radius:999px;padding:5px 12px;display:flex;align-items:center;gap:5px}
#rml-landing .gcf-chip-on{color:#BDFF00;border-color:#BDFF00;background:rgba(189,255,0,.08);font-weight:700}
#rml-landing .gcf-chip-live{color:#FF5C5C}
#rml-landing .gcf-livedot{width:6px;height:6px;border-radius:50%;background:#FF5C5C;flex:none}
#rml-landing .gcf-dates{display:flex;gap:16px;border-bottom:1px solid #1E211F;padding-bottom:8px}
#rml-landing .gcf-date{font-family:var(--rl-d);font-weight:600;font-size:12px;letter-spacing:.1em;color:#878D85;padding-bottom:6px;position:relative}
#rml-landing .gcf-date-on{color:#F2F4F0}
#rml-landing .gcf-date-on::after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:2px;background:#BDFF00}
#rml-landing .gcf-card{background:#101110;border:1px solid #2A2E2B;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}
#rml-landing .gcf-card-head{display:flex;align-items:center;gap:8px}
#rml-landing .gcf-tag{font-family:var(--rl-d);font-weight:700;font-size:10px;letter-spacing:.12em;color:#9DA39A;background:#161817;border:1px solid #1E211F;border-radius:4px;padding:2px 6px}
#rml-landing .gcf-livepill{display:flex;align-items:center;gap:5px;font-family:var(--rl-m);font-size:9px;font-weight:700;letter-spacing:.1em;color:#FF5C5C;border:1px solid rgba(255,92,92,.4);border-radius:4px;padding:2px 6px}
#rml-landing .gcf-inning{margin-left:auto;font-family:var(--rl-m);font-size:11px;color:#9DA39A}
#rml-landing .gcf-time{margin-left:auto;font-family:var(--rl-m);font-size:12px;color:#9DA39A}
#rml-landing .gcf-matchup{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}
#rml-landing .gcf-team{display:flex;align-items:center;gap:8px;min-width:0}
#rml-landing .gcf-team-r{justify-content:flex-end}
#rml-landing .gcf-logo{width:30px;height:30px;border-radius:50%;background:#161817;display:flex;align-items:center;justify-content:center;flex:none}
#rml-landing .gcf-logo img{width:22px;height:22px;object-fit:contain}
#rml-landing .gcf-abbr{font-family:var(--rl-d);font-weight:700;font-size:17px;color:#F2F4F0}
#rml-landing .gcf-rec{font-family:var(--rl-m);font-size:11px;color:#878D85;font-variant-numeric:tabular-nums}
#rml-landing .gcf-score{display:flex;align-items:center;gap:8px}
#rml-landing .gcf-sc{font-family:var(--rl-m);font-size:22px;font-weight:700;color:#F2F4F0;font-variant-numeric:tabular-nums}
#rml-landing .gcf-diamonds{font-size:9px;color:#BDFF00;letter-spacing:1px}
#rml-landing .gcf-soon{font-family:var(--rl-m);font-size:15px;font-weight:600;color:#9DA39A}
#rml-landing .gcf-odds{display:flex;align-items:center;gap:7px;justify-content:center;font-family:var(--rl-m);font-size:11px;color:#878D85;border-top:1px solid #1E211F;padding-top:9px;font-variant-numeric:tabular-nums}
#rml-landing .gcf-odds b{color:#F2F4F0;font-weight:700}
#rml-landing .gcf-dot{color:#2A2E2B}
#rml-landing .gcf-pitch{font-family:var(--rl-b);font-size:11px;color:#9DA39A;text-align:center}
#rml-landing .gcf-vs{color:#878D85}
#rml-landing .gcf-leanrow{display:flex;align-items:center;gap:8px}
#rml-landing .gcf-lean{display:inline-flex;align-items:center;gap:6px;font-family:var(--rl-m);font-size:11px;font-weight:700;color:#BDFF00;background:rgba(189,255,0,.08);border:1px solid rgba(189,255,0,.35);border-radius:6px;padding:4px 8px}
#rml-landing .gcf-result{font-family:var(--rl-m);font-size:11px;font-weight:700;color:#5BE38B}

/* ── Matrix Bot full screen ── */
#rml-landing .mbf-screen{min-height:auto;padding:14px 12px 12px;display:flex;flex-direction:column;gap:12px;font-family:var(--rl-b);color:#F2F4F0}
#rml-landing .mbf-tabs{display:flex;gap:6px}
#rml-landing .mbf-tab{flex:1;text-align:center;font-family:var(--rl-d);font-weight:600;font-size:11px;letter-spacing:.06em;color:#878D85;background:#101110;border:1px solid #1E211F;border-radius:9px;padding:9px 4px}
#rml-landing .mbf-tab-on{color:#BDFF00;border-color:#BDFF00;background:#161817;box-shadow:inset 0 0 0 1px rgba(189,255,0,.25)}
#rml-landing .mbf-strip{display:flex;align-items:center;justify-content:space-between;padding:0 2px}
#rml-landing .mbf-dates{display:flex;gap:6px}
#rml-landing .mbf-chip{font-family:var(--rl-m);font-size:11px;color:#9DA39A;background:#101110;border:1px solid #1E211F;border-radius:7px;padding:5px 10px}
#rml-landing .mbf-chip-on{color:#F2F4F0;background:#161817;border-color:#2A2E2B}
#rml-landing .mbf-sports{display:flex;gap:6px}
#rml-landing .mbf-sport{font-family:var(--rl-d);font-weight:600;font-size:11px;letter-spacing:.04em;color:#878D85;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#101110;border:1px solid #1E211F}
#rml-landing .mbf-sport-on{color:#BDFF00;border-color:#BDFF00;background:#161817}
#rml-landing .mbf-body{display:flex;flex-direction:column;gap:8px;flex:1}
#rml-landing .mbf-player{background:#101110;border:1px solid #1E211F;border-radius:13px}
#rml-landing .mbf-player-open{border-color:#2A2E2B}
#rml-landing .mbf-phead{display:flex;align-items:center;gap:10px;padding:11px 12px}
#rml-landing .mbf-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--rl-d);font-weight:700;font-size:13px;flex-shrink:0}
#rml-landing .mbf-pmeta{flex:1;min-width:0}
#rml-landing .mbf-pname{font-family:var(--rl-d);font-weight:600;font-size:15px;color:#F2F4F0;line-height:1.1}
#rml-landing .mbf-pteam{font-family:var(--rl-m);font-size:10px;color:#878D85;letter-spacing:.04em;margin-top:2px}
#rml-landing .mbf-count{font-family:var(--rl-m);font-size:10px;color:#9DA39A}
#rml-landing .mbf-chev{font-size:13px;color:#878D85}
#rml-landing .mbf-props{display:flex;flex-direction:column;gap:7px;padding:0 10px 11px}
#rml-landing .mbf-prop{display:flex;align-items:center;justify-content:space-between;background:#161817;border:1px solid #1E211F;border-radius:10px;padding:9px 10px}
#rml-landing .mbf-stat{display:flex;flex-direction:column;gap:2px}
#rml-landing .mbf-statname{font-family:var(--rl-d);font-weight:600;font-size:13px;color:#F2F4F0}
#rml-landing .mbf-line{font-family:var(--rl-m);font-size:11px;color:#9DA39A;font-variant-numeric:tabular-nums}
#rml-landing .mbf-prices{display:flex;align-items:center;gap:6px}
#rml-landing .mbf-price{display:inline-flex;align-items:center;gap:2px;font-family:var(--rl-m);font-size:12px;font-variant-numeric:tabular-nums;color:#9DA39A;background:#0A0A0A;border:1px solid #2A2E2B;border-radius:7px;padding:5px 8px}
#rml-landing .mbf-ar{font-size:9px;opacity:.7}
#rml-landing .mbf-price-best{color:#5BE38B;border-color:rgba(91,227,139,.45);background:rgba(91,227,139,.08)}
#rml-landing .mbf-ev{font-family:var(--rl-m);font-weight:700;font-size:12px;color:#0A0A0A;background:#BDFF00;border-radius:7px;padding:5px 8px;font-variant-numeric:tabular-nums}
#rml-landing .mbf-foot{text-align:center;font-family:var(--rl-m);font-size:9.5px;letter-spacing:.12em;color:#878D85;padding:4px 0 2px}
`

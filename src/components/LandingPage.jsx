import { useState, useEffect, useRef } from 'react'

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
        <div className="rl-brand"><div className="rl-mark">R</div><div className="rl-nm">RISK MATRIX LABS</div></div>
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
            <div className="rl-shot"><div className="rl-ph" style={{ height: 150 }}>[ GAME CENTER SCREENSHOT ]<br />live odds · win prob · line movement</div></div>
          </div>
        </div>
      </header>

      <div className="rl-ticker-wrap"><div className="rl-ticker">
        {ticker.map(([t, r], i) => <span className="rl-tk" key={i}><span className="rl-dot" />{t} <span className={r === 'hit' ? 'rl-hit' : 'rl-miss'}>{r === 'hit' ? '✓ HIT' : '✗ MISS'}</span></span>)}
      </div></div>

      <div className="rl-trust">FREE LIVE ODDS · EV ENGINE · LINE MOVEMENT · KBO · <b>NO PICKS, NO HYPE</b></div>

      <section className="rl-sect">
        <div className="rl-stats rl-reveal">
          <div className="rl-stat"><div className="rl-n rl-acc rl-mono" data-to="248">0</div><div className="rl-l">leans graded</div></div>
          <div className="rl-stat"><div className="rl-n rl-mono" data-to="0">0</div><div className="rl-l">credits / scan</div></div>
          <div className="rl-stat"><div className="rl-n rl-mono">3</div><div className="rl-l">free models</div></div>
        </div>
      </section>

      <section className="rl-sect">
        <span className="rl-label rl-kick">SECTION 01 // THE PLATFORM</span>
        <h2 className="rl-h2">An edge platform.<br /><span className="rl-g">Not a tout.</span></h2>
        <p className="rl-sub">Everything an operator needs to find value and act on it with discipline — free where it can be, honest everywhere.</p>
        <div className="rl-bento">
          {BENTO.map((c, i) => (
            <div className="rl-cell rl-reveal" key={i}>
              {c.tag && <span className="rl-tag">{c.tag}</span>}
              <span className="rl-label">{c.label}</span>
              <div className="rl-ci">{c.title}</div>
              <p>{c.desc}</p>
              {c.ph && <div className="rl-ph" style={{ height: 96, marginTop: 14 }}>{c.ph}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="rl-sect" id="rl-record">
        <span className="rl-label rl-kick">SECTION 02 // THE RECORD</span>
        <h2 className="rl-h2">We show our work.<br /><span className="rl-g">Wins and misses.</span></h2>
        <p className="rl-sub">Every model lean is snapshotted before the game and graded against the real result. No hidden losses. No cherry-picked screenshots. Most apps won't show you this.</p>
        <div className="rl-board rl-reveal">
          <div className="rl-board-h"><span className="rl-bt">Spotlight · model record</span><span className="rl-live"><span className="rl-ld" />LIVE</span></div>
          <div className="rl-bstats">
            <div className="rl-bstat"><div className="rl-bn rl-mono">12–13</div><div className="rl-bl">all-time</div></div>
            <div className="rl-bstat"><div className="rl-bn rl-mono">2–1</div><div className="rl-bl">yesterday</div></div>
            <div className="rl-bstat"><div className="rl-bn rl-mono">48%</div><div className="rl-bl">hit rate</div></div>
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

      <section className="rl-sect">
        <span className="rl-label rl-kick">SECTION 03 // HOW IT WORKS</span>
        <h2 className="rl-h2">Scan. Grade.<br /><span className="rl-g">Decide.</span></h2>
        <div style={{ marginTop: 18 }}>
          {STEPS.map(([n, t, d]) => (
            <div className="rl-step rl-reveal" key={n}><div className="rl-sn rl-mono">{n}</div><div><div className="rl-st">{t}</div><p>{d}</p></div></div>
          ))}
        </div>
      </section>

      <section className="rl-mani"><h2 className="rl-h2">We build for <span className="rl-g">operators.</span><br />Not gamblers.</h2></section>

      <section className="rl-sect">
        <span className="rl-label rl-kick">SECTION 04 // PRICING</span>
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

      <footer className="rl-foot">
        <div className="rl-foot-top">
          <div className="rl-foot-brand">
            <div className="rl-brand"><div className="rl-mark">R</div><div className="rl-nm">RISK MATRIX LABS</div></div>
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
  --rl-ink-0:#F2F4F0;--rl-ink-1:#9DA39A;--rl-ink-2:#5E635D;
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
#rml-landing .rl-mark{width:30px;height:30px;border:2px solid var(--rl-signal);border-radius:8px;display:grid;place-items:center;font-family:var(--rl-d);font-weight:700;color:var(--rl-signal);font-size:17px}
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
@media(prefers-reduced-motion:reduce){#rml-landing .rl-reveal{opacity:1;transform:none}#rml-landing .rl-ticker,#rml-landing .rl-ld{animation:none}}
`

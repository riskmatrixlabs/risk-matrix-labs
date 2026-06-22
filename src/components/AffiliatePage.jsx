import { ArrowLeft, DollarSign, Users, RefreshCw, Zap, CheckCircle, Link } from 'lucide-react'

const NEON = '#BDFF00'
const BG   = '#0A0A0A'
const R    = "'Rajdhani', sans-serif"
const I    = "'Inter', sans-serif"

const SIGNUP_URL = 'https://risk-matrix-labs.getrewardful.com/signup'

function StatCard({ value, label, sub }) {
  return (
    <div style={{ background: '#111', border: '1px solid rgba(189,255,0,0.15)', borderRadius: '10px', padding: '28px 24px', textAlign: 'center', flex: 1, minWidth: '140px' }}>
      <div style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, color: NEON, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginTop: '8px' }}>{label}</div>
      {sub && <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function Step({ n, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(189,255,0,0.1)', border: '1px solid rgba(189,255,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontSize: '14px', fontWeight: 700, color: NEON, flexShrink: 0 }}>{n}</div>
      <div>
        <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

function CheckItem({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
      <CheckCircle size={15} color={NEON} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{text}</span>
    </div>
  )
}

export default function AffiliatePage({ onBack }) {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff' }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 40px', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/brand/logos/logo-dashboard.png" alt="Risk Matrix" style={{ height: '26px' }} />
          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>RISK MATRIX LABS</span>
        </div>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 14px', color: 'rgba(255,255,255,0.5)', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          <ArrowLeft size={12} /> Back
        </button>
      </nav>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 40px 80px' }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: 'center', padding: '80px 0 60px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.18)', borderRadius: '20px', padding: '5px 14px', marginBottom: '28px' }}>
            <DollarSign size={12} color={NEON} />
            <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase' }}>For Creators & Cappers</span>
          </div>
          <h1 style={{ fontFamily: R, fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 700, lineHeight: 1.05, color: '#fff', margin: '0 0 20px' }}>
            Your audience already bets.<br />
            <span style={{ color: NEON }}>Start getting paid for it.</span>
          </h1>
          <p style={{ fontFamily: I, fontSize: '17px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: '520px', margin: '0 auto 16px' }}>
            Every follower who tails you needs a real edge platform to do it right — live odds, EV grades, props, and the discipline tools to run a system. Point them to Risk Matrix Labs — earn 30% recurring every month they stay subscribed.
          </p>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.28)', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto 40px' }}>
            One link. No gatekeeping. Pays out automatically — month after month, for as long as they're active.
          </p>
          <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: NEON, color: '#000', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none', padding: '15px 32px', borderRadius: '6px', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Link size={14} /> Get Your Link — It's Free
          </a>
          <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '14px' }}>No approval. No minimum. Instant access.</div>
        </div>

        {/* ── STATS ── */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '72px' }}>
          <StatCard value="30%" label="Recurring commission" sub="per subscriber per month" />
          <StatCard value="90" label="Day cookie" sub="window per click" />
          <StatCard value="$29" label="Per subscriber" sub="est. ~$8.70/mo per referral" />
          <StatCard value="∞" label="Referrals" sub="no cap on earnings" />
        </div>

        {/* ── HOW IT WORKS ── */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '12px' }}>How it works</div>
          <h2 style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '36px' }}>Three steps to your first commission</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <Step n="01" title="Sign up — it's free"
              desc="Create your affiliate account in under a minute. You'll get a unique tracking link immediately — no approval process, no waiting." />
            <Step n="02" title="Share your link"
              desc="Post it on X, TikTok, Instagram, Discord, YouTube, or wherever your audience lives. Anyone who clicks and subscribes within 90 days is your referral." />
            <Step n="03" title="Earn every month they stay"
              desc="30% of every payment your referrals make goes to you — automatically. If they stay subscribed for a year, you earn for a year." />
          </div>
        </div>

        {/* ── WHO IT'S FOR ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '72px' }}>
          {[
            { icon: Users, title: 'Cappers', desc: 'Your followers already need real tools — live odds, EV grades, and bankroll discipline — to operate correctly. Point them to the right platform and earn when they subscribe.' },
            { icon: Zap, title: 'Content creators', desc: "Sports betting content? Your audience is the exact operator we're built for. One link in your bio or video description." },
            { icon: RefreshCw, title: 'Discord & community mods', desc: 'If you run a betting Discord or Slack, every member is a potential subscriber. Your link works 24/7.' },
            { icon: DollarSign, title: 'Anyone with an audience', desc: 'Podcast, newsletter, Twitch stream — if your audience bets, they need better tools. That\'s the pitch.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(189,255,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={NEON} />
                </div>
                <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff' }}>{title}</div>
              </div>
              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* ── WHAT YOU GET ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '72px', alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '12px' }}>What you get</div>
            <h2 style={{ fontFamily: R, fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>Everything you need to promote</h2>
            <CheckItem text="Unique affiliate link with 90-day tracking cookie" />
            <CheckItem text="Real-time dashboard — see clicks, signups, and earnings" />
            <CheckItem text="Payouts via Stripe — automatic monthly deposits" />
            <CheckItem text="30% commission on every recurring payment, not just the first" />
            <CheckItem text="No minimum payout threshold" />
            <CheckItem text="Shareable screenshots, demo link, and brand assets" />
          </div>
          <div style={{ background: 'rgba(189,255,0,0.04)', border: '1px solid rgba(189,255,0,0.12)', borderRadius: '10px', padding: '28px' }}>
            <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(189,255,0,0.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Earnings example</div>
            {[
              ['10 referrals', '$29 × 30% × 10', '~$87/mo'],
              ['25 referrals', '$29 × 30% × 25', '~$218/mo'],
              ['100 referrals', '$29 × 30% × 100', '~$870/mo'],
            ].map(([label, calc, result]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: '#fff' }}>{label}</div>
                  <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{calc}</div>
                </div>
                <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON }}>{result}</div>
              </div>
            ))}
            <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '14px', lineHeight: 1.5 }}>Based on $29/mo pricing. Recurring — earned every month subscribers stay active. Annual plans earn 30% of $149.</div>
          </div>
        </div>

        {/* ── YEARLY EARNINGS COMPARISON ── */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '12px' }}>Yearly breakdown</div>
          <h2 style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>What a year of referrals looks like</h2>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.35)', marginBottom: '32px', lineHeight: 1.6 }}>
            Monthly subscribers earn you more over 12 months. Annual subscribers pay out instantly. Either way, it compounds.
          </p>

          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: '#141414', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                ['Referrals', ''],
                ['Monthly subs', '$29/mo × 30% × 12'],
                ['Annual subs', '$149/yr × 30%'],
                ['Mixed 50/50', 'half each'],
              ].map(([label, sub], i) => (
                <div key={label} style={{ padding: '14px 18px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: i === 0 ? 'rgba(255,255,255,0.3)' : '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
                  {sub && <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '3px' }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Data rows: 10, 25, 50, 100 referrals */}
            {[10, 25, 50, 100].map((n, i) => {
              const monthly = n * 29 * 0.30 * 12   // $104.40/ref/yr
              const annual  = n * 149 * 0.30         // $44.70/ref/yr
              const mixed   = (monthly + annual) / 2
              const isLast  = n === 100
              const bg = i % 2 === 0 ? '#0d0d0d' : '#111'
              const fmt = (v) => '$' + Math.round(v).toLocaleString()
              return (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: bg, borderTop: isLast ? `1px solid rgba(189,255,0,0.2)` : 'none' }}>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: isLast ? NEON : '#fff', lineHeight: 1 }}>{n}</div>
                    <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>referrals</div>
                  </div>
                  {[monthly, annual, mixed].map((val, j) => (
                    <div key={j} style={{ padding: '14px 18px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: isLast ? NEON : '#fff', lineHeight: 1 }}>{fmt(val)}</div>
                      <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '3px' }}>per year</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.18)', marginTop: '12px', lineHeight: 1.5 }}>
            Monthly: $29/mo × 30% × 12 months = $104.40/referral/yr. Annual: $149 × 30% = $44.70/referral upfront. Assumes subscribers stay active for the full year.
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ background: 'rgba(189,255,0,0.04)', border: '1px solid rgba(189,255,0,0.15)', borderRadius: '12px', padding: '52px 40px', textAlign: 'center' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '14px' }}>Ready to earn?</div>
          <h2 style={{ fontFamily: R, fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
            Start earning in 60 seconds.
          </h2>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.35)', marginBottom: '32px' }}>
            Free to join. Instant link. No gatekeeping.
          </p>
          <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: NEON, color: '#000', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none', padding: '15px 36px', borderRadius: '6px', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Link size={14} /> Get Your Affiliate Link
          </a>
          <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: '16px' }}>
            Questions? <a href="mailto:hello@riskmatrixlabs.com" style={{ color: 'rgba(189,255,0,0.4)', textDecoration: 'none' }}>hello@riskmatrixlabs.com</a>
          </div>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px 40px', textAlign: 'center' }}>
        <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', maxWidth: '640px', margin: '0 auto 12px', lineHeight: 1.6 }}>
          Affiliate links — Risk Matrix Labs may earn a commission. Earnings shown are examples, not guarantees; results vary based on referred subscribers who stay active. Must be 21+. Problem gambling? Call 1-800-GAMBLER.
        </div>
        <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.16)' }}>© 2026 Risk Matrix Labs LLC. All rights reserved. &nbsp;·&nbsp; <a href="/privacy" style={{ color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Privacy</a> &nbsp;·&nbsp; <a href="/terms" style={{ color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Terms</a></div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="padding: 0 40px"] { padding: 0 20px 60px !important; }
          div[style*="padding: 80px 0 60px"] { padding: 48px 0 40px !important; }
        }
      `}</style>
    </div>
  )
}

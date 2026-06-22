import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = 'Risk Matrix Labs <hello@riskmatrixlabs.com>'

const BASE = `
  background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;
  max-width:560px;margin:0 auto;padding:0;
`
const NEON = '#BDFF00'

function shell(content, { marketing = false } = {}) {
  const footer = marketing
    ? `<p style="margin:0;font-size:11px;color:#444;letter-spacing:0.06em;">
        Risk Matrix Labs · <a href="https://riskmatrixlabs.com" style="color:#444;">riskmatrixlabs.com</a>
      </p>
      <p style="margin:6px 0 0;font-size:10px;color:#333;letter-spacing:0.08em;text-transform:uppercase;">Operate With Discipline</p>
      <p style="margin:10px 0 0;font-size:10px;color:#2a2a2a;">
        <a href="mailto:hello@riskmatrixlabs.com?subject=unsubscribe" style="color:#333;text-decoration:underline;">Unsubscribe</a> · You're receiving this because you subscribed to Risk Matrix Labs.
      </p>`
    : `<p style="margin:0;font-size:11px;color:#444;letter-spacing:0.06em;">
        Risk Matrix Labs · <a href="https://riskmatrixlabs.com" style="color:#444;">riskmatrixlabs.com</a>
      </p>
      <p style="margin:6px 0 0;font-size:10px;color:#333;letter-spacing:0.08em;text-transform:uppercase;">Operate With Discipline</p>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="${BASE}">
  <tr><td style="border-top:3px solid ${NEON};padding:32px 36px 0;">
    <img src="https://app.riskmatrixlabs.com/brand/logos/logo-dashboard.png" height="44" alt="Risk Matrix Labs" style="display:block;margin-bottom:24px;" />
  </td></tr>
  <tr><td style="padding:0 36px 36px;">${content}</td></tr>
  <tr><td style="padding:20px 36px 32px;border-top:1px solid #1e1e1e;">${footer}</td></tr>
</table>
</body></html>`
}

const h1 = (t) => `<h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#fff;letter-spacing:0.06em;">${t}</h1>`
const p  = (t) => `<p style="margin:12px 0;font-size:14px;line-height:1.7;color:#aaa;">${t}</p>`
const btn = (label, url) => `
  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${NEON};border-radius:2px;">
      <a href="${url}" style="display:block;padding:12px 28px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#0A0A0A;text-decoration:none;">${label}</a>
    </td></tr>
  </table>`
const chip = (label, color = NEON) => `<span style="display:inline-block;padding:3px 10px;border-radius:2px;border:1px solid ${color};font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${label}</span>`

// ── 1. Welcome ────────────────────────────────────────────────────────────────
export async function sendWelcome({ email, plan = 'Beta' }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Welcome to Risk Matrix Labs — Operate With Discipline',
    html: shell(`
      ${h1('You\'re in. Let\'s build your edge.')}
      ${chip('Welcome')}
      ${p('<strong style="color:#fff;">Risk Matrix Labs</strong> is your edge platform. Live odds, EV-graded bets, player props, and line movement — plus a model track record we grade in public, wins and misses. And underneath it all, the discipline tools that keep operators in the game.')}
      ${p('Here\'s how to get started in the first 5 minutes:')}
      <ol style="color:#aaa;font-size:14px;line-height:2;padding-left:18px;margin:12px 0;">
        <li>Open Game Center — scan today's slate for live odds and edges</li>
        <li>Check the Matrix Bot props and model leans</li>
        <li>Set your starting bankroll, then log your first bet</li>
        <li>Watch your Discipline Score™ build session over session</li>
      </ol>
      ${btn('Open Dashboard', 'https://app.riskmatrixlabs.com')}
      ${p('Questions? Reply to this email — it goes straight to me.')}
    `),
  })
}

// ── 2. Trial ending in 3 days ─────────────────────────────────────────────────
export async function sendTrialEnding({ email, trialEnd }) {
  const date = new Date(trialEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your Risk Matrix Labs trial ends ${date}`,
    html: shell(`
      ${h1('Your trial ends in 3 days.')}
      ${chip('Trial Ending', '#F5A623')}
      ${p(`Your free trial expires on <strong style="color:#fff;">${date}</strong>. After that your dashboard will be locked until you subscribe.`)}
      ${p('Everything you\'ve built — your bet history, ladder settings, discipline scores — stays saved. You won\'t lose anything.')}
      ${btn('Subscribe Now', 'https://app.riskmatrixlabs.com')}
      ${p('If you have questions about the plan, just reply here.')}
    `),
  })
}

// ── 3. Payment failed ─────────────────────────────────────────────────────────
export async function sendPaymentFailed({ email }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Action needed — Risk Matrix Labs payment failed',
    html: shell(`
      ${h1('Your payment didn\'t go through.')}
      ${chip('Action Required', '#FF3B3B')}
      ${p('We couldn\'t process your subscription payment. Your access is still active for now, but we\'ll need a valid payment method to keep it running.')}
      ${p('Update your billing info in 60 seconds:')}
      ${btn('Update Payment Method', 'https://app.riskmatrixlabs.com')}
      ${p('Once updated, your subscription continues automatically — no interruption to your dashboard.')}
      ${p('If you think this is a mistake, reply here and we\'ll sort it out.')}
    `),
  })
}

// ── 4. Subscription activated (trial → paid) ──────────────────────────────────
export async function sendSubscriptionActivated({ email, plan = 'Beta' }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'You\'re now a full Risk Matrix Labs member',
    html: shell(`
      ${h1('Subscription confirmed. Welcome to the full access.')}
      ${chip('Active Member')}
      ${p(`Your <strong style="color:#fff;">${plan}</strong> subscription is now active. Full access — Game Center, Matrix Bot props and model leans, PHLT™ Ladder, analytics, and everything else — no limits.`)}
      ${p('Manage your billing, update your plan, or cancel anytime from inside the dashboard → click your username → Manage Billing.')}
      ${btn('Open Dashboard', 'https://app.riskmatrixlabs.com')}
      ${p('Appreciate you. Now go operate with discipline.')}
    `),
  })
}

// ── 5. Day 1 onboarding — "Did you set your bankroll?" ───────────────────────
export async function sendDayOne({ email }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'One thing to do in Risk Matrix Labs',
    html: shell(`
      ${h1('Did you set your bankroll yet?')}
      ${chip('Day 1')}
      ${p('Most people open the app, look around, and close it. The ones who stick around do one thing first:')}
      <ol style="color:#aaa;font-size:14px;line-height:2.2;padding-left:18px;margin:16px 0;">
        <li>Set your starting bankroll (top of the dashboard)</li>
        <li>Log one bet — even a past one</li>
        <li>Check your risk panel — see what % you actually deployed</li>
      </ol>
      ${p('That\'s it. Takes under 2 minutes. After that the system starts working for you.')}
      ${btn('Open Dashboard', 'https://app.riskmatrixlabs.com')}
      ${p('Reply here if you have any questions. I read every one.')}
    `),
  })
}

// ── 6. Trial expired — "Your trial ended" ────────────────────────────────────
export async function sendTrialExpired({ email }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your Risk Matrix Labs trial ended — here\'s what you\'re missing',
    html: shell(`
      ${h1('Your free trial ended.')}
      ${chip('Trial Expired', '#FF3B3B')}
      ${p('Your 3-day trial is over and your dashboard is locked — but everything you built is still saved. Your bets, your ladder settings, your bankroll history.')}
      ${p('Subscribe in 60 seconds to get it back:')}
      <ul style="color:#aaa;font-size:14px;line-height:2.2;padding-left:18px;margin:16px 0;">
        <li>Game Center — live odds, EV-graded bets, line movement</li>
        <li>Matrix Bot — player props and model leans, graded in public</li>
        <li>Discipline Score™ — session grading A–F, every dollar tracked</li>
        <li>Risk Analytics + RR Engine — exposure, stop loss, every combo</li>
      </ul>
      ${btn('Subscribe — $29/mo or $149/yr', 'https://app.riskmatrixlabs.com')}
      ${p('Questions? Just reply here.')}
    `),
  })
}

// ── 7. Win-back — after cancellation ─────────────────────────────────────────
export async function sendWinBack({ email }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Before you go — what went wrong?',
    headers: { 'List-Unsubscribe': '<mailto:hello@riskmatrixlabs.com?subject=unsubscribe>' },
    html: shell(`
      ${h1('We noticed you canceled.')}
      ${chip('We\'d love to know why', '#555')}
      ${p('No hard feelings — but it would help us a lot to know what didn\'t work for you.')}
      ${p('Was it:')}
      <ul style="color:#aaa;font-size:14px;line-height:2.4;padding-left:18px;margin:16px 0;">
        <li>Too expensive right now?</li>
        <li>Missing a feature you needed?</li>
        <li>Didn\'t use it enough to justify it?</li>
        <li>Something broke or didn\'t work?</li>
      </ul>
      ${p('Reply to this email with one line. I personally read and respond to every reply — and your feedback directly shapes what we build next.')}
      ${p('And if timing was the issue — your data is saved. Come back anytime.')}
      ${btn('Reactivate Anytime', 'https://app.riskmatrixlabs.com')}
    `, { marketing: true }),
  })
}

// ── 8. Re-engagement — inactive paying subscribers ────────────────────────────
export async function sendReengagement({ email }) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'You haven\'t logged a bet in a while',
    headers: { 'List-Unsubscribe': '<mailto:hello@riskmatrixlabs.com?subject=unsubscribe>' },
    html: shell(`
      ${h1('Your edge is slipping.')}
      ${chip('Check In', '#F5A623')}
      ${p('You haven\'t logged a bet in over 2 weeks. That means no discipline score, no P&L tracking, no risk visibility.')}
      ${p('The operators who stay profitable aren\'t luckier — they\'re more consistent. Every session tracked. Every result analyzed.')}
      ${p('It takes 30 seconds to log a bet. Here\'s what you\'re missing:')}
      <ul style="color:#aaa;font-size:14px;line-height:2.2;padding-left:18px;margin:16px 0;">
        <li>Is your bankroll up or down since you last logged?</li>
        <li>What\'s your win rate been over your last 20 bets?</li>
        <li>Are you tilting without knowing it?</li>
      </ul>
      ${btn('Open Dashboard', 'https://app.riskmatrixlabs.com')}
      ${p('Operate with discipline. That\'s the whole game.')}
    `, { marketing: true }),
  })
}

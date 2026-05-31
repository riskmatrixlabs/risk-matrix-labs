import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = 'Risk Matrix Labs <hello@riskmatrixlabs.com>'

const BASE = `
  background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;
  max-width:560px;margin:0 auto;padding:0;
`
const NEON = '#BDFF00'

function shell(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="${BASE}">
  <tr><td style="border-top:3px solid ${NEON};padding:32px 36px 0;">
    <img src="https://www.riskmatrixlabs.com/brand/logo-dashboard.png" height="44" alt="Risk Matrix Labs" style="display:block;margin-bottom:24px;" />
  </td></tr>
  <tr><td style="padding:0 36px 36px;">${content}</td></tr>
  <tr><td style="padding:20px 36px 32px;border-top:1px solid #1e1e1e;">
    <p style="margin:0;font-size:11px;color:#444;letter-spacing:0.06em;">
      Risk Matrix Labs · <a href="https://riskmatrixlabs.com" style="color:#444;">riskmatrixlabs.com</a>
    </p>
    <p style="margin:6px 0 0;font-size:10px;color:#333;letter-spacing:0.08em;text-transform:uppercase;">Operate With Discipline</p>
  </td></tr>
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
      ${p('Your <strong style="color:#fff;">Risk Matrix Dashboard</strong> is ready. You now have access to the PHLT™ Bankroll Ladder Tracker, discipline scoring, analytics, and every tool built for operators who take the long game seriously.')}
      ${p('Here\'s how to get started in the first 5 minutes:')}
      <ol style="color:#aaa;font-size:14px;line-height:2;padding-left:18px;margin:12px 0;">
        <li>Set your starting bankroll in the dashboard header</li>
        <li>Log your first bet → Bet Log → LOG BET</li>
        <li>Run your first PHLT™ Ladder session</li>
        <li>Check your discipline score after each session</li>
      </ol>
      ${btn('Open Dashboard', 'https://www.riskmatrixlabs.com')}
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
      ${btn('Subscribe Now', 'https://www.riskmatrixlabs.com')}
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
      ${btn('Update Payment Method', 'https://www.riskmatrixlabs.com')}
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
      ${p(`Your <strong style="color:#fff;">${plan}</strong> subscription is now active. Full dashboard access, PHLT™ Ladder, analytics, and everything else — no limits.`)}
      ${p('Manage your billing, update your plan, or cancel anytime from inside the dashboard → click your username → Manage Billing.')}
      ${btn('Open Dashboard', 'https://www.riskmatrixlabs.com')}
      ${p('Appreciate you. Now go operate with discipline.')}
    `),
  })
}

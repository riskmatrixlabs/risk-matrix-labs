const NEON = '#BDFF00'
const BG   = '#0A0A0A'
const R    = "'Rajdhani', sans-serif"
const I    = "'Inter', sans-serif"

const EFFECTIVE = 'June 4, 2026'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: '40px' }}>
    <h2 style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', color: NEON, textTransform: 'uppercase', marginBottom: '14px' }}>{title}</h2>
    <div style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.85 }}>{children}</div>
  </div>
)

const P = ({ children }) => <p style={{ marginBottom: '12px' }}>{children}</p>

const UL = ({ items }) => (
  <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
    {items.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}
  </ul>
)

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#e0e0e0' }}>
      {/* Nav */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 40px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = NEON}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >← Back</button>
        <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>RISK MATRIX LABS</div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 40px 100px' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '12px' }}>Legal</div>
          <h1 style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', marginBottom: '12px' }}>Privacy Policy</h1>
          <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Effective Date: {EFFECTIVE} · Risk Matrix Labs LLC</div>
        </div>

        <Section title="1. Who We Are">
          <P>Risk Matrix Labs LLC ("Risk Matrix Labs," "we," "us," or "our") operates the website riskmatrixlabs.com and the web application app.riskmatrixlabs.com (collectively, the "Service"). We are based in the United States.</P>
          <P>Questions about this Privacy Policy can be directed to: <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a></P>
        </Section>

        <Section title="2. Information We Collect">
          <P><strong style={{ color: '#fff' }}>Information you provide directly:</strong></P>
          <UL items={[
            'Account information: email address and password when you create an account',
            'Bet log data: bet details you enter including sport, book, odds, stake, units, and result',
            'Session and bankroll data: starting bankroll, session notes, ladder settings, and risk preferences',
            'Payment information: processed by Stripe — we do not store your card number or banking details',
            'Communications: emails or messages you send to us',
          ]} />
          <P><strong style={{ color: '#fff' }}>Information collected automatically:</strong></P>
          <UL items={[
            'Usage data: pages visited, features used, and time spent in the app',
            'Device data: browser type, operating system, and device type',
            'IP address and general location (country/region level)',
            'Cookies and similar tracking technologies (see Section 6)',
          ]} />
        </Section>

        <Section title="3. How We Use Your Information">
          <P>We use the information we collect to:</P>
          <UL items={[
            'Provide, operate, and improve the Service',
            'Process your subscription and manage billing through Stripe',
            'Sync your data across devices and maintain your account',
            'Send transactional emails (trial reminders, billing notices, account alerts)',
            'Respond to your support requests',
            'Analyze aggregate usage to improve features and fix bugs',
            'Comply with legal obligations',
          ]} />
          <P>We do not use your bet log data to provide gambling advice, picks, or recommendations of any kind. The Service is a bankroll simulation and management tool — not a gambling service.</P>
        </Section>

        <Section title="4. Legal Basis for Processing (GDPR)">
          <P>If you are located in the European Economic Area (EEA) or United Kingdom, we process your personal data under the following legal bases:</P>
          <UL items={[
            'Contract: processing necessary to provide the Service you have subscribed to',
            'Legitimate interests: improving the Service, preventing fraud, and ensuring security',
            'Legal obligation: complying with applicable laws and regulations',
            'Consent: where we have obtained your explicit consent (e.g., marketing emails)',
          ]} />
        </Section>

        <Section title="5. How We Share Your Information">
          <P>We do not sell your personal data. We share information only in the following circumstances:</P>
          <UL items={[
            'Service providers: Supabase (database and authentication), Stripe (payments), Vercel (hosting), and Google Analytics / Google Tag Manager (analytics) — each bound by data processing agreements',
            'Business transfers: if Risk Matrix Labs is acquired or merges, your data may transfer as part of that transaction',
            'Legal requirements: if required by law, regulation, court order, or to protect our legal rights',
            'With your consent: in any other circumstances with your explicit permission',
          ]} />
          <P>We do not share your individual bet data or performance data with any third party for advertising or marketing purposes.</P>
        </Section>

        <Section title="6. Cookies and Tracking">
          <P>We use cookies and similar technologies for:</P>
          <UL items={[
            'Authentication: keeping you logged in to your account',
            'Preferences: remembering your app settings and display preferences',
            'Analytics: understanding how users interact with the Service (Google Analytics)',
            'Marketing attribution: tracking referral sources via affiliate links (Rewardful)',
          ]} />
          <P>You can control cookies through your browser settings. Disabling cookies may affect your ability to log in or use certain features.</P>
        </Section>

        <Section title="7. Data Retention">
          <P>We retain your account data for as long as your account is active. If you cancel your subscription and delete your account, we will delete your personal data within 90 days, except where we are required to retain it for legal or regulatory purposes (e.g., billing records, which we retain for 7 years).</P>
          <P>You can request deletion of your data at any time by emailing <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a>.</P>
        </Section>

        <Section title="8. Your Rights">
          <P>Depending on your location, you may have the right to:</P>
          <UL items={[
            'Access: request a copy of the personal data we hold about you',
            'Correction: request that we correct inaccurate or incomplete data',
            'Deletion: request that we delete your personal data ("right to be forgotten")',
            'Portability: request your data in a machine-readable format',
            'Objection: object to certain processing activities',
            'Restriction: request that we limit how we process your data',
            'Opt-out of sale/sharing (CCPA): we do not sell or share personal data for cross-context behavioral advertising',
          ]} />
          <P>To exercise any of these rights, contact us at <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a>. We will respond within 30 days.</P>
        </Section>

        <Section title="9. Data Security">
          <P>We implement industry-standard security measures including encrypted data transmission (TLS), secure authentication via Supabase, and row-level security on all user data. However, no method of transmission over the internet is 100% secure. We encourage you to use a strong password and to contact us immediately if you suspect unauthorized access to your account.</P>
        </Section>

        <Section title="10. Children's Privacy">
          <P>The Service is not directed to individuals under the age of 18. We do not knowingly collect personal data from anyone under 18. If you believe we have inadvertently collected data from a minor, please contact us immediately and we will delete it.</P>
        </Section>

        <Section title="11. International Transfers">
          <P>Risk Matrix Labs is based in the United States. If you access the Service from outside the United States, your data may be transferred to and processed in the United States. We rely on Supabase's data processing agreement and standard contractual clauses for transfers of data from the EEA or United Kingdom.</P>
        </Section>

        <Section title="12. Third-Party Links">
          <P>The Service may contain links to third-party websites (e.g., sportsbook affiliates). We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.</P>
        </Section>

        <Section title="13. Changes to This Policy">
          <P>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice in the app at least 14 days before the change takes effect. Your continued use of the Service after the effective date constitutes acceptance of the updated policy.</P>
        </Section>

        <Section title="14. Contact Us">
          <P>If you have questions, concerns, or requests relating to this Privacy Policy:</P>
          <P>
            Risk Matrix Labs LLC<br />
            <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a>
          </P>
          <P style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            This Privacy Policy was drafted for informational purposes. Risk Matrix Labs recommends reviewing this document with qualified legal counsel before publishing.
          </P>
        </Section>
      </div>
    </div>
  )
}

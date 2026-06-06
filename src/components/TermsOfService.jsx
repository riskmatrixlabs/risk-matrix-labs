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

export default function TermsOfService({ onBack }) {
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
          <h1 style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', marginBottom: '12px' }}>Terms of Service</h1>
          <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Effective Date: {EFFECTIVE} · Risk Matrix Labs LLC</div>
        </div>

        <div style={{ background: 'rgba(189,255,0,0.05)', border: '1px solid rgba(189,255,0,0.2)', borderRadius: '4px', padding: '20px 24px', marginBottom: '40px', fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
          <strong style={{ color: NEON }}>Important:</strong> Risk Matrix Labs is a bankroll simulation and management tool designed for educational and organizational purposes. It is not a gambling service, does not provide picks or wagering advice, and does not facilitate or process any bets. By using the Service, you confirm that you understand and agree to use it solely for bankroll tracking and simulation purposes in compliance with all applicable laws in your jurisdiction.
        </div>

        <Section title="1. Acceptance of Terms">
          <P>By creating an account or using the Risk Matrix Labs Service (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.</P>
          <P>These Terms constitute a legally binding agreement between you and Risk Matrix Labs LLC, a United States limited liability company ("Risk Matrix Labs," "we," "us," or "our").</P>
        </Section>

        <Section title="2. Description of Service">
          <P>Risk Matrix Labs provides a web-based bankroll simulation and management platform. The Service includes tools for:</P>
          <UL items={[
            'Simulating bankroll growth under various unit sizes, win rates, and risk parameters',
            'Logging and tracking personal bet history for performance analysis',
            'Managing risk exposure through configurable limits and discipline tools',
            'Generating session grades and behavioral analytics based on your own data',
            'Running ladder and round robin simulations',
          ]} />
          <P><strong style={{ color: '#fff' }}>The Service is not a gambling service.</strong> Risk Matrix Labs does not take bets, facilitate wagering, provide picks, or offer gambling advice of any kind. All data entered into the Service reflects your personal records and is used solely for your own bankroll management and simulation purposes.</P>
        </Section>

        <Section title="3. Eligibility">
          <P>You must be at least 18 years of age to use the Service. By using the Service, you represent and warrant that you are 18 or older and that your use of the Service complies with all applicable laws in your jurisdiction.</P>
          <P>You are solely responsible for determining whether sports betting and related activities are legal in your jurisdiction. Risk Matrix Labs makes no representation that the Service or any activity it supports is lawful in your location.</P>
        </Section>

        <Section title="4. Accounts">
          <P>You must create an account to use the Service. You agree to provide accurate information and to keep it current. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</P>
          <P>You may not share your account with others or create accounts for third parties without their consent. Notify us immediately at <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a> if you suspect unauthorized access.</P>
        </Section>

        <Section title="5. Subscription and Billing">
          <P><strong style={{ color: '#fff' }}>Free Trial:</strong> New subscribers receive a 3-day free trial. Your payment method will not be charged until the trial period ends. You will receive an email reminder before your trial expires. You may cancel at any time during the trial period at no charge.</P>
          <P><strong style={{ color: '#fff' }}>Subscription Plans:</strong></P>
          <UL items={[
            'Operator: $19/month or ~$149/year',
            'Operator Pro: $29/month or ~$229/year',
          ]} />
          <P><strong style={{ color: '#fff' }}>Auto-Renewal:</strong> Subscriptions automatically renew at the end of each billing period at the then-current rate. You authorize Risk Matrix Labs to charge your payment method on file. To cancel, log in to your account settings or email us at <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a> before the renewal date.</P>
          <P><strong style={{ color: '#fff' }}>Refunds:</strong> Subscription fees are non-refundable except where required by applicable law. If you cancel, you retain access to the Service through the end of your paid billing period.</P>
          <P>All payments are processed by Stripe. By subscribing, you agree to Stripe's terms of service. Risk Matrix Labs does not store your payment card details.</P>
        </Section>

        <Section title="6. Acceptable Use">
          <P>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</P>
          <UL items={[
            'Use the Service to facilitate any illegal activity',
            'Attempt to gain unauthorized access to any part of the Service or its infrastructure',
            'Reverse engineer, decompile, or attempt to extract the source code of the Service',
            'Use automated tools (bots, scrapers) to access or collect data from the Service',
            'Sell, resell, or sublicense access to the Service without our written permission',
            'Upload or transmit malware, spam, or any content that violates third-party rights',
            'Misrepresent your identity or affiliation',
          ]} />
        </Section>

        <Section title="7. Your Data">
          <P>You retain ownership of all data you enter into the Service (your bet logs, bankroll data, and session records). By using the Service, you grant Risk Matrix Labs a limited, non-exclusive license to store, process, and display your data solely for the purpose of providing the Service to you.</P>
          <P>We do not sell your data. See our <a href="/privacy" style={{ color: NEON, textDecoration: 'none' }}>Privacy Policy</a> for full details on how we handle your information.</P>
          <P>You can export or request deletion of your data at any time.</P>
        </Section>

        <Section title="8. Intellectual Property">
          <P>The Service, including its design, code, features, brand marks, and content (excluding your user data), is owned by Risk Matrix Labs and protected by intellectual property laws. Nothing in these Terms grants you any right to use our trademarks, logos, or brand assets without prior written permission.</P>
          <P>PHLT™ and Discipline Score™ are trademarks of Risk Matrix Labs LLC.</P>
        </Section>

        <Section title="9. Disclaimers">
          <P><strong style={{ color: '#fff' }}>No Gambling Advice.</strong> The Service is a simulation and management tool. Nothing in the Service constitutes gambling advice, a recommendation to place any bet, or a guarantee of any outcome. Past simulated performance does not guarantee future results.</P>
          <P><strong style={{ color: '#fff' }}>No Warranty.</strong> The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses.</P>
          <P><strong style={{ color: '#fff' }}>Results Disclaimer.</strong> Individual results using the Service will vary. Risk Matrix Labs makes no representation that using the Service will improve your betting outcomes or financial results.</P>
        </Section>

        <Section title="10. Limitation of Liability">
          <P>To the fullest extent permitted by applicable law, Risk Matrix Labs shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising out of or in connection with your use of the Service.</P>
          <P>Our total liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed the greater of (a) the amount you paid to us in the 12 months preceding the claim, or (b) $100.</P>
        </Section>

        <Section title="11. Indemnification">
          <P>You agree to indemnify and hold harmless Risk Matrix Labs, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising out of your use of the Service, your violation of these Terms, or your violation of any applicable law.</P>
        </Section>

        <Section title="12. Termination">
          <P>You may cancel your account at any time through your account settings or by contacting us. We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or for any other reason at our sole discretion, with or without notice.</P>
          <P>Upon termination, your right to access the Service ceases immediately. We will retain your data for 90 days following termination, after which it will be permanently deleted unless we are required to retain it by law.</P>
        </Section>

        <Section title="13. Governing Law and Disputes">
          <P>These Terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of laws provisions.</P>
          <P>Any dispute arising out of or relating to these Terms or the Service shall first be subject to good-faith negotiation between the parties. If unresolved, disputes shall be resolved through binding arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, unless you opt out of arbitration by emailing us within 30 days of account creation.</P>
          <P>You waive any right to participate in a class action lawsuit or class-wide arbitration.</P>
        </Section>

        <Section title="14. Changes to These Terms">
          <P>We may update these Terms from time to time. We will notify you of material changes by email or in-app notice at least 14 days before the change takes effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms.</P>
        </Section>

        <Section title="15. Contact">
          <P>Questions about these Terms? Contact us at:</P>
          <P>
            Risk Matrix Labs LLC<br />
            <a href="mailto:hello@riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>hello@riskmatrixlabs.com</a>
          </P>
          <P style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            These Terms were drafted for informational purposes. Risk Matrix Labs recommends reviewing this document with qualified legal counsel before publishing.
          </P>
        </Section>
      </div>
    </div>
  )
}

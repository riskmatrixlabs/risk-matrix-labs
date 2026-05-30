import './LandingPage.css'

export default function LandingPage({ onLogin }) {
  return (
    <div className="rml2">

      {/* HEADER */}
      <header className="rml2-header">
        <div className="rml2-shell rml2-nav">
          <a href="/" className="rml2-brand">
            <img src="/brand/logo-labs.png" alt="Risk Matrix Labs" />
            <div className="rml2-brand-text">
              <strong>RISK MATRIX</strong>
              <span>LABS</span>
            </div>
          </a>

          <nav className="rml2-menu">
            <a href="#dashboard">Dashboard</a>
            <a href="#systems">Features</a>
            <a href="#access">Waitlist</a>
            <a href="mailto:support@riskmatrixlabs.com">Contact</a>
          </nav>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="rml2-login-btn" onClick={onLogin}>Log In</button>
            <a href="#access" className="rml2-btn">Join Waitlist →</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="rml2-hero">
        <div className="rml2-shell rml2-hero-grid">
          <div>
            <div className="rml2-kicker">DISCIPLINE TODAY. FREEDOM TOMORROW.</div>

            <h1>
              THE DASHBOARD<br />
              BUILT FOR<br />
              <span className="rml2-green">DISCIPLINED OPERATORS.</span>
            </h1>

            <p>
              Risk Matrix Dashboard combines risk management, behavioral analytics,
              and performance tracking into one terminal-style command center.
            </p>

            <div className="rml2-actions">
              <a href="#access" className="rml2-btn">Join Early Waitlist</a>
              <button className="rml2-btn rml2-btn-outline" onClick={onLogin}>Open Dashboard →</button>
            </div>

            <div className="rml2-proof">
              <div className="rml2-proof-bubbles">
                <span /><span /><span /><span />
              </div>
              <div>Join early access for<br /><span className="rml2-green">founder pricing.</span></div>
            </div>
          </div>

          <div className="rml2-visual">
            <img src="/brand/dashboard-v2.png" alt="Risk Matrix Dashboard" />
          </div>
        </div>
      </section>

      {/* CORE SYSTEMS */}
      <section className="rml2-section" id="systems">
        <div className="rml2-shell">
          <div className="rml2-title">
            <span>CORE SYSTEMS</span>
            <h2>Everything You Need To Operate With Discipline.</h2>
          </div>

          <div className="rml2-grid4">
            <div className="rml2-card">
              <div className="rml2-num">01</div>
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.4 8.5-7 10-3.6-1.5-7-5-7-10V6l7-3z" /></svg>
              </div>
              <h3>Risk Engine</h3>
              <p>Exposure tracking, bankroll limits, and structured risk controls.</p>
            </div>

            <div className="rml2-card">
              <div className="rml2-num">02</div>
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
              </div>
              <h3>Session Discipline</h3>
              <p>Behavior analysis, emotional tracking, and review systems.</p>
            </div>

            <div className="rml2-card">
              <div className="rml2-num">03</div>
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><path d="M5 19V9M10 19V5M15 19v-8M20 19V7" /></svg>
              </div>
              <h3>Performance Grade</h3>
              <p>ROI analytics, grading models, and long-term data visibility.</p>
            </div>

            <div className="rml2-card">
              <div className="rml2-num">04</div>
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z" /><path d="M8 9l3 3-3 3M13 15h4" /></svg>
              </div>
              <h3>Dashboard Systems</h3>
              <p>Terminal-inspired workflows built for disciplined operators.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD SHOWCASE */}
      <section className="rml2-section" id="dashboard">
        <div className="rml2-shell rml2-control">
          <div className="rml2-copy">
            <span>RISK MATRIX DASHBOARD™</span>
            <h2>Built Like A Control Center.</h2>
            <p>A terminal-style dashboard for tracking performance, managing exposure, reviewing decisions, and keeping every session disciplined.</p>
            <div style={{ marginTop: '24px' }}>
              <button className="rml2-btn" onClick={onLogin}>Open Dashboard →</button>
            </div>
          </div>

          <div className="rml2-visual">
            <img src="/brand/dashboard-v2.png" alt="Dashboard Preview" />
          </div>
        </div>
      </section>

      {/* OPERATOR SYSTEMS */}
      <section className="rml2-section">
        <div className="rml2-shell">
          <div className="rml2-title">
            <span>OPERATOR SYSTEMS</span>
            <h2>Everything Built For Discipline.</h2>
          </div>

          <div className="rml2-grid3">
            <div className="rml2-card">
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg>
              </div>
              <h3>Session Tracking</h3>
              <p>Log every session, track decisions, and build structured reviews over time.</p>
            </div>

            <div className="rml2-card">
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v8c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" /></svg>
              </div>
              <h3>Risk Management</h3>
              <p>Monitor exposure, unit sizing, operational limits, and risk controls in real time.</p>
            </div>

            <div className="rml2-card">
              <div className="rml2-icon">
                <svg viewBox="0 0 24 24"><path d="M12 3v9h9" /><circle cx="12" cy="12" r="9" /></svg>
              </div>
              <h3>Performance Analytics</h3>
              <p>Analyze ROI, behavior trends, win rates, and execution quality across sessions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section className="rml2-section" id="access">
        <div className="rml2-shell rml2-access">
          <div className="rml2-copy">
            <span>FOUNDER ACCESS</span>
            <h2>Request Early Access.</h2>
            <p>Risk Matrix Dashboard™ is currently in MVP development. Join the early access list for beta access, launch updates, and founder pricing.</p>

            <div className="rml2-mini">
              <div><b>✉</b><strong>Early Access</strong><small>Be the first to get inside.</small></div>
              <div><b>◇</b><strong>Founder Pricing</strong><small>Lock in special launch pricing.</small></div>
              <div><b>▣</b><strong>Private Updates</strong><small>Get development updates.</small></div>
            </div>
          </div>

          <form
            className="rml2-form"
            action="https://formsubmit.co/support@riskmatrixlabs.com"
            method="POST"
          >
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_subject" value="New Risk Matrix Labs Waitlist Signup" />
            <label className="rml2-field">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" />
              </svg>
              <input type="email" name="email" placeholder="Enter your email address..." required />
            </label>
            <button type="submit">Join Waitlist →</button>
            <p className="rml2-note">▣ We respect your privacy. No spam, ever.</p>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="rml2-footer">
        <div className="rml2-shell">
          <div className="rml2-footer-top">
            <a href="/" className="rml2-brand">
              <img src="/brand/logo-labs.png" alt="Risk Matrix Labs" />
              <div className="rml2-brand-text">
                <strong>RISK MATRIX</strong>
                <span>LABS</span>
              </div>
            </a>

            <div className="rml2-footer-links">
              <a href="#dashboard">Dashboard</a>
              <a href="#systems">Features</a>
              <a href="#access">Waitlist</a>
              <a href="mailto:support@riskmatrixlabs.com">Contact</a>
            </div>

            <div className="rml2-socials">
              <a href="#" aria-label="X">𝕏</a>
              <a href="#" aria-label="Discord">◎</a>
              <a href="mailto:support@riskmatrixlabs.com" aria-label="Email">✉</a>
            </div>
          </div>

          <div className="rml2-footer-bottom">
            <p>© 2026 Risk Matrix Labs™. Operate With Discipline.</p>
            <p>support@riskmatrixlabs.com</p>
          </div>
        </div>
      </footer>

    </div>
  )
}

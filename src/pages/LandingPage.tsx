export function LandingPage() {
  return (
    <div className="ld">

      {/* ── NAV ── */}
      <nav className="ld-nav">
        <a href="/" className="ld-nav-logo">
          <picture>
            <source srcSet="/invairo_logo_h_dark.png" media="(prefers-color-scheme: light)" />
            <img src="/invairo_logo_h_white.png" alt="Invairo" className="ld-nav-logo-img" />
          </picture>
        </a>
        <div className="ld-nav-links">
          <a href="/login" className="ld-nav-link">Log in</a>
          <a href="/register" className="ld-btn-primary ld-btn-sm">Sign up</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="ld-hero">
        <div className="ld-hero-glow" />
        <div className="ld-container">
          <div className="ld-hero-inner">
            <div className="ld-hero-text">
              <span className="ld-badge">✦ 30-day free trial · No card required</span>
              <h1 className="ld-hero-title">
                Track Time.<br />
                Send Invoices.<br />
                <span className="ld-gradient-text">All from Your Phone.</span>
              </h1>
              <p className="ld-hero-sub">
                The simplest way for freelancers and contractors to log hours
                and create professional invoices — no desktop required.
              </p>
              <div className="ld-hero-actions">
                <a href="/register" className="ld-btn-primary">Start free trial →</a>
                <a href="#pricing" className="ld-btn-ghost">See pricing</a>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="ld-phone-wrap">
              <div className="ld-phone">
                <div className="ld-phone-notch" />
                <div className="ld-phone-screen">
                  <div className="ld-phone-header">
                    <span className="ld-phone-title">Today</span>
                    <span className="ld-phone-date">Mon 21 Feb</span>
                  </div>
                  <div className="ld-phone-shifts">
                    <div className="ld-phone-shift">
                      <span className="ld-phone-dot ld-phone-dot--blue" />
                      <div className="ld-phone-shift-info">
                        <span className="ld-phone-shift-name">Acme Corp</span>
                        <span className="ld-phone-shift-time">09:00 – 17:00</span>
                      </div>
                      <span className="ld-phone-shift-earn">$320</span>
                    </div>
                    <div className="ld-phone-shift">
                      <span className="ld-phone-dot ld-phone-dot--purple" />
                      <div className="ld-phone-shift-info">
                        <span className="ld-phone-shift-name">Startup XYZ</span>
                        <span className="ld-phone-shift-time">18:00 – 21:00</span>
                      </div>
                      <span className="ld-phone-shift-earn">$150</span>
                    </div>
                    <div className="ld-phone-shift ld-phone-shift--active">
                      <span className="ld-phone-dot ld-phone-dot--green" />
                      <div className="ld-phone-shift-info">
                        <span className="ld-phone-shift-name">Freelance job</span>
                        <span className="ld-phone-shift-time">22:00 – now</span>
                      </div>
                      <span className="ld-phone-shift-earn ld-phone-earn--live">● live</span>
                    </div>
                  </div>
                  <div className="ld-phone-total">
                    <span className="ld-phone-total-label">Earned today</span>
                    <span className="ld-phone-total-amount">$470</span>
                  </div>
                  <button className="ld-phone-add-btn">+ Add shift</button>
                  <div className="ld-phone-invoice-row">
                    <span className="ld-phone-invoice-icon">📄</span>
                    <span className="ld-phone-invoice-text">Invoice ready · Feb 2026</span>
                    <span className="ld-phone-invoice-link">Export PDF</span>
                  </div>
                </div>
              </div>
              <div className="ld-phone-glow-ring" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="ld-section" id="features">
        <div className="ld-container">
          <div className="ld-section-label">Why TimeTracker</div>
          <h2 className="ld-section-title">Everything you need. Nothing you don't.</h2>
          <div className="ld-features-grid">
            {[
              { icon: '📱', title: 'Built for mobile', desc: 'Log a shift in under 10 seconds from your pocket. Works perfectly on any smartphone.' },
              { icon: '⚡', title: 'Fast time entry', desc: 'Pick a client, set start & end time, save. No bloated forms, no confusion.' },
              { icon: '📄', title: 'Pro PDF invoices', desc: 'Generate a professional invoice with your logo and rates in a single tap. Ready to send.' },
              { icon: '📊', title: 'Weekly & monthly totals', desc: 'See exactly how much you earned this week, this month, and with each client.' },
              { icon: '👥', title: 'Multiple clients', desc: 'Track hours across as many clients as you need. Keep everything organised in one place.' },
              { icon: '🔒', title: 'Your data, always safe', desc: 'Secured with JWT auth and encrypted cloud storage. Your data belongs to you.' },
            ].map(f => (
              <div key={f.title} className="ld-feature-card">
                <div className="ld-feature-icon">{f.icon}</div>
                <h3 className="ld-feature-title">{f.title}</h3>
                <p className="ld-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="ld-section ld-section--alt">
        <div className="ld-container">
          <div className="ld-section-label">How it works</div>
          <h2 className="ld-section-title">Up and running in minutes</h2>
          <div className="ld-steps">
            {[
              { n: '01', title: 'Create your account', desc: 'Sign up in 30 seconds. No credit card, no commitment.' },
              { n: '02', title: 'Add clients & log hours', desc: 'Create your first client, set your hourly rate, and start logging shifts from your phone.' },
              { n: '03', title: 'Generate & send invoices', desc: 'When payday comes, tap "Generate Invoice" and send a professional PDF in seconds.' },
            ].map(s => (
              <div key={s.n} className="ld-step">
                <div className="ld-step-num">{s.n}</div>
                <div className="ld-step-body">
                  <h3 className="ld-step-title">{s.title}</h3>
                  <p className="ld-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="ld-section" id="pricing">
        <div className="ld-container">
          <div className="ld-section-label">Pricing</div>
          <h2 className="ld-section-title">Simple, honest pricing</h2>
          <p className="ld-section-sub">Start free for 30 days. No credit card required.</p>
          <div className="ld-pricing-grid">

            <div className="ld-price-card">
              <div className="ld-price-plan">Free Trial</div>
              <div className="ld-price-amount"><span className="ld-price-num">$0</span><span className="ld-price-per"> / 30 days</span></div>
              <ul className="ld-price-features">
                <li>✓ 1 client</li>
                <li>✓ 1 product</li>
                <li>✓ Unlimited shifts</li>
                <li>✓ Invoice generation</li>
                <li>✓ PDF export</li>
              </ul>
              <a href="/register" className="ld-btn-ghost ld-btn-full">Start free trial</a>
            </div>

            <div className="ld-price-card ld-price-card--featured">
              <div className="ld-price-badge">Most popular</div>
              <div className="ld-price-plan">Solo</div>
              <div className="ld-price-amount"><span className="ld-price-num">$5</span><span className="ld-price-per"> AUD / month (incl. GST)</span></div>
              <ul className="ld-price-features">
                <li>✓ 1 client / contractor</li>
                <li>✓ 1 product</li>
                <li>✓ Unlimited shifts</li>
                <li>✓ Invoice generation</li>
                <li>✓ PDF export</li>
              </ul>
              <a href="/register" className="ld-btn-primary ld-btn-full">Get Solo →</a>
              <p className="ld-price-renewal">Renews automatically. Cancel anytime.</p>
            </div>

            <div className="ld-price-card">
              <div className="ld-price-plan">Pro</div>
              <div className="ld-price-amount"><span className="ld-price-num">$10</span><span className="ld-price-per"> AUD / month (incl. GST)</span></div>
              <ul className="ld-price-features">
                <li>✓ Unlimited clients</li>
                <li>✓ Unlimited products</li>
                <li>✓ Unlimited shifts</li>
                <li>✓ Invoice generation</li>
                <li>✓ PDF export</li>
                <li>✓ Priority support</li>
              </ul>
              <a href="/register" className="ld-btn-ghost ld-btn-full">Get Pro</a>
              <p className="ld-price-renewal">Renews automatically. Cancel anytime.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECURE PAYMENTS ── */}
      <section className="ld-section ld-section--alt">
        <div className="ld-container">
          <div className="ld-section-label">Payments &amp; Security</div>
          <h2 className="ld-section-title">Your payment is always safe</h2>
          <p className="ld-section-sub">We use Stripe — the same payment infrastructure trusted by Amazon, Google, and millions of businesses worldwide.</p>
          <div className="ld-features-grid">
            {[
              { icon: '🔐', title: 'SSL encrypted', desc: 'All data is transmitted over HTTPS. Your payment information is fully encrypted end-to-end.' },
              { icon: '🏦', title: 'No card data stored', desc: 'Your card details go directly to Stripe. We never see, touch, or store your payment information.' },
              { icon: '🛡️', title: 'PCI DSS compliant', desc: 'Stripe is certified to PCI Level 1 — the highest global standard for payment security.' },
            ].map(f => (
              <div key={f.title} className="ld-feature-card">
                <div className="ld-feature-icon">{f.icon}</div>
                <h3 className="ld-feature-title">{f.title}</h3>
                <p className="ld-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="ld-stripe-badge">
            <span className="ld-stripe-badge-text">Payments secured by</span>
            <span className="ld-stripe-badge-logo">stripe</span>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="ld-cta-bottom">
        <div className="ld-cta-glow" />
        <div className="ld-container ld-cta-inner">
          <h2 className="ld-cta-title">Ready to get paid on time?</h2>
          <p className="ld-cta-sub">Join freelancers who use TimeTracker to stay organised and invoice like a pro.</p>
          <a href="/register" className="ld-btn-primary ld-btn-lg">Create free account →</a>
          <p className="ld-cta-hint">30-day free trial · Cancel anytime · No credit card</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ld-footer">
        <div className="ld-container ld-footer-inner">
          <picture>
            <source srcSet="/invairo_logo_h_dark.png" media="(prefers-color-scheme: light)" />
            <img src="/invairo_logo_h_white.png" alt="Invairo" className="ld-footer-logo" />
          </picture>
          <div className="ld-footer-links">
            <a href="/login">Log in</a>
            <a href="/register">Sign up</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/refund">Refund Policy</a>
          </div>
          <p className="ld-footer-copy">© {new Date().getFullYear()} Invairo. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}

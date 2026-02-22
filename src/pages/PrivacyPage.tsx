export function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <a href="/" className="legal-back">← Back to home</a>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-meta">Last updated: 21 February 2026</p>

        <div className="legal-body">
          <p>
            TimeTracker ("we", "us", "our") is committed to protecting your personal information in
            accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
            This Privacy Policy explains what information we collect, how we use it, and your rights.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We collect the following personal information when you use the Service:</p>
          <ul>
            <li><strong>Account data</strong> — email address and password (hashed)</li>
            <li><strong>Work data</strong> — client names, hourly rates, shift start/end times you record</li>
            <li><strong>Invoice data</strong> — invoice contents you generate within the app</li>
            <li><strong>Billing data</strong> — subscription plan and billing status (payment details are handled directly by Stripe and never stored by us)</li>
            <li><strong>Usage data</strong> — server logs including IP address and browser type, retained for up to 90 days</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain the Service</li>
            <li>Process subscription payments via Stripe</li>
            <li>Send transactional emails (account confirmation, billing receipts)</li>
            <li>Respond to your support requests</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>

          <h2>3. Third-Party Services</h2>
          <p>We share information with the following trusted third parties solely to operate the Service:</p>
          <ul>
            <li>
              <strong>Stripe</strong> — payment processing. Stripe collects and stores your payment card details
              under its own{' '}
              <a href="https://stripe.com/au/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </li>
            <li>
              <strong>Render</strong> — cloud hosting and database. Your data is stored on Render's
              infrastructure in the United States. Render maintains appropriate data protection safeguards.
            </li>
          </ul>

          <h2>4. Overseas Disclosure</h2>
          <p>
            Your data is stored on servers located in the United States (Render). Before disclosing
            personal information overseas, we take reasonable steps to ensure overseas recipients handle
            it consistently with the APPs. By using the Service, you consent to this transfer.
          </p>

          <h2>5. Data Security</h2>
          <p>
            We use industry-standard measures to protect your data, including encrypted HTTPS connections,
            hashed passwords, and access controls. No method of transmission over the internet is 100%
            secure; in the event of a data breach we will notify you as required by the{' '}
            <em>Notifiable Data Breaches scheme</em>.
          </p>

          <h2>6. Your Rights</h2>
          <p>Under the Privacy Act 1988 you have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal information we hold about you</li>
            <li><strong>Correction</strong> — ask us to correct inaccurate or out-of-date information</li>
            <li><strong>Deletion</strong> — request deletion of your account and associated data</li>
          </ul>
          <p>
            To exercise these rights, email us at{' '}
            <a href="mailto:privacy@timetracker.app">privacy@timetracker.app</a>. We will respond within
            30 days.
          </p>

          <h2>7. Cookies</h2>
          <p>
            The Service uses only a session token stored in <code>localStorage</code> to keep you logged in.
            We do not use tracking cookies or advertising cookies.
          </p>

          <h2>8. Children</h2>
          <p>
            The Service is not directed at children under 18. We do not knowingly collect personal
            information from anyone under 18.
          </p>

          <h2>9. Complaints</h2>
          <p>
            If you believe we have mishandled your personal information, please contact us first at{' '}
            <a href="mailto:privacy@timetracker.app">privacy@timetracker.app</a>. If you are not satisfied
            with our response, you may lodge a complaint with the{' '}
            <a href="https://www.oaic.gov.au/privacy/privacy-complaints" target="_blank" rel="noreferrer">
              Office of the Australian Information Commissioner (OAIC)
            </a>.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you by email of material
            changes at least 14 days before they take effect.
          </p>

          <h2>11. Contact</h2>
          <p>
            Privacy enquiries:{' '}
            <a href="mailto:privacy@timetracker.app">privacy@timetracker.app</a>
          </p>
        </div>
      </div>
    </div>
  )
}

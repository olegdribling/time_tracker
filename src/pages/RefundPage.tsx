export function RefundPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <a href="/" className="legal-back">← Back to home</a>
        <h1 className="legal-title">Refund Policy</h1>
        <p className="legal-meta">Last updated: 21 February 2026</p>

        <div className="legal-body">
          <p>
            This Refund Policy applies to all paid subscriptions for TimeTracker ("Service").
            Your rights under the <em>Australian Consumer Law</em> (ACL) are not affected by this policy.
          </p>

          <h2>1. Free Trial</h2>
          <p>
            All new accounts receive a 30-day free trial. No payment is taken during the trial period.
            If you cancel before the trial ends, you will not be charged.
          </p>

          <h2>2. Subscription Cancellation</h2>
          <p>
            You can cancel your subscription at any time from the Subscription page inside the app.
            Upon cancellation:
          </p>
          <ul>
            <li>Your subscription will not renew at the next billing date.</li>
            <li>You retain full access to the Service until the end of your current paid period.</li>
            <li>No partial-month refunds are issued for unused days in the current period.</li>
          </ul>

          <h2>3. Refunds for Service Failure</h2>
          <p>
            We will provide a refund or credit if:
          </p>
          <ul>
            <li>The Service is unavailable for more than 48 consecutive hours due to our fault, or</li>
            <li>A major failure of the Service occurs and cannot be remedied within a reasonable time.</li>
          </ul>
          <p>
            Refunds for service failures will be calculated on a pro-rata basis for the affected period.
          </p>

          <h2>4. Duplicate or Erroneous Charges</h2>
          <p>
            If you believe you have been charged in error or charged twice, contact us within 30 days
            of the charge. We will investigate and issue a full refund if the charge was made in error.
          </p>

          <h2>5. Australian Consumer Law Guarantees</h2>
          <p>
            Nothing in this policy limits your rights under the Australian Consumer Law. Under the ACL,
            consumers are entitled to a remedy (repair, replacement, or refund) if a service fails to
            meet a consumer guarantee. If you believe the Service has not met the statutory guarantees,
            please contact us to discuss your options.
          </p>

          <h2>6. How to Request a Refund</h2>
          <p>
            Email <a href="mailto:support@timetracker.app">support@timetracker.app</a> with:
          </p>
          <ul>
            <li>Your account email address</li>
            <li>The date and amount of the charge</li>
            <li>The reason for your refund request</li>
          </ul>
          <p>
            We will respond within 5 business days. Approved refunds are processed back to your
            original payment method within 5–10 business days.
          </p>

          <h2>7. Contact</h2>
          <p>
            Refund enquiries:{' '}
            <a href="mailto:support@timetracker.app">support@timetracker.app</a>
          </p>
        </div>
      </div>
    </div>
  )
}

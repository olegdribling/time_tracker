export function LandingPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>TimeTracker</div>
        <nav style={{ display: 'flex', gap: 12 }}>
          <a href="/login">Log in</a>
          <a href="/register">Registration</a>
        </nav>
      </header>

      <main style={{ marginTop: 48 }}>
        <h1 style={{ margin: 0 }}>Track time. Create invoices. All from your phone.</h1>
        <p style={{ marginTop: 12, lineHeight: 1.5 }}>
          Mobile-first time tracking with simple invoices. No computer needed.
        </p>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <a href="/register">Get started</a>
          <a href="/login">Log in</a>
        </div>

        <section style={{ marginTop: 40 }}>
          <ul>
            <li>Fast time entry</li>
            <li>Weekly/monthly totals</li>
            <li>Invoice PDF export</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

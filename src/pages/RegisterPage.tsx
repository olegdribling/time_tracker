import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleRegister = async () => {
    setError('')
    const data = await api.register(email, password)
    if (data.error) return setError(data.error)
    localStorage.setItem('tt_token', data.token)
    localStorage.setItem('tt_auth', '1')
    navigate('/app')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRegister()
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <picture className="auth-logo-wrap">
          <source srcSet="/tt_logo_dark.png" media="(prefers-color-scheme: dark)" />
          <img src="/tt_logo_light.png" alt="TimeTracker" className="auth-logo-img" />
        </picture>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start tracking your work time</p>

        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input
            className="auth-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn" onClick={handleRegister}>Create account</button>

        <p className="auth-consent">
          By creating an account you agree to our{' '}
          <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
        </p>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

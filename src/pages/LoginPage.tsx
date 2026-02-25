import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    const data = await api.login(email, password)
    if (data.error) return setError(data.error)
    localStorage.setItem('tt_token', data.token)
    localStorage.setItem('tt_refresh_token', data.refreshToken)
    localStorage.setItem('tt_auth', '1')
    navigate('/app')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <picture className="auth-logo-wrap">
          <source srcSet="/tt_logo_dark.png" media="(prefers-color-scheme: dark)" />
          <img src="/tt_logo_light.png" alt="TimeTracker" className="auth-logo-img" />
        </picture>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input
            className="auth-input"
            type="email"
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
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn" onClick={handleLogin}>Sign in</button>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}

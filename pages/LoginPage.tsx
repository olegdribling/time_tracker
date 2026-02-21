import { useNavigate } from "react-router-dom"

export function LoginPage() {
  const navigate = useNavigate()

  const loginMock = () => {
    localStorage.setItem("tt_auth", "1")
    navigate("/app")
  }

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h2>Log in</h2>
      <p style={{ opacity: 0.8 }}>MVP mock login (backend/auth later).</p>
      <button onClick={loginMock}>Continue</button>
      <div style={{ marginTop: 12 }}>
        <a href="/register">Registration</a>
      </div>
    </div>
  )
}

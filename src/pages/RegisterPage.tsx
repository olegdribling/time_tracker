import { useNavigate } from "react-router-dom"

export function RegisterPage() {
  const navigate = useNavigate()

  const registerMock = () => {
    localStorage.setItem("tt_auth", "1")
    navigate("/app")
  }

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h2>Registration</h2>
      <p style={{ opacity: 0.8 }}>MVP mock registration (backend/auth later).</p>
      <button onClick={registerMock}>Create account</button>
      <div style={{ marginTop: 12 }}>
        <a href="/login">Log in</a>
      </div>
    </div>
  )
}

import { Navigate } from "react-router-dom"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem("tt_auth") === "1"
  if (!isAuth) return <Navigate to="/login" replace />
  return children
}

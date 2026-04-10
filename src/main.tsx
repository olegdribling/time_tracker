import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import "./index.css"

import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { AppPage } from "./pages/AppPage"
import { BillingPage } from "./pages/BillingPage"
import { TermsPage } from "./pages/TermsPage"
import { PrivacyPage } from "./pages/PrivacyPage"
import { RefundPage } from "./pages/RefundPage"
import { ProtectedRoute } from "./auth/ProtectedRoute"


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund" element={<RefundPage />} />

        <Route
          path="/app/billing"
          element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <AppPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)

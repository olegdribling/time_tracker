import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import "./index.css"

import { LandingPage } from "./pages/LandingPage"
import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"
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
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)

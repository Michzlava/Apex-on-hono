import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/DashboardLayout'
import DashboardOverview from './pages/DashboardOverview'
import DepositPage from './pages/DepositPage'
import TradePage from './pages/TradePage'
import AssetsPage from './pages/AssetsPage'

// ── 404 Page ──────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'var(--sans)',
      gap: '12px',
      padding: '20px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--ink-faint)', margin: 0, letterSpacing: '-0.04em' }}>
        404
      </h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--ink-dim)', margin: 0 }}>
        This page doesn't exist yet.
      </p>
      <a
        href="/dashboard"
        style={{
          color: 'var(--accent)',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginTop: '8px',
          fontFamily: 'var(--mono)',
        }}
      >
        ← Back to Dashboard
      </a>
    </div>
  )
}

// ── Auth Guard ────────────────────────────────────────────────────────────────

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '20px', color: 'white' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

// ── Routes ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected Dashboard */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="deposit" element={<DepositPage />} />
          <Route path="trade" element={<TradePage />} />
          
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>

      {/* Global 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App

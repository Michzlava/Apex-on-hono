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
import AdminLoginPage from './pages/AdminLoginPage'

// Admin pages — all in ./pages now
import AdminLayout from './pages/AdminLayout'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminDepositsPage from './pages/AdminDepositsPage'
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage'
import AdminKycPage from './pages/AdminKycPage'
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import AdminUserDetailPage from './pages/AdminUserDetailPage'

function ProtectedRoute() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function NotFound() {
  return <div>404 Not Found</div>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      
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

      {/* Protected Admin */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="deposits" element={<AdminDepositsPage />} />
          <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
          <Route path="kyc" element={<AdminKycPage />} />
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
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

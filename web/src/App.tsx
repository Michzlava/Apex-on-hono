import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/DashboardLayout'
import DashboardOverview from './pages/DashboardOverview'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <div style={{ padding: '20px', color: 'white' }}>Loading...</div>
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <Outlet />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="markets" element={<div>Markets Page (Coming Soon)</div>} />
          <Route path="trade" element={<div>Trade Page (Coming Soon)</div>} />
          <Route path="assets" element={<div>Assets Page (Coming Soon)</div>} />
          <Route path="deposit" element={<div>Deposit Page (Coming Soon)</div>} />
          <Route path="withdraw" element={<div>Withdraw Page (Coming Soon)</div>} />
          <Route path="support" element={<div>Support Page (Coming Soon)</div>} />
          <Route path="settings" element={<div>Settings Page (Coming Soon)</div>} />
          <Route path="notifications" element={<div>Notifications Page (Coming Soon)</div>} />
          <Route path="kyc" element={<div>KYC Page (Coming Soon)</div>} />
          <Route path="subscription" element={<div>Subscription Page (Coming Soon)</div>} />
          <Route path="history" element={<div>History Page (Coming Soon)</div>} />
        </Route>
      </Route>
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

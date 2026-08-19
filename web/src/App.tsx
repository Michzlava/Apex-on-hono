import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/DashboardLayout'

// Protected route wrapper
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
      
      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<div>Dashboard Overview (Coming Next)</div>} />
          <Route path="markets" element={<div>Markets Page</div>} />
          <Route path="trade" element={<div>Trade Page</div>} />
          <Route path="assets" element={<div>Assets Page</div>} />
          <Route path="deposit" element={<div>Deposit Page</div>} />
          <Route path="withdraw" element={<div>Withdraw Page</div>} />
          <Route path="support" element={<div>Support Page</div>} />
          <Route path="settings" element={<div>Settings Page</div>} />
          <Route path="notifications" element={<div>Notifications Page</div>} />
          <Route path="kyc" element={<div>KYC Page</div>} />
          <Route path="subscription" element={<div>Subscription Page</div>} />
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

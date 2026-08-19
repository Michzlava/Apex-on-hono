import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/SignupPage' // <-- ADDED

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} /> {/* <-- ADDED */}
      {/* We will add /login and /dashboard next */}
    </Routes>
  )
}

export default App

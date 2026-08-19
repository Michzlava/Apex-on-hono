import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* Add other routes like /login, /dashboard later */}
    </Routes>
  )
}

export default App

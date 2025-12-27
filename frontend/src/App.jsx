import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import AuthButton from './components/AuthButton'
import CallbackPage from './components/CallbackPage'
import OWC2025Page from './pages/OWC2025Page'
import MyTeamPage from './pages/MyTeamPage'
import BoostersPage from './pages/BoostersPage'
import ProtectedRoute from './components/ProtectedRoute'

function App(){
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing/>} />
        <Route path="/league/owc2025" element={<ProtectedRoute><OWC2025Page /></ProtectedRoute>} />
        <Route path="/league/owc2025/my-team" element={<ProtectedRoute><MyTeamPage /></ProtectedRoute>} />
        <Route path="/league/owc2025/my-team/boosters" element={<ProtectedRoute><BoostersPage /></ProtectedRoute>} />
        <Route path="/auth" element={<AuthButton />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
      </Routes>
    </Router>
  )
}

export default App;
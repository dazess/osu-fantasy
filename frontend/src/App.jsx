import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AuthButton from './components/AuthButton'
import CallbackPage from './components/CallbackPage'

function App(){
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing/>} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/auth" element={<AuthButton />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
      </Routes>
    </Router>
  )
}

export default App;
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx'
import AppShell from './components/AppShell.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<AppShell />}>
            <Route path="/home" element={<Dashboard />} />
            <Route path="/home/jobs" element={<ComingSoon label="Jobs" />} />
            <Route path="/home/messages" element={<ComingSoon label="Messages" />} />
            <Route path="/home/notifications" element={<ComingSoon label="Notifications" />} />
            <Route path="/home/profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function ComingSoon({ label }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 24, marginTop: 8, color: 'var(--ink)' }}>
        Coming soon
      </h1>
    </div>
  )
}

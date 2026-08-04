import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import Landing from './pages/Landing.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AppShell from './components/AppShell.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding/:role" element={<Onboarding />} />

          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/jobs" element={<ComingSoon label="Jobs" />} />
            <Route path="/dashboard/messages" element={<ComingSoon label="Messages" />} />
            <Route path="/dashboard/notifications" element={<ComingSoon label="Notifications" />} />
            <Route path="/dashboard/profile" element={<ComingSoon label="Profile" />} />
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

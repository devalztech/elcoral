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
import ProfileView from './pages/ProfileView.jsx'
import ProfileEditor from './pages/ProfileEditor.jsx'
import Settings from './pages/settings/Settings.jsx'
import AccountSettings from './pages/settings/AccountSettings.jsx'
import PrivacySettings from './pages/settings/PrivacySettings.jsx'
import SecuritySettings from './pages/settings/SecuritySettings.jsx'
import EarningsSettings from './pages/settings/EarningsSettings.jsx'
import AppShell from './components/AppShell.jsx'
import PublicShell from './components/PublicShell.jsx'

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

          {/* Public-facing, works logged-out — no bottom nav for an app
              the visitor hasn't joined. If they ARE logged in, ProfileView
              still renders full owner/dashboard chrome when it's their own
              profile; this shell only controls the surrounding nav. */}
          <Route element={<PublicShell />}>
            <Route path="/u/:username" element={<ProfileView />} />
          </Route>

          <Route element={<AppShell />}>
            <Route path="/home" element={<Dashboard />} />
            <Route path="/home/jobs" element={<ComingSoon label="Jobs" />} />
            <Route path="/home/create" element={<ComingSoon label="Create" />} />
          <Route path="/home/community" element={<ComingSoon label="Community" />} />
          <Route path="/home/messages" element={<ComingSoon label="Messages" />} />
            <Route path="/home/notifications" element={<ComingSoon label="Notifications" />} />
            <Route path="/home/profile" element={<ProfileView />} />
            <Route path="/home/profile/edit" element={<ProfileEditor />} />
            <Route path="/home/settings" element={<Settings />} />
            <Route path="/home/settings/account" element={<AccountSettings />} />
            <Route path="/home/settings/privacy" element={<PrivacySettings />} />
            <Route path="/home/settings/security" element={<SecuritySettings />} />
            <Route path="/home/settings/earnings" element={<EarningsSettings />} />
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

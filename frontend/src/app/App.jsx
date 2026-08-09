import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../features/auth/hooks/useAuth.jsx'
import Landing from '../pages/Landing.jsx'
import Login from '../pages/Login.jsx'
import Signup from '../pages/Signup.jsx'
import ForgotPassword from '../pages/ForgotPassword.jsx'
import ResetPassword from '../pages/ResetPassword.jsx'
import VerifyEmail from '../pages/VerifyEmail.jsx'
import Onboarding from '../pages/Onboarding.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import CreatePost from '../pages/CreatePost.jsx'
import Create from '../pages/Create.jsx'
import Jobs from '../pages/Jobs.jsx'
import Community from '../pages/Community.jsx'
import CommunityDetail from '../pages/CommunityDetail.jsx'
import CommunityCreate from '../pages/CommunityCreate.jsx'
import ProfileView from '../pages/ProfileView.jsx'
import ProfileEditor from '../pages/ProfileEditor.jsx'
import Settings from '../pages/settings/Settings.jsx'
import AccountSettings from '../pages/settings/AccountSettings.jsx'
import PrivacySettings from '../pages/settings/PrivacySettings.jsx'
import SecuritySettings from '../pages/settings/SecuritySettings.jsx'
import EarningsSettings from '../pages/settings/EarningsSettings.jsx'
import SettingsPlaceholder from '../pages/settings/SettingsPlaceholder.jsx'
import VerificationSettings from '../pages/settings/VerificationSettings.jsx'
import EmailSettings from '../pages/settings/EmailSettings.jsx'
import NotificationSettings from '../pages/settings/NotificationSettings.jsx'
import AppearanceSettings from '../pages/settings/AppearanceSettings.jsx'
import LanguageSettings from '../pages/settings/LanguageSettings.jsx'
import AccessibilitySettings from '../pages/settings/AccessibilitySettings.jsx'
import BlockedSettings from '../pages/settings/BlockedSettings.jsx'
import ReportsSettings from '../pages/settings/ReportsSettings.jsx'
import DataSettings from '../pages/settings/DataSettings.jsx'
import HelpSettings from '../pages/settings/HelpSettings.jsx'
import AboutSettings from '../pages/settings/AboutSettings.jsx'
import { SettingsProvider } from '../features/settings/hooks/useSettings.jsx'
import AppShell from '../layouts/AppShell.jsx'
import PublicShell from '../layouts/PublicShell.jsx'

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
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
            <Route path="/home/jobs" element={<Jobs />} />
            <Route path="/home/jobs/:slug" element={<ComingSoon label="Jobs" />} />
            <Route path="/home/search" element={<ComingSoon label="Search" />} />
            <Route path="/home/discover" element={<ComingSoon label="Discover" />} />
            <Route path="/home/stories/:id" element={<ComingSoon label="Story" />} />
            <Route path="/home/projects/:slug" element={<ComingSoon label="Project" />} />
            <Route path="/home/create" element={<Create />} />
            <Route path="/home/create/community" element={<CommunityCreate />} />
            <Route path="/home/create/post" element={<CreatePost />} />
            <Route path="/home/create/media" element={<CreatePost />} />
            <Route path="/home/create/article" element={<CreatePost />} />
            <Route path="/home/create/poll" element={<CreatePost />} />
            <Route path="/home/create/link" element={<CreatePost />} />
            <Route path="/home/create/:slug" element={<ComingSoon label="Create" />} />
            <Route path="/home/community" element={<Community />} />
            <Route path="/home/community/:slug" element={<CommunityDetail />} />
            <Route path="/home/messages" element={<ComingSoon label="Messages" />} />
            <Route path="/home/notifications" element={<ComingSoon label="Notifications" />} />
            <Route path="/home/more" element={<ComingSoon label="More" />} />
            <Route path="/home/profile" element={<ProfileView />} />
            <Route path="/home/profile/edit" element={<ProfileEditor />} />
            <Route path="/home/settings" element={<Settings />} />
            <Route path="/home/settings/account" element={<AccountSettings />} />
            <Route path="/home/settings/privacy" element={<PrivacySettings />} />
            <Route path="/home/settings/security" element={<SecuritySettings />} />
            <Route path="/home/settings/earnings" element={<EarningsSettings />} />
            <Route path="/home/settings/verification" element={<VerificationSettings />} />
            <Route path="/home/settings/email" element={<EmailSettings />} />
            <Route path="/home/settings/notifications" element={<NotificationSettings />} />
            <Route path="/home/settings/appearance" element={<AppearanceSettings />} />
            <Route path="/home/settings/language" element={<LanguageSettings />} />
            <Route path="/home/settings/accessibility" element={<AccessibilitySettings />} />
            <Route path="/home/settings/blocked" element={<BlockedSettings />} />
            <Route path="/home/settings/reports" element={<ReportsSettings />} />
            <Route path="/home/settings/data" element={<DataSettings />} />
            <Route path="/home/settings/help" element={<HelpSettings />} />
            <Route path="/home/settings/about" element={<AboutSettings />} />
            <Route path="/home/settings/:slug" element={<SettingsPlaceholder />} />
          </Route>
        </Routes>
        </BrowserRouter>
      </SettingsProvider>
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

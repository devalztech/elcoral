import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Shell from './components/Shell.jsx'
import Spinner from './components/Spinner.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import UserDetail from './pages/UserDetail.jsx'
import Roles from './pages/Roles.jsx'
import Audit from './pages/Audit.jsx'

/**
 * Route guarding here is convenience, not security: every one of these
 * screens is useless without a valid admin token, because the backend
 * re-checks the `scope: "admin"` claim AND the user_roles table on every
 * single request. Hiding the UI just avoids showing an admin a wall of
 * 403s.
 */
function Protected({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return <Spinner page label="Checking your session" />
  if (!admin) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

export default function App() {
  const { admin, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Spinner page label="Loading" /> : admin ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/users" element={<Protected><Users /></Protected>} />
      <Route path="/users/:userId" element={<Protected><UserDetail /></Protected>} />
      <Route path="/roles" element={<Protected><Roles /></Protected>} />
      <Route path="/audit" element={<Protected><Audit /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword.tsx';
import { ResetPassword } from './pages/ResetPassword.tsx';
import { Register } from './pages/Register';
import { PublicRegister } from './pages/PublicRegister';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { SubmitProject } from './pages/SubmitProject';
import { Review } from './pages/Review';
import { Analytics } from './pages/Analytics';
import { AdminPanel } from './pages/AdminPanel';
import { Messages } from './pages/Messages';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/public" element={<PublicRegister />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student', 'lecturer']} fallbackPath="/analytics">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submit"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <SubmitProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submit/:id"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <SubmitProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review"
              element={
                <ProtectedRoute allowedRoles={['lecturer', 'admin']}>
                  <Review />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute allowedRoles={['student', 'lecturer']}>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:projectId"
              element={
                <ProtectedRoute allowedRoles={['student', 'lecturer']}>
                  <Messages />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

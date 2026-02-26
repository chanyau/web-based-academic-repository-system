import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Upload, BarChart3, LogOut, User, Home, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-blue-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-blue-900">AcademicHub</span>
            </Link>

            {isAuthenticated && (
              <div className="hidden md:flex ml-10 space-x-8">
                {user?.role !== 'admin' && (
                  <Link to="/dashboard" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                )}
                <Link to="/projects" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                  <Search className="h-4 w-4" />
                  <span>Browse Projects</span>
                </Link>
                {user?.role === 'student' && (
                  <Link to="/submit" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>Submit Project</span>
                  </Link>
                )}
                {(user?.role === 'student' || user?.role === 'lecturer') && (
                  <Link to="/messages" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    <span>Messages</span>
                  </Link>
                )}
                {user?.role === 'lecturer' && (
                  <Link to="/review" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Reviews</span>
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <>
                    <Link to="/analytics" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                      <BarChart3 className="h-4 w-4" />
                      <span>Analytics</span>
                    </Link>
                    <Link to="/admin" className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors">
                      <BarChart3 className="h-4 w-4" />
                      <span>Admin</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2">
                  <img src={user?.avatar} alt={user?.name} className="h-8 w-8 rounded-full" />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <User className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

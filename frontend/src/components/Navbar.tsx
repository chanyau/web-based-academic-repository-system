import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Upload, BarChart3, LogOut, User, Home, MessageSquare, Users, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { messageService } from '../services/messageService';

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchUnreadCount = async () => {
      if (!isAuthenticated || (user?.role !== 'student' && user?.role !== 'lecturer')) {
        setUnreadCount(0);
        return;
      }

      try {
        const conversations = await messageService.getConversations();
        const totalUnread = conversations.reduce((total, conversation) => total + conversation.unread_count, 0);
        setUnreadCount(totalUnread);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    intervalId = setInterval(fetchUnreadCount, 30000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthenticated, user?.role, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-blue-900 border-b border-blue-800 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-white" />
              <span className="text-xl font-bold text-white">AcademicHub</span>
            </Link>

            {isAuthenticated && (
              <div className="hidden md:flex ml-10 space-x-8">
                {user?.role !== 'admin' && (
                  <Link to="/dashboard" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                )}
                {user?.role !== 'admin' && (
                  <Link to="/projects" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <Search className="h-4 w-4" />
                    <span>Browse Projects</span>
                  </Link>
                )}
                {user?.role === 'student' && (
                  <Link to="/submit" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>Submit Project</span>
                  </Link>
                )}
                {(user?.role === 'student' || user?.role === 'lecturer') && (
                  <Link to="/messages" className="relative flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    <span>Messages</span>
                    {unreadCount > 0 && (
                      <span className="absolute -top-2 -right-3 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-600 text-white text-[10px] leading-[1.1rem] rounded-full text-center font-semibold">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}
                {user?.role === 'lecturer' && (
                  <Link to="/supervisees" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <Users className="h-4 w-4" />
                    <span>Supervisees</span>
                  </Link>
                )}
                {user?.role === 'lecturer' && (
                  <Link to="/supervisee-notifications" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <Calendar className="h-4 w-4" />
                    <span>Due Dates</span>
                  </Link>
                )}
                {user?.role === 'lecturer' && (
                  <Link to="/review" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Reviews</span>
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <>
                    <Link to="/analytics" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
                      <BarChart3 className="h-4 w-4" />
                      <span>Analytics</span>
                    </Link>
                    <Link to="/admin" className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors">
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
                  <img src={user?.avatar} alt={user?.name} className="h-8 w-8 rounded-full border-2 border-white" />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-xs text-blue-200 capitalize">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-blue-100 hover:text-white transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-1 bg-white text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
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

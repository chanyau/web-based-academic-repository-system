import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string, firstName: string, lastName: string, role: User['role'], faculty?: string, department?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user and token on mount
    const storedUser = authService.getStoredUser();
    const token = authService.getStoredToken();
    
    if (storedUser && token) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authService.login(username, password);
      const backendUser = response.user;
      
      // Map backend user to frontend User type
      const mappedUser: User = {
        id: backendUser?.id?.toString() || '',
        name: `${backendUser?.first_name || ''} ${backendUser?.last_name || ''}`.trim() || backendUser?.username || '',
        email: backendUser?.email || '',
        role: backendUser?.role as User['role'],
        faculty: backendUser?.faculty,
        department: backendUser?.department,
        admitted: backendUser?.admitted,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser?.username || 'User')}&background=2563eb&color=fff`
      };
      
      setUser(mappedUser);
      return mappedUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: User['role'],
    faculty?: string,
    department?: string
  ) => {
    try {
      console.log('AuthContext: Registering user with data:', {
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        faculty,
        department
      });

      const response = await authService.register({
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: role || 'student',
        faculty,
        department
      });

      console.log('AuthContext: Full registration response:', response);

      // Check if response has user object
      if (!response || !response.user) {
        console.error('AuthContext: Invalid response structure:', response);
        throw new Error('Invalid response from server. User data missing.');
      }

      const backendUser = response.user;
      console.log('AuthContext: Backend user data:', backendUser);
      
      // Map backend user to frontend User type with safe fallbacks
      const mappedUser: User = {
        id: backendUser?.id?.toString() || backendUser?.id || '',
        username: backendUser?.username || username,
        first_name: backendUser?.first_name || firstName,
        last_name: backendUser?.last_name || lastName,
        name: `${backendUser?.first_name || firstName} ${backendUser?.last_name || lastName}`.trim() || backendUser?.username || username,
        email: backendUser?.email || email,
        role: (backendUser?.role as User['role']) || role || 'student',
        faculty: backendUser?.faculty || faculty,
        department: backendUser?.department || department,
        admitted: backendUser?.admitted !== undefined ? backendUser.admitted : false,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser?.username || username)}&background=2563eb&color=fff`
      };

      console.log('AuthContext: Mapped user:', mappedUser);
      setUser(mappedUser);
    } catch (error: any) {
      console.error('AuthContext: Registration error:', error);
      // Re-throw with more context
      throw new Error(error?.message || 'Registration failed. Please check your connection and try again.');
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

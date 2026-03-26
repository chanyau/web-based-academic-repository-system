import { apiClient } from './api';
import { User } from '../types';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'lecturer' | 'admin' | 'public';
  faculty?: string;
  department?: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  uid: string;
  token: string;
  password: string;
}

export const authService = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login/', { username, password });
    apiClient.setToken(response.access);
    localStorage.setItem('refreshToken', response.refresh);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register/', data);
    apiClient.setToken(response.access);
    localStorage.setItem('refreshToken', response.refresh);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  },

  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const response = await apiClient.post<{ access: string }>('/auth/refresh/', { refresh: refreshToken });
    apiClient.setToken(response.access);
    return response.access;
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return apiClient.post<ForgotPasswordResponse>('/auth/forgot-password/', { email });
  },

  async resetPassword(data: ResetPasswordRequest): Promise<ForgotPasswordResponse> {
    return apiClient.post<ForgotPasswordResponse>('/auth/reset-password/', data);
  },

  logout() {
    apiClient.setToken(null);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  getStoredToken(): string | null {
    return apiClient.getToken();
  },

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
};



import { apiClient } from './api';
import { User } from '../types';

export const userService = {
  async getAllUsers(): Promise<User[]> {
    return apiClient.get<User[]>('/users/');
  },

  async getUserById(id: string): Promise<User> {
    return apiClient.get<User>(`/users/${id}/`);
  },

  async admitUser(id: string): Promise<{ status: string; message: string }> {
    return apiClient.post<{ status: string; message: string }>(`/users/${id}/admit/`, {});
  },

  async revokeAdmission(id: string): Promise<{ status: string; message: string }> {
    return apiClient.post<{ status: string; message: string }>(`/users/${id}/revoke_admission/`, {});
  },
};

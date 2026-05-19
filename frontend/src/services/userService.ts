import { apiClient } from './api';
import { User, SuperviseeDetail, SuperviseesResponse } from '../types';

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

  async getMySupervisees(): Promise<SuperviseesResponse> {
    return apiClient.get<SuperviseesResponse>('/supervisees/');
  },

  async getSuperviseeDetails(id: number | string): Promise<SuperviseeDetail> {
    return apiClient.get<SuperviseeDetail>(`/supervisees/${id}/details/`);
  },

  async sendDueDateNotification(payload: {
    student_id: number | string;
    project_id: number | string;
    stage: string;
    due_date: string;
    note?: string;
  }): Promise<{ status: string; message_id: number }> {
    return apiClient.post<{ status: string; message_id: number }>('/supervisees/due-date/', payload);
  },

  async sendSupervisorMessage(payload: {
    student_id: number | string;
    project_id: number | string;
    content: string;
  }): Promise<{ status: string; message_id: number }> {
    return apiClient.post<{ status: string; message_id: number }>('/supervisees/notify/', payload);
  },
};

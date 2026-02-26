import { apiClient } from './api';

export interface Message {
  id: number;
  project: number;
  sender: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  sender_name: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface Conversation {
  project_id: number;
  project_title: string;
  project_status: string;
  other_party: {
    id: number;
    name: string;
    role: string;
  } | null;
  unread_count: number;
  last_message: {
    content: string;
    created_at: string;
    sender_name: string;
  } | null;
  message_count: number;
}

export const messageService = {
  async getConversations(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>('/conversations/');
  },

  async getMessages(projectId: string | number): Promise<Message[]> {
    return apiClient.get<Message[]>(`/projects/${projectId}/messages/`);
  },

  async sendMessage(projectId: string | number, content: string): Promise<Message> {
    return apiClient.post<Message>(`/projects/${projectId}/messages/`, { content });
  },

  async getUnreadCount(projectId: string | number): Promise<{ unread_count: number }> {
    return apiClient.get<{ unread_count: number }>(`/projects/${projectId}/unread_count/`);
  },
};

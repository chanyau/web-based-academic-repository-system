import { apiClient } from './api';
import { Project } from '../types';

export const recommendationService = {
  async getRecommendations(): Promise<Project[]> {
    return apiClient.get<Project[]>('/recommendations/me');
  },

  async generateRecommendations(): Promise<Project[]> {
    return apiClient.post<Project[]>('/recommendations/generate');
  },
};



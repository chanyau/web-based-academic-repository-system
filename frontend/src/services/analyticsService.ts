import { apiClient } from './api';

export interface AnalyticsOverview {
  total_projects: number;
  pending_reviews: number;
  under_review: number;
  approved: number;
  by_faculty: Array<{ faculty: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  by_role: Array<{ role: string; count: number }>;
}

export const analyticsService = {
  async getOverview(): Promise<AnalyticsOverview> {
    return apiClient.get<AnalyticsOverview>('/analytics/');
  },
};



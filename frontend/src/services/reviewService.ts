import { apiClient } from './api';

export interface Review {
  id: number;
  projectId: number;
  reviewerId: number;
  status: 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';
  feedback?: string;
  requestedChanges?: string;
  createdAt: string;
}

export interface ReviewRequest {
  feedback: string;
  status: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';
}

export const reviewService = {
  async getProjectReviews(projectId: string): Promise<Review[]> {
    return apiClient.get<Review[]>(`/reviews/projects/${projectId}`);
  },

  async createReview(projectId: string, data: ReviewRequest): Promise<Review> {
    return apiClient.post<Review>(`/reviews/projects/${projectId}`, data);
  },
};



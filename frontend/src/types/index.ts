export interface User {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  name: string;
  email: string;
  // Frontend role values (backend uses lowercase)
  role?: 'student' | 'lecturer' | 'admin' | 'public';
  faculty?: string;
  department?: string;
  // For public users: whether admin has approved admission
  admitted?: boolean;
  avatar?: string;
}

export interface Project {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  faculty: string;
  department: string;
  year: number;
  type: 'thesis' | 'capstone' | 'dissertation' | 'research';
  keywords: string[];
  // Owner (student) who submitted the project
  ownerId?: string;
  supervisorId: string;
  supervisorName: string;
  submittedAt: string;
  status: 'pending' | 'under_review' | 'revision_requested' | 'approved' | 'archived';
  similarityScore?: number;
  fileUrl?: string;
  file?: string;  // Backend returns 'file' field
  views: number;
  downloads: number;
}

export interface SearchFilters {
  query?: string;
  faculty?: string;
  department?: string;
  year?: number;
  type?: string;
  keywords?: string[];
}

export interface AnalyticsSummary {
  totalProjects: number;
  pendingReviews: number;
  approvedThisMonth: number;
  topKeywords: { keyword: string; count: number }[];
  submissionTrends: { month: string; count: number }[];
  facultyDistribution: { faculty: string; count: number }[];
}

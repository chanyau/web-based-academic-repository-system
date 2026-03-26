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
  objectives?: string;
  workflowStatus?:
    | 'proposal_submitted'
    | 'proposal_approved'
    | 'proposal_rejected'
    | 'proposal_revision'
    | 'in_progress'
    | 'interim_evaluated'
    | 'final_submitted'
    | 'plagiarism_flagged'
    | 'plagiarism_passed'
    | 'approved'
    | 'final_revision'
    | 'rejected'
    | 'archived';
  plagiarismReportUrl?: string;
  similarityScore?: number;
  fileUrl?: string;
  file?: string;  // Backend returns 'file' field
  views: number;
  downloads: number;
}

export interface WorkflowReview {
  id: number;
  phase: 'proposal' | 'final';
  decision: 'approved' | 'rejected' | 'revision_required';
  feedback: string;
  reviewer_name: string;
  created_at: string;
}

export interface DevelopmentSubmission {
  id: number;
  submission_type: 'progress_report' | 'chapter' | 'code';
  version: number;
  file_url?: string;
  comment?: string;
  supervisor_comment?: string;
  review_status: 'pending' | 'approved' | 'revision_requested';
  submitted_at: string;
}

export interface InterimEvaluationRecord {
  id: number;
  evaluator_name: string;
  marks: string;
  comments: string;
  created_at: string;
}

export interface WorkflowDetails {
  project: Project;
  reviews: WorkflowReview[];
  development_submissions: DevelopmentSubmission[];
  interim_evaluations: InterimEvaluationRecord[];
}

export type ProjectStageCode =
  | 'proposal'
  | 'literature_review'
  | 'methodology'
  | 'implementation'
  | 'final_document';

export type ProjectStageReviewStatus = 'not_submitted' | 'pending' | 'revision_requested' | 'approved';

export interface ProjectStageVersion {
  id: number;
  version: number;
  submitted_file?: string | null;
  fileUrl?: string | null;
  student_note?: string;
  supervisor_feedback?: string;
  review_status: Exclude<ProjectStageReviewStatus, 'not_submitted'>;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewedByName?: string | null;
}

export interface ProjectStageProgress {
  id: number | null;
  project: string | number;
  stage: ProjectStageCode;
  stageLabel: string;
  submitted_file?: string | null;
  fileUrl?: string | null;
  student_note?: string;
  supervisor_feedback?: string;
  review_status: ProjectStageReviewStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | number | null;
  reviewedByName?: string | null;
  versions?: ProjectStageVersion[];
  is_locked?: boolean;
  lock_reason?: string | null;
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

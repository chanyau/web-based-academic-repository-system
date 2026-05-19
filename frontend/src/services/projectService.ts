import { apiClient } from './api';
import { Project, ProjectStageCode, ProjectStageProgress, WorkflowDetails } from '../types';

export interface ProjectSearchParams {
  query?: string;
  status?: string;
  owner?: string | number;
  supervisor?: string | number;
  page?: number;
  size?: number;
}

export interface Lecturer {
  id: number;
  name: string;
  email: string;
  faculty?: string;
  department?: string;
}

export interface SimilarityCheckResult {
  similarity_score: number;
  top_matches: Array<{
    project_id: string | number;
    title: string;
    similarity: number;
  }>;
  report_url?: string | null;
  report_file_url?: string | null;
  method?: 'local_cosine_only' | 'hybrid_local_winston';
  components?: {
    local_score: number;
    winston_score: number | null;
    weights: {
      local: number;
      winston: number;
    };
  };
  local_details?: {
    average_top_matches: number;
    peak_match: number;
    evaluated_projects: number;
  };
  winston_status?: 'used' | 'fallback_local_only';
  winston_error?: string | null;
  message?: string;
}

export const projectService = {
  async getProjects(params: ProjectSearchParams = {}): Promise<Project[]> {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.status) queryParams.append('status', params.status);
    if (params.owner) queryParams.append('owner', String(params.owner));
    if (params.supervisor) queryParams.append('supervisor', String(params.supervisor));
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    const endpoint = `/projects/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Project[]>(endpoint);
  },

  async getProject(id: string): Promise<Project> {
    return apiClient.get<Project>(`/projects/${id}/`);
  },

  async getLecturers(faculty?: string, department?: string): Promise<Lecturer[]> {
    const queryParams = new URLSearchParams();
    if (faculty) queryParams.append('faculty', faculty);
    if (department) queryParams.append('department', department);
    
    const endpoint = `/lecturers/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Lecturer[]>(endpoint);
  },

  async createProject(projectData: Partial<Project> & { supervisor_id?: number }, file?: File): Promise<Project> {
    if (file) {
      const formData = new FormData();
      
      // Add all project fields to FormData
      Object.entries(projectData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            formData.append(key, value.join(', '));
          } else {
            formData.append(key, String(value));
          }
        }
      });
      
      formData.append('file', file);
      return apiClient.postFormData<Project>('/projects/', formData);
    } else {
      // Convert arrays to comma-separated strings for backend
      const data = {
        ...projectData,
        authors: Array.isArray(projectData.authors) ? projectData.authors.join(', ') : projectData.authors,
        keywords: Array.isArray(projectData.keywords) ? projectData.keywords.join(', ') : projectData.keywords,
      };
      return apiClient.post<Project>('/projects/', data);
    }
  },

  async updateProject(id: string, projectData: Partial<Project> & { supervisor_id?: number }, file?: File): Promise<Project> {
    if (file) {
      const formData = new FormData();
      
      // Add all project fields to FormData
      Object.entries(projectData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            formData.append(key, value.join(', '));
          } else {
            formData.append(key, String(value));
          }
        }
      });
      
      formData.append('file', file);
      return apiClient.putFormData<Project>(`/projects/${id}/`, formData);
    } else {
      // Convert arrays to comma-separated strings for backend
      const data = {
        ...projectData,
        authors: Array.isArray(projectData.authors) ? projectData.authors.join(', ') : projectData.authors,
        keywords: Array.isArray(projectData.keywords) ? projectData.keywords.join(', ') : projectData.keywords,
      };
      return apiClient.put<Project>(`/projects/${id}/`, data);
    }
  },

  async submitProject(id: string): Promise<Project> {
    return apiClient.post<Project>(`/projects/${id}/submit`);
  },

  async resubmitProject(id: string): Promise<any> {
    return apiClient.post(`/projects/${id}/resubmit/`);
  },

  async approveProject(id: string, feedback?: string): Promise<any> {
    return apiClient.post(`/projects/${id}/approve/`, { feedback });
  },

  async rejectProject(id: string, feedback: string): Promise<any> {
    return apiClient.post(`/projects/${id}/reject/`, { feedback });
  },

  async requestRevision(id: string, feedback: string): Promise<any> {
    return apiClient.post(`/projects/${id}/request_revision/`, { feedback });
  },

  async publishProject(id: string): Promise<any> {
    return apiClient.post(`/projects/${id}/publish/`);
  },

  async archiveProject(id: string): Promise<any> {
    return apiClient.post(`/projects/${id}/archive/`);
  },

  async unpublishProject(id: string): Promise<any> {
    return apiClient.post(`/projects/${id}/unpublish/`);
  },

  async unarchiveProject(id: string): Promise<any> {
    return apiClient.post(`/projects/${id}/unarchive/`);
  },

  async getCitation(id: string): Promise<any> {
    return apiClient.get(`/projects/${id}/citation/`);
  },

  async incrementDownload(id: string): Promise<any> {
    return apiClient.post(`/projects/${id}/increment_download/`);
  },

  async downloadProject(project: Project): Promise<void> {
    // Check both 'file' (backend) and 'fileUrl' (frontend) field names
    const fileLocation = project.file || project.fileUrl;
    
    if (fileLocation) {
      // If fileUrl is a full URL, download directly
      if (fileLocation.startsWith('http')) {
        window.open(fileLocation, '_blank');
      } else {
        // Construct the download URL using the API base
        const baseUrl = apiClient.getBaseUrl();
        const filePath = fileLocation.startsWith('/') ? fileLocation : `/${fileLocation}`;
        
        // For media files served by Django, we need to handle the path correctly
        // Remove /api prefix if present since media files are served from /media
        const downloadUrl = filePath.startsWith('/api') 
          ? filePath.replace('/api', '') 
          : filePath;
        
        // Open in new tab for download
        window.open(`${baseUrl.replace('/api', '')}${downloadUrl}`, '_blank');
      }
      
      // Track the download
      try {
        await this.incrementDownload(project.id);
      } catch (e) {
        console.error('Failed to track download:', e);
      }
    } else {
      throw new Error('No file available for download');
    }
  },

  getDownloadUrl(project: Project): string | null {
    // Check both 'file' (backend) and 'fileUrl' (frontend) field names
    const fileLocation = project.file || project.fileUrl;
    
    if (!fileLocation) return null;
    
    if (fileLocation.startsWith('http')) {
      return fileLocation;
    }
    
    const baseUrl = apiClient.getBaseUrl();
    const filePath = fileLocation.startsWith('/') ? fileLocation : `/${fileLocation}`;
    const downloadUrl = filePath.startsWith('/api') 
      ? filePath.replace('/api', '') 
      : filePath;
    
    return `${baseUrl.replace('/api', '')}${downloadUrl}`;
  },

  /**
   * Extract keywords from uploaded document using AI/NLP
   */
  async extractKeywords(file: File | null, existingKeywords?: string[], abstractText?: string, titleText?: string): Promise<{ keywords: string[]; suggestions?: string[]; message?: string; source?: string }> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (existingKeywords && existingKeywords.length > 0) {
      existingKeywords.forEach(k => formData.append('existing_keywords', k));
    }
    if (abstractText) {
      formData.append('abstract_text', abstractText);
    }
    if (titleText) {
      formData.append('title_text', titleText);
    }
    return apiClient.postFormData<{ keywords: string[]; suggestions?: string[]; message?: string; source?: string }>('/extract-keywords/', formData);
  },

  async checkSimilarity(file?: File, abstractText?: string, titleText?: string, currentProjectId?: string): Promise<SimilarityCheckResult> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (abstractText) {
      formData.append('abstract_text', abstractText);
    }
    if (titleText) {
      formData.append('title_text', titleText);
    }
    if (currentProjectId) {
      formData.append('current_project_id', currentProjectId);
    }
    return apiClient.postFormData<SimilarityCheckResult>('/check-similarity/', formData);
  },

  async extractMetadata(file: File): Promise<{ title?: string; abstract?: string; authors?: string[]; message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postFormData('/extract-metadata/', formData);
  },

  async getProjectStageProgress(projectId: string): Promise<ProjectStageProgress[]> {
    return apiClient.get<ProjectStageProgress[]>(`/projects/${projectId}/stage-progress/`);
  },

  async submitProjectStage(projectId: string, stage: ProjectStageCode, file: File, studentNote?: string): Promise<ProjectStageProgress> {
    const formData = new FormData();
    formData.append('file', file);
    if (studentNote) {
      formData.append('student_note', studentNote);
    }
    return apiClient.postFormData<ProjectStageProgress>(`/projects/${projectId}/stage-submissions/${stage}/`, formData);
  },

  // Messaging functions
  async sendStageUploadNotification(projectId: string, stage: ProjectStageCode, supervisorId: string, studentName?: string, projectTitle?: string): Promise<void> {
    try {
      // Import messageService dynamically to avoid circular imports
      const { messageService } = await import('./messageService');
      await messageService.createStageUploadNotification(
        projectId, 
        stage, 
        supervisorId, 
        studentName || 'Student', 
        projectTitle || 'Project'
      );
    } catch (err: any) {
      console.warn("Failed to send stage upload notification:", err?.message);
      throw err;
    }
  },

  async sendStageReviewNotification(projectId: string, stage: ProjectStageCode, studentId: string, reviewStatus: string, supervisorName?: string, projectTitle?: string, feedback?: string): Promise<void> {
    try {
      // Import messageService dynamically to avoid circular imports
      const { messageService } = await import('./messageService');
      await messageService.createStageReviewNotification(
        projectId, 
        stage, 
        studentId, 
        reviewStatus,
        supervisorName || 'Supervisor',
        projectTitle || 'Project',
        feedback
      );
    } catch (err: any) {
      console.warn("Failed to send stage review notification:", err?.message);
      throw err;
    }
  },

  async notifySimilarityReport({
    projectId,
    studentName,
    projectTitle,
    similarityResult,
  }: {
    projectId: string;
    studentName?: string;
    projectTitle?: string;
    similarityResult: SimilarityCheckResult;
  }): Promise<void> {
    const readableStudent = studentName || 'The student';
    const readableTitle = projectTitle || 'the project';
    const methodLabel = similarityResult.method === 'hybrid_local_winston'
      ? 'Hybrid (Local + Winston AI)'
      : 'Local cosine analysis';

    const componentSummary = similarityResult.components
      ? `Components — Local: ${similarityResult.components.local_score}% | Winston: ${
          similarityResult.components.winston_score !== null
            ? `${similarityResult.components.winston_score}%`
            : 'N/A'
        }`
      : null;

    const localDetails = similarityResult.local_details
      ? `Local insights — Avg top matches: ${similarityResult.local_details.average_top_matches}% | Peak match: ${similarityResult.local_details.peak_match}% across ${similarityResult.local_details.evaluated_projects} projects.`
      : null;

    const topMatchesMessage = (similarityResult.top_matches || [])
      .slice(0, 3)
      .map((match, index) => `${index + 1}. ${match.title} (${match.similarity}%)`)
      .join('\n');

    const bodyParts = [
      `📊 ${readableStudent} completed the similarity check for "${readableTitle}".`,
      `Overall score: ${similarityResult.similarity_score}% (${methodLabel}).`,
      componentSummary,
      localDetails,
      topMatchesMessage ? `Top overlaps:\n${topMatchesMessage}` : null,
    ].filter(Boolean);

    const { messageService } = await import('./messageService');
    await messageService.sendMessage(projectId, bodyParts.join('\n\n'));
  },

  async updateStageReview(projectId: string, stage: ProjectStageCode, reviewData: {
    review_status: 'approved' | 'revision_requested' | 'rejected';
    supervisor_feedback?: string;
  }): Promise<ProjectStageProgress> {
    return apiClient.put<ProjectStageProgress>(`/projects/${projectId}/stage-review/${stage}/`, reviewData);
  },

  async submitFinalDocument(projectId: string, file: File, note?: string): Promise<ProjectStageProgress> {
    const formData = new FormData();
    formData.append('file', file);
    if (note) {
      formData.append('note', note);
    }
    return apiClient.postFormData<ProjectStageProgress>(`/projects/${projectId}/final-document/`, formData);
  },

  async submitPlagiarismCheck({
    projectId,
    file,
    similarityScore,
    note,
  }: {
    projectId: string;
    file?: File;
    similarityScore?: number;
    note?: string;
  }): Promise<ProjectStageProgress> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (typeof similarityScore === 'number') {
      formData.append('similarity_score', String(similarityScore));
    }
    if (note) {
      formData.append('note', note);
    }
    return apiClient.postFormData<ProjectStageProgress>(`/projects/${projectId}/plagiarism-check/`, formData);
  },

  async reviewProjectStage(
    projectId: string,
    payload: { stage: ProjectStageCode; feedback?: string; review_status: 'approved' | 'revision_requested' | 'pending' }
  ): Promise<ProjectStageProgress> {
    return apiClient.post(`/projects/${projectId}/stage-submissions/${payload.stage}/review/`, payload);
  },

  async submitDevelopment(
    projectId: string,
    submissionType: 'progress_report' | 'chapter' | 'code',
    file: File,
    comment?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('submission_type', submissionType);
    formData.append('file', file);
    if (comment) {
      formData.append('comment', comment);
    }
    return apiClient.postFormData(`/projects/${projectId}/development-submissions/`, formData);
  },

  async submitFinalSubmission({
    projectId,
    finalReport,
    sourceCode,
    supportingDocs,
    note,
  }: {
    projectId: string;
    finalReport: File;
    sourceCode?: File;
    supportingDocs?: File;
    note?: string;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('final_report', finalReport);
    if (sourceCode) {
      formData.append('source_code', sourceCode);
    }
    if (supportingDocs) {
      formData.append('supporting_documents', supportingDocs);
    }
    if (note) {
      formData.append('note', note);
    }
    return apiClient.postFormData(`/projects/${projectId}/final-submission/`, formData);
  },

  async getWorkflowDetails(projectId: string): Promise<WorkflowDetails> {
    return apiClient.get<WorkflowDetails>(`/projects/${projectId}/workflow/`);
  },
};



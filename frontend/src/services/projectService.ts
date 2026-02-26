import { apiClient } from './api';
import { Project } from '../types';

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
   * Extract keywords from abstract using AI/NLP
   */
  async extractKeywords(abstract: string, existingKeywords?: string[]): Promise<{ keywords: string[]; suggestions?: string[]; message?: string }> {
    return apiClient.post<{ keywords: string[]; suggestions?: string[]; message?: string }>('/extract-keywords/', {
      abstract,
      existing_keywords: existingKeywords || []
    });
  },
};



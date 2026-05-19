import { apiClient } from './api';

const stageLabelMap: Record<string, string> = {
  proposal: 'Proposal',
  proposal_revision: 'Proposal Revision',
  chapter1: 'Chapter 1',
  chapter2: 'Chapter 2',
  chapter3: 'Chapter 3',
  literature_review: 'Literature Review',
  methodology: 'Methodology',
  implementation: 'Implementation & Results',
  development: 'Development Update',
  interim_evaluation: 'Interim Evaluation',
  final_submission: 'Final Submission',
  final_document: 'Final Document',
  plagiarism_check: 'Plagiarism Check',
};

const formatStageLabel = (stage: string) => {
  if (!stage) return 'Stage';
  if (stageLabelMap[stage]) {
    return stageLabelMap[stage];
  }
  return stage
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

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
  message_type?: 'user' | 'system' | 'notification';
  metadata?: {
    stage?: string;
    action?: 'upload' | 'review' | 'approval' | 'revision' | 'rejection';
    project_title?: string;
    student_name?: string;
    supervisor_name?: string;
  };
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
    return apiClient.get<{ unread_count: number }>(`/projects/${projectId}/unread-count/`);
  },

  // System notification methods
  async createStageUploadNotification(projectId: string | number, stage: string, supervisorId: string | number, studentName: string, projectTitle: string): Promise<Message> {
    const stageLabel = formatStageLabel(stage);
    const content = `📤 ${studentName} has submitted "${stageLabel}" for review on "${projectTitle}".`;
    return apiClient.post<Message>(`/projects/${projectId}/messages/`, { content });
  },

  async createStageReviewNotification(projectId: string | number, stage: string, studentId: string | number, reviewStatus: string, supervisorName: string, projectTitle: string, feedback?: string): Promise<Message> {
    const stageLabel = formatStageLabel(stage);
    let content = '';
    switch (reviewStatus) {
      case 'approved':
        content = `✅ ${stageLabel} approved for "${projectTitle}". You can move forward.`;
        if (stage === 'final_document') {
          content += '\n\nNext step: run the similarity check and upload the generated report for supervisor review.';
        }
        break;
      case 'revision_requested':
        content = `🔄 ${stageLabel} needs revision for "${projectTitle}". Please review the feedback and resubmit.`;
        break;
      case 'rejected':
        content = `❌ ${stageLabel} was rejected for "${projectTitle}". Please contact your supervisor for guidance.`;
        break;
      default:
        content = `ℹ️ ${stageLabel} update recorded for "${projectTitle}".`;
    }

    if (feedback) {
      content += `\n\nFeedback: ${feedback}`;
    }

    return apiClient.post<Message>(`/projects/${projectId}/messages/`, { content });
  },

  async createFinalSubmissionNotification(projectId: string | number, supervisorId: string | number, studentName: string, projectTitle: string): Promise<Message> {
    const content = `🎯 ${studentName} has submitted the final project "${projectTitle}" for review.`;
    return apiClient.post<Message>(`/projects/${projectId}/messages/`, { content });
  },
};

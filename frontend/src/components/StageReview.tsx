import React, { useState } from 'react';
import { ProjectStageProgress } from '../types';
import { projectService } from '../services/projectService';
import { CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';

interface StageReviewProps {
  stage: ProjectStageProgress;
  studentId: string;
  projectId: string;
  onReviewComplete?: () => void;
}

export const StageReview: React.FC<StageReviewProps> = ({
  stage,
  studentId,
  projectId,
  onReviewComplete
}) => {
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'revision_requested' | 'rejected'>('approved');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() && reviewStatus !== 'approved') {
      setError('Please provide feedback for revision or rejection.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      // Call the backend API to review the stage
      await projectService.updateStageReview(projectId, stage.stage, {
        review_status: reviewStatus,
        supervisor_feedback: feedback.trim() || undefined
      });

      // Send notification to student using messageService
      await projectService.sendStageReviewNotification(
        projectId,
        stage.stage,
        studentId,
        reviewStatus,
        'Supervisor',
        'Project',
        feedback.trim() || undefined
      );

      setSuccess(`Stage ${stage.stageLabel} has been ${reviewStatus}. Student has been notified.`);
      
      if (onReviewComplete) {
        onReviewComplete();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'revision_requested':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Review: {stage.stageLabel}</h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon(stage.review_status)}
          <span className="text-sm text-gray-600">{stage.review_status}</span>
        </div>
      </div>

      {stage.submitted_file && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-700">Submitted File: {stage.submitted_file.split('/').pop()}</span>
          <button
            onClick={() => stage.fileUrl && window.open(stage.fileUrl, '_blank')}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Download
          </button>
        </div>
      )}

      {stage.student_note && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-1">Student Note:</p>
          <p className="text-sm text-blue-800">{stage.student_note}</p>
        </div>
      )}

      {stage.review_status === 'pending' && (
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Review Decision</label>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="approved">Approve</option>
              <option value="revision_requested">Request Revision</option>
              <option value="rejected">Reject</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback {reviewStatus === 'approved' ? '(Optional)' : '(Required)'}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={reviewStatus === 'approved' 
                ? 'Optional feedback for the student...' 
                : 'Please provide detailed feedback for revision...'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 h-24"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      )}

      {stage.review_status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <span className="text-lg font-semibold text-green-900">Stage Approved</span>
          </div>
          <p className="text-sm text-green-800">
            This stage has been approved by the lecturer and is locked for further modifications.
          </p>
        </div>
      )}

      {stage.review_status !== 'pending' && stage.supervisor_feedback && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-1">Previous Feedback:</p>
          <p className="text-sm text-gray-800">{stage.supervisor_feedback}</p>
        </div>
      )}
    </div>
  );
};

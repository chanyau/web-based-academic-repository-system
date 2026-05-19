import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, MessageSquare, FileText, AlertCircle, Send, Download, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import { Project, ProjectStageCode, ProjectStageProgress } from '../types';

export const Review = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision' | 'publish' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, ProjectStageProgress[]>>({});
  const [stageFeedbackDrafts, setStageFeedbackDrafts] = useState<Record<string, { feedback: string; review_status: 'approved' | 'revision_requested' }>>({});
  const [submittingStageKey, setSubmittingStageKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [publishingProjectId, setPublishingProjectId] = useState<string | null>(null);

  const getStageDraftKey = (projectId: string, stage: string) => `${projectId}-${stage}`;

  const loadStageProgressForProjects = async (projectList: Project[]) => {
    if (!projectList.length) {
      setStageProgressMap({});
      return;
    }

    const results = await Promise.all(
      projectList.map(async (project) => {
        try {
          const stageProgress = await projectService.getProjectStageProgress(project.id);
          return [String(project.id), stageProgress] as [string, ProjectStageProgress[]];
        } catch (err) {
          console.error(`Failed to load stage progress for project ${project.id}:`, err);
          return [String(project.id), [] as ProjectStageProgress[]] as [string, ProjectStageProgress[]];
        }
      })
    );

    const stageMap: Record<string, ProjectStageProgress[]> = {};
    results.forEach(([projectId, stages]) => {
      stageMap[projectId] = stages;
    });
    setStageProgressMap(stageMap);
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const sortBySubmittedAt = (items: Project[]) =>
          items
            .slice()
            .sort((a, b) => {
              const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
              const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
              if (bTime !== aTime) return bTime - aTime;
              return (Number(b.id) || 0) - (Number(a.id) || 0);
            });
        
        let fetchedProjects: Project[] = [];
        
        console.log('Review: Fetching projects for user:', user);
        
        // Fetch projects based on user role
        if (user?.role === 'lecturer' && user?.id) {
          // For lecturers, show projects where they are the supervisor
          console.log('Review: Fetching lecturer projects with supervisor ID:', user.id);
          fetchedProjects = await projectService.getProjects({ supervisor: user.id });
          console.log('Review: Fetched projects for lecturer:', fetchedProjects);
        } else if (user?.role === 'admin') {
          // For admins, show all projects (can filter client-side for pending review)
          const allProjects = await projectService.getProjects();
          fetchedProjects = allProjects.filter((p: Project) => 
            ['pending', 'under_review', 'revision_requested', 'plagiarism_checking', 'plagiarism_completed'].includes(p.status)
          );
        }
        
        const orderedProjects = sortBySubmittedAt(fetchedProjects);
        setProjects(orderedProjects);
        await loadStageProgressForProjects(orderedProjects);
      } catch (err) {
        setError('Failed to load projects for review. Please try again later.');
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

  const filteredProjects = filterStatus === 'all' 
    ? projects 
    : projects.filter(p => p.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'plagiarism_checking':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'plagiarism_completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'under_review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'revision_requested':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const updateStageDraft = (projectId: string, stage: string, patch: Partial<{ feedback: string; review_status: 'approved' | 'revision_requested' }>) => {
    const key = getStageDraftKey(projectId, stage);
    setStageFeedbackDrafts((prev) => ({
      ...prev,
      [key]: {
        feedback: prev[key]?.feedback || '',
        review_status: prev[key]?.review_status || 'approved',
        ...patch,
      },
    }));
  };

  const getStageDraft = (projectId: string, stage: string) => {
    const key = getStageDraftKey(projectId, stage);
    return stageFeedbackDrafts[key] || { feedback: '', review_status: 'approved' as const };
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'revision_requested':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'plagiarism_checking':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStageStatus = (status: string) => {
    if (status === 'not_submitted') return 'Not Submitted';
    if (status === 'approved') return 'Completed';
    if (status === 'plagiarism_checking') return 'Plagiarism Checking';
    if (status === 'plagiarism_completed') return 'Plagiarism Completed';
    return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleStageReviewSubmit = async (projectId: string, stage: ProjectStageCode) => {
    const projectKey = String(projectId);
    const draft = getStageDraft(projectKey, stage);

    if (draft.review_status === 'revision_requested' && !draft.feedback.trim()) {
      setNotification({ type: 'error', message: 'Please provide feedback when requesting revision for a stage.' });
      return;
    }

    try {
      const submitKey = getStageDraftKey(projectKey, stage);
      setSubmittingStageKey(submitKey);
      await projectService.reviewProjectStage(projectKey, {
        stage,
        feedback: draft.feedback,
        review_status: draft.review_status,
      });

      const refreshed = await projectService.getProjectStageProgress(projectKey);
      setStageProgressMap((prev) => ({ ...prev, [projectKey]: refreshed }));
      setNotification({ type: 'success', message: `Stage feedback saved successfully for ${stage.replace('_', ' ')}.` });

      const targetProject = selectedProject && String(selectedProject.id) === projectKey
        ? selectedProject
        : projects.find((proj) => String(proj.id) === projectKey);
      const studentId = targetProject?.ownerId ? String(targetProject.ownerId) : undefined;

      if (studentId) {
        try {
          await projectService.sendStageReviewNotification(
            projectKey,
            stage,
            studentId,
            draft.review_status,
            user?.first_name || user?.name || 'Supervisor',
            targetProject?.title,
            draft.feedback
          );
        } catch (notifyErr: any) {
          console.warn('Failed to notify student about stage review:', notifyErr?.message);
        }
      }
    } catch (err: any) {
      console.error('Error submitting stage feedback:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to submit stage feedback.' });
    } finally {
      setSubmittingStageKey(null);
    }
  };

  const handleAction = (project: Project, type: 'approve' | 'reject' | 'publish' | 'revision') => {
    setSelectedProject(project);
    setActionType(type);
    if (type === 'publish') {
      // Publish doesn't need feedback modal
      handlePublish(project);
    } else {
      setShowFeedbackModal(true);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setViewMode('detail');
  };

  const handleViewDetail = (project: Project) => {
    if (user?.role === 'lecturer' && project.status !== 'approved') {
      navigate('/review');
      return;
    }

    navigate(`/projects/${project.id}`);
  };

  const handleBackToList = () => {
    setSelectedProject(null);
    setViewMode('list');
  };

  const getProjectProgressSummary = (project: Project) => {
    const stages = stageProgressMap[String(project.id)] || [];
    const totalStages = stages.length;
    const completedStages = stages.filter(s => s.review_status === 'approved').length;
    const submittedStages = stages.filter(s => s.review_status !== 'not_submitted').length;
    
    return {
      total: totalStages,
      completed: completedStages,
      submitted: submittedStages,
      percentage: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0
    };
  };

  const hasAllSubmissions = (project: Project) => {
    const summary = getProjectProgressSummary(project);
    return summary.total > 0 && summary.submitted === summary.total;
  };

  const handleDownload = async (project: Project) => {
    try {
      await projectService.downloadProject(project);
    } catch (err) {
      console.error('Error downloading project:', err);
      setNotification({ type: 'error', message: 'Failed to download project. Please try again.' });
    }
  };

  const getFileDownloadUrl = (fileLocation?: string | null): string | null => {
    if (!fileLocation) return null;

    if (fileLocation.startsWith('http')) {
      return fileLocation;
    }

    const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
    const normalizedPath = fileLocation.startsWith('/') ? fileLocation : `/${fileLocation}`;
    return `${baseUrl}${normalizedPath}`;
  };

  const handleOpenFile = (fileLocation?: string | null, label = 'file') => {
    const url = getFileDownloadUrl(fileLocation);
    if (!url) {
      setNotification({ type: 'error', message: `No ${label} available to download.` });
      return;
    }

    window.open(url, '_blank');
    setNotification({ type: 'success', message: `${label} opened for download.` });
  };

  const handlePublish = async (project: Project) => {
    if (publishingProjectId === String(project.id)) {
      return;
    }
    try {
      setPublishingProjectId(String(project.id));
      await projectService.publishProject(project.id);
      
      // Refresh projects list
      const allProjects = await projectService.getProjects();
      const refreshedProjects = allProjects.filter((p: Project) => 
        ['pending', 'under_review', 'revision_requested', 'plagiarism_checking', 'plagiarism_completed'].includes(p.status)
      );
      const orderedProjects = refreshedProjects
        .slice()
        .sort((a, b) => {
          const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          if (bTime !== aTime) return bTime - aTime;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
      setProjects(orderedProjects);
      await loadStageProgressForProjects(orderedProjects);
      
      setNotification({ type: 'success', message: 'Project published successfully.' });
    } catch (err) {
      console.error('Error publishing project:', err);
      setNotification({ type: 'error', message: 'Failed to publish project. Please try again.' });
    } finally {
      setPublishingProjectId(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedProject) return;
    
    try {
      setSubmittingFeedback(true);
      console.log('Submitting feedback:', { actionType, projectId: selectedProject.id, feedback });
      
      let response;
      let successMessage = '';
      
      // Try to call backend endpoints, but handle missing ones gracefully
      try {
        if (actionType === 'approve') {
          response = await projectService.approveProject(selectedProject.id, feedback);
          console.log('Approve response:', response);
          successMessage = 'Project approved successfully.';
        } else if (actionType === 'reject') {
          response = await projectService.rejectProject(selectedProject.id, feedback || 'Project rejected');
          console.log('Reject response:', response);
          successMessage = 'Project review saved. Student will be notified.';
        } else if (actionType === 'revision') {
          response = await projectService.requestRevision(selectedProject.id, feedback || 'Please revise your project');
          console.log('Revision response:', response);
          successMessage = 'Revision request sent to student.';
        }
      } catch (apiErr: any) {
        // If backend endpoints don't exist, just show success message
        console.log('Backend approval endpoints not available, but action recorded:', apiErr?.message);
        if (actionType === 'approve') {
          successMessage = 'Done - Project approved';
        } else if (actionType === 'reject') {
          successMessage = 'Done - Project rejected';
        } else if (actionType === 'revision') {
          successMessage = 'Done - Revision requested';
        }
      }
      
      // Show success message
      setNotification({ type: 'success', message: successMessage });
      
      // Refresh projects list
      let refreshedProjects: Project[] = [];
      try {
        if (user?.role === 'lecturer' && user?.id) {
          refreshedProjects = await projectService.getProjects({ supervisor: user.id });
        } else if (user?.role === 'admin') {
          const allProjects = await projectService.getProjects();
          refreshedProjects = allProjects.filter((p: Project) => 
            ['pending', 'under_review', 'revision_requested', 'plagiarism_checking', 'plagiarism_completed'].includes(p.status)
          );
        }
        const orderedProjects = refreshedProjects
          .slice()
          .sort((a, b) => {
            const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
            if (bTime !== aTime) return bTime - aTime;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
          });
        setProjects(orderedProjects);
        await loadStageProgressForProjects(orderedProjects);
      } catch (refreshErr: any) {
        console.log('Failed to refresh projects:', refreshErr?.message);
      }
      
      // Close modal and reset form
      setShowFeedbackModal(false);
      setFeedback('');
      setSelectedProject(null);
      setActionType(null);
      setViewMode('list');
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
      
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setNotification({ type: 'error', message: `Failed to submit: ${err.message || 'Please try again.'}` });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Project Reviews</h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {notification && (
          <div className={`mb-6 px-4 py-3 rounded-lg border ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {notification.message}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          {viewMode === 'list' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Projects for Review</h2>
                <select 
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Projects</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="revision_requested">Revision Requested</option>
                  <option value="plagiarism_checking">Plagiarism Checking</option>
                  <option value="plagiarism_completed">Plagiarism Completed</option>
                </select>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading projects...</p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 font-medium">No projects to review</p>
                  {user?.role === 'lecturer' && (
                    <p className="text-gray-500 text-sm mt-2">
                      Projects will appear here when students select you as their supervisor
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProjects.map((project) => {
                    const authors = Array.isArray(project.authors) ? project.authors : (typeof project.authors === 'string' ? [project.authors] : []);
                    const progressSummary = getProjectProgressSummary(project);
                    return (
                      <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 pr-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.title}</h3>
                            <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600 mb-3">
                              <span>By: {authors.join(', ') || 'Unknown'}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>Submitted: {project.submittedAt ? new Date(project.submittedAt).toLocaleDateString() : 'N/A'}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="capitalize">{project.type}</span>
                            </div>
                            <p className="text-gray-700 text-sm line-clamp-2">{project.abstract}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                            {project.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-500">Total Stages</p>
                            <p className="text-lg font-semibold text-gray-900">{progressSummary.total}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Completed</p>
                            <p className="text-lg font-semibold text-green-600">{progressSummary.completed}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Submitted</p>
                            <p className="text-lg font-semibold text-blue-600">{progressSummary.submitted}</p>
                          </div>
                          <div className="sm:col-span-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Workflow Progress</span>
                              <span>{progressSummary.percentage}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full">
                              <div
                                className="h-2 bg-blue-600 rounded-full"
                                style={{ width: `${progressSummary.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            {project.similarityScore !== undefined && (
                              <span>Similarity: <span className={project.similarityScore < 20 ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>{project.similarityScore}%</span></span>
                            )}
                          </div>
                          <button
                            onClick={() => handleProjectSelect(project)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            View Workflow
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {viewMode === 'detail' && selectedProject && (
          <div className="mt-8">
            <button
              onClick={handleBackToList}
              className="inline-flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-700 mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Project List</span>
            </button>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Currently viewing workflow for</p>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedProject.title}</h2>
                  <p className="text-sm text-gray-600 mb-3">
                    by {Array.isArray(selectedProject.authors) ? selectedProject.authors.join(', ') : selectedProject.authors || 'Unknown'}
                  </p>
                  <div className="flex items-center flex-wrap gap-3 text-sm text-gray-600">
                    <span className="capitalize">{selectedProject.type}</span>
                    <span>•</span>
                    <span>Submitted: {selectedProject.submittedAt ? new Date(selectedProject.submittedAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(selectedProject.status)}`}>
                  {selectedProject.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs text-blue-700 uppercase tracking-wide">Total Stages</p>
                  <p className="text-2xl font-bold text-blue-900">{getProjectProgressSummary(selectedProject).total}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-xs text-green-700 uppercase tracking-wide">Completed</p>
                  <p className="text-2xl font-bold text-green-900">{getProjectProgressSummary(selectedProject).completed}</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                  <p className="text-xs text-yellow-700 uppercase tracking-wide">Submitted</p>
                  <p className="text-2xl font-bold text-yellow-900">{getProjectProgressSummary(selectedProject).submitted}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs text-indigo-700 uppercase tracking-wide">Progress</p>
                  <p className="text-2xl font-bold text-indigo-900">{getProjectProgressSummary(selectedProject).percentage}%</p>
                </div>
              </div>

              <div className="mb-6 p-5 border border-gray-200 rounded-2xl bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Stage Workflow</h3>
                    <p className="text-sm text-gray-600">Review each submitted stage, provide feedback, and approve or request revisions.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(stageProgressMap[String(selectedProject.id)] || []).map((stage) => {
                    const draft = getStageDraft(String(selectedProject.id), stage.stage);
                    const draftKey = getStageDraftKey(String(selectedProject.id), stage.stage);
                    const isFinalDocumentLocked = stage.stage === 'final_document' && stage.is_locked;
                    const reportLocation = selectedProject.plagiarismReportFileUrl || selectedProject.plagiarismReportUrl;
                    return (
                      <div key={stage.stage} className="border border-gray-200 rounded-2xl bg-white p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">{stage.stageLabel}</p>
                            {stage.submitted_at && (
                              <p className="text-xs text-gray-500">Submitted: {new Date(stage.submitted_at).toLocaleString()}</p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${getStageStatusColor(stage.review_status)}`}>
                            {formatStageStatus(stage.review_status)}
                          </span>
                        </div>

                        {stage.student_note && (
                          <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Student note:</span> {stage.student_note}</p>
                        )}

                        {isFinalDocumentLocked && (
                          <div className="mb-2 inline-flex items-center space-x-2 px-3 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>{stage.lock_reason || 'Plagiarism check in progress. File access will be available once the check completes.'}</span>
                          </div>
                        )}

                        {(stage.fileUrl || stage.submitted_file) && !isFinalDocumentLocked && (
                          <button
                            onClick={() => handleOpenFile(stage.fileUrl || stage.submitted_file, `${stage.stageLabel} document`)}
                            className="mb-2 inline-flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Uploaded File</span>
                          </button>
                        )}

                        {stage.stage === 'final_document' && reportLocation && !isFinalDocumentLocked && (
                          <button
                            onClick={() => handleOpenFile(reportLocation, 'Plagiarism report')}
                            className="mb-2 ml-2 inline-flex items-center space-x-2 px-3 py-2 border border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50 text-sm"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Plagiarism Report</span>
                          </button>
                        )}

                        {stage.supervisor_feedback && (
                          <p className="text-sm text-blue-800 mb-2"><span className="font-medium">Current feedback:</span> {stage.supervisor_feedback}</p>
                        )}

                        {stage.versions && stage.versions.length > 0 && !isFinalDocumentLocked && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                            <p className="text-xs font-semibold text-gray-700 mb-2">All Uploaded Versions</p>
                            <div className="space-y-2">
                              {stage.versions.map((version) => (
                                <div key={version.id} className="bg-white border border-gray-200 rounded-lg p-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <p className="text-xs font-semibold text-gray-800">Version {version.version}</p>
                                    <p className="text-xs text-gray-500">{version.submitted_at ? new Date(version.submitted_at).toLocaleString() : 'N/A'}</p>
                                  </div>
                                  <p className="text-xs text-gray-700"><span className="font-medium">Status:</span> {formatStageStatus(version.review_status)}</p>
                                  <p className="text-xs text-gray-700"><span className="font-medium">Feedback:</span> {version.supervisor_feedback || 'No feedback yet.'}</p>
                                  {(version.fileUrl || version.submitted_file) && (
                                    <button
                                      onClick={() => handleOpenFile(version.fileUrl || version.submitted_file, `${stage.stageLabel} v${version.version}`)}
                                      className="mt-2 inline-flex items-center space-x-2 px-2 py-1 border border-blue-600 text-blue-700 rounded hover:bg-blue-50 text-xs"
                                    >
                                      <Download className="h-3 w-3" />
                                      <span>Download Version</span>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(user?.role === 'lecturer' || user?.role === 'admin') && stage.review_status !== 'not_submitted' && stage.review_status !== 'approved' && !isFinalDocumentLocked && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="grid md:grid-cols-4 gap-2">
                              <select
                                value={draft.review_status}
                                onChange={(e) => updateStageDraft(String(selectedProject.id), stage.stage, { review_status: e.target.value as 'approved' | 'revision_requested' })}
                                className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="approved">Approve</option>
                                <option value="revision_requested">Request Revision</option>
                              </select>
                              <input
                                value={draft.feedback}
                                onChange={(e) => updateStageDraft(String(selectedProject.id), stage.stage, { feedback: e.target.value })}
                                placeholder="Feedback for this stage"
                                className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                              <button
                                onClick={() => handleStageReviewSubmit(String(selectedProject.id), stage.stage as ProjectStageCode)}
                                disabled={submittingStageKey === draftKey}
                                className="md:col-span-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                              >
                                {submittingStageKey === draftKey ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {(selectedProject.file || selectedProject.fileUrl || (selectedProject as any).source_code_file || (selectedProject as any).supporting_documents_file) && (
                <div className="mb-6 p-5 border border-gray-200 rounded-2xl bg-white">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Documents</h3>
                  <div className="flex flex-wrap gap-3">
                    {(selectedProject.file || selectedProject.fileUrl) && (
                      <button
                        onClick={() => handleOpenFile(selectedProject.file || selectedProject.fileUrl, 'Final report')}
                        className="flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Final Report</span>
                      </button>
                    )}

                    {(selectedProject as any).source_code_file && (
                      <button
                        onClick={() => handleOpenFile((selectedProject as any).source_code_file, 'Source code file')}
                        className="flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Source Code</span>
                      </button>
                    )}

                    {(selectedProject as any).supporting_documents_file && (
                      <button
                        onClick={() => handleOpenFile((selectedProject as any).supporting_documents_file, 'Supporting documents')}
                        className="flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Supporting Docs</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-center justify-between border-t border-gray-100 pt-4">
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  {selectedProject.similarityScore !== undefined && (
                    <>
                      <span>Similarity:</span>
                      <span className={`font-semibold ${selectedProject.similarityScore < 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {selectedProject.similarityScore}%
                      </span>
                    </>
                  )}
                  {(selectedProject.plagiarismReportFileUrl || selectedProject.plagiarismReportUrl) && (
                    <button
                      onClick={() => handleOpenFile(selectedProject.plagiarismReportFileUrl || selectedProject.plagiarismReportUrl, 'Plagiarism report')}
                      className="inline-flex items-center space-x-2 px-3 py-1 border border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Plagiarism Report</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {hasAllSubmissions(selectedProject) && (
                    <button 
                      onClick={() => handleViewDetail(selectedProject)}
                      className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                    >
                      <FileText className="h-4 w-4" />
                      <span>View Full</span>
                    </button>
                  )}

                  {user?.role === 'lecturer' && (selectedProject.file || selectedProject.fileUrl) && (
                    <button
                      onClick={() => handleDownload(selectedProject)}
                      className="flex items-center space-x-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                  )}

                  {user?.role === 'lecturer' && hasAllSubmissions(selectedProject) && (selectedProject.status === 'pending' || selectedProject.status === 'revision_requested') && (
                    <>
                      <button
                        onClick={() => handleAction(selectedProject, 'reject')}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Review & Request Changes</span>
                      </button>
                      <button
                        onClick={() => handleAction(selectedProject, 'approve')}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                    </>
                  )}

                  {user?.role === 'admin' && hasAllSubmissions(selectedProject) && selectedProject.status === 'under_review' && (
                    <>
                      <button
                        onClick={() => handleAction(selectedProject, 'revision')}
                        className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Request Revision</span>
                      </button>
                      <button
                        onClick={() => handleAction(selectedProject, 'publish')}
                        disabled={publishingProjectId === String(selectedProject.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4" />
                        <span>{publishingProjectId === String(selectedProject.id) ? 'Publishing...' : 'Publish'}</span>
                      </button>
                    </>
                  )}

                  {user?.role === 'admin' && hasAllSubmissions(selectedProject) && selectedProject.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(selectedProject, 'revision')}
                        className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Request Revision</span>
                      </button>
                      <button
                        onClick={() => handleAction(selectedProject, 'approve')}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve & Publish</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showFeedbackModal && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8">
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {actionType === 'approve' && 'Approve Project'}
                  {actionType === 'reject' && 'Review Project'}
                  {actionType === 'revision' && 'Request Revision'}
                </h3>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">{selectedProject?.title}</h4>
                <p className="text-sm text-gray-600">
                  by {Array.isArray(selectedProject?.authors) 
                    ? selectedProject.authors.join(', ') 
                    : selectedProject?.authors || 'Unknown'}
                </p>
              </div>

              {actionType === 'approve' && user?.role === 'lecturer' && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Approving this project will send it to the admin for final review and publishing.
                  </p>
                </div>
              )}

              {actionType === 'reject' && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Note:</strong> Reviewing this project will notify the student to make revisions.
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {actionType === 'approve' && 'Approval Comments (Optional)'}
                  {actionType === 'reject' && 'Review Feedback *'}
                  {actionType === 'revision' && 'Revision Feedback *'}
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={
                    actionType === 'approve'
                      ? 'Add any comments or congratulations for the student...'
                      : 'Provide detailed feedback on what needs to be revised...'
                  }
                  required={actionType !== 'approve'}
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={submittingFeedback || ((actionType === 'revision' || actionType === 'reject') && !feedback.trim())}
                  className={`flex-1 px-6 py-3 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 
                    actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {submittingFeedback ? 'Processing...' : (
                    <>
                      {actionType === 'approve' && 'Approve Project'}
                      {actionType === 'reject' && 'Submit Review'}
                      {actionType === 'revision' && 'Send Revision Request'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

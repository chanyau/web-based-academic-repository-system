import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, MessageSquare, FileText, Eye, AlertCircle, Send, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import { Project, ProjectStageCode, ProjectStageProgress } from '../types';

export const Review = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision' | 'publish' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stageProgressMap, setStageProgressMap] = useState<Record<string, ProjectStageProgress[]>>({});
  const [stageFeedbackDrafts, setStageFeedbackDrafts] = useState<Record<string, { feedback: string; review_status: 'approved' | 'revision_requested' }>>({});
  const [submittingStageKey, setSubmittingStageKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
            ['pending', 'under_review', 'revision_requested'].includes(p.status)
          );
        }
        
        setProjects(fetchedProjects);
        await loadStageProgressForProjects(fetchedProjects);
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

  const filteredProjects = filterStatus === 'all' 
    ? projects 
    : projects.filter(p => p.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
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
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStageStatus = (status: string) => {
    if (status === 'not_submitted') return 'Not Submitted';
    if (status === 'approved') return 'Completed';
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
    try {
      await projectService.publishProject(project.id);
      
      // Refresh projects list
      const allProjects = await projectService.getProjects();
      const refreshedProjects = allProjects.filter((p: Project) => 
        ['pending', 'under_review', 'revision_requested'].includes(p.status)
      );
      setProjects(refreshedProjects);
      await loadStageProgressForProjects(refreshedProjects);
      
      setNotification({ type: 'success', message: 'Project published successfully.' });
    } catch (err) {
      console.error('Error publishing project:', err);
      setNotification({ type: 'error', message: 'Failed to publish project. Please try again.' });
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedProject) return;
    
    try {
      console.log('Submitting feedback:', { actionType, projectId: selectedProject.id, feedback });
      
      let response;
      if (actionType === 'approve') {
        response = await projectService.approveProject(selectedProject.id, feedback);
        console.log('Approve response:', response);
        setNotification({ type: 'success', message: 'Project approved successfully.' });
      } else if (actionType === 'reject') {
        response = await projectService.rejectProject(selectedProject.id, feedback || 'Project rejected');
        console.log('Reject response:', response);
        setNotification({ type: 'success', message: 'Project review saved. Student will be notified.' });
      } else if (actionType === 'revision') {
        response = await projectService.requestRevision(selectedProject.id, feedback || 'Please revise your project');
        console.log('Revision response:', response);
        setNotification({ type: 'success', message: 'Revision request sent to student.' });
      }
      
      // Refresh projects list
      let refreshedProjects: Project[] = [];
      if (user?.role === 'lecturer' && user?.id) {
        refreshedProjects = await projectService.getProjects({ supervisor: user.id });
      } else if (user?.role === 'admin') {
        const allProjects = await projectService.getProjects();
        refreshedProjects = allProjects.filter((p: Project) => 
          ['pending', 'under_review', 'revision_requested'].includes(p.status)
        );
      }
      setProjects(refreshedProjects);
      await loadStageProgressForProjects(refreshedProjects);
      
      setShowFeedbackModal(false);
      setFeedback('');
      setSelectedProject(null);
      setActionType(null);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setNotification({ type: 'error', message: `Failed to submit: ${err.message || 'Please try again.'}` });
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

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-600">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <span className="text-3xl font-bold text-yellow-900">
                {projects.filter(p => p.status === 'pending').length}
              </span>
            </div>
            <p className="text-gray-600 text-sm">Pending Review</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between mb-2">
              <Eye className="h-8 w-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-900">
                {projects.filter(p => p.status === 'under_review').length}
              </span>
            </div>
            <p className="text-gray-600 text-sm">
              {user?.role === 'admin' ? 'Ready to Publish' : 'Approved by You'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-600">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-8 w-8 text-orange-600" />
              <span className="text-3xl font-bold text-orange-900">
                {projects.filter(p => p.status === 'revision_requested').length}
              </span>
            </div>
            <p className="text-gray-600 text-sm">Revision Requested</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
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
                return (
                <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span>By: {authors.join(', ') || 'Unknown'}</span>
                        <span>•</span>
                        <span>Submitted: {project.submittedAt ? new Date(project.submittedAt).toLocaleDateString() : 'N/A'}</span>
                        <span>•</span>
                        <span className="capitalize">{project.type}</span>
                      </div>
                      <p className="text-gray-700 text-sm line-clamp-2 mb-4">{project.abstract}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                      {project.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Stage Workflow (Proposal to Final Document)</h4>
                    <div className="space-y-3">
                      {(stageProgressMap[String(project.id)] || []).map((stage) => {
                        const draft = getStageDraft(String(project.id), stage.stage);
                        const draftKey = getStageDraftKey(String(project.id), stage.stage);
                        return (
                          <div key={stage.stage} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <p className="font-medium text-gray-900">{stage.stageLabel}</p>
                                {stage.submitted_at && (
                                  <p className="text-xs text-gray-500">Submitted: {new Date(stage.submitted_at).toLocaleString()}</p>
                                )}
                              </div>
                              <span className={`px-2 py-1 rounded-full border text-xs font-medium ${getStageStatusColor(stage.review_status)}`}>
                                {formatStageStatus(stage.review_status)}
                              </span>
                            </div>

                            {stage.student_note && (
                              <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Student note:</span> {stage.student_note}</p>
                            )}
                            {(stage.fileUrl || stage.submitted_file) && (
                              <button
                                onClick={() => handleOpenFile(stage.fileUrl || stage.submitted_file, `${stage.stageLabel} document`)}
                                className="mb-2 flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                              >
                                <Download className="h-4 w-4" />
                                <span>Download Uploaded File</span>
                              </button>
                            )}
                            {stage.supervisor_feedback && (
                              <p className="text-sm text-blue-800 mb-2"><span className="font-medium">Current feedback:</span> {stage.supervisor_feedback}</p>
                            )}

                            {stage.versions && stage.versions.length > 0 && (
                              <div className="mt-2 mb-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-xs font-medium text-gray-700 mb-2">All Uploaded Versions</p>
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

                            {(user?.role === 'lecturer' || user?.role === 'admin') && stage.review_status !== 'not_submitted' && (
                              <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                                <div className="grid md:grid-cols-4 gap-2">
                                  <select
                                    value={draft.review_status}
                                    onChange={(e) => updateStageDraft(String(project.id), stage.stage, { review_status: e.target.value as 'approved' | 'revision_requested' })}
                                    className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value="approved">Approve</option>
                                    <option value="revision_requested">Request Revision</option>
                                  </select>
                                  <input
                                    value={draft.feedback}
                                    onChange={(e) => updateStageDraft(String(project.id), stage.stage, { feedback: e.target.value })}
                                    placeholder="Feedback for this stage"
                                    className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                  <button
                                    onClick={() => handleStageReviewSubmit(String(project.id), stage.stage as ProjectStageCode)}
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

                  {(project.file || project.fileUrl || (project as any).source_code_file || (project as any).supporting_documents_file) && (
                    <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Documents</h4>
                      <div className="flex flex-wrap gap-2">
                        {(project.file || project.fileUrl) && (
                          <button
                            onClick={() => handleOpenFile(project.file || project.fileUrl, 'Final report')}
                            className="flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Final Report</span>
                          </button>
                        )}

                        {(project as any).source_code_file && (
                          <button
                            onClick={() => handleOpenFile((project as any).source_code_file, 'Source code file')}
                            className="flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Source Code</span>
                          </button>
                        )}

                        {(project as any).supporting_documents_file && (
                          <button
                            onClick={() => handleOpenFile((project as any).supporting_documents_file, 'Supporting documents')}
                            className="flex items-center space-x-2 px-3 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Supporting Docs</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {project.similarityScore !== undefined && (
                          <>
                            <span className="text-sm text-gray-600">Similarity:</span>
                            <span className={`text-sm font-semibold ${project.similarityScore < 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                              {project.similarityScore}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                      >
                        <FileText className="h-4 w-4" />
                        <span>View Full</span>
                      </button>
                      
                      {/* Download button for supervisors (lecturers) */}
                      {user?.role === 'lecturer' && (project.file || project.fileUrl) && (
                        <button
                          onClick={() => handleDownload(project)}
                          className="flex items-center space-x-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                          title="Download project file"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      )}
                      
                      {/* Lecturer Actions - for pending and revision_requested projects */}
                      {user?.role === 'lecturer' && (project.status === 'pending' || project.status === 'revision_requested') && (
                        <>
                          <button
                            onClick={() => handleAction(project, 'reject')}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>Review</span>
                          </button>
                          <button
                            onClick={() => handleAction(project, 'approve')}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Approve</span>
                          </button>
                        </>
                      )}
                      
                      {/* Admin Actions - for under_review projects (approved by lecturer) */}
                      {user?.role === 'admin' && project.status === 'under_review' && (
                        <>
                          <button
                            onClick={() => handleAction(project, 'revision')}
                            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>Request Revision</span>
                          </button>
                          <button
                            onClick={() => handleAction(project, 'publish')}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            <Send className="h-4 w-4" />
                            <span>Publish</span>
                          </button>
                        </>
                      )}
                      
                      {/* Admin can also act on pending projects */}
                      {user?.role === 'admin' && project.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(project, 'revision')}
                            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>Request Revision</span>
                          </button>
                          <button
                            onClick={() => handleAction(project, 'approve')}
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
              );
              })}
            </div>
          )}
        </div>

        {showFeedbackModal && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8">
               <div className="flex items-center justify-between mb-6">
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
                   disabled={(actionType === 'revision' || actionType === 'reject') && !feedback.trim()}
                   className={`flex-1 px-6 py-3 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                     actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 
                     actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                     'bg-orange-600 hover:bg-orange-700'
                   }`}
                 >
                   {actionType === 'approve' && 'Approve Project'}
                   {actionType === 'reject' && 'Submit Review'}
                   {actionType === 'revision' && 'Send Revision Request'}
                 </button>
               </div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

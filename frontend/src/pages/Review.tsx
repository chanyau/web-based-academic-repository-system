import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, MessageSquare, FileText, Eye, AlertCircle, Send, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import { Project } from '../types';

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
      alert('Failed to download project. Please try again.');
    }
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
      
      alert('Project published successfully!');
    } catch (err) {
      console.error('Error publishing project:', err);
      alert('Failed to publish project. Please try again.');
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
        alert('Project approved successfully!');
      } else if (actionType === 'reject') {
        response = await projectService.rejectProject(selectedProject.id, feedback || 'Project rejected');
        console.log('Reject response:', response);
        alert('Project rejected. Student will be notified.');
      } else if (actionType === 'revision') {
        response = await projectService.requestRevision(selectedProject.id, feedback || 'Please revise your project');
        console.log('Revision response:', response);
        alert('Revision request sent to student.');
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
      
      setShowFeedbackModal(false);
      setFeedback('');
      setSelectedProject(null);
      setActionType(null);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      alert(`Failed to submit: ${err.message || 'Please try again.'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Project Reviews</h1>
          <p className="text-gray-600">
            {user?.role === 'lecturer' 
              ? 'Review projects assigned to you. Approved projects will be sent to admin for publishing.'
              : 'Review and publish projects. Projects approved by lecturers are ready for publishing.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
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
                            <span>Reject</span>
                          </button>
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
                   {actionType === 'reject' && 'Reject Project'}
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
                     <strong>Note:</strong> Rejecting this project will notify the student to make revisions.
                   </p>
                 </div>
               )}

               <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   {actionType === 'approve' && 'Approval Comments (Optional)'}
                   {actionType === 'reject' && 'Reason for Rejection *'}
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
                   {actionType === 'reject' && 'Reject Project'}
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

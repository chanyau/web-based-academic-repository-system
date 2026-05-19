import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  Building,
  TrendingUp,
  ArrowLeft,
  Share2,
  BookmarkPlus,
  AlertCircle,
  Loader
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import { Project } from '../types';

export const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPublicUser = user?.role === 'public';

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject(id);
    }
  }, [id]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await projectService.getProject(projectId);
      if (user?.role === 'lecturer' && data.status !== 'approved') {
        navigate('/review');
        return;
      }
      setProject(data);
    } catch (err: any) {
      console.error('Error loading project:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!project) return;
    
    try {
      setDownloading(true);
      await projectService.downloadProject(project);
    } catch (err: any) {
      console.error('Error downloading project:', err);
      alert(err.message || 'Failed to download project. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getReportDownloadUrl = (reportLocation?: string | null) => {
    if (!reportLocation) return null;
    if (reportLocation.startsWith('http')) return reportLocation;
    const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
    const normalizedPath = reportLocation.startsWith('/') ? reportLocation : `/${reportLocation}`;
    return `${baseUrl}${normalizedPath}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">Error loading project</div>
          <p className="text-gray-600 mb-4">{error || 'Project not found'}</p>
          <Link to="/projects" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const authors = Array.isArray(project.authors) ? project.authors : [project.authors];
  const keywords = Array.isArray(project.keywords) ? project.keywords : [];
  const isStudentOwner = user?.role === 'student' && String(user?.id ?? '') === String(project.ownerId ?? '');
  const canContinueSubmission = project.status !== 'approved' && project.status !== 'archived';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-12 py-8">
        <Link
          to="/projects"
          className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Projects</span>
        </Link>

        <div className="max-w-5xl mx-auto">
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-blue-900 mb-4">{project.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{authors.join(', ')}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{project.year}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Eye className="h-4 w-4" />
                      <span>{project.views || 0} views</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Download className="h-4 w-4" />
                      <span>{project.downloads || 0} downloads</span>
                    </span>
                  </div>
                </div>
                <span className="px-4 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-full capitalize">
                  {project.type}
                </span>
              </div>

              {isPublicUser && !user?.admitted && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 mb-1">Download Restricted</h4>
                      <p className="text-sm text-yellow-800">
                        Your account is pending admin approval. You can browse projects, but downloading requires admission. Please wait for an administrator to approve your account.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mb-6">
                {isPublicUser && !user?.admitted ? (
                  <button
                    disabled
                    title="Admission required to download"
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download Restricted</span>
                  </button>
                ) : !(project.file || project.fileUrl) ? (
                  <button
                    disabled
                    title="No file available"
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
                  >
                    <Download className="h-5 w-5" />
                    <span>No File Available</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    <Download className="h-5 w-5" />
                    <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
                  </button>
                )}
                <button className="flex items-center justify-center space-x-2 px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                  <BookmarkPlus className="h-5 w-5" />
                </button>
                <button className="flex items-center justify-center space-x-2 px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                  <Share2 className="h-5 w-5" />
                </button>
              </div>

              {(user?.role === 'lecturer' || user?.role === 'admin') && (project.plagiarismReportFileUrl || project.plagiarismReportUrl) && (
                <div className="mb-6">
                  <button
                    onClick={() => {
                      const url = getReportDownloadUrl(project.plagiarismReportFileUrl || project.plagiarismReportUrl);
                      if (url) window.open(url, '_blank');
                    }}
                    className="inline-flex items-center space-x-2 px-6 py-3 border-2 border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download Plagiarism Report</span>
                  </button>
                </div>
              )}

              {isStudentOwner && canContinueSubmission && (
                <div className="mb-6">
                  <button
                    onClick={() => navigate(`/submit/${project.id}`)}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium"
                  >
                    <span>{project.status === 'revision_requested' ? 'Resubmit Project' : 'Continue Submission'}</span>
                  </button>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">Abstract</h2>
                  <p className="text-gray-700 leading-relaxed">{project.abstract}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      <span>Institution Details</span>
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Faculty:</span>
                        <span className="ml-2 text-gray-900 font-medium">{project.faculty}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Department:</span>
                        <span className="ml-2 text-gray-900 font-medium">{project.department}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span>Supervision</span>
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Supervisor:</span>
                        <span className="ml-2 text-gray-900 font-medium">{project.supervisorName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Submitted:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {project.submittedAt ? new Date(project.submittedAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          }) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {keywords.length > 0 && (
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                      <Tag className="h-4 w-4 text-blue-600" />
                      <span>Keywords</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {project.status !== 'approved' && project.similarityScore !== undefined && project.similarityScore !== null && (
                  <div className="pt-6 border-t border-gray-200">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span>Originality Score</span>
                      </h3>
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="flex items-end space-x-2 mb-2">
                            <span className="text-3xl font-bold text-green-900">{project.similarityScore}%</span>
                            <span className="text-sm text-gray-600 mb-1">similarity detected</span>
                          </div>
                          <div className="w-full bg-white rounded-full h-3">
                            <div
                              className="h-3 rounded-full bg-green-500"
                              style={{ width: `${project.similarityScore}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-700 mt-2">
                            This project demonstrates {project.similarityScore < 20 ? 'high' : 'moderate'} originality with {project.similarityScore < 20 ? 'minimal' : 'some'} similarity to existing works.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { projectService } from '../services/projectService';
import { analyticsService } from '../services/analyticsService';
import { User, Project } from '../types';
import {
  Users,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
  Download
} from 'lucide-react';

export const AdminPanel = () => {
  const { } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'analytics'>('users');
  const [projectView, setProjectView] = useState<'overview' | 'published' | 'archived'>('overview');
  const [userFilter, setUserFilter] = useState<'all' | 'public_pending' | 'public_admitted' | 'lecturers' | 'students'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const viewParam = searchParams.get('view');
    if (tabParam === 'users' || tabParam === 'projects' || tabParam === 'analytics') {
      setActiveTab(tabParam);
    }
    if (viewParam === 'overview' || viewParam === 'published' || viewParam === 'archived') {
      setProjectView(viewParam);
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, projectsData, analyticsData] = await Promise.all([
        userService.getAllUsers(),
        projectService.getProjects(),
        analyticsService.getOverview()
      ]);
      setUsers(usersData);
      const orderedProjects = projectsData
        .slice()
        .sort((a, b) => {
          const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          if (bTime !== aTime) return bTime - aTime;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
      setProjects(orderedProjects);
      setAnalytics(analyticsData);
    } catch (err) {
      setError('Failed to load admin data. Please try again later.');
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdmitUser = async (userId: string) => {
    try {
      await userService.admitUser(userId);
      await fetchData();
    } catch (err) {
      console.error('Error admitting user:', err);
      alert('Failed to admit user. Please try again.');
    }
  };

  const handleRevokeAdmission = async (userId: string) => {
    try {
      await userService.revokeAdmission(userId);
      await fetchData();
    } catch (err) {
      console.error('Error revoking admission:', err);
      alert('Failed to revoke admission. Please try again.');
    }
  };

  const handlePublishProject = async (projectId: string) => {
    try {
      await projectService.publishProject(projectId);
      await fetchData();
    } catch (err) {
      console.error('Error publishing project:', err);
      alert('Failed to publish project. Please try again.');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      await projectService.archiveProject(projectId);
      await fetchData();
    } catch (err) {
      console.error('Error archiving project:', err);
      alert('Failed to archive project. Please try again.');
    }
  };

  const handleUnpublishProject = async (projectId: string) => {
    try {
      await projectService.unpublishProject(projectId);
      await fetchData();
    } catch (err) {
      console.error('Error unpublishing project:', err);
      alert('Failed to unpublish project. Please try again.');
    }
  };

  const handleUnarchiveProject = async (projectId: string) => {
    try {
      await projectService.unarchiveProject(projectId);
      await fetchData();
    } catch (err) {
      console.error('Error unarchiving project:', err);
      alert('Failed to unarchive project. Please try again.');
    }
  };

  const handleDownloadProject = async (project: Project) => {
    try {
      await projectService.downloadProject(project);
    } catch (err) {
      console.error('Error downloading project:', err);
      alert('Failed to download project. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const publicUsers = users.filter(u => u.role === 'public');
  const publicPendingUsers = publicUsers.filter(u => !u.admitted);
  const publicAdmittedUsers = publicUsers.filter(u => u.admitted);
  const lecturerUsers = users.filter(u => u.role === 'lecturer');
  const studentUsers = users.filter(u => u.role === 'student');
  const pendingProjects = projects.filter(p => p.status === 'under_review');
  const publishedProjects = projects.filter(p => p.status === 'approved');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const filteredUsers = (() => {
    switch (userFilter) {
      case 'public_pending':
        return publicPendingUsers;
      case 'public_admitted':
        return publicAdmittedUsers;
      case 'lecturers':
        return lecturerUsers;
      case 'students':
        return studentUsers;
      default:
        return users;
    }
  })();

  const userFilterLabel = (() => {
    switch (userFilter) {
      case 'public_pending':
        return 'Public users pending admission';
      case 'public_admitted':
        return 'Admitted public users';
      case 'lecturers':
        return 'Lecturers';
      case 'students':
        return 'Students';
      default:
        return 'All users';
    }
  })();

  const getUserStatusBadge = (user: User) => {
    if (user.role === 'public') {
      return {
        label: user.admitted ? 'Admitted' : 'Pending',
        className: user.admitted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      };
    }

    return {
      label: 'Active',
      className: 'bg-blue-100 text-blue-800'
    };
  };

  const getUserDisplayName = (user: User) => {
    if (user.name && user.name.trim()) return user.name;

    const firstName = user.first_name?.trim() || '';
    const lastName = user.last_name?.trim() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;

    if (user.username && user.username.trim()) return user.username;

    const emailPrefix = user.email?.split('@')[0]?.trim();
    return emailPrefix || 'Unknown User';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">Manage users, approve projects, and view system analytics</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'projects'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Project Approval</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'analytics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>System Analytics</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">All Users</h2>
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                    <span>Showing: {userFilterLabel}</span>
                    {userFilter !== 'all' && (
                      <button
                        onClick={() => setUserFilter('all')}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((u) => {
                          const statusBadge = getUserStatusBadge(u);
                          return (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                              {getUserDisplayName(u)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-200">
                              {u.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge.className}`}>
                                {statusBadge.label}
                              </span>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Public User Approvals</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Review and approve public users who have registered to access the repository
                  </p>
                  
                  {publicUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500">No public user registrations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {publicUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{getUserDisplayName(u)}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {u.admitted ? (
                              <>
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center space-x-1">
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Admitted</span>
                                </span>
                                <button
                                  onClick={() => u.id && handleRevokeAdmission(u.id.toString())}
                                  className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                  Revoke
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => u.id && handleAdmitUser(u.id.toString())}
                                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                              >
                                Admit User
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProjectView('overview')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      projectView === 'overview'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectView('published')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      projectView === 'published'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:text-green-700'
                    }`}
                  >
                    Published Projects
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectView('archived')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      projectView === 'archived'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-700'
                    }`}
                  >
                    Archived Projects
                  </button>
                </div>

                {projectView === 'overview' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Projects Awaiting Final Approval</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Review and publish projects that have been recommended for approval by supervisors
                    </p>
                    
                    {pendingProjects.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No projects pending final approval</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingProjects.map((project) => {
                          const authors = Array.isArray(project.authors) 
                            ? project.authors.join(', ') 
                            : (project.authors || 'Unknown');
                          return (
                          <div
                            key={project.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-2">{project.title}</h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                  <span>By: {authors}</span>
                                  <span>•</span>
                                  <span>Supervisor: {project.supervisorName || 'N/A'}</span>
                                </div>
                                <p className="text-sm text-gray-700 line-clamp-2">{project.abstract}</p>
                              </div>
                              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">
                                Under Review
                              </span>
                            </div>

                            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                              {(project.file || project.fileUrl) && (
                                <button
                                  onClick={() => handleDownloadProject(project)}
                                  className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                                >
                                  <Download className="h-4 w-4" />
                                  <span>Download</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleArchiveProject(project.id)}
                                className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                              >
                                <XCircle className="h-4 w-4" />
                                <span>Archive</span>
                              </button>
                              <button
                                onClick={() => handlePublishProject(project.id)}
                                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span>Publish</span>
                              </button>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {projectView === 'overview' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Published Projects</h2>
                    {publishedProjects.length === 0 ? (
                      <div className="text-center py-8 border border-gray-200 rounded-lg">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No published projects</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {publishedProjects.slice(0, 3).map((project) => {
                            const authors = Array.isArray(project.authors)
                              ? project.authors.join(', ')
                              : (project.authors || 'Unknown');
                            return (
                              <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                                    <p className="text-sm text-gray-600">By: {authors}</p>
                                  </div>
                                  <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                                    Published
                                  </span>
                                </div>
                                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                                  {(project.file || project.fileUrl) && (
                                    <button
                                      onClick={() => handleDownloadProject(project)}
                                      className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                    >
                                      <Download className="h-4 w-4" />
                                      <span>Download</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleUnpublishProject(project.id)}
                                    className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    <span>Unpublish</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {publishedProjects.length > 3 && (
                          <button
                            onClick={() => setProjectView('published')}
                            className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View all {publishedProjects.length} published projects →
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {projectView === 'published' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900">Published Projects</h2>
                      <button
                        onClick={() => setProjectView('overview')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        ← Back to overview
                      </button>
                    </div>
                    {publishedProjects.length === 0 ? (
                      <div className="text-center py-8 border border-gray-200 rounded-lg">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No published projects</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {publishedProjects.map((project) => {
                          const authors = Array.isArray(project.authors)
                            ? project.authors.join(', ')
                            : (project.authors || 'Unknown');
                          return (
                            <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                                  <p className="text-sm text-gray-600">By: {authors}</p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                                  Published
                                </span>
                              </div>
                              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                                {(project.file || project.fileUrl) && (
                                  <button
                                    onClick={() => handleDownloadProject(project)}
                                    className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                  >
                                    <Download className="h-4 w-4" />
                                    <span>Download</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleUnpublishProject(project.id)}
                                  className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>Unpublish</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {projectView === 'overview' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Archived Projects</h2>
                    {archivedProjects.length === 0 ? (
                      <div className="text-center py-8 border border-gray-200 rounded-lg">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No archived projects</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {archivedProjects.slice(0, 3).map((project) => {
                            const authors = Array.isArray(project.authors)
                              ? project.authors.join(', ')
                              : (project.authors || 'Unknown');
                            return (
                              <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                                    <p className="text-sm text-gray-600">By: {authors}</p>
                                  </div>
                                  <span className="px-3 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
                                    Archived
                                  </span>
                                </div>
                                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                                  {(project.file || project.fileUrl) && (
                                    <button
                                      onClick={() => handleDownloadProject(project)}
                                      className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                    >
                                      <Download className="h-4 w-4" />
                                      <span>Download</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleUnarchiveProject(project.id)}
                                    className="flex items-center space-x-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Unarchive</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {archivedProjects.length > 3 && (
                          <button
                            onClick={() => setProjectView('archived')}
                            className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View all {archivedProjects.length} archived projects →
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {projectView === 'archived' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900">Archived Projects</h2>
                      <button
                        onClick={() => setProjectView('overview')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        ← Back to overview
                      </button>
                    </div>
                    {archivedProjects.length === 0 ? (
                      <div className="text-center py-8 border border-gray-200 rounded-lg">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No archived projects</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {archivedProjects.map((project) => {
                          const authors = Array.isArray(project.authors)
                            ? project.authors.join(', ')
                            : (project.authors || 'Unknown');
                          return (
                            <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
                                  <p className="text-sm text-gray-600">By: {authors}</p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
                                  Archived
                                </span>
                              </div>
                              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                                {(project.file || project.fileUrl) && (
                                  <button
                                    onClick={() => handleDownloadProject(project)}
                                    className="flex items-center space-x-2 px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                  >
                                    <Download className="h-4 w-4" />
                                    <span>Download</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleUnarchiveProject(project.id)}
                                  className="flex items-center space-x-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Unarchive</span>
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
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">System Analytics</h2>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-purple-900 mb-4">Predictive Trend Analysis</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">+24%</div>
                            <div className="text-sm text-purple-700">Project Growth</div>
                            <div className="text-xs text-purple-600 mt-1">vs. last month</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">87%</div>
                            <div className="text-sm text-purple-700">Approval Rate</div>
                            <div className="text-xs text-purple-600 mt-1">last 30 days</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-900">156</div>
                            <div className="text-sm text-purple-700">Active Users</div>
                            <div className="text-xs text-purple-600 mt-1">daily average</div>
                          </div>
                        </div>
                        <div className="border-t border-purple-200 pt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-purple-700">Predicted projects next month:</span>
                            <span className="font-semibold text-purple-900">~42 projects</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-purple-700">System capacity utilization:</span>
                            <span className="font-semibold text-purple-900">68%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {analytics && (
                      <>
                        <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                          <h3 className="font-semibold text-green-900 mb-4">Faculty Distribution</h3>
                          <div className="space-y-2">
                            {analytics.by_faculty.slice(0, 5).map((item: any, index: number) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-green-800">{item.faculty}:</span>
                                <span className="font-semibold text-green-900">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 md:col-span-2">
                          <h3 className="font-semibold text-blue-900 mb-4">Status Distribution</h3>
                          <div className="space-y-2">
                            {analytics.by_status.map((item: any, index: number) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-blue-800 capitalize">{item.status.replace('_', ' ')}:</span>
                                <span className="font-semibold text-blue-900">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

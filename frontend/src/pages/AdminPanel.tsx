import { useState, useEffect } from 'react';
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
  Clock, 
  TrendingUp,
  AlertCircle,
  Download 
} from 'lucide-react';

export const AdminPanel = () => {
  const { } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'analytics'>('users');

  useEffect(() => {
    fetchData();
  }, []);

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
      setProjects(projectsData);
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
  const pendingProjects = projects.filter(p => p.status === 'under_review');
  const publishedProjects = projects.filter(p => p.status === 'approved');
  const archivedProjects = projects.filter(p => p.status === 'archived');

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

        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-8 w-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-900">{users.length}</span>
            </div>
            <p className="text-gray-600 text-sm">Total Users</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-8 w-8 text-green-600" />
              <span className="text-3xl font-bold text-green-900">{analytics?.total_projects || 0}</span>
            </div>
            <p className="text-gray-600 text-sm">Total Projects</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-600">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <span className="text-3xl font-bold text-yellow-900">{publicUsers.filter(u => !u.admitted).length}</span>
            </div>
            <p className="text-gray-600 text-sm">Pending Approvals</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-600">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-8 w-8 text-purple-600" />
              <span className="text-3xl font-bold text-purple-900">{pendingProjects.length}</span>
            </div>
            <p className="text-gray-600 text-sm">Projects Pending Publish</p>
          </div>
        </div>

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

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">All Users</h2>
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
                        {users.map((u) => {
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
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
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

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">All Projects Overview</h2>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-2xl font-bold text-gray-900">{publishedProjects.length}</div>
                      <div className="text-sm text-gray-600">Published</div>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-900">{projects.filter(p => p.status === 'pending').length}</div>
                      <div className="text-sm text-gray-600">Pending Review</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-2xl font-bold text-red-900">{archivedProjects.length}</div>
                      <div className="text-sm text-gray-600">Archived</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Published Projects</h2>
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
                                  className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                                >
                                  <Download className="h-4 w-4" />
                                  <span>Download</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleUnpublishProject(project.id)}
                                className="flex items-center space-x-2 px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium"
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

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Archived Projects</h2>
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
                                  className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
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
              </div>
            )}

            {activeTab === 'analytics' && analytics && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">System Analytics</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
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

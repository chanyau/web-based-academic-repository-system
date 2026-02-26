import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, FileText, Eye, Clock } from 'lucide-react';
import { analyticsService, AnalyticsOverview } from '../services/analyticsService';

export const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await analyticsService.getOverview();
        setAnalytics(data);
      } catch (err) {
        setError('Failed to load analytics. Please try again later.');
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            {error || 'Failed to load analytics data'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive insights into repository performance and trends</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-900">{analytics.total_projects}</span>
            </div>
            <p className="text-gray-600 text-sm">Total Projects</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <span className="text-3xl font-bold text-green-900">{analytics.approved}</span>
            </div>
            <p className="text-gray-600 text-sm">Approved Projects</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-600">
            <div className="flex items-center justify-between mb-2">
              <Eye className="h-8 w-8 text-yellow-600" />
              <span className="text-3xl font-bold text-yellow-900">{analytics.pending_reviews}</span>
            </div>
            <p className="text-gray-600 text-sm">Pending Review</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-600">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-purple-600" />
              <span className="text-3xl font-bold text-purple-900">{analytics.under_review}</span>
            </div>
            <p className="text-gray-600 text-sm">Under Review</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span>Projects by Status</span>
              </h2>
            </div>

            <div className="space-y-4">
              {analytics.by_status.map((item, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600 w-32 capitalize">{item.status.replace('_', ' ')}</span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                          style={{ width: `${(item.count / analytics.total_projects) * 100}%` }}
                        >
                          <span className="text-white text-xs font-semibold">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Faculty Distribution</span>
              </h2>
            </div>

            <div className="space-y-6">
              {analytics.by_faculty.map((item, index) => {
                const percentage = (item.count / analytics.total_projects) * 100;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{item.faculty}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{item.count} projects</span>
                        <span className="text-sm font-semibold text-blue-600">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Users by Role</span>
              </h2>
            </div>

            <div className="space-y-3">
              {analytics.by_role.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="text-gray-900 font-medium capitalize">{item.role}</span>
                  </div>
                  <span className="text-blue-600 font-semibold">{item.count} users</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>System Summary</span>
              </h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Approval Rate</span>
                  <span className="text-lg font-bold text-green-600">
                    {analytics.total_projects > 0 
                      ? ((analytics.approved / analytics.total_projects) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${analytics.total_projects > 0 
                        ? (analytics.approved / analytics.total_projects) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Pending Rate</span>
                  <span className="text-lg font-bold text-yellow-600">
                    {analytics.total_projects > 0 
                      ? ((analytics.pending_reviews / analytics.total_projects) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-yellow-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${analytics.total_projects > 0 
                        ? (analytics.pending_reviews / analytics.total_projects) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Review Rate</span>
                  <span className="text-lg font-bold text-blue-600">
                    {analytics.total_projects > 0 
                      ? ((analytics.under_review / analytics.total_projects) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${analytics.total_projects > 0 
                        ? (analytics.under_review / analytics.total_projects) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

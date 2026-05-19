import { useEffect, useMemo, useState } from 'react';
import { Users, CheckCircle, Clock } from 'lucide-react';
import { userService } from '../services/userService';
import { SuperviseeDetail, SuperviseeSummary } from '../types';

export const Supervisees = () => {
  const [submitted, setSubmitted] = useState<SuperviseeSummary[]>([]);
  const [notSubmitted, setNotSubmitted] = useState<SuperviseeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SuperviseeSummary | null>(null);
  const [details, setDetails] = useState<SuperviseeDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupervisees = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await userService.getMySupervisees();
        setSubmitted(response.submitted || []);
        setNotSubmitted(response.not_submitted || []);
      } catch (err) {
        setError('Failed to load supervisees. Please try again later.');
        console.error('Error fetching supervisees:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisees();
  }, []);

  const total = submitted.length + notSubmitted.length;
  const submittedCount = submitted.length;
  const notSubmittedCount = notSubmitted.length;

  const latestSubmitted = useMemo(() => {
    if (!submitted.length) return null;
    const dates = submitted
      .map((student) => (student.latest_submission ? new Date(student.latest_submission) : null))
      .filter((value): value is Date => value !== null)
      .sort((a, b) => b.getTime() - a.getTime());
    return dates[0] || null;
  }, [submitted]);

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'revision_requested':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_submitted':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStageStatus = (status: string) => {
    if (status === 'not_submitted') return 'Not Submitted';
    return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleOpenDetails = async (student: SuperviseeSummary) => {
    setSelectedStudent(student);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetails(null);

    try {
      const response = await userService.getSuperviseeDetails(student.id);
      setDetails(response);
    } catch (err) {
      setDetailsError('Failed to load student details. Please try again.');
      console.error('Error fetching supervisee details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedStudent(null);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900">My Supervisees</h1>
          <p className="text-sm text-gray-600 mt-1">Students automatically allocated to you in your faculty.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-900 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-7 w-7 text-white" />
              <span className="text-3xl font-bold text-white">{total}</span>
            </div>
            <p className="text-blue-100 text-sm">Total Supervisees</p>
          </div>
          <div className="bg-green-600 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-7 w-7 text-white" />
              <span className="text-3xl font-bold text-white">{submittedCount}</span>
            </div>
            <p className="text-green-100 text-sm">Submitted Projects</p>
          </div>
          <div className="bg-slate-700 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-7 w-7 text-white" />
              <span className="text-3xl font-bold text-white">{notSubmittedCount}</span>
            </div>
            <p className="text-slate-200 text-sm">No Submissions Yet</p>
            {latestSubmitted && (
              <p className="text-slate-200 text-xs mt-2">
                Latest submission: {latestSubmitted.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading supervisees...</p>
            </div>
          ) : total === 0 ? (
            <div className="text-center py-12">
              <Users className="h-14 w-14 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No students allocated yet</p>
              <p className="text-gray-500 text-sm mt-2">Students in your faculty will appear here after signing in.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="border border-green-100 rounded-xl p-4 bg-green-50">
                <h2 className="text-lg font-semibold text-green-900 mb-4">Submitted</h2>
                {submitted.length === 0 ? (
                  <p className="text-sm text-green-800">No submissions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {submitted.map((student) => (
                      <div key={student.id} className="bg-white border border-green-100 rounded-lg p-3">
                        <p className="font-semibold text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-600">{student.email}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-2">
                          <span>Projects: {student.project_count}</span>
                          {student.latest_submission && (
                            <span>Latest: {new Date(student.latest_submission).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={() => handleOpenDetails(student)}
                            className="text-xs font-semibold text-green-700 hover:text-green-800"
                          >
                            View details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Not Submitted</h2>
                {notSubmitted.length === 0 ? (
                  <p className="text-sm text-slate-700">All allocated students have submitted.</p>
                ) : (
                  <div className="space-y-3">
                    {notSubmitted.map((student) => (
                      <div key={student.id} className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-semibold text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-600">{student.email}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-2">
                          <span>Projects: 0</span>
                          <span>Awaiting submission</span>
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={() => handleOpenDetails(student)}
                            className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                          >
                            View details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Student Details</h2>
                <p className="text-sm text-gray-600">{selectedStudent.name}</p>
              </div>
              <button
                onClick={handleCloseDetails}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <span aria-hidden>✕</span>
              </button>
            </div>

            {detailsError && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {detailsError}
              </div>
            )}

            {detailsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading details...</p>
              </div>
            ) : details ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Student Info</p>
                    <p className="text-lg font-semibold text-slate-900">{details.student.name}</p>
                    <p className="text-sm text-slate-700">{details.student.email}</p>
                    <p className="text-sm text-slate-600">{details.student.faculty || 'Faculty not set'}</p>
                    <p className="text-sm text-slate-600">{details.student.department || 'Department not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Supervisor</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {details.student.supervisor?.name || 'Not assigned'}
                    </p>
                    <p className="text-sm text-slate-700">{details.student.supervisor?.email || 'N/A'}</p>
                    <p className="text-sm text-slate-600">{details.student.supervisor?.faculty || ''}</p>
                    <p className="text-sm text-slate-600">{details.student.supervisor?.department || ''}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Projects & Stages</h3>
                  {details.projects.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                      This student has not submitted any projects yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {details.projects.map((project) => (
                        <div key={project.id} className="border border-gray-200 rounded-2xl p-4 bg-white">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                            <div>
                              <p className="text-lg font-semibold text-gray-900">{project.title}</p>
                              <p className="text-xs text-gray-500">Submitted: {project.submittedAt ? new Date(project.submittedAt).toLocaleDateString() : 'N/A'}</p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                              {project.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          <div className="grid sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
                            <div>
                              <p className="text-xs text-slate-500">Total Stages</p>
                              <p className="text-lg font-semibold text-slate-900">{project.stage_summary.total}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Submitted</p>
                              <p className="text-lg font-semibold text-blue-700">{project.stage_summary.submitted}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Completed</p>
                              <p className="text-lg font-semibold text-green-700">{project.stage_summary.completed}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Pending</p>
                              <p className="text-lg font-semibold text-orange-600">{project.stage_summary.pending}</p>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-3">
                            {project.stage_progress.map((stage) => (
                              <div key={stage.stage} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{stage.stageLabel}</p>
                                    {stage.submitted_at && (
                                      <p className="text-xs text-gray-500">Submitted: {new Date(stage.submitted_at).toLocaleDateString()}</p>
                                    )}
                                  </div>
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStageStatusColor(stage.review_status)}`}>
                                    {formatStageStatus(stage.review_status)}
                                  </span>
                                </div>
                                {stage.supervisor_feedback && (
                                  <p className="text-xs text-slate-600 mt-2">Feedback: {stage.supervisor_feedback}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

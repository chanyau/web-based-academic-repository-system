import { useEffect, useMemo, useState } from 'react';
import { Calendar, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { Project, SuperviseeSummary } from '../types';

const stageOptions = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'chapter1', label: 'Chapter 1' },
  { value: 'chapter2', label: 'Chapter 2' },
  { value: 'chapter3', label: 'Chapter 3' },
  { value: 'final_document', label: 'Final Document' },
];

export const SupervisorNotifications = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<SuperviseeSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [mode, setMode] = useState<'due_date' | 'message'>('due_date');
  const [selectAllStudents, setSelectAllStudents] = useState(false);
  const [selectedStage, setSelectedStage] = useState(stageOptions[0].value);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!user?.id) {
          setStudents([]);
          setProjects([]);
          return;
        }

        const supervisees = await userService.getMySupervisees();
        const allStudents = [...(supervisees.submitted || []), ...(supervisees.not_submitted || [])];
        const lecturerProjects = await projectService.getProjects({ supervisor: user.id });

        setStudents(allStudents);
        setProjects(lecturerProjects || []);
      } catch (err: any) {
        console.error('Failed to load supervisees/projects:', err);
        setError(err?.message || 'Failed to load supervisees. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  const studentProjects = useMemo(() => {
    if (!selectedStudentId) return [];
    return projects.filter((project) => String(project.ownerId) === String(selectedStudentId));
  }, [projects, selectedStudentId]);

  const getLatestProjectForStudent = (studentId: string) => {
    const ownedProjects = projects
      .filter((project) => String(project.ownerId) === String(studentId))
      .sort((a, b) => {
        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
    return ownedProjects[0];
  };

  const canSendDueDate = (selectAllStudents || (selectedStudentId && selectedProjectId)) && selectedStage && dueDate;
  const canSendMessage = (selectAllStudents || (selectedStudentId && selectedProjectId)) && messageContent.trim();

  const handleSend = async () => {
    if (mode === 'due_date' && !canSendDueDate) return;
    if (mode === 'message' && !canSendMessage) return;

    try {
      setSending(true);
      setError(null);
      setSuccess(null);

      const targets = selectAllStudents
        ? students
            .map((student) => ({
              student,
              project: getLatestProjectForStudent(String(student.id)),
            }))
            .filter((entry) => Boolean(entry.project))
        : [
            {
              student: students.find((student) => String(student.id) === String(selectedStudentId)),
              project: projects.find((project) => String(project.id) === String(selectedProjectId)),
            },
          ];

      if (!targets.length) {
        setError('No projects found for the selected students.');
        return;
      }

      if (mode === 'due_date') {
        await Promise.all(
          targets.map((entry) =>
            userService.sendDueDateNotification({
              student_id: String(entry.student?.id || ''),
              project_id: String(entry.project?.id || ''),
              stage: selectedStage,
              due_date: dueDate,
              note: note.trim() || undefined,
            })
          )
        );

        const skipped = selectAllStudents ? students.length - targets.length : 0;
        setSuccess(
          skipped > 0
            ? `Due date notifications sent. ${skipped} students skipped (no projects found).`
            : 'Due date notifications sent and email delivered to the students.'
        );
        setNote('');
      } else {
        await Promise.all(
          targets.map((entry) =>
            userService.sendSupervisorMessage({
              student_id: String(entry.student?.id || ''),
              project_id: String(entry.project?.id || ''),
              content: messageContent.trim(),
            })
          )
        );

        const skipped = selectAllStudents ? students.length - targets.length : 0;
        setSuccess(
          skipped > 0
            ? `Messages sent. ${skipped} students skipped (no projects found).`
            : 'Messages sent and email delivered to the students.'
        );
        setMessageContent('');
      }
    } catch (err: any) {
      console.error('Failed to send due date notification:', err);
      setError(err?.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Stage Due Date Notifications</h1>
          <p className="text-gray-600">Send due dates for each submission stage to your students.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading supervisees...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode('due_date')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'due_date'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Due Date
                </button>
                <button
                  type="button"
                  onClick={() => setMode('message')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'message'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Simple Message
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Student</label>
                <label className="inline-flex items-center space-x-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={selectAllStudents}
                    onChange={(e) => {
                      setSelectAllStudents(e.target.checked);
                      setSelectedStudentId('');
                      setSelectedProjectId('');
                    }}
                  />
                  <span>Select all students</span>
                </label>
              </div>
              <div>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                    setSelectedProjectId('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={selectAllStudents}
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={String(student.id)}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!selectedStudentId || selectAllStudents}
                >
                  <option value="">Select project</option>
                  {studentProjects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.title}
                    </option>
                  ))}
                </select>
                {selectedStudentId && studentProjects.length === 0 && !selectAllStudents && (
                  <p className="mt-2 text-sm text-gray-500">No projects found for this student.</p>
                )}
                {selectAllStudents && (
                  <p className="mt-2 text-sm text-gray-500">
                    Notifications will be sent to each student&apos;s latest project.
                  </p>
                )}
              </div>

              {mode === 'due_date' ? (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                      <select
                        value={selectedStage}
                        onChange={(e) => setSelectedStage(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {stageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add guidance or expectations for this stage..."
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Write a message to the student..."
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSend}
                  disabled={(mode === 'due_date' ? !canSendDueDate : !canSendMessage) || sending}
                  className="inline-flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {mode === 'message' ? <MessageSquare className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  <span>{sending ? 'Sending...' : mode === 'message' ? 'Send Message' : 'Send Notification'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

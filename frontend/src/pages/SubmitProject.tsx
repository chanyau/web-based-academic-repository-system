import { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader, Sparkles, Download, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService, Lecturer } from '../services/projectService';
import { FACULTIES } from '../constants/faculties';
import { ProjectStageCode, ProjectStageProgress, WorkflowDetails } from '../types';

export const SubmitProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); // For editing existing project
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [existingProjectStatus, setExistingProjectStatus] = useState<string | null>(null);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loadingLecturers, setLoadingLecturers] = useState(true);
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[]>([]);
  const [stageProgress, setStageProgress] = useState<ProjectStageProgress[]>([]);
  const [loadingStageProgress, setLoadingStageProgress] = useState(false);
  const [stageError, setStageError] = useState('');
  const [selectedStage, setSelectedStage] = useState<ProjectStageCode>('proposal');
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageNote, setStageNote] = useState('');
  const [submittingStage, setSubmittingStage] = useState(false);
  const [stageWorkflowNotice, setStageWorkflowNotice] = useState('');
  const [workflowDetails, setWorkflowDetails] = useState<WorkflowDetails | null>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [uploadingProposal, setUploadingProposal] = useState(false);
  const [proposalSuccessMessage, setProposalSuccessMessage] = useState('');
  const [proposalSubmittedAt, setProposalSubmittedAt] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [otherStageFile, setOtherStageFile] = useState<File | null>(null);
  const [uploadingOtherStage, setUploadingOtherStage] = useState(false);
  const [developmentType, setDevelopmentType] = useState<'progress_report' | 'chapter' | 'code'>('progress_report');
  const [developmentFile, setDevelopmentFile] = useState<File | null>(null);
  const [developmentComment, setDevelopmentComment] = useState('');
  const [uploadingDevelopment, setUploadingDevelopment] = useState(false);
  const [finalReportFile, setFinalReportFile] = useState<File | null>(null);
  const [sourceCodeFile, setSourceCodeFile] = useState<File | null>(null);
  const [supportingDocsFile, setSupportingDocsFile] = useState<File | null>(null);
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [plagiarismMessage, setPlagiarismMessage] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    objectives: '',
    type: 'capstone',
    faculty: user?.faculty || '',
    department: user?.department || '',
    year: new Date().getFullYear(),
    keywords: '',
    authors: `${user?.first_name} ${user?.last_name}` || '',
    supervisor_id: '' as string | number,
    file: null as File | null
  });

  const stageTemplate: Array<{ stage: ProjectStageCode; stageLabel: string }> = [
    { stage: 'proposal', stageLabel: 'Project Proposal' },
    { stage: 'literature_review', stageLabel: 'Literature Review' },
    { stage: 'methodology', stageLabel: 'Methodology' },
    { stage: 'implementation', stageLabel: 'Implementation & Results' },
    { stage: 'final_document', stageLabel: 'Final Document' },
  ];

  // Fetch lecturers on component mount
  useEffect(() => {
    const fetchLecturers = async () => {
      try {
        setLoadingLecturers(true);
        const data = await projectService.getLecturers();
        setLecturers(data);
      } catch (err) {
        console.error('Failed to load lecturers:', err);
      } finally {
        setLoadingLecturers(false);
      }
    };
    fetchLecturers();
  }, []);

  useEffect(() => {
    if (id && user?.id) {
      // Load existing project for editing
      loadProject(id);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (id && user?.id) {
      fetchStageProgress(id);
      fetchWorkflowDetails(id);
    }
  }, [id, user?.id]);

  const fetchWorkflowDetails = async (projectId: string) => {
    try {
      setLoadingWorkflow(true);
      const details = await projectService.getWorkflowDetails(projectId);
      setWorkflowDetails(details);
    } catch (err) {
      console.error('Failed to load workflow details:', err);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  const ensureProjectRecord = async (): Promise<string> => {
    const projectData = {
      title: formData.title,
      abstract: formData.abstract,
      authors: formData.authors.split(',').map(a => a.trim()).filter(a => a),
      faculty: formData.faculty,
      department: formData.department,
      year: Number(formData.year),
      type: formData.type as 'capstone' | 'thesis' | 'dissertation' | 'research',
      keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
      similarity_score: similarityScore,
      supervisor_id: Number(formData.supervisor_id)
    };

    if (id) {
      await projectService.updateProject(id, projectData, formData.file || undefined);
      return id;
    }

    const createdProject = await projectService.createProject(projectData, formData.file || undefined);
    const createdId = String(createdProject.id);
    navigate(`/submit/${createdId}?workflow=1`);
    return createdId;
  };

  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingDetails(true);
      setError('');

      if (!formData.title.trim() || !formData.abstract.trim() || !formData.supervisor_id) {
        setError('Title, Abstract, and Supervisor are required.');
        return;
      }

      const projectId = await ensureProjectRecord();
      await fetchStageProgress(projectId);
      await fetchWorkflowDetails(projectId);
      setStageWorkflowNotice('Project details saved. Continue with proposal upload.');
    } catch (err: any) {
      setError(err.message || 'Failed to save project details.');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUploadProposal = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentProposalStage = stageProgress.find((stage) => stage.stage === 'proposal');
    if (currentProposalStage?.review_status === 'approved') {
      setError('Proposal stage is already approved and marked as completed.');
      return;
    }

    if (!proposalFile) {
      setError('Please choose a proposal file first.');
      return;
    }

    try {
      setUploadingProposal(true);
      setError('');
      setProposalSuccessMessage('');
      setSubmissionNotice('');
      const projectId = await ensureProjectRecord();
      const submission = await projectService.submitProjectStage(projectId, 'proposal', proposalFile);
      setProposalFile(null);
      const submittedAtValue = submission?.submitted_at || new Date().toISOString();
      setProposalSubmittedAt(submittedAtValue);
      setProposalSuccessMessage('Project proposal submitted successfully.');
      setSubmissionNotice('Turned in.');
      await fetchStageProgress(projectId);
      await fetchWorkflowDetails(projectId);
    } catch (err: any) {
      setError(err.message || 'Failed to upload proposal.');
    } finally {
      setUploadingProposal(false);
    }
  };

  const handleUploadOtherStage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otherStageFile) {
      setError('Please choose a file for the selected step.');
      return;
    }

    try {
      setUploadingOtherStage(true);
      setError('');
      setSubmissionNotice('');
      const projectId = await ensureProjectRecord();
      await projectService.uploadChaptersBundle(projectId, otherStageFile);
      setOtherStageFile(null);
      setSubmissionNotice('Turned in.');
      await fetchStageProgress(projectId);
      await fetchWorkflowDetails(projectId);
    } catch (err: any) {
      setError(err.message || 'Failed to upload this stage.');
    } finally {
      setUploadingOtherStage(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('workflow') === '1') {
      setStageWorkflowNotice('Project created successfully. You can now submit each workflow stage below.');
    } else {
      setStageWorkflowNotice('');
    }
  }, [location.search]);

  useEffect(() => {
    if (!stageProgress.length) return;

    const firstOpenStage = stageProgress.find(stage => stage.review_status !== 'approved');
    if (firstOpenStage) {
      setSelectedStage(firstOpenStage.stage);
    }
  }, [stageProgress]);

  const fetchStageProgress = async (projectId: string) => {
    try {
      setLoadingStageProgress(true);
      setStageError('');
      const progress = await projectService.getProjectStageProgress(projectId);
      setStageProgress(progress);
      const proposalStage = progress.find((stage) => stage.stage === 'proposal');
      if (proposalStage?.submitted_at) {
        setProposalSubmittedAt(proposalStage.submitted_at);
      }
    } catch (err: any) {
      setStageError(err.message || 'Failed to load project stage progress');
    } finally {
      setLoadingStageProgress(false);
    }
  };

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      setLoadError('');
      setError('');
      const project = await projectService.getProject(projectId);
      
      // Check if user owns this project
      const projectOwnerId = String((project as any).ownerId ?? (project as any).owner?.id ?? '');
      const currentUserId = String(user?.id ?? '');
      if (!currentUserId || projectOwnerId !== currentUserId) {
        setLoadError('You can only edit your own projects');
        return;
      }

      // Allow reopening project for workflow continuation/resubmission.
      // Only block fully closed states.
      if (project.status === 'approved' || project.status === 'archived') {
        setLoadError('This project is closed and cannot be modified further.');
        return;
      }

      setFormData({
        title: project.title,
        abstract: project.abstract,
        objectives: (project as any).objectives || '',
        type: project.type,
        faculty: project.faculty,
        department: project.department,
        year: project.year,
        keywords: Array.isArray(project.keywords) ? project.keywords.join(', ') : project.keywords,
        authors: Array.isArray(project.authors) ? project.authors.join(', ') : project.authors,
        supervisor_id: project.supervisorId || '',
        file: null
      });
      setSimilarityScore(project.similarityScore || null);
      setExistingProjectStatus(project.status || null);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleExtractKeywords = async () => {
    if (!formData.file) {
      setError('Please upload a document first to extract keywords.');
      return;
    }

    try {
      setExtractingKeywords(true);
      setError('');
      
      const existingKeywords = formData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k);
      
      const result = await projectService.extractKeywords(
        formData.file,
        existingKeywords,
        formData.abstract,
        formData.title
      );
      
      if (result.keywords && result.keywords.length > 0) {
        // Combine existing and new keywords, avoiding duplicates
        const allKeywords = [...new Set([...existingKeywords, ...result.keywords])];
        setFormData({ ...formData, keywords: allKeywords.join(', ') });
        setKeywordSuggestions(result.suggestions || []);
      } else {
        setError('No keywords were extracted. The document may not contain enough text content.');
      }
    } catch (err: any) {
      console.error('Keyword extraction error:', err);
      setError(err.message || 'Failed to extract keywords. Please try again or enter keywords manually.');
    } finally {
      setExtractingKeywords(false);
    }
  };

  const addSuggestedKeyword = (keyword: string) => {
    const currentKeywords = formData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    
    if (!currentKeywords.map(k => k.toLowerCase()).includes(keyword.toLowerCase())) {
      currentKeywords.push(keyword);
      setFormData({ ...formData, keywords: currentKeywords.join(', ') });
    }
    
    // Remove from suggestions
    setKeywordSuggestions(prev => prev.filter(k => k !== keyword));
  };

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate supervisor is selected
    if (!formData.supervisor_id) {
      setError('Please select a supervisor for your project');
      return;
    }
    
    setError('');
    setStep(2);
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      setError('');

      const result = await projectService.checkSimilarity(
        formData.file || undefined,
        formData.abstract,
        formData.title,
        id
      );

      setSimilarityScore(result.similarity_score ?? 0);
      setStep(3);
    } catch (err: any) {
      console.error('Similarity check error:', err);
      setError(err.message || 'Failed to run similarity check. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setUploading(true);
      setError('');

      const projectData = {
        title: formData.title,
        abstract: formData.abstract,
        objectives: formData.objectives,
        authors: formData.authors.split(',').map(a => a.trim()).filter(a => a),
        faculty: formData.faculty,
        department: formData.department,
        year: Number(formData.year),
        type: formData.type as 'capstone' | 'thesis' | 'dissertation' | 'research',
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
        similarity_score: similarityScore,
        supervisor_id: Number(formData.supervisor_id)
      };

      if (id) {
        // Update existing project
        await projectService.updateProject(id, projectData, formData.file || undefined);

        // If this is a revision-requested project, complete resubmission flow
        if (existingProjectStatus === 'revision_requested') {
          await projectService.resubmitProject(id);
        }
      } else {
        // Create new project
        const createdProject = await projectService.createProject(projectData, formData.file || undefined);
        navigate(`/submit/${createdProject.id}?workflow=1`);
        return;
      }

      if (id) {
        await fetchWorkflowDetails(id);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to submit project');
    } finally {
      setUploading(false);
    }
  };

  const handleStageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStageFile(e.target.files[0]);
    }
  };

  const handleSubmitStage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stageFile) {
      setStageError('Please upload a file for the selected stage.');
      return;
    }

    try {
      setSubmittingStage(true);
      setStageError('');

      let projectId = id;

      if (!projectId) {
        if (selectedStage !== 'proposal') {
          setStageError('For a new project, your first stage submission must be Project Proposal.');
          return;
        }

        if (!formData.title.trim() || !formData.abstract.trim() || !formData.objectives.trim() || !formData.supervisor_id) {
          setStageError('Please fill Title, Abstract, Objectives, and Supervisor before submitting proposal stage.');
          return;
        }

        const projectData = {
          title: formData.title,
          abstract: formData.abstract,
          objectives: formData.objectives,
          authors: formData.authors.split(',').map(a => a.trim()).filter(a => a),
          faculty: formData.faculty,
          department: formData.department,
          year: Number(formData.year),
          type: formData.type as 'capstone' | 'thesis' | 'dissertation' | 'research',
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
          similarity_score: similarityScore,
          supervisor_id: Number(formData.supervisor_id)
        };

        const createdProject = await projectService.createProject(projectData, formData.file || undefined);
        projectId = String(createdProject.id);
      }

      const selectedStageProgress = stageProgress.find((stage) => stage.stage === selectedStage);
      if (selectedStageProgress?.is_locked) {
        setStageError(selectedStageProgress.lock_reason || 'This stage is locked until previous stages are approved.');
        return;
      }

      await projectService.submitProjectStage(projectId, selectedStage, stageFile, stageNote);
      setStageFile(null);
      setStageNote('');

      if (projectId !== id) {
        navigate(`/submit/${projectId}?workflow=1`);
        return;
      }

      await fetchStageProgress(projectId);
      await fetchWorkflowDetails(projectId);
    } catch (err: any) {
      setStageError(err.message || 'Failed to submit stage. Please try again.');
    } finally {
      setSubmittingStage(false);
    }
  };

  const getStageStatusPill = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'revision_requested':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatStageStatus = (status: string) => {
    if (status === 'not_submitted') return 'Not Submitted';
    if (status === 'approved') return 'Completed';
    return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getFileDownloadUrl = (fileLocation?: string | null) => {
    if (!fileLocation) return null;
    if (fileLocation.startsWith('http')) return fileLocation;
    const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');
    const normalizedPath = fileLocation.startsWith('/') ? fileLocation : `/${fileLocation}`;
    return `${baseUrl}${normalizedPath}`;
  };

  const openStageFile = (fileLocation?: string | null) => {
    const url = getFileDownloadUrl(fileLocation);
    if (!url) {
      setError('No file available for this stage version.');
      return;
    }
    window.open(url, '_blank');
  };

  const handleUploadDevelopment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !developmentFile) {
      setError('Please choose a development file before uploading.');
      return;
    }

    try {
      setUploadingDevelopment(true);
      setError('');
      await projectService.uploadDevelopmentSubmission(id, developmentType, developmentFile, developmentComment);
      setDevelopmentFile(null);
      setDevelopmentComment('');
      await fetchWorkflowDetails(id);
    } catch (err: any) {
      setError(err.message || 'Failed to upload development submission');
    } finally {
      setUploadingDevelopment(false);
    }
  };

  const handleSubmitFinalFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !finalReportFile) {
      setError('Final report is required.');
      return;
    }

    try {
      setSubmittingFinal(true);
      setError('');
      setSubmissionNotice('');
      const result = await projectService.submitFinal(id, {
        finalReport: finalReportFile,
        sourceCode: sourceCodeFile || undefined,
        supportingDocuments: supportingDocsFile || undefined,
      });
      const similarity = result?.plagiarism?.similarity_score;
      setPlagiarismMessage(
        typeof similarity === 'number'
          ? `Plagiarism check complete. Similarity score: ${similarity}%`
          : 'Final submission received and plagiarism check executed.'
      );
      setSubmissionNotice('Turned in.');
      await fetchWorkflowDetails(id);
    } catch (err: any) {
      setError(err.message || 'Final submission failed');
    } finally {
      setSubmittingFinal(false);
    }
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

  if (loadError && id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <div className="text-red-600 font-semibold mb-2">Cannot Edit Project</div>
          <p className="text-gray-600 mb-4">{loadError}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const proposalStage = stageProgress.find((stage) => stage.stage === 'proposal');
  const proposalNeedsRevision = proposalStage?.review_status === 'revision_requested';
  const proposalApproved = proposalStage?.review_status === 'approved';
  const literatureStage = stageProgress.find((stage) => stage.stage === 'literature_review');
  const methodologyStage = stageProgress.find((stage) => stage.stage === 'methodology');
  const implementationStage = stageProgress.find((stage) => stage.stage === 'implementation');
  const finalDocumentStage = stageProgress.find((stage) => stage.stage === 'final_document');
  const chaptersCompleted = [literatureStage, methodologyStage, implementationStage].every((stage) => stage?.review_status === 'approved');
  const chaptersNeedRevision = [literatureStage, methodologyStage, implementationStage].some((stage) => stage?.review_status === 'revision_requested');
  const finalStageCompleted = finalDocumentStage?.review_status === 'approved';
  const isPublishedProject = (workflowDetails?.project?.status === 'approved') || (workflowDetails?.project?.workflowStatus === 'approved');

  const renderStageVersions = (stage: ProjectStageProgress | undefined) => {
    if (!stage || !stage.versions || stage.versions.length === 0) {
      return <p className="text-sm text-gray-500 mt-2">No versions submitted for this stage yet.</p>;
    }

    return (
      <div className="space-y-2 mt-3">
        {stage.versions.map((version) => (
          <div key={`${stage.stage}-${version.id}-${version.version}`} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-gray-900">Version {version.version}</p>
              <p className="text-xs text-gray-500">Submitted: {version.submitted_at ? new Date(version.submitted_at).toLocaleString() : 'N/A'}</p>
            </div>
            <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Status:</span> {formatStageStatus(version.review_status)}</p>
            <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Feedback:</span> {version.supervisor_feedback || 'No feedback provided yet.'}</p>
            {version.student_note && (
              <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Your note:</span> {version.student_note}</p>
            )}
            {(version.fileUrl || version.submitted_file) && (
              <button
                type="button"
                onClick={() => openStageFile(version.fileUrl || version.submitted_file)}
                className="inline-flex items-center space-x-2 px-3 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
              >
                <Download className="h-4 w-4" />
                <span>Download Version File</span>
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Project Submission Workflow</h1>
          <p className="text-gray-600">Project Details → Upload Proposal → Other Steps → Final Whole Document → Plagiarism Check</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {stageWorkflowNotice && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{stageWorkflowNotice}</p>
          </div>
        )}

        {proposalSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p>{proposalSuccessMessage}</p>
              {proposalSubmittedAt && (
                <p className="mt-1">Submission date: {new Date(proposalSubmittedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {submissionNotice && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{submissionNotice}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">1. Project Details</h2>
          <form onSubmit={handleSaveProjectDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
              <input name="title" value={formData.title} onChange={handleChange} placeholder="Enter project title" className="w-full px-4 py-3 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Abstract *</label>
              <textarea name="abstract" value={formData.abstract} onChange={handleChange} rows={5} placeholder="Enter project abstract" className="w-full px-4 py-3 border border-gray-300 rounded-lg" required />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
                <select name="type" value={formData.type} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg">
                  <option value="capstone">Capstone Project</option>
                  <option value="thesis">Thesis</option>
                  <option value="dissertation">Dissertation</option>
                  <option value="research">Research Paper</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <input name="year" type="number" value={formData.year} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Faculty *</label>
                <select name="faculty" value={formData.faculty} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg" required>
                  <option value="">Select Faculty</option>
                  {FACULTIES.map((faculty) => <option key={faculty} value={faculty}>{faculty}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                <input name="department" value={formData.department} onChange={handleChange} placeholder="Enter department" className="w-full px-4 py-3 border border-gray-300 rounded-lg" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Authors *</label>
              <input name="authors" value={formData.authors} onChange={handleChange} placeholder="Enter authors" className="w-full px-4 py-3 border border-gray-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Keywords</label>
              <input name="keywords" value={formData.keywords} onChange={handleChange} placeholder="Comma-separated keywords" className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            </div>
            <div>
              {loadingLecturers ? (
                <p className="text-sm text-gray-500">Loading supervisors...</p>
              ) : (
                <>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor *</label>
                <select name="supervisor_id" value={formData.supervisor_id} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg" required>
                  <option value="">-- Select Supervisor --</option>
                  {lecturers.map((lecturer) => (
                    <option key={lecturer.id} value={lecturer.id}>{lecturer.name}</option>
                  ))}
                </select>
                </>
              )}
            </div>
            <button type="submit" disabled={savingDetails} className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {savingDetails ? 'Saving...' : 'Save Project Details'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">2. Upload Proposal</h2>
          {proposalApproved && (
            <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">Proposal stage completed. This stage has already been approved.</p>
            </div>
          )}
          {proposalNeedsRevision && (
            <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">Supervisor requested revision for your proposal. Upload the revised file and submit again.</p>
            </div>
          )}
          <form onSubmit={handleUploadProposal} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Proposal Document *</label>
            <input type="file" onChange={(e) => setProposalFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx" className="w-full px-4 py-3 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" required={!proposalApproved} disabled={proposalApproved} />
            <button type="submit" disabled={uploadingProposal || proposalApproved} className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {proposalApproved ? 'Completed' : uploadingProposal ? 'Uploading Proposal...' : proposalNeedsRevision ? 'Resubmit Proposal' : 'Submit Proposal'}
            </button>
          </form>
          {proposalSubmittedAt && (
            <p className="text-sm text-gray-600 mt-3">
              Last proposal submission date: {new Date(proposalSubmittedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">3. Upload Chapters 1 - 3</h2>
          {chaptersCompleted && (
            <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">Chapter stage completed. All chapters (1-3) have been approved.</p>
            </div>
          )}
          {!chaptersCompleted && chaptersNeedRevision && (
            <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">Supervisor requested revision for one or more chapter stages. Upload updated chapters and resubmit.</p>
            </div>
          )}
          <form onSubmit={handleUploadOtherStage} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Chapters 1-3 Document *</label>
            <input type="file" onChange={(e) => setOtherStageFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx" className="w-full px-4 py-3 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" required={!chaptersCompleted} disabled={chaptersCompleted} />
            <p className="text-xs text-gray-500">Upload one document containing Chapters 1, 2, and 3.</p>
            <button type="submit" disabled={uploadingOtherStage || chaptersCompleted} className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {chaptersCompleted ? 'Completed' : uploadingOtherStage ? 'Uploading...' : chaptersNeedRevision ? 'Resubmit Chapters 1-3' : 'Submit Chapters 1-3'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">4. Final Whole Document</h2>
          {finalStageCompleted && (
            <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">Final stage completed. This section has already been approved.</p>
            </div>
          )}
          <form onSubmit={handleSubmitFinalFiles} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Final Report *</label>
              <input type="file" onChange={(e) => setFinalReportFile(e.target.files?.[0] || null)} className="w-full px-4 py-3 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" required={!finalStageCompleted} disabled={finalStageCompleted} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Source Code (Optional)</label>
              <input type="file" onChange={(e) => setSourceCodeFile(e.target.files?.[0] || null)} className="w-full px-4 py-3 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" disabled={finalStageCompleted} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents (Optional)</label>
              <input type="file" onChange={(e) => setSupportingDocsFile(e.target.files?.[0] || null)} className="w-full px-4 py-3 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" disabled={finalStageCompleted} />
            </div>
            <p className="text-xs text-gray-500">Final report is required. Source code and supporting documents are optional.</p>
            <button type="submit" disabled={submittingFinal || finalStageCompleted} className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {finalStageCompleted ? 'Completed' : submittingFinal ? 'Submitting Final...' : 'Submit Final Document'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">5. Plagiarism Check Result</h2>
          <p className="text-sm text-gray-600">Status: {(workflowDetails?.project?.workflowStatus || 'proposal_submitted').replace(/_/g, ' ').toUpperCase()}</p>
          {!isPublishedProject && typeof workflowDetails?.project?.similarityScore === 'number' && (
            <p className="text-sm text-gray-800 mt-2">Similarity Score: {workflowDetails.project.similarityScore}%</p>
          )}
          {!isPublishedProject && plagiarismMessage && <p className="text-sm text-green-700 mt-2">{plagiarismMessage}</p>}
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">6. Stage Versions & Feedback</h2>
          {loadingStageProgress ? (
            <p className="text-sm text-gray-500">Loading stage versions...</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">2. Upload Proposal</h3>
                  <span className={`px-2 py-1 rounded-full border text-xs font-medium ${getStageStatusPill(proposalStage?.review_status || 'not_submitted')}`}>
                    {formatStageStatus(proposalStage?.review_status || 'not_submitted')}
                  </span>
                </div>
                {renderStageVersions(proposalStage)}
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">3. Upload Chapters 1-3</h3>
                <div className="space-y-4">
                  {[literatureStage, methodologyStage, implementationStage].map((stage, idx) => (
                    <div key={stage?.stage || `chapter-stage-${idx}`} className="border border-gray-100 rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-gray-800">{stage?.stageLabel || 'Stage'}</p>
                        <span className={`px-2 py-1 rounded-full border text-xs font-medium ${getStageStatusPill(stage?.review_status || 'not_submitted')}`}>
                          {formatStageStatus(stage?.review_status || 'not_submitted')}
                        </span>
                      </div>
                      {renderStageVersions(stage)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">4. Final Whole Document</h3>
                  <span className={`px-2 py-1 rounded-full border text-xs font-medium ${getStageStatusPill(finalDocumentStage?.review_status || 'not_submitted')}`}>
                    {formatStageStatus(finalDocumentStage?.review_status || 'not_submitted')}
                  </span>
                </div>
                {renderStageVersions(finalDocumentStage)}

                {(workflowDetails?.project as any)?.file && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-700 mb-2">Uploaded final files:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openStageFile((workflowDetails?.project as any)?.file)}
                        className="inline-flex items-center space-x-2 px-3 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>Final Report</span>
                      </button>
                      {(workflowDetails?.project as any)?.source_code_file && (
                        <button
                          type="button"
                          onClick={() => openStageFile((workflowDetails?.project as any)?.source_code_file)}
                          className="inline-flex items-center space-x-2 px-3 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
                        >
                          <Download className="h-4 w-4" />
                          <span>Source Code</span>
                        </button>
                      )}
                      {(workflowDetails?.project as any)?.supporting_documents_file && (
                        <button
                          type="button"
                          onClick={() => openStageFile((workflowDetails?.project as any)?.supporting_documents_file)}
                          className="inline-flex items-center space-x-2 px-3 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
                        >
                          <Download className="h-4 w-4" />
                          <span>Supporting Documents</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">
            {id ? (existingProjectStatus === 'revision_requested' ? 'Resubmit Project' : 'Edit Project') : 'Submit Your Project'}
          </h1>
          <p className="text-gray-600">
            {id ? (existingProjectStatus === 'revision_requested' ? 'Follow the same submission steps and submit your revised project for review' : 'Update your project metadata') : 'Follow the steps to submit your academic project for review'}
          </p>
        </div>

        {
          <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Project Workflow Stages</h2>
              <p className="text-sm text-gray-600">Submit each stage from proposal to final document and track supervisor feedback.</p>
            </div>

            {stageWorkflowNotice && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">{stageWorkflowNotice}</p>
              </div>
            )}

            {stageError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{stageError}</p>
              </div>
            )}

            {id && loadingStageProgress ? (
              <div className="text-center py-8">
                <Loader className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading stage progress...</p>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {(id
                  ? stageProgress
                  : stageTemplate.map((stage) => ({
                      id: null,
                      project: '',
                      stage: stage.stage,
                      stageLabel: stage.stageLabel,
                      review_status: 'not_submitted',
                      submitted_at: null,
                      supervisor_feedback: '',
                    } as ProjectStageProgress))).map((stage, index) => (
                  <div key={stage.stage} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-500">Step {index + 1}</p>
                        <h3 className="font-semibold text-gray-900">{stage.stageLabel}</h3>
                        {stage.submitted_at && (
                          <p className="text-xs text-gray-500 mt-1">Submitted: {new Date(stage.submitted_at).toLocaleString()}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full border text-xs font-medium ${getStageStatusPill(stage.review_status)}`}>
                        {formatStageStatus(stage.review_status)}
                      </span>
                    </div>

                    {stage.is_locked && stage.lock_reason && (
                      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">{stage.lock_reason}</p>
                      </div>
                    )}

                    {stage.fileUrl && (
                      <button
                        type="button"
                        onClick={() => window.open(stage.fileUrl || '', '_blank')}
                        className="mb-3 inline-flex items-center space-x-2 px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>Open Submitted File</span>
                      </button>
                    )}

                    {stage.student_note && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-1">Your Note</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{stage.student_note}</p>
                      </div>
                    )}

                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-medium text-blue-700 mb-1 flex items-center space-x-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>Supervisor Feedback</span>
                      </p>
                      <p className="text-sm text-blue-900 whitespace-pre-wrap">
                        {stage.supervisor_feedback || 'No feedback yet for this stage.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmitStage} className="space-y-4 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900">Submit / Resubmit Stage</h3>
              {!id && <p className="text-sm text-gray-600">Submitting Project Proposal here will create the project automatically.</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Stage *</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value as ProjectStageCode)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {(id ? stageProgress : stageTemplate).map((stage) => (
                    <option key={stage.stage} value={stage.stage} disabled={Boolean((stage as ProjectStageProgress).is_locked)}>
                      {stage.stageLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Stage File *</label>
                <input
                  type="file"
                  onChange={handleStageFileChange}
                  accept=".pdf,.doc,.docx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note to Supervisor</label>
                <textarea
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add notes about this stage submission (optional)"
                />
              </div>

              <button
                type="submit"
                disabled={submittingStage}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submittingStage ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Submitting Stage...</span>
                  </>
                ) : (
                  <span>Submit Stage</span>
                )}
              </button>
            </form>
          </div>
        }

        {id && (
          <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Workflow History & Feedback</h2>
            <p className="text-sm text-gray-600 mb-4">Tracks proposal review, development comments, interim evaluation, and final decision feedback.</p>

            {loadingWorkflow ? (
              <div className="text-center py-6">
                <Loader className="h-7 w-7 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading workflow details...</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600">Current lifecycle status</p>
                  <p className="font-semibold text-blue-900 mt-1">{(workflowDetails?.project?.workflowStatus || 'proposal_submitted').replace(/_/g, ' ').toUpperCase()}</p>
                  {plagiarismMessage && <p className="text-sm text-green-700 mt-2">{plagiarismMessage}</p>}
                </div>

                <form onSubmit={handleUploadDevelopment} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <h3 className="font-semibold text-gray-900">Project Development Phase (Step 3)</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    <select
                      value={developmentType}
                      onChange={(e) => setDevelopmentType(e.target.value as 'progress_report' | 'chapter' | 'code')}
                      className="px-4 py-3 border border-gray-300 rounded-lg"
                    >
                      <option value="progress_report">Progress Report</option>
                      <option value="chapter">Chapter</option>
                      <option value="code">Code</option>
                    </select>
                    <input
                      type="file"
                      onChange={(e) => setDevelopmentFile(e.target.files?.[0] || null)}
                      className="px-4 py-3 border border-gray-300 rounded-lg"
                      required
                    />
                    <button
                      type="submit"
                      disabled={uploadingDevelopment}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploadingDevelopment ? 'Uploading...' : 'Upload Development File'}
                    </button>
                  </div>
                  <textarea
                    value={developmentComment}
                    onChange={(e) => setDevelopmentComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    placeholder="Comment for supervisor (optional)"
                  />
                </form>

                <form onSubmit={handleSubmitFinalFiles} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <h3 className="font-semibold text-gray-900">Final Project Submission (Step 5 + 6)</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    <input type="file" onChange={(e) => setFinalReportFile(e.target.files?.[0] || null)} className="px-4 py-3 border border-gray-300 rounded-lg" required />
                    <input type="file" onChange={(e) => setSourceCodeFile(e.target.files?.[0] || null)} className="px-4 py-3 border border-gray-300 rounded-lg" required />
                    <input type="file" onChange={(e) => setSupportingDocsFile(e.target.files?.[0] || null)} className="px-4 py-3 border border-gray-300 rounded-lg" required />
                  </div>
                  <p className="text-xs text-gray-500">Required order: Final report, Source code, Supporting documents.</p>
                  <button
                    type="submit"
                    disabled={submittingFinal}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {submittingFinal ? 'Submitting Final...' : 'Submit Final Project'}
                  </button>
                </form>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Proposal/Final Reviews</h3>
                  <div className="space-y-2">
                    {(workflowDetails?.reviews?.length ?? 0) > 0 ? (workflowDetails?.reviews || []).map((review) => (
                      <div key={review.id} className="p-3 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleString()} • {review.phase.toUpperCase()} • {review.decision.toUpperCase()}</p>
                        <p className="text-sm text-gray-800 mt-1">{review.feedback || 'No feedback provided.'}</p>
                        <p className="text-xs text-blue-700 mt-1">By: {review.reviewer_name}</p>
                      </div>
                    )) : <p className="text-sm text-gray-500">No review feedback yet.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Development Submissions</h3>
                  <div className="space-y-2">
                    {(workflowDetails?.development_submissions?.length ?? 0) > 0 ? (workflowDetails?.development_submissions || []).map((submission) => (
                      <div key={submission.id} className="p-3 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500">{new Date(submission.submitted_at).toLocaleString()} • {submission.submission_type.replace('_', ' ').toUpperCase()} • v{submission.version}</p>
                        <p className="text-sm text-gray-700 mt-1">Status: {submission.review_status.replace('_', ' ').toUpperCase()}</p>
                        {submission.comment && <p className="text-sm text-gray-800 mt-1">Your note: {submission.comment}</p>}
                        {submission.supervisor_comment && <p className="text-sm text-blue-800 mt-1">Supervisor: {submission.supervisor_comment}</p>}
                      </div>
                    )) : <p className="text-sm text-gray-500">No development uploads yet.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Interim Evaluation</h3>
                  <div className="space-y-2">
                    {(workflowDetails?.interim_evaluations?.length ?? 0) > 0 ? (workflowDetails?.interim_evaluations || []).map((evaluation) => (
                      <div key={evaluation.id} className="p-3 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500">{new Date(evaluation.created_at).toLocaleString()} • By {evaluation.evaluator_name}</p>
                        <p className="text-sm text-gray-800 mt-1">Marks: {evaluation.marks}</p>
                        <p className="text-sm text-gray-700 mt-1">{evaluation.comments || 'No comments'}</p>
                      </div>
                    )) : <p className="text-sm text-gray-500">No interim evaluation yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              1
            </div>
            <div className={`w-20 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              2
            </div>
            <div className={`w-20 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              3
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* Step 1: Project Information */}
          {step === 1 && (
            <form onSubmit={handleSubmitStep1} className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Project Information</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title *
                </label>
                <input
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your project title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Abstract *
                </label>
                <textarea
                  name="abstract"
                  value={formData.abstract}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Provide a brief summary of your project (minimum 100 words)"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">{formData.abstract.split(' ').filter(w => w).length} words</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objectives *
                </label>
                <textarea
                  name="objectives"
                  value={formData.objectives}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="List your project objectives"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="capstone">Capstone Project</option>
                    <option value="thesis">Thesis</option>
                    <option value="dissertation">Dissertation</option>
                    <option value="research">Research Paper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year *
                  </label>
                  <input
                    name="year"
                    type="number"
                    value={formData.year}
                    onChange={handleChange}
                    min="2000"
                    max={new Date().getFullYear() + 1}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Faculty *
                  </label>
                  <select
                    name="faculty"
                    value={formData.faculty}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    required
                  >
                    <option value="">Select Faculty</option>
                    {FACULTIES.map((faculty) => (
                      <option key={faculty} value={faculty}>{faculty}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <input
                    name="department"
                    type="text"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Software Engineering"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authors *
                </label>
                <input
                  name="authors"
                  type="text"
                  value={formData.authors}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., John Doe, Jane Smith"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Separate multiple authors with commas</p>
              </div>

              {/* Document Upload for Keyword Extraction */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <label className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700 font-medium">
                      Choose a file
                    </span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      required={!id}
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">PDF, DOC, DOCX up to 50MB</p>
                  {formData.file && (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg inline-block">
                      <p className="text-sm text-blue-800 font-medium">{formData.file?.name}</p>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">Upload your document to enable AI keyword extraction</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <div className="flex space-x-2">
                  <input
                    name="keywords"
                    type="text"
                    value={formData.keywords}
                    onChange={handleChange}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave empty to auto-generate, or enter manually"
                  />
                  <button
                    type="button"
                    onClick={handleExtractKeywords}
                    disabled={extractingKeywords || !formData.file}
                    className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={formData.file ? "Generate keywords using AI" : "Upload a document first to generate keywords"}
                  >
                    {extractingKeywords ? (
                      <>
                        <Loader className="h-5 w-5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        <span>AI Generate</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Click "AI Generate" to auto-extract keywords from your uploaded document, or enter them manually (comma-separated)
                </p>
                
                {/* Keyword Suggestions */}
                {keywordSuggestions.length > 0 && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm font-medium text-purple-800 mb-2 flex items-center">
                      <Sparkles className="h-4 w-4 mr-1" />
                      Additional suggestions:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {keywordSuggestions.map((keyword, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addSuggestedKeyword(keyword)}
                          className="px-3 py-1 bg-white border border-purple-300 text-purple-700 rounded-full text-sm hover:bg-purple-100 transition-colors"
                        >
                          + {keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supervisor *
                </label>
                {loadingLecturers ? (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Loading supervisors...</span>
                  </div>
                ) : lecturers.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      No supervisors available. Please contact the administrator.
                    </p>
                  </div>
                ) : (
                  <select
                    name="supervisor_id"
                    value={formData.supervisor_id}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">-- Select a Supervisor --</option>
                    {lecturers.map((lecturer) => (
                      <option key={lecturer.id} value={lecturer.id}>
                        {lecturer.name} {lecturer.department ? `(${lecturer.department})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm text-gray-500 mt-1">Select the supervisor who will review your project</p>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Next: Upload File
                </button>
              </div>
            </form>
          )}

          {/* Step 2: File Upload */}
          {step === 2 && (
            <form onSubmit={handleSubmitStep2} className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Document</h2>

              {/* Show uploaded file */}
              {formData.file ? (
                <div className="border-2 border-green-300 bg-green-50 rounded-lg p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">Document Ready</p>
                  <div className="p-3 bg-white border border-green-200 rounded-lg inline-block">
                    <p className="text-sm text-green-800 font-medium">{formData.file?.name}</p>
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    <label className="cursor-pointer text-blue-600 hover:text-blue-700">
                      Change file
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                      />
                    </label>
                  </p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <label className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700 font-medium">
                      Choose a file
                    </span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      required={!id}
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX up to 50MB</p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your document will be checked for plagiarism. Ensure all sources are properly cited.
                </p>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>Checking Plagiarism...</span>
                    </>
                  ) : (
                    <span>Check & Continue</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Review & Submit</h2>

              {/* Similarity Score */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Plagiarism Check Complete</span>
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="flex items-end space-x-2 mb-2">
                      <span className="text-3xl font-bold text-green-900">{similarityScore}%</span>
                      <span className="text-sm text-gray-600 mb-1">similarity detected</span>
                    </div>
                    <div className="w-full bg-white rounded-full h-3">
                      <div
                        className="h-3 rounded-full bg-green-500"
                        style={{ width: `${similarityScore}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-700 mt-2">
                      {similarityScore! < 20 ? 'Excellent! Your work is highly original.' : 'Good. Acceptable similarity level.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Project Summary */}
              <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Title</h4>
                  <p className="text-gray-900">{formData.title}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Type</h4>
                  <p className="text-gray-900 capitalize">{formData.type}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Faculty / Department</h4>
                  <p className="text-gray-900">{formData.faculty} / {formData.department}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Authors</h4>
                  <p className="text-gray-900">{formData.authors}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Objectives</h4>
                  <p className="text-gray-900 whitespace-pre-wrap">{formData.objectives}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Keywords</h4>
                  <p className="text-gray-900">{formData.keywords}</p>
                </div>
                {formData.file && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">File</h4>
                    <p className="text-gray-900">{formData.file?.name}</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  By submitting, you confirm that this work is original and properly cited. Your supervisor will be notified for review.
                </p>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={uploading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>{id ? (existingProjectStatus === 'revision_requested' ? 'Resubmitting...' : 'Updating...') : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>{id ? (existingProjectStatus === 'revision_requested' ? 'Resubmit Project' : 'Update Project') : 'Submit Project'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

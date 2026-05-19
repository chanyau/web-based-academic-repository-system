import React, { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Download, Loader, Upload } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lecturer, projectService } from "../services/projectService";
import { ProjectStageCode, ProjectStageProgress } from "../types";

type ProjectType = "thesis" | "capstone" | "dissertation" | "research";

interface FormState {
  title: string;
  abstract: string;
  authors: string;
  type: ProjectType;
  faculty: string;
  department: string;
  year: number | "";
  keywords: string;
  focus_area: string;
  file: File | null;
  supervisor_id: string;
}

const stageTemplate: Array<{ stage: ProjectStageCode; label: string }> = [
  { stage: "proposal", label: "Proposal" },
  { stage: "chapter1", label: "Chapter 1" },
  { stage: "chapter2", label: "Chapter 2" },
  { stage: "chapter3", label: "Chapter 3" },
  { stage: "final_document", label: "Final Document" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "Not submitted";
  const date = new Date(value);
  return date.toLocaleDateString();
};

const stageClass = (status: ProjectStageProgress["review_status"]) => {
  switch (status) {
    case "approved":
      return "bg-green-50 text-green-800 border-green-200";
    case "revision_requested":
      return "bg-yellow-50 text-yellow-800 border-yellow-200";
    case "pending":
      return "bg-blue-50 text-blue-800 border-blue-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

const inferFocusArea = (title: string, abstract: string) => {
  const text = `${title} ${abstract}`.toLowerCase();
  if (!text.trim()) return "General";

  const focusMap: Array<{ area: string; keywords: string[] }> = [
    { area: "AI", keywords: ["artificial intelligence", "machine learning", "deep learning", "neural", "nlp", "computer vision", "ai"] },
    { area: "Networking", keywords: ["network", "routing", "wireless", "sdn", "tcp", "ip", "lan", "wan", "5g"] },
    { area: "Security", keywords: ["security", "secure", "encryption", "cryptography", "malware", "attack", "vulnerability", "authentication", "authorization"] },
    { area: "IoT", keywords: ["iot", "internet of things", "sensor", "embedded", "smart device"] },
    { area: "Data Science", keywords: ["data science", "analytics", "big data", "data mining", "prediction", "forecast"] },
    { area: "Software Engineering", keywords: ["software", "development", "agile", "testing", "devops", "architecture"] },
    { area: "Database", keywords: ["database", "dbms", "sql", "nosql", "data warehouse"] },
    { area: "HCI", keywords: ["human computer", "usability", "interaction", "ui", "ux"] },
    { area: "Cloud", keywords: ["cloud", "aws", "azure", "gcp", "virtualization", "container", "kubernetes"] },
    { area: "Mobile", keywords: ["mobile", "android", "ios", "smartphone"] },
  ];

  let bestArea = "General";
  let bestScore = 0;

  focusMap.forEach(({ area, keywords }) => {
    let score = 0;
    keywords.forEach((keyword) => {
      if (text.includes(keyword)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestArea = area;
    }
  });

  return bestArea;
};

const getReportDownloadUrl = (reportLocation?: string | null) => {
  if (!reportLocation) return null;
  if (reportLocation.startsWith("http")) return reportLocation;
  const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace("/api", "");
  const normalizedPath = reportLocation.startsWith("/") ? reportLocation : `/${reportLocation}`;
  return `${baseUrl}${normalizedPath}`;
};

// Function to check if a stage is available for submission
const isStageAvailable = (stage: ProjectStageCode, stageProgress: ProjectStageProgress[], currentIndex: number): boolean => {
  // First stage (proposal) is always available
  if (stage === "proposal") return true;
  
  // Check if previous stage is approved
  if (currentIndex > 0) {
    const previousStage = stageTemplate[currentIndex - 1];
    const previousProgress = stageProgress.find(p => p.stage === previousStage.stage);
    return previousProgress?.review_status === "approved";
  }
  
  return false;
};

export const SubmitProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormState>({
    title: "",
    abstract: "",
    authors: user?.name || "",
    type: "capstone",
    faculty: user?.faculty || "",
    department: user?.department || "",
    year: new Date().getFullYear(),
    keywords: "",
    focus_area: "",
    file: null,
    supervisor_id: "",
  });

  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [projectId, setProjectId] = useState<string | undefined>(routeId);
  const [existingStatus, setExistingStatus] = useState<string | undefined>();
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);

  const [loading, setLoading] = useState<boolean>(!!routeId);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[]>([]);

  const [stageProgress, setStageProgress] = useState<ProjectStageProgress[]>([]);
  const [selectedStage, setSelectedStage] = useState<ProjectStageCode>("proposal");
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageNote, setStageNote] = useState("");
  const [stageError, setStageError] = useState("");
  const [stageNotice, setStageNotice] = useState("");
  const [submittingStage, setSubmittingStage] = useState(false);
  const [checkingStageSimilarity, setCheckingStageSimilarity] = useState(false);
  const [stageSimilarityScore, setStageSimilarityScore] = useState<number | null>(null);
  const [stageReportUrl, setStageReportUrl] = useState<string | null>(null);
  const [stageReportFileUrl, setStageReportFileUrl] = useState<string | null>(null);

  const canShowStages = useMemo(() => Boolean(projectId), [projectId]);

  useEffect(() => {
    const loadLecturers = async () => {
      try {
        const facultyFilter = (formData.faculty || user?.faculty || "").trim();
        const list = await projectService.getLecturers(facultyFilter || undefined);
        setLecturers(list);
      } catch (err) {
        console.error("Failed to load lecturers", err);
      }
    };
    loadLecturers();
  }, [formData.faculty, user?.faculty]);

  const visibleLecturers = useMemo(() => {
    const facultyFilter = (formData.faculty || user?.faculty || "").trim();
    if (!facultyFilter) return lecturers;
    return lecturers.filter((lecturer) => lecturer.faculty === facultyFilter);
  }, [formData.faculty, user?.faculty, lecturers]);

  useEffect(() => {
    if (!formData.supervisor_id) return;
    const stillVisible = visibleLecturers.some(
      (lecturer) => String(lecturer.id) === String(formData.supervisor_id)
    );
    if (!stillVisible) {
      setFormData((prev) => ({ ...prev, supervisor_id: "" }));
    }
  }, [visibleLecturers, formData.supervisor_id]);

  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const project = await projectService.getProject(routeId);
        setFormData({
          title: project.title || "",
          abstract: project.abstract || "",
          authors: Array.isArray(project.authors) ? project.authors.join(", ") : (project.authors || ""),
          type: project.type,
          faculty: project.faculty || "",
          department: project.department || "",
          year: project.year || new Date().getFullYear(),
          keywords: Array.isArray(project.keywords) ? project.keywords.join(", ") : (project.keywords || ""),
          focus_area: project.focusArea || "",
          file: null,
          supervisor_id: project.supervisorId ? String(project.supervisorId) : "",
        });
        setExistingStatus(project.status);
        setProjectDetails(project);
        setProjectId(String(project.id));
        await fetchStageProgress(String(project.id));
      } catch (err: any) {
        console.error(err);
        setLoadError(err?.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [routeId]);

  const toArray = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

  const inferredFocusArea = useMemo(
    () => inferFocusArea(formData.title, formData.abstract),
    [formData.title, formData.abstract]
  );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      focus_area: prev.focus_area || inferredFocusArea,
    }));
  }, [inferredFocusArea]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "year" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, file }));
  };

  const ensureProject = async (): Promise<string> => {
    const payload = {
      title: formData.title.trim(),
      abstract: formData.abstract.trim(),
      authors: toArray(formData.authors),
      type: formData.type,
      faculty: formData.faculty.trim(),
      department: formData.department.trim(),
      year: formData.year || undefined,
      keywords: toArray(formData.keywords),
      focus_area: inferredFocusArea,
      supervisor_id: formData.supervisor_id ? Number(formData.supervisor_id) : undefined,
    };

    console.log('Submitting project data:', payload);

    try {
      if (projectId) {
        console.log('Updating existing project:', projectId);
        const updated = await projectService.updateProject(projectId, payload, formData.file || undefined);
        setExistingStatus(updated.status);
        setProjectDetails(updated);
        return String(updated.id);
      }

      console.log('Creating new project');
      const created = await projectService.createProject(payload, formData.file || undefined);
      setExistingStatus(created.status);
      setProjectDetails(created);
      setProjectId(String(created.id));
      navigate(`/submit/${created.id}`, { replace: true, state: location.state });
      return String(created.id);
    } catch (error: any) {
      console.error('Project creation/update failed:', error);
      throw error;
    }
  };

  const fetchStageProgress = async (pid: string) => {
    try {
      const progress = await projectService.getProjectStageProgress(pid);
      setStageProgress(progress);
    } catch (err) {
      console.error("Failed to load stage progress", err);
    }
  };

  const handleAIGenerateKeywords = async () => {
    if (!formData.abstract || formData.abstract.trim().length < 50) {
      setError("Please enter an abstract with at least 50 characters to generate keywords.");
      return;
    }
    try {
      setExtractingKeywords(true);
      setError("");
      
      // Call the extract keywords API with just the abstract
      const res = await projectService.extractKeywords(null, undefined, formData.abstract, formData.title);
      
      // Replace existing keywords with AI-generated ones
      const aiKeywords = res.keywords || [];
      const existing = toArray(formData.keywords);
      const merged = Array.from(new Set([...existing, ...aiKeywords]));
      setFormData((prev) => ({ ...prev, keywords: merged.join(", ") }));
      setKeywordSuggestions(res.suggestions || []);
      
    } catch (err: any) {
      setError(err?.message || "AI keyword generation failed.");
    } finally {
      setExtractingKeywords(false);
    }
  };

  const handleSubmitDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.supervisor_id) {
      setError("Select a supervisor before continuing.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const pid = await ensureProject();
      await fetchStageProgress(pid);
      setStep(2);
    } catch (err: any) {
      setError(err?.message || "Failed to save project");
    } finally {
      setBusy(false);
    }
  };

  const handleStageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setStageError("Save your project first.");
      return;
    }
    if (!stageFile) {
      setStageError("Attach a file for this stage.");
      return;
    }
    try {
      setSubmittingStage(true);
      setStageError("");
      if (selectedStage === 'final_document' && stageSimilarityScore === null) {
        setStageNotice("Run the plagiarism check before submitting the final document.");
        return;
      }
      await projectService.submitProjectStage(projectId, selectedStage, stageFile, stageNote || undefined);
      
      // Send notification to supervisor about stage upload
      if (formData.supervisor_id) {
        try {
          await projectService.sendStageUploadNotification(
            projectId, 
            selectedStage, 
            formData.supervisor_id,
            user?.name || 'Student',
            formData.title || 'Project'
          );
        } catch (notifErr: any) {
          // Silently handle notification failures - don't block the main flow
          console.log("Notification system not available on backend:", notifErr?.message);
        }
      }
      
      setStageFile(null);
      setStageNote("");
      setStageSimilarityScore(null);
      await fetchStageProgress(projectId);
      try {
        const refreshedProject = await projectService.getProject(projectId);
        setProjectDetails(refreshedProject);
      } catch (refreshErr) {
        console.warn("Failed to refresh project details after stage submit.");
      }
      setStageNotice("Stage submitted successfully.");
    } catch (err: any) {
      setStageError(err?.message || "Stage submission failed.");
    } finally {
      setSubmittingStage(false);
    }
  };

  const handleStageSimilarityCheck = async () => {
    if (!projectId || !stageFile) {
      setStageError("Attach a file for this stage.");
      return;
    }
    try {
      setCheckingStageSimilarity(true);
      setStageError("");
      setStageNotice("Running similarity check on your final document...");
      const result = await projectService.checkSimilarity(
        stageFile,
        formData.abstract,
        formData.title,
        projectId
      );
      const score = result.similarity_score ?? 0;
      setStageSimilarityScore(score);
      setStageReportUrl(result.report_url || null);
      setStageReportFileUrl(result.report_file_url || null);
      setStageNotice(`Similarity check complete: ${score}%. You can now submit.`);
    } catch (err: any) {
      setStageError(err?.message || "Similarity check failed. Please try again.");
      setStageNotice("");
    } finally {
      setCheckingStageSimilarity(false);
    }
  };

  // Function to send notification when supervisor reviews a stage
  const sendStageReviewNotification = async (stage: ProjectStageCode, reviewStatus: string, studentId: string) => {
    if (!projectId) return;
    
    try {
      await projectService.sendStageReviewNotification(projectId, stage, studentId, reviewStatus);
      console.log(`Review notification sent to student for stage: ${stage}`);
    } catch (err: any) {
      console.warn("Failed to send review notification to student:", err?.message);
    }
  };

  const getStage = (stage: ProjectStageCode) => stageProgress.find((item) => item.stage === stage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <Loader className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (loadError && routeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="bg-white shadow-lg rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-4" />
          <p className="text-gray-700 mb-4">{loadError}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-900">
            {projectId ? (existingStatus === "revision_requested" ? "Resubmit Project" : "Edit Project") : "Submit Your Project"}
          </h1>
          <p className="text-gray-600 mt-2">
            {projectId ? "Update your project details and uploads." : "Follow the steps to submit your project."}
          </p>
        </div>

        <div className="flex items-center justify-center space-x-2">
          {[1, 2].map((item) => (
            <React.Fragment key={`step-${item}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= item ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {item}
              </div>
              {item !== 3 && <div className={`w-24 h-1 ${step > item ? "bg-blue-600" : "bg-gray-200"}`}></div>}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white shadow-xl rounded-xl p-8">
          {step === 1 && (
            <form className="space-y-6" onSubmit={handleSubmitDetails}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-800">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                >
                  <option value="capstone">Capstone</option>
                  <option value="thesis">Thesis</option>
                  <option value="dissertation">Dissertation</option>
                  <option value="research">Research</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Faculty *</label>
                <input
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                <input
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Authors *</label>
                <input
                  name="authors"
                  value={formData.authors}
                  onChange={handleChange}
                  placeholder="Comma separated"
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor *</label>
                <select
                  name="supervisor_id"
                  value={formData.supervisor_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                >
                  <option value="">Select supervisor</option>
                  {visibleLecturers.map((lecturer) => (
                    <option key={lecturer.id} value={lecturer.id}>
                      {lecturer.name} {lecturer.department ? `(${lecturer.department})` : ""}
                    </option>
                  ))}
                </select>
                {visibleLecturers.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    No supervisors found for this faculty. Update your faculty to see available lecturers.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Abstract *</label>
                <textarea
                  name="abstract"
                  value={formData.abstract}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Focus Area (Auto)</label>
                <input
                  value={inferredFocusArea}
                  readOnly
                  className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-700 py-3 px-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Keywords</label>
                <div className="flex gap-2">
                  <input
                    name="keywords"
                    value={formData.keywords}
                    onChange={handleChange}
                    placeholder="Comma separated"
                    className="flex-1 rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                  />
                  <button
                    type="button"
                    onClick={handleAIGenerateKeywords}
                    disabled={extractingKeywords || !formData.abstract}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {extractingKeywords ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Generate
                      </>
                    )}
                  </button>
                </div>
                {keywordSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {keywordSuggestions.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => {
                          const list = toArray(formData.keywords);
                          if (!list.includes(kw)) list.push(kw);
                          setFormData((prev) => ({ ...prev, keywords: list.join(", ") }));
                          setKeywordSuggestions((prev) => prev.filter((k) => k !== kw));
                        }}
                        className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm"
                      >
                        + {kw}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-800">{error}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Project ID</p>
                  <p className="font-semibold text-gray-900">{projectId}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                </div>
              </div>

              {stageNotice && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                  {stageNotice}
                </div>
              )}

              {stageError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                  {stageError}
                </div>
              )}

              {canShowStages && (
                <form onSubmit={handleStageSubmit} className="border rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                      <select
                        value={selectedStage}
                        onChange={(e) => setSelectedStage(e.target.value as ProjectStageCode)}
                        className="w-full rounded-lg border-2 border-gray-400 focus:ring-blue-500 focus:border-blue-500 py-3 px-4"
                      >
                        {stageTemplate.map(({ stage, label }, index) => {
                          const isAvailable = isStageAvailable(stage, stageProgress, index);
                          return (
                            <option key={stage} value={stage} disabled={!isAvailable}>
                              {label} {!isAvailable ? "(Locked - Previous stage not approved)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border border-dashed rounded-lg p-4">
                    <div className="text-sm text-gray-700">
                      {stageFile ? stageFile.name : "Attach file for this stage"}
                    </div>
                    <label className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer">
                      <Upload className="h-5 w-5" />
                      <span>Choose file</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          setStageFile(e.target.files?.[0] || null);
                          setStageSimilarityScore(null);
                          setStageReportUrl(null);
                          setStageReportFileUrl(null);
                        }}
                      />
                    </label>
                  </div>

                  {selectedStage === "final_document" && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-purple-800">
                          {stageSimilarityScore === null
                            ? "Run plagiarism check before submitting the final document."
                            : `Similarity score: ${stageSimilarityScore}%`}
                        </div>
                        <button
                          type="button"
                          onClick={handleStageSimilarityCheck}
                          disabled={checkingStageSimilarity || !stageFile}
                          className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {checkingStageSimilarity ? "Checking..." : "Check Plagiarism"}
                        </button>
                      </div>
                      {(stageReportFileUrl || stageReportUrl) ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              const url = getReportDownloadUrl(stageReportFileUrl || stageReportUrl);
                              if (url) window.open(url, "_blank");
                            }}
                            className="inline-flex items-center space-x-2 text-purple-700 hover:text-purple-800"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download Similarity Report</span>
                          </button>
                        </div>
                      ) : stageSimilarityScore !== null ? (
                        <div className="mt-3 inline-flex items-center space-x-2 text-purple-600">
                          <Download className="h-4 w-4" />
                          <span className="text-sm">Similarity report is being prepared. Run the check again if it does not appear.</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingStage}
                      className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submittingStage ? "Submitting..." : "Submit Stage"}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                <h3 className="cke-lg font-semibold text-gray-900">Stage Progress & Feedback</h3>
                {stageTemplate.map(({ stage, label }, index) => {
                  const info = getStage(stage);
                  const isAvailable = isStageAvailable(stage, stageProgress, index);
                  return (
                    <div key={stage} className={`border rounded-lg p-4 ${!isAvailable ? 'opacity-60 bg-gray-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{label}</p>
                          <p className="text-sm text-gray-600">
                            {!isAvailable 
                              ? "Locked - Previous stage must be approved first" 
                              : info?.lock_reason || "Submit and await review."
                            }
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-sm rounded-full border ${stageClass(info?.review_status || "not_submitted")}`}>
                          {!isAvailable ? "Locked" : (info?.review_status || "not_submitted")}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <div>Submitted: {formatDate(info?.submitted_at)}</div>
                        <div>Reviewed: {formatDate(info?.reviewed_at)}</div>
                      </div>
                      {info?.supervisor_feedback && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">Supervisor Feedback:</p>
                          <p className="text-sm text-blue-800">{info.supervisor_feedback}</p>
                        </div>
                      )}
                      {info?.submitted_file && (
                        <button
                          onClick={() =>
                            projectService.downloadProject({
                              id: String(info.project),
                              title: "",
                              abstract: "",
                              authors: [],
                              faculty: "",
                              department: "",
                              year: new Date().getFullYear(),
                              type: "capstone",
                              keywords: [],
                              supervisorId: "",
                              supervisorName: "",
                              submittedAt: "",
                              status: "pending",
                              views: 0,
                              downloads: 0,
                              file: info.submitted_file,
                            } as any)
                          }
                          className="mt-3 inline-flex items-center space-x-2 text-blue-700 hover:text-blue-800"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download submission</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};



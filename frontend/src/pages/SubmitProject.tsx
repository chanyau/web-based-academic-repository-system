import { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService, Lecturer } from '../services/projectService';

export const SubmitProject = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // For editing existing project
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loadingLecturers, setLoadingLecturers] = useState(true);
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    type: 'capstone',
    faculty: user?.faculty || '',
    department: user?.department || '',
    year: new Date().getFullYear(),
    keywords: '',
    authors: `${user?.first_name} ${user?.last_name}` || '',
    supervisor_id: '' as string | number,
    file: null as File | null
  });

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
    if (id) {
      // Load existing project for editing
      loadProject(id);
    }
  }, [id]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      const project = await projectService.getProject(projectId);
      
      // Check if user owns this project
      if (project.ownerId !== user?.id) {
        setError('You can only edit your own projects');
        return;
      }

      // Check if project can be edited
      if (project.status !== 'pending' && project.status !== 'revision_requested') {
        setError('You can only edit pending or revision-requested projects');
        return;
      }

      setFormData({
        title: project.title,
        abstract: project.abstract,
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
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
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
    if (!formData.abstract || formData.abstract.trim().length < 50) {
      setError('Please enter an abstract with at least 50 characters to extract keywords.');
      return;
    }

    try {
      setExtractingKeywords(true);
      setError('');
      
      const existingKeywords = formData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k);
      
      const result = await projectService.extractKeywords(formData.abstract, existingKeywords);
      
      if (result.keywords && result.keywords.length > 0) {
        // Combine existing and new keywords, avoiding duplicates
        const allKeywords = [...new Set([...existingKeywords, ...result.keywords])];
        setFormData({ ...formData, keywords: allKeywords.join(', ') });
        setKeywordSuggestions(result.suggestions || []);
      } else {
        setError('Could not extract keywords. Please try adding more detail to your abstract.');
      }
    } catch (err: any) {
      console.error('Keyword extraction error:', err);
      setError('Failed to extract keywords. Please try again or enter keywords manually.');
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
    setUploading(true);

    // Simulate plagiarism check
    await new Promise(resolve => setTimeout(resolve, 2000));
    const randomScore = Math.floor(Math.random() * 20) + 5;
    setSimilarityScore(randomScore);
    setUploading(false);
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    try {
      setUploading(true);
      setError('');

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
        // Update existing project
        await projectService.updateProject(id, projectData, formData.file || undefined);
      } else {
        // Create new project
        await projectService.createProject(projectData, formData.file || undefined);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to submit project');
    } finally {
      setUploading(false);
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

  if (error && id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <div className="text-red-600 font-semibold mb-2">Cannot Edit Project</div>
          <p className="text-gray-600 mb-4">{error}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">
            {id ? 'Edit Project' : 'Submit Your Project'}
          </h1>
          <p className="text-gray-600">
            {id ? 'Update your project metadata' : 'Follow the steps to submit your academic project for review'}
          </p>
        </div>

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
                  <input
                    name="faculty"
                    type="text"
                    value={formData.faculty}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Computer Science"
                    required
                  />
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
                    disabled={extractingKeywords || formData.abstract.length < 50}
                    className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generate keywords using AI"
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
                  Click "AI Generate" to auto-extract keywords from your abstract, or enter them manually (comma-separated)
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
                {formData.file && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg inline-block">
                    <p className="text-sm text-blue-800 font-medium">{formData.file.name}</p>
                  </div>
                )}
              </div>

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
                  <h4 className="text-sm font-semibold text-gray-700">Keywords</h4>
                  <p className="text-gray-900">{formData.keywords}</p>
                </div>
                {formData.file && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">File</h4>
                    <p className="text-gray-900">{formData.file.name}</p>
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
                      <span>{id ? 'Updating...' : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>{id ? 'Update Project' : 'Submit Project'}</span>
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

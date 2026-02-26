import { useState, useEffect } from 'react';
import { Search, Filter, X, Eye, Download, Calendar, User, Tag, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import { projectService } from '../services/projectService';

export const Projects = () => {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedFaculty, setSelectedFaculty] = useState('');
	const [selectedYear, setSelectedYear] = useState('');
	const [selectedType, setSelectedType] = useState('');
	const [showFilters, setShowFilters] = useState(false);

	useEffect(() => {
		loadProjects();
	}, []);

	const loadProjects = async () => {
		try {
			setLoading(true);
			setError('');
			console.log('Loading approved projects...');
			const projects = await projectService.getProjects({ status: 'approved' });
			console.log('Loaded projects:', projects);
			setProjects(projects || []);
		} catch (err: any) {
			console.error('Error loading projects:', err);
			setError(err.message || 'Failed to load projects');
		} finally{
			setLoading(false);
		}
	};

	const faculties = Array.from(new Set(projects.map(p => p.faculty))).filter(Boolean);
	const years = Array.from(new Set(projects.map(p => p.year))).filter(Boolean).sort((a, b) => b - a);
	const types = Array.from(new Set(projects.map(p => p.type))).filter(Boolean);

	const filteredProjects = projects.filter(project => {
		const keywordsRaw = project.keywords as string | string[] | undefined;
		const keywords: string[] = Array.isArray(keywordsRaw) 
			? keywordsRaw 
			: (typeof keywordsRaw === 'string' && keywordsRaw ? keywordsRaw.split(',').map((k: string) => k.trim()) : []);
		
		const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
							project.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
							(keywords.length > 0 && keywords.some((k: string) => k.toLowerCase().includes(searchQuery.toLowerCase())));
		const matchesFaculty = !selectedFaculty || project.faculty === selectedFaculty;
		const matchesYear = !selectedYear || project.year.toString() === selectedYear;
		const matchesType = !selectedType || project.type === selectedType;

		return matchesSearch && matchesFaculty && matchesYear && matchesType;
	});

	const clearFilters = () => {
		setSelectedFaculty('');
		setSelectedYear('');
		setSelectedType('');
		setSearchQuery('');
	};

	const activeFiltersCount = [selectedFaculty, selectedYear, selectedType].filter(Boolean).length;

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
				<div className="text-center">
					<Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
					<p className="text-gray-600">Loading projects...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
				<div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
					<div className="text-red-600 mb-4">Error loading projects</div>
					<p className="text-gray-600 mb-4">{error}</p>
					<button
						onClick={loadProjects}
						className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-blue-900 mb-2">Browse Projects</h1>
					<p className="text-gray-600">Explore academic research from across all faculties</p>
				</div>

				<div className="bg-white rounded-xl shadow-lg p-6 mb-6">
					<div className="flex flex-col md:flex-row gap-4">
						<div className="flex-1 relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search by title, keywords, or abstract..."
								className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
						</div>
						<button
							onClick={() => setShowFilters(!showFilters)}
							className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors relative"
						>
							<Filter className="h-5 w-5" />
							<span>Filters</span>
							{activeFiltersCount > 0 && (
								<span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
									{activeFiltersCount}
								</span>
							)}
						</button>
					</div>

					{showFilters && (
						<div className="mt-4 pt-4 border-t border-gray-200">
							<div className="grid md:grid-cols-3 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">Faculty</label>
									<select
										value={selectedFaculty}
										onChange={(e) => setSelectedFaculty(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									>
										<option value="">All Faculties</option>
										{faculties.map(faculty => (
											<option key={faculty} value={faculty}>{faculty}</option>
										))}
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
									<select
										value={selectedYear}
										onChange={(e) => setSelectedYear(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									>
										<option value="">All Years</option>
										{years.map(year => (
											<option key={year} value={year}>{year}</option>
										))}
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
									<select
										value={selectedType}
										onChange={(e) => setSelectedType(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									>
										<option value="">All Types</option>
										{types.map(type => (
											<option key={type} value={type} className="capitalize">{type}</option>
										))}
									</select>
								</div>
							</div>

							{activeFiltersCount > 0 && (
								<button
									onClick={clearFilters}
									className="mt-4 flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
								>
									<X className="h-4 w-4" />
									<span>Clear all filters</span>
								</button>
							)}
						</div>
					)}
				</div>

				<div className="mb-4 flex items-center justify-between">
					<p className="text-gray-600">
						Showing <span className="font-semibold text-blue-900">{filteredProjects.length}</span> projects
					</p>
				</div>

				<div className="grid gap-6">
					{filteredProjects.map((project) => (
						<div key={project.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all">
							<div className="flex items-start justify-between mb-4">
								<div className="flex-1">
									<Link
										to={`/projects/${project.id}`}
										className="text-xl font-bold text-blue-900 hover:text-blue-700 transition-colors"
									>
										{project.title}
									</Link>
									<div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
										<span className="flex items-center space-x-1">
											<User className="h-4 w-4" />
											<span>{Array.isArray(project.authors) ? project.authors.join(', ') : project.authors}</span>
										</span>
										<span className="flex items-center space-x-1">
											<Calendar className="h-4 w-4" />
											<span>{project.year}</span>
										</span>
									</div>
								</div>
								<span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full capitalize">
									{project.type}
								</span>
							</div>

							<p className="text-gray-700 mb-4 line-clamp-2">{project.abstract}</p>

							{(() => {
								const keywordsRaw = project.keywords as string | string[] | undefined;
								const keywords: string[] = Array.isArray(keywordsRaw) 
									? keywordsRaw 
									: (typeof keywordsRaw === 'string' && keywordsRaw ? keywordsRaw.split(',').map((k: string) => k.trim()) : []);
								return keywords.length > 0 && (
								<div className="flex flex-wrap gap-2 mb-4">
									{keywords.slice(0, 4).map((keyword: string, index: number) => (
										<span
											key={index}
											className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full flex items-center space-x-1"
										>
											<Tag className="h-3 w-3" />
											<span>{keyword}</span>
										</span>
									))}
									{keywords.length > 4 && (
										<span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
											+{keywords.length - 4} more
										</span>
									)}
								</div>
							);
							})()}

							<div className="flex items-center justify-between pt-4 border-t border-gray-100">
								<div className="flex items-center space-x-6 text-sm text-gray-600">
									<span className="flex items-center space-x-1">
										<Eye className="h-4 w-4" />
										<span>{project.views || 0} views</span>
									</span>
									<span className="flex items-center space-x-1">
										<Download className="h-4 w-4" />
										<span>{project.downloads || 0} downloads</span>
									</span>
								</div>
								<div className="flex items-center space-x-2">
									<span className="text-sm text-gray-600">{project.faculty}</span>
									<Link to={`/projects/${project.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
										View Details
									</Link>
								</div>
							</div>
						</div>
					))}

					{filteredProjects.length === 0 && !loading && (
						<div className="bg-white rounded-xl shadow-lg p-12 text-center">
							<Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
							<h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
							<p className="text-gray-600 mb-4">
								{projects.length === 0 
									? "No projects have been submitted yet. Be the first to submit!"
									: "Try adjusting your search criteria or filters"
								}
							</p>
							{activeFiltersCount > 0 && (
								<button
									onClick={clearFilters}
									className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
								>
									Clear Filters
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

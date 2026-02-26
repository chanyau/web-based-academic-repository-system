import { useAuth } from '../context/AuthContext';
import { Upload, FileText, Clock, CheckCircle, AlertTriangle, TrendingUp, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { useState, useEffect } from 'react';
import { Project } from '../types';

export const Dashboard = () => {
	const { user } = useAuth();
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchProjects = async () => {
			try {
				setLoading(true);
				setError(null);
				
				// Fetch projects based on user role
				if (user?.role === 'student' && user?.id) {
					// Fetch only student's own projects
					const projects = await projectService.getProjects({ owner: user.id });
					setProjects(projects);
				} else if (user?.role === 'lecturer' && user?.id) {
					// Fetch projects assigned to this lecturer
					const projects = await projectService.getProjects({ supervisor: user.id });
					setProjects(projects);
				} else {
					// For admin or others, fetch all projects
					const projects = await projectService.getProjects();
					setProjects(projects);
				}
			} catch (err) {
				setError('Failed to load projects. Please try again later.');
				console.error('Error fetching projects:', err);
			} finally {
				setLoading(false);
			}
		};

		if (user) {
			fetchProjects();
		}
	}, [user]);

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'approved':
				return <CheckCircle className="h-5 w-5 text-green-600" />;
			case 'under_review':
				return <Clock className="h-5 w-5 text-blue-600" />;
			case 'revision_requested':
				return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
			default:
				return <FileText className="h-5 w-5 text-gray-600" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'approved':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'under_review':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'revision_requested':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'pending':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	};

	const totalProjects = projects.length;
	const approvedProjects = projects.filter(p => p.status === 'approved').length;
	const underReviewProjects = projects.filter(p => p.status === 'under_review').length;
	const pendingProjects = projects.filter(p => p.status === 'pending').length;
	const revisionProjects = projects.filter(p => p.status === 'revision_requested').length;

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-blue-900">Welcome back, {user?.name}!</h1>
					<p className="text-gray-600 mt-2">Here's an overview of your academic projects</p>
				</div>

				{error && (
					<div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
						{error}
					</div>
				)}

				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
						<div className="flex items-center justify-between mb-2">
							<FileText className="h-8 w-8 text-blue-600" />
							<span className="text-3xl font-bold text-blue-900">{totalProjects}</span>
						</div>
						<p className="text-gray-600 text-sm">Total Projects</p>
					</div>

					<div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
						<div className="flex items-center justify-between mb-2">
							<CheckCircle className="h-8 w-8 text-green-600" />
							<span className="text-3xl font-bold text-green-900">{approvedProjects}</span>
						</div>
						<p className="text-gray-600 text-sm">Approved</p>
					</div>

					<div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
						<div className="flex items-center justify-between mb-2">
							<Clock className="h-8 w-8 text-blue-600" />
							<span className="text-3xl font-bold text-blue-900">{underReviewProjects}</span>
						</div>
						<p className="text-gray-600 text-sm">Under Review</p>
					</div>

					<div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-600">
						<div className="flex items-center justify-between mb-2">
							<AlertTriangle className="h-8 w-8 text-yellow-600" />
							<span className="text-3xl font-bold text-yellow-900">{revisionProjects}</span>
						</div>
						<p className="text-gray-600 text-sm">Revision Requested</p>
					</div>
				</div>

				<div className="grid lg:grid-cols-3 gap-8">
					<div className="lg:col-span-2">
						<div className="bg-white rounded-xl shadow-lg p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-bold text-gray-900">My Projects</h2>
								{user?.role === 'student' && (
									<Link
										to="/submit"
										className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
									>
										<Upload className="h-4 w-4" />
										<span>Submit New</span>
									</Link>
								)}
							</div>

							{loading ? (
								<div className="text-center py-12">
									<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
									<p className="mt-2 text-gray-600">Loading projects...</p>
								</div>
							) : projects.length === 0 ? (
								<div className="text-center py-12">
									<FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
									<p className="text-gray-600">No projects found</p>
									{user?.role === 'student' && (
										<Link
											to="/submit"
											className="mt-4 inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
										>
											<Upload className="h-4 w-4" />
											<span>Submit Your First Project</span>
										</Link>
									)}
								</div>
							) : (
								<div className="space-y-4">
									{projects.map((project) => (
										<div
											key={project.id}
											className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
										>
											<div className="flex items-start justify-between mb-3">
												<div className="flex-1">
													<h3 className="font-semibold text-gray-900 mb-2">{project.title}</h3>
													<div className="flex items-center space-x-4 text-sm text-gray-600">
														<span className="flex items-center space-x-1">
															<Eye className="h-4 w-4" />
															<span>{project.views} views</span>
														</span>
														<span>Submitted: {new Date(project.submittedAt).toLocaleDateString()}</span>
													</div>
												</div>
												<div
													className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(
														project.status
													)}`}
												>
													{getStatusIcon(project.status)}
													<span className="capitalize">{project.status.replace('_', ' ')}</span>
												</div>
											</div>

											<div className="flex items-center justify-between pt-3 border-t border-gray-100">
												<div className="flex items-center space-x-2">
													{project.similarityScore !== undefined && (
														<>
															<TrendingUp className="h-4 w-4 text-blue-600" />
															<span className="text-sm text-gray-600">
																Similarity Score:{' '}
																<span className="font-semibold text-blue-600">
																	{project.similarityScore}%
																</span>
															</span>
														</>
													)}
												</div>
												<Link
													to={`/projects/${project.id}`}
													className="text-sm text-blue-600 hover:text-blue-700 font-medium"
												>
													View Details →
												</Link>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					<div>
						<div className="bg-white rounded-xl shadow-lg p-6 mb-6">
							<h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
							<div className="space-y-3">
								{user?.role === 'student' && (
									<Link
										to="/submit"
										className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200"
									>
										<Upload className="h-5 w-5 text-blue-600" />
										<span className="text-gray-700">Submit Project</span>
									</Link>
								)}
								<Link
									to="/projects"
									className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200"
								>
									<FileText className="h-5 w-5 text-blue-600" />
									<span className="text-gray-700">Browse Projects</span>
								</Link>
								{(user?.role === 'lecturer' || user?.role === 'admin') && (
									<Link
										to="/review"
										className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200"
									>
										<CheckCircle className="h-5 w-5 text-blue-600" />
										<span className="text-gray-700">Review Submissions</span>
									</Link>
								)}
							</div>
						</div>

						{user?.role === 'admin' && (
							<div className="bg-white rounded-xl shadow-lg p-6">
								<h2 className="text-xl font-bold text-gray-900 mb-4">System Overview</h2>
								<div className="space-y-3 text-sm">
									<div className="flex justify-between">
										<span className="text-gray-600">Pending Reviews:</span>
										<span className="font-semibold text-yellow-600">{pendingProjects}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">Under Review:</span>
										<span className="font-semibold text-blue-600">{underReviewProjects}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">Total Approved:</span>
										<span className="font-semibold text-green-600">{approvedProjects}</span>
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

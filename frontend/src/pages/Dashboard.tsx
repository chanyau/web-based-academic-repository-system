import { useAuth } from '../context/AuthContext';
import { Upload, FileText, Clock, CheckCircle, AlertTriangle, TrendingUp, Eye, MessageSquare } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { useState, useEffect } from 'react';
import { Project } from '../types';

export const Dashboard = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<string>('all');

	useEffect(() => {
		const fetchProjects = async () => {
			try {
				setLoading(true);
				setError(null);
				const sortBySubmittedAt = (items: Project[]) =>
					items
						.slice()
						.sort((a, b) => {
							const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
							const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
							if (bTime !== aTime) return bTime - aTime;
							return (Number(b.id) || 0) - (Number(a.id) || 0);
						});
				
				if (user?.role === 'student' && user?.id) {
					const projects = await projectService.getProjects({ owner: user.id });
					setProjects(sortBySubmittedAt(projects));
				} else if (user?.role === 'lecturer' && user?.id) {
					const projects = await projectService.getProjects({ supervisor: user.id });
					setProjects(sortBySubmittedAt(projects));
				} else {
					const projects = await projectService.getProjects();
					setProjects(sortBySubmittedAt(projects));
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

	useEffect(() => {
		const statusParam = searchParams.get('status');
		if (statusParam) {
			setStatusFilter(statusParam);
		} else {
			setStatusFilter('all');
		}
	}, [searchParams]);

	const handleResubmit = (projectId: string) => {
		navigate(`/submit/${projectId}`);
	};

	const handleViewDetails = (project: Project) => {
		if (user?.role === 'lecturer' && project.status !== 'approved') {
			navigate('/review');
			return;
		}

		navigate(`/projects/${project.id}`);
	};

	const canContinueWorkflow = (status: string) => {
		return status !== 'approved' && status !== 'archived';
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'approved':
				return <CheckCircle className="h-5 w-5 text-green-600" />;
			case 'under_review':
				return <Clock className="h-5 w-5 text-blue-900" />;
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
	const filteredProjects = statusFilter === 'all'
		? projects
		: projects.filter(p => p.status === statusFilter);

	return (
		<div className="min-h-screen bg-slate-100">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{error && (
					<div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
						{error}
					</div>
				)}

				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<button
						type="button"
						onClick={() => navigate('/dashboard?status=all')}
						className="bg-blue-900 rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-all"
					>
						<div className="flex items-center justify-between mb-2">
							<FileText className="h-8 w-8 text-white" />
							<span className="text-3xl font-bold text-white">{totalProjects}</span>
						</div>
						<p className="text-blue-100 text-sm">Total Projects</p>
					</button>

					<button
						type="button"
						onClick={() => navigate('/dashboard?status=approved')}
						className="bg-blue-800 rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-all"
					>
						<div className="flex items-center justify-between mb-2">
							<CheckCircle className="h-8 w-8 text-green-400" />
							<span className="text-3xl font-bold text-white">{approvedProjects}</span>
						</div>
						<p className="text-blue-100 text-sm">Approved</p>
					</button>

					<button
						type="button"
						onClick={() => navigate('/dashboard?status=under_review')}
						className="bg-blue-700 rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-all"
					>
						<div className="flex items-center justify-between mb-2">
							<Clock className="h-8 w-8 text-blue-200" />
							<span className="text-3xl font-bold text-white">{underReviewProjects}</span>
						</div>
						<p className="text-blue-100 text-sm">Under Review</p>
					</button>

					<button
						type="button"
						onClick={() => navigate('/dashboard?status=revision_requested')}
						className="bg-blue-500 rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-all"
					>
						<div className="flex items-center justify-between mb-2">
							<AlertTriangle className="h-8 w-8 text-yellow-400" />
							<span className="text-3xl font-bold text-white">{revisionProjects}</span>
						</div>
						<p className="text-blue-100 text-sm">Revision Requested</p>
					</button>
				</div>

				{user?.role === 'student' ? (
					<div className="w-full">
						<div className="bg-white rounded-xl shadow-lg p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-bold text-blue-900">My Projects</h2>
							</div>

							<div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
								<p className="text-xs uppercase tracking-wide text-blue-700">Assigned Supervisor</p>
								<p className="text-base font-semibold text-blue-900">
									{user?.supervisorName || 'Not assigned yet'}
								</p>
								{!user?.supervisorName && (
									<p className="text-xs text-blue-700 mt-1">Sign in again if your assignment has not appeared.</p>
								)}
							</div>

							{loading ? (
								<div className="text-center py-12">
									<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
									<p className="mt-2 text-gray-600">Loading projects...</p>
								</div>
							) : filteredProjects.length === 0 ? (
								<div className="text-center py-12">
									<FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
									<p className="text-gray-600">No projects found</p>
									<Link
										to="/submit"
										className="mt-4 inline-flex items-center space-x-2 bg-blue-900 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
									>
										<Upload className="h-4 w-4" />
										<span>Submit Your First Project</span>
									</Link>
								</div>
							) : (
								<div className="space-y-4">
									{filteredProjects.map((project) => (
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
													className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(project.status)}`}
												>
													{getStatusIcon(project.status)}
													<span className="capitalize">{project.status.replace('_', ' ')}</span>
												</div>
											</div>

											<div className="flex items-center justify-between pt-3 border-t border-gray-100">
												<div className="flex items-center space-x-2">
													{project.status !== 'approved' && project.similarityScore !== undefined && (
														<>
															<TrendingUp className="h-4 w-4 text-blue-900" />
															<span className="text-sm text-gray-600">
																Similarity Score:{' '}
																<span className="font-semibold text-blue-900">
																	{project.similarityScore}%
																</span>
															</span>
														</>
													)}
												</div>
												<div className="flex items-center space-x-3">
														{canContinueWorkflow(project.status) && (
														<button
															onClick={() => handleResubmit(project.id)}
															className="text-sm bg-blue-900 text-white px-3 py-1 rounded-lg hover:bg-blue-800 transition-colors"
														>
																{project.status === 'revision_requested' ? 'Resubmit' : 'Continue Submission'}
														</button>
													)}
														<button
															onClick={() => handleViewDetails(project)}
															className="text-sm text-blue-900 hover:text-blue-700 font-medium"
														>
															View Details →
														</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="grid lg:grid-cols-3 gap-8">
						<div className="lg:col-span-2">
							<div className="bg-white rounded-xl shadow-lg p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold text-blue-900">My Projects</h2>
								</div>
								{loading ? (
									<div className="text-center py-12">
										<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
										<p className="mt-2 text-gray-600">Loading projects...</p>
									</div>
								) : filteredProjects.length === 0 ? (
									<div className="text-center py-12">
										<FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
										<p className="text-gray-600">No projects found</p>
									</div>
								) : (
									<div className="space-y-4">
										{filteredProjects.map((project) => (
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
														className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(project.status)}`}
													>
														{getStatusIcon(project.status)}
														<span className="capitalize">{project.status.replace('_', ' ')}</span>
													</div>
												</div>

												<div className="flex items-center justify-between pt-3 border-t border-gray-100">
													<div className="flex items-center space-x-2">
														{project.status !== 'approved' && project.similarityScore !== undefined && (
															<>
																<TrendingUp className="h-4 w-4 text-blue-900" />
																<span className="text-sm text-gray-600">
																	Similarity Score:{' '}
																	<span className="font-semibold text-blue-900">
																		{project.similarityScore}%
																	</span>
																</span>
															</>
														)}
													</div>
													<Link
														to={`/projects/${project.id}`}
														className="text-sm text-blue-900 hover:text-blue-700 font-medium"
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
									<Link
										to="/projects"
										className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-100 transition-colors border border-gray-200"
									>
										<FileText className="h-5 w-5 text-blue-900" />
										<span className="text-gray-700">Browse Projects</span>
									</Link>
									<Link
										to="/messages"
										className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-100 transition-colors border border-gray-200"
									>
										<MessageSquare className="h-5 w-5 text-blue-900" />
										<span className="text-gray-700">Messages</span>
									</Link>
									{(user?.role === 'lecturer' || user?.role === 'admin') && (
										<Link
											to="/review"
											className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-100 transition-colors border border-gray-200"
										>
											<CheckCircle className="h-5 w-5 text-blue-900" />
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
											<span className="font-semibold text-blue-900">{underReviewProjects}</span>
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
				)}
			</div>
		</div>
	);
};

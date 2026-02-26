import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


export const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-bold text-blue-900 mb-6">
            Academic Project Repository
          </h1>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8">
            A smart, centralized platform for archiving, managing, and retrieving academic research. Empowering students,
            faculty, and researchers with seamless access to institutional knowledge.
          </p>
          <div className="flex justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Sign In
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Browse Projects
                  <Search className="ml-2 h-5 w-5" />
                </Link>
              </>
            )}
          </div>
        </div>

       

      

        <div className="bg-blue-600 rounded-2xl p-12 text-center shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            Join the Future of Academic Research
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Preserve knowledge, enhance collaboration, and drive innovation with our smart repository system.
          </p>
          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
              >
                Register as Student/Lecturer
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/register/public"
                className="inline-flex items-center px-8 py-3 bg-blue-700 text-white border-2 border-white rounded-lg hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
              >
                Public User Registration
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

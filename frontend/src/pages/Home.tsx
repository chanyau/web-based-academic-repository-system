import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


export const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/home-bg.png')" }}
    >
      <div className="min-h-screen bg-blue-900/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Academic Project Repository
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-8">
            A smart, centralized platform for archiving, managing, and retrieving academic research. Empowering students,
            faculty, and researchers with seamless access to institutional knowledge.
          </p>
          <div className="flex justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center px-8 py-3 bg-white text-blue-900 rounded-lg hover:bg-blue-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center px-8 py-3 bg-white text-blue-900 rounded-lg hover:bg-blue-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
                >
                  Sign In
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center px-8 py-3 bg-transparent text-white border-2 border-white rounded-lg hover:bg-white hover:text-blue-900 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
                >
                  Browse Projects
                  <Search className="ml-2 h-5 w-5" />
                </Link>
              </>
            )}
          </div>
        </div>

       

      

        <div className="p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Join the Future of Academic Research
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Preserve knowledge, enhance collaboration, and drive innovation with our smart repository system.
          </p>
          
        </div>
      </div>
      </div>
    </div>
  );
};

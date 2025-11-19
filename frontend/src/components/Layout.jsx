import { Outlet, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Code, LogOut, Plus, Home } from "lucide-react";

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <img
                  src="/logo.svg"
                  alt="AI Code Review"
                  className="w-10 h-10"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                  AI Code Review
                </span>
              </Link>

              <div className="ml-10 flex space-x-4">
                <Link
                  to="/"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100"
                >
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/new"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Review</span>
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.username || user?.email}
              </span>
              <button
                onClick={logout}
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-gray-700 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

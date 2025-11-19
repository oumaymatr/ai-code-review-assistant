import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReviewStore } from "../store/reviewStore";
import {
  FileCode,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Filter,
} from "lucide-react";
import clsx from "clsx";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusIcons = {
  pending: Clock,
  in_progress: Loader,
  completed: CheckCircle,
  cancelled: XCircle,
};

export default function Dashboard() {
  const { reviews, isLoading, fetchReviews } = useReviewStore();
  const [filters, setFilters] = useState({ status: "", language: "" });

  useEffect(() => {
    fetchReviews(filters);
  }, [fetchReviews, filters]);

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Code Reviews</h1>
          <p className="text-gray-600 mt-1">
            Manage and track your code reviews
          </p>
        </div>
        <Link to="/new" className="btn btn-primary">
          + New Review
        </Link>
      </div>

      <div className="card mb-6">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            className="input flex-1"
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            className="input flex-1"
            value={filters.language}
            onChange={(e) => handleFilterChange("language", e.target.value)}
          >
            <option value="">All Languages</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="card text-center py-12">
          <FileCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No reviews yet
          </h3>
          <p className="text-gray-600 mb-4">
            Get started by creating your first code review
          </p>
          <Link to="/new" className="btn btn-primary">
            Create Review
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const StatusIcon = statusIcons[review.status] || Clock;

            return (
              <Link key={review.id} to={`/review/${review.id}`}>
                <div className="card hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {review.title}
                        </h3>
                        <span
                          className={clsx(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            statusColors[review.status]
                          )}
                        >
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {review.status.replace("_", " ")}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {review.language}
                        </span>
                      </div>

                      {review.description && (
                        <p className="text-gray-600 text-sm mb-3">
                          {review.description}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>By {review.username}</span>
                        <span>•</span>
                        <span>
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                        {review.comment_count > 0 && (
                          <>
                            <span>•</span>
                            <span>{review.comment_count} comments</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReviewStore } from "../store/reviewStore";
import toast from "react-hot-toast";
import { FileCode, Loader } from "lucide-react";
import Editor from "@monaco-editor/react";

const LANGUAGE_MAP = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  go: "go",
  rust: "rust",
  cpp: "cpp",
};

export default function NewReview() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    language: "python",
    code: "# Paste your code here\n",
    auto_analyze: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createReview } = useReviewStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.code.trim() || formData.code === "# Paste your code here\n") {
      toast.error("Please provide code to review");
      return;
    }

    setIsSubmitting(true);
    const result = await createReview(formData);

    if (result.success) {
      toast.success("Review created successfully!");
      navigate(`/review/${result.review.id}`);
    } else {
      toast.error(result.error || "Failed to create review");
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Code Review</h1>
        <p className="text-gray-600 mt-1">
          Submit your code for AI-powered analysis
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., User authentication module"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                className="input"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Provide context about the code..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Programming Language
              </label>
              <select
                className="input"
                value={formData.language}
                onChange={(e) =>
                  setFormData({ ...formData, language: e.target.value })
                }
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <Editor
                  height="400px"
                  language={LANGUAGE_MAP[formData.language] || "plaintext"}
                  value={formData.code}
                  onChange={(value) =>
                    setFormData({ ...formData, code: value || "" })
                  }
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="auto_analyze"
                checked={formData.auto_analyze}
                onChange={(e) =>
                  setFormData({ ...formData, auto_analyze: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label
                htmlFor="auto_analyze"
                className="ml-2 text-sm text-gray-700"
              >
                Automatically analyze code after submission
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <FileCode className="w-5 h-5" />
                <span>Create Review</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReviewStore } from "../store/reviewStore";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  AlertCircle,
  TestTube,
  Zap,
  MessageSquare,
  Loader,
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
  Search,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const severityColors = {
  critical: "text-red-600 bg-red-50 border-red-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  low: "text-blue-600 bg-blue-50 border-blue-200",
};

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentReview,
    analyses,
    comments,
    tests,
    optimizations,
    isLoading,
    fetchReview,
    silentFetchReview,
    analyzeCode,
    generateTests,
    optimizeCode,
    addComment,
    updateReviewStatus,
  } = useReviewStore();
  const [activeTab, setActiveTab] = useState("code");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);

  useEffect(() => {
    fetchReview(id);
  }, [id, fetchReview]);

  // Auto-update status to completed when all features have results
  useEffect(() => {
    if (!currentReview || currentReview.status === "completed") return;

    const hasAnalysis = analyses.length > 0;
    const hasTests = tests.length > 0;
    const hasOptimizations = optimizations.length > 0;

    if (hasAnalysis && hasTests && hasOptimizations) {
      updateReviewStatus(id, "completed");
      toast.success("Review completed successfully.");
    }
  }, [
    analyses.length,
    tests.length,
    optimizations.length,
    currentReview,
    id,
    updateReviewStatus,
  ]);

  // Handle page unload - set status to cancelled if incomplete
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (!currentReview) return;

      const hasAnalysis = analyses.length > 0;
      const hasTests = tests.length > 0;
      const hasOptimizations = optimizations.length > 0;
      const isIncomplete = !(hasAnalysis && hasTests && hasOptimizations);

      // If user is leaving and review is incomplete, mark as cancelled
      if (
        isIncomplete &&
        currentReview.status !== "completed" &&
        currentReview.status !== "cancelled"
      ) {
        // Use sendBeacon for reliable async call before page unload
        navigator.sendBeacon(
          `http://localhost:5000/api/reviews/${id}/status`,
          JSON.stringify({ status: "cancelled" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentReview, analyses.length, tests.length, optimizations.length, id]);

  // Auto-start polling if review was just created and has no analyses yet
  useEffect(() => {
    if (!currentReview) return;

    // Check if review is new (created in last 2 minutes) and has no analyses
    const reviewAge = Date.now() - new Date(currentReview.created_at).getTime();
    const isNewReview = reviewAge < 120000; // 2 minutes

    if (isNewReview && analyses.length === 0 && !isAnalyzing) {
      // Start polling for auto-analysis results
      setIsAnalyzing(true);
      toast.loading("Analysis in progress... Results will appear shortly", {
        id: "analysis-loading",
      });

      let attempts = 0;
      const maxAttempts = 30; // 60 seconds

      const checkResults = setInterval(async () => {
        attempts++;
        const hasChanges = await silentFetchReview(id);

        const currentAnalyses = useReviewStore.getState().analyses;

        if (currentAnalyses.length > 0 || attempts >= maxAttempts) {
          clearInterval(checkResults);
          setIsAnalyzing(false);
          toast.dismiss("analysis-loading");

          if (currentAnalyses.length > 0) {
            toast.success("Analysis complete!");
            setActiveTab("analysis");
          }
        }
      }, 2000);
    }
  }, [currentReview, analyses.length, isAnalyzing, id, silentFetchReview]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);

    toast.loading(
      "🤖 AI is analyzing your code... This may take 1-2 minutes for complex code",
      {
        id: "analysis-loading",
        duration: Infinity,
      }
    );

    // Store initial count to detect new analyses
    const initialAnalysesCount = useReviewStore.getState().analyses.length;

    const result = await analyzeCode(id, "full");

    if (result.success) {
      // Keep polling for 120 seconds (2 minutes) to get results
      let attempts = 0;
      const maxAttempts = 60; // 60 * 2s = 120 secondes

      const checkResults = setInterval(async () => {
        attempts++;

        // Update toast with progress
        if (attempts % 5 === 0) {
          const elapsed = attempts * 2;
          toast.loading(`⏳ Still analyzing... (${elapsed}s elapsed)`, {
            id: "analysis-loading",
          });
        }

        await silentFetchReview(id);

        const currentAnalyses = useReviewStore.getState().analyses;
        const hasNewAnalysis = currentAnalyses.length > initialAnalysesCount;

        if (hasNewAnalysis || attempts >= maxAttempts) {
          clearInterval(checkResults);
          setIsAnalyzing(false);
          toast.dismiss("analysis-loading");

          if (hasNewAnalysis) {
            toast.success("✅ Analysis complete!");
            setActiveTab("analysis");
          } else {
            toast.error(
              "⚠️ Analysis is taking longer than expected. Check back in a moment or refresh the page."
            );
          }
        }
      }, 2000);
    } else {
      setIsAnalyzing(false);
      toast.dismiss("analysis-loading");
      toast.error(result.error || "Analysis failed");
    }
  };

  const handleGenerateTests = async () => {
    setIsGeneratingTests(true);

    if (currentReview && currentReview.status !== "completed") {
      await updateReviewStatus(id, "in_progress");
    }

    toast.loading("Generating tests... This may take a minute", {
      id: "tests-loading",
    });

    // Store initial count to detect new tests
    const initialTestsCount = useReviewStore.getState().tests.length;

    const result = await generateTests(id);

    if (result.success) {
      // Poll for results
      let attempts = 0;
      const maxAttempts = 20;

      const checkResults = setInterval(async () => {
        attempts++;
        await silentFetchReview(id);

        const currentTests = useReviewStore.getState().tests;
        const hasNewTests = currentTests.length > initialTestsCount;

        if (hasNewTests || attempts >= maxAttempts) {
          clearInterval(checkResults);
          setIsGeneratingTests(false);
          toast.dismiss("tests-loading");

          if (hasNewTests) {
            toast.success("Tests generated successfully!");
            setActiveTab("tests");
          } else {
            toast("Tests are still processing. Refresh to check.", {
              icon: "ℹ️",
            });
          }
        }
      }, 5000); // Check every 5 seconds
    } else {
      setIsGeneratingTests(false);
      toast.dismiss("tests-loading");
      toast.error(result.error || "Test generation failed");
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);

    if (currentReview && currentReview.status !== "completed") {
      await updateReviewStatus(id, "in_progress");
    }

    toast.loading("Optimizing code... This may take a minute", {
      id: "optimize-loading",
    });

    const initialOptimizationsCount =
      useReviewStore.getState().optimizations.length;

    const result = await optimizeCode(id, "performance");

    if (result.success) {
      let attempts = 0;
      const maxAttempts = 20;

      const checkResults = setInterval(async () => {
        attempts++;
        await silentFetchReview(id);

        const currentOptimizations = useReviewStore.getState().optimizations;
        const hasNewOptimization =
          currentOptimizations.length > initialOptimizationsCount;

        if (hasNewOptimization || attempts >= maxAttempts) {
          clearInterval(checkResults);
          setIsOptimizing(false);
          toast.dismiss("optimize-loading");

          if (hasNewOptimization) {
            toast.success("Code optimized successfully");
            setActiveTab("optimization");
          } else {
            toast.info(
              "Optimization is still processing. Please refresh to check."
            );
          }
        }
      }, 5000);
    } else {
      setIsOptimizing(false);
      toast.dismiss("optimize-loading");
      toast.error(result.error || "Optimization failed");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const result = await addComment(id, commentText, null);
    if (result.success) {
      setCommentText("");
      toast.success("Comment added!");
    } else {
      toast.error(result.error || "Failed to add comment");
    }
  };

  if (isLoading || !currentReview) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {currentReview.title}
            </h1>
            <p className="text-gray-600 mt-1">{currentReview.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={currentReview.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                const result = await updateReviewStatus(id, newStatus);
                if (result.success) {
                  toast.success(
                    `Status changed to: ${newStatus.replace("_", " ")}`
                  );
                } else {
                  toast.error("Failed to update status");
                }
              }}
              className={clsx(
                "px-3 py-1 rounded-full text-sm font-medium border-2 cursor-pointer",
                statusColors[currentReview.status]
              )}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span className="px-2 py-1 bg-gray-100 rounded">
            {currentReview.language}
          </span>
          <span>By {currentReview.username}</span>
          <span>•</span>
          <span>{new Date(currentReview.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || analyses.length > 0}
          className="card hover:shadow-md transition-shadow cursor-pointer flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <Loader className="w-6 h-6 text-primary-600 animate-spin" />
          ) : (
            <AlertCircle className="w-6 h-6 text-primary-600" />
          )}
          <div className="text-left">
            <div className="font-semibold text-gray-900">Analyze Code</div>
            <div className="text-sm text-gray-600">Find issues & bugs</div>
          </div>
        </button>

        <button
          onClick={handleGenerateTests}
          disabled={isGeneratingTests}
          className="card hover:shadow-md transition-shadow cursor-pointer flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingTests ? (
            <Loader className="w-6 h-6 text-green-600 animate-spin" />
          ) : (
            <TestTube className="w-6 h-6 text-green-600" />
          )}
          <div className="text-left">
            <div className="font-semibold text-gray-900">Generate Tests</div>
            <div className="text-sm text-gray-600">Unit test creation</div>
          </div>
        </button>

        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="card hover:shadow-md transition-shadow cursor-pointer flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOptimizing ? (
            <Loader className="w-6 h-6 text-orange-600 animate-spin" />
          ) : (
            <Zap className="w-6 h-6 text-orange-600" />
          )}
          <div className="text-left">
            <div className="font-semibold text-gray-900">Optimize</div>
            <div className="text-sm text-gray-600">Performance boost</div>
          </div>
        </button>
      </div>

      <div className="card mb-6">
        <div className="border-b border-gray-200 mb-6">
          <div className="flex space-x-8">
            {["code", "analysis", "tests", "optimization", "comments"].map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === tab
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "analysis" && analyses.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full text-xs font-semibold">
                      {analyses.length}
                    </span>
                  )}
                  {tab === "tests" && tests.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-xs font-semibold">
                      {tests.length}
                    </span>
                  )}
                  {tab === "optimization" && optimizations.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full text-xs font-semibold">
                      {optimizations.length}
                    </span>
                  )}
                  {tab === "comments" && comments.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                      {comments.length}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
        </div>

        {activeTab === "code" && (
          <div>
            <SyntaxHighlighter
              language={currentReview.language}
              style={vscDarkPlus}
              showLineNumbers
            >
              {currentReview.code}
            </SyntaxHighlighter>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-6">
            {analyses.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 text-lg">
                  No analysis results yet. Click "Analyze Code" to get started.
                </p>
              </div>
            ) : (
              analyses
                .filter((analysis) => analysis != null)
                .map((analysis, idx) => {
                  // Extract data from the analysis.result object
                  const result = analysis?.result || {};
                  const analysisMetrics = result?.metrics || {};
                  const rawAnalysisText = result?.suggestions || "";
                  const issues = result?.issues || [];
                  const recommendations =
                    analysisMetrics?.recommendations || [];

                  const metrics = {
                    low: analysisMetrics.low || 0,
                    medium: analysisMetrics.medium || 0,
                    high: analysisMetrics.high || 0,
                    critical: analysisMetrics.critical || 0,
                    total_issues: analysisMetrics.total_issues || issues.length,
                  };

                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
                    >
                      {/* Header */}
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold mb-1">
                              Code Analysis Report
                            </h3>
                            <p className="text-indigo-100 text-sm">
                              {new Date(analysis.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-indigo-100">
                              Powered by
                            </div>
                            <div className="font-bold text-lg capitalize">
                              {analysis.provider}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Metrics Summary */}
                      <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50">
                        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500 hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">🔴</span>
                            <div className="text-3xl font-bold text-red-600">
                              {metrics.critical}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            Critical Issues
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Requires immediate attention
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500 hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">🟠</span>
                            <div className="text-3xl font-bold text-orange-600">
                              {metrics.high}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            High Priority
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Should be fixed soon
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500 hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">🟡</span>
                            <div className="text-3xl font-bold text-yellow-600">
                              {metrics.medium}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            Medium Priority
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Plan to address
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">🔵</span>
                            <div className="text-3xl font-bold text-blue-600">
                              {metrics.low}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            Low Priority
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Minor improvements
                          </div>
                        </div>
                      </div>

                      {/* Issues List */}
                      {Array.isArray(issues) && issues.length > 0 && (
                        <div className="p-6">
                          <div className="flex items-center mb-6">
                            <AlertCircle className="w-6 h-6 mr-3 text-red-500" />
                            <h4 className="text-2xl font-bold text-gray-800">
                              Detected Issues
                            </h4>
                            <span className="ml-3 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                              {metrics.total_issues} total
                            </span>
                          </div>

                          <div className="space-y-4">
                            {issues.map((issue, i) => {
                              const issueData =
                                typeof issue === "object"
                                  ? issue
                                  : { message: issue, severity: "medium" };

                              const severityConfig = {
                                critical: {
                                  bg: "bg-red-50",
                                  border: "border-red-500",
                                  text: "text-red-800",
                                  badge: "bg-red-100 text-red-800",
                                  icon: "🔴",
                                },
                                high: {
                                  bg: "bg-orange-50",
                                  border: "border-orange-500",
                                  text: "text-orange-800",
                                  badge: "bg-orange-100 text-orange-800",
                                  icon: "🟠",
                                },
                                medium: {
                                  bg: "bg-yellow-50",
                                  border: "border-yellow-500",
                                  text: "text-yellow-800",
                                  badge: "bg-yellow-100 text-yellow-800",
                                  icon: "🟡",
                                },
                                low: {
                                  bg: "bg-blue-50",
                                  border: "border-blue-500",
                                  text: "text-blue-800",
                                  badge: "bg-blue-100 text-blue-800",
                                  icon: "🔵",
                                },
                              };

                              const config =
                                severityConfig[issueData.severity] ||
                                severityConfig.medium;

                              return (
                                <div
                                  key={i}
                                  className={`${config.bg} border-l-4 ${config.border} rounded-lg p-5 shadow-md hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1`}
                                >
                                  {/* Issue Header */}
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl">
                                        {config.icon}
                                      </span>
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span
                                            className={`${config.badge} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider`}
                                          >
                                            {issueData.severity || "MEDIUM"}
                                          </span>
                                          {issueData.type && (
                                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold capitalize">
                                              {issueData.type}
                                            </span>
                                          )}
                                        </div>
                                        {issueData.line && (
                                          <div className="flex items-center text-xs text-gray-600 mt-1">
                                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-300">
                                              Line {issueData.line}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Issue Message */}
                                  <div className="mb-4">
                                    <h5
                                      className={`font-bold ${config.text} text-base mb-2 flex items-start`}
                                    >
                                      <AlertCircle className="w-4 h-4 mr-2 mt-0.5" />
                                      Problem:
                                    </h5>
                                    <p
                                      className="text-gray-800 leading-relaxed pl-7"
                                      dangerouslySetInnerHTML={{
                                        __html: (issueData.message || issue)
                                          .replace(
                                            /\*\*(.+?)\*\*/g,
                                            '<strong class="font-bold text-gray-900">$1</strong>'
                                          )
                                          .replace(
                                            /`(.+?)`/g,
                                            '<code class="bg-gray-200 px-1.5 py-0.5 rounded text-sm font-mono text-blue-700">$1</code>'
                                          ),
                                      }}
                                    />
                                  </div>

                                  {/* Suggestion */}
                                  {issueData.suggestion && (
                                    <div className="bg-white bg-opacity-80 rounded-lg p-4 border-l-4 border-green-500">
                                      <h5 className="font-bold text-green-700 text-sm mb-2 flex items-center">
                                        <Lightbulb className="w-4 h-4 mr-2" />
                                        Recommended Fix:
                                      </h5>
                                      <p
                                        className="text-gray-700 leading-relaxed text-sm pl-7"
                                        dangerouslySetInnerHTML={{
                                          __html: issueData.suggestion
                                            .replace(
                                              /\*\*(.+?)\*\*/g,
                                              '<strong class="font-bold text-gray-900">$1</strong>'
                                            )
                                            .replace(
                                              /`(.+?)`/g,
                                              '<code class="bg-gray-200 px-1.5 py-0.5 rounded text-sm font-mono text-blue-700">$1</code>'
                                            ),
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recommendations Section */}
                      {Array.isArray(recommendations) &&
                        recommendations.length > 0 && (
                          <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-t border-gray-200">
                            <div className="flex items-center mb-4">
                              <CheckCircle className="w-6 h-6 mr-3 text-green-600" />
                              <h4 className="text-2xl font-bold text-gray-800">
                                General Recommendations
                              </h4>
                            </div>
                            <div className="grid gap-3">
                              {recommendations.map((rec, i) => (
                                <div
                                  key={i}
                                  className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-start">
                                    <span className="text-green-600 font-bold mr-3 text-lg">
                                      ✓
                                    </span>
                                    <p className="text-gray-700 leading-relaxed">
                                      {rec}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {rawAnalysisText && (
                        <details className="p-6 bg-gray-50 border-t border-gray-200">
                          <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900 flex items-center">
                            <Search className="w-4 h-4 mr-2" />
                            View Full AI Analysis (Debug)
                          </summary>
                          <div
                            className="mt-4 p-4 bg-white rounded-lg border border-gray-300 text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto"
                            dangerouslySetInnerHTML={{
                              __html: rawAnalysisText
                                .replace(
                                  /\*\*(.+?)\*\*/g,
                                  '<strong class="font-bold text-gray-900">$1</strong>'
                                )
                                .replace(
                                  /`(.+?)`/g,
                                  '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-blue-600">$1</code>'
                                )
                                .replace(
                                  /###\s+(.+)/g,
                                  '<h3 class="text-lg font-bold text-gray-900 mt-4 mb-2">$1</h3>'
                                )
                                .replace(
                                  /####\s+(.+)/g,
                                  '<h4 class="text-base font-semibold text-gray-800 mt-3 mb-1">$1</h4>'
                                )
                                .replace(
                                  /^-\s+(.+)/gm,
                                  '<li class="ml-4">$1</li>'
                                ),
                            }}
                          />
                        </details>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}

        {activeTab === "tests" && (
          <div>
            {tests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <TestTube className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>
                  No tests generated yet. Click "Generate Tests" to create unit
                  tests.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {tests.map((test, index) => (
                  <div
                    key={test.id}
                    className="border-2 border-green-500/30 rounded-xl p-6 bg-gradient-to-br from-green-500/5 to-emerald-500/5 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <TestTube className="w-6 h-6 text-green-500" />
                      <h3 className="font-bold text-xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        {test.test_type
                          ? test.test_type.charAt(0).toUpperCase() +
                            test.test_type.slice(1)
                          : "Unit"}{" "}
                        Tests
                      </h3>
                      <span className="ml-auto text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full font-medium">
                        {new Date(test.created_at).toLocaleString()}
                      </span>
                    </div>

                    {test.description &&
                      test.description !==
                        '["Placeholder - parse from LLM response"]' && (
                        <div className="mb-5 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {test.description}
                          </p>
                        </div>
                      )}

                    <div className="bg-green-50/50 rounded-lg p-4 border-2 border-green-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <h4 className="font-semibold text-green-600">
                          Generated Test Code
                        </h4>
                      </div>
                      <SyntaxHighlighter
                        language={currentReview?.language || "javascript"}
                        style={vscDarkPlus}
                        showLineNumbers
                        customStyle={{
                          fontSize: "0.875rem",
                          borderRadius: "0.5rem",
                          margin: 0,
                        }}
                      >
                        {test.test_code || "// No test code available"}
                      </SyntaxHighlighter>
                    </div>

                    {test.framework && (
                      <div className="flex items-center gap-3 p-4 mt-4 bg-gradient-to-r from-blue-100 to-cyan-100 border-2 border-blue-300 rounded-lg">
                        <TestTube className="w-5 h-5 text-blue-600" />
                        <div>
                          <span className="text-xs text-blue-700 font-semibold uppercase tracking-wide">
                            Test Framework
                          </span>
                          <p className="text-sm text-blue-900 mt-1">
                            {test.framework}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "optimization" && (
          <div>
            {optimizations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>
                  No optimization results yet. Click "Optimize" to improve your
                  code.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {optimizations.map((optimization, index) => (
                  <div
                    key={optimization.id}
                    className="border-2 border-yellow-500/30 rounded-xl p-6 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <Zap className="w-6 h-6 text-yellow-500" />
                      <h3 className="font-bold text-xl bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        {optimization.optimization_type
                          .charAt(0)
                          .toUpperCase() +
                          optimization.optimization_type.slice(1)}{" "}
                        Optimization
                      </h3>
                      <span className="ml-auto text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-full font-medium">
                        {new Date(optimization.created_at).toLocaleString()}
                      </span>
                    </div>

                    {optimization.description &&
                      optimization.description !==
                        '["Placeholder - parse from LLM response"]' && (
                        <div className="mb-5 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {optimization.description}
                          </p>
                        </div>
                      )}

                    <div className="space-y-5">
                      <div className="bg-red-50/50 rounded-lg p-4 border-2 border-red-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <h4 className="font-semibold text-red-400">
                            Original Code
                          </h4>
                        </div>
                        <SyntaxHighlighter
                          language={currentReview.language}
                          style={vscDarkPlus}
                          showLineNumbers
                          customStyle={{
                            fontSize: "0.875rem",
                            borderRadius: "0.5rem",
                            margin: 0,
                          }}
                        >
                          {optimization.original_code}
                        </SyntaxHighlighter>
                      </div>

                      <div className="bg-green-50/50 rounded-lg p-4 border-2 border-green-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <h4 className="font-semibold text-green-400">
                            Optimized Code
                          </h4>
                        </div>
                        <SyntaxHighlighter
                          language={currentReview.language}
                          style={vscDarkPlus}
                          showLineNumbers
                          customStyle={{
                            fontSize: "0.875rem",
                            borderRadius: "0.5rem",
                            margin: 0,
                          }}
                        >
                          {optimization.optimized_code}
                        </SyntaxHighlighter>
                      </div>

                      {optimization.performance_impact &&
                        optimization.performance_impact !==
                          "Parse from LLM response" && (
                          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300 rounded-lg">
                            <Zap className="w-5 h-5 text-purple-600" />
                            <div>
                              <span className="text-xs text-purple-700 font-semibold uppercase tracking-wide">
                                Performance Impact
                              </span>
                              <p className="text-sm text-purple-900 mt-1">
                                {optimization.performance_impact}
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="space-y-6">
            <form onSubmit={handleAddComment} className="flex space-x-3">
              <input
                type="text"
                className="input flex-1"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <MessageSquare className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {comment.username}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

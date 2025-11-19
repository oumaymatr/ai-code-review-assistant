import { create } from "zustand";
import { reviewsAPI } from "../api";

export const useReviewStore = create((set, get) => ({
  reviews: [],
  currentReview: null,
  analyses: [],
  comments: [],
  tests: [],
  optimizations: [],
  isLoading: false,

  fetchReviews: async (filters) => {
    set({ isLoading: true });
    try {
      const response = await reviewsAPI.list(filters);
      set({ reviews: response.data.reviews, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error("Failed to fetch reviews:", error);
    }
  },

  fetchReview: async (id) => {
    set({ isLoading: true });
    try {
      const [reviewRes, analysesRes, commentsRes, testsRes, optimizationsRes] =
        await Promise.all([
          reviewsAPI.get(id),
          reviewsAPI.getAnalyses(id),
          reviewsAPI.getComments(id),
          reviewsAPI.getTests(id),
          reviewsAPI.getOptimizations(id),
        ]);

      set({
        currentReview: reviewRes.data.review,
        analyses: analysesRes.data.analyses,
        comments: commentsRes.data.comments,
        tests: testsRes.data.tests || [],
        optimizations: optimizationsRes.data.optimizations || [],
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      console.error("Failed to fetch review:", error);
    }
  },

  // Silent fetch - updates data without showing loading state (for polling)
  silentFetchReview: async (id) => {
    try {
      const [analysesRes, testsRes, optimizationsRes] = await Promise.all([
        reviewsAPI.getAnalyses(id),
        reviewsAPI.getTests(id),
        reviewsAPI.getOptimizations(id),
      ]);

      // Only update if data changed to avoid unnecessary re-renders
      const state = useReviewStore.getState();
      const analysesChanged =
        JSON.stringify(state.analyses) !==
        JSON.stringify(analysesRes.data.analyses);
      const testsChanged =
        JSON.stringify(state.tests) !==
        JSON.stringify(testsRes.data.tests || []);
      const optimizationsChanged =
        JSON.stringify(state.optimizations) !==
        JSON.stringify(optimizationsRes.data.optimizations || []);

      if (analysesChanged || testsChanged || optimizationsChanged) {
        set({
          analyses: analysesRes.data.analyses,
          tests: testsRes.data.tests || [],
          optimizations: optimizationsRes.data.optimizations || [],
        });
        return true; // Data changed
      }
      return false; // No changes
    } catch (error) {
      console.error("Silent fetch failed:", error);
      return false;
    }
  },

  createReview: async (data) => {
    try {
      const response = await reviewsAPI.create(data);
      set((state) => ({ reviews: [response.data.review, ...state.reviews] }));
      return { success: true, review: response.data.review };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to create review",
      };
    }
  },

  addComment: async (reviewId, content, lineNumber) => {
    try {
      const response = await reviewsAPI.addComment(reviewId, {
        content,
        line_number: lineNumber,
      });
      set((state) => ({
        comments: [...state.comments, response.data.comment],
      }));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to add comment",
      };
    }
  },

  analyzeCode: async (reviewId, analysisType = "full") => {
    try {
      const response = await reviewsAPI.analyze(reviewId, analysisType);
      // Analysis is async, don't add undefined to analyses
      // Results will be fetched via fetchReview polling
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Analysis failed",
      };
    }
  },

  generateTests: async (reviewId, framework) => {
    try {
      const response = await reviewsAPI.generateTests(reviewId, framework);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Test generation failed",
      };
    }
  },

  optimizeCode: async (reviewId, focus = "performance") => {
    try {
      const response = await reviewsAPI.optimize(reviewId, focus);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Optimization failed",
      };
    }
  },

  updateReviewStatus: async (reviewId, status) => {
    try {
      const response = await reviewsAPI.updateStatus(reviewId, status);
      set((state) => ({
        currentReview: { ...state.currentReview, status },
      }));
      return { success: true, review: response.data.review };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to update status",
      };
    }
  },
}));

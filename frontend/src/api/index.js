import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 600000, // 10 minutes timeout pour les analyses AI complexes
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ne pas rediriger automatiquement lors du login/register (laisse le composant gérer l'erreur)
    const isAuthEndpoint =
      error.config?.url?.includes("/auth/login") ||
      error.config?.url?.includes("/auth/register");

    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  getProfile: () => api.get("/auth/profile"),
};

// Reviews API
export const reviewsAPI = {
  create: (data) => api.post("/reviews", data),
  list: (params) => api.get("/reviews", { params }),
  get: (id) => api.get(`/reviews/${id}`),
  updateStatus: (id, status) => api.patch(`/reviews/${id}/status`, { status }),
  delete: (id) => api.delete(`/reviews/${id}`),

  // Comments
  getComments: (id) => api.get(`/reviews/${id}/comments`),
  addComment: (id, data) => api.post(`/reviews/${id}/comments`, data),

  // Analysis
  getAnalyses: (id) => api.get(`/reviews/${id}/analyses`),
  analyze: (id, analysisType) =>
    api.post(`/reviews/${id}/analyze`, { analysis_type: analysisType }),

  // Tests
  getTests: (id) => api.get(`/reviews/${id}/tests`),
  generateTests: (id, framework) =>
    api.post(`/reviews/${id}/generate-tests`, { framework }),

  // Optimizations
  getOptimizations: (id) => api.get(`/reviews/${id}/optimizations`),
  optimize: (id, focus) => api.post(`/reviews/${id}/optimize`, { focus }),
};

export default api;

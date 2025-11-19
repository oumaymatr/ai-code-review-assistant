import { create } from "zustand";
import { authAPI } from "../api";
import api from "../api";

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
  isLoading: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authAPI.login(credentials);

      const { user, tokens } = response.data.data;
      const token = tokens.accessToken;

      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      set({ user, token, isAuthenticated: true, isLoading: false });

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      set({ isLoading: false });
      return {
        success: false,
        error:
          error.response?.data?.message || "Login failed. Please try again.",
      };
    }
  },

  register: async (userData) => {
    set({ isLoading: true });
    try {
      const response = await authAPI.register(userData);
      const { user, tokens } = response.data.data;
      const token = tokens.accessToken;

      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      set({ user, token, isAuthenticated: true, isLoading: false });

      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return {
        success: false,
        error:
          error.response?.data?.message ||
          "Registration failed. Please try again.",
      };
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await authAPI.getProfile();
      set({ user: response.data.user, isAuthenticated: true });
    } catch (error) {
      // Ne pas logout automatiquement - laisser l'intercepteur gérer ça
      console.error("Failed to load user profile:", error);
      // Si vraiment unauthorized (401), l'intercepteur axios va rediriger
    }
  },
}));

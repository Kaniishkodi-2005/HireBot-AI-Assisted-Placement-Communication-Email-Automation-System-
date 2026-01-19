// Central place to read API base URL from environment variables.
// For Vite we use import.meta.env, but we also fall back to a React-style env var.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";

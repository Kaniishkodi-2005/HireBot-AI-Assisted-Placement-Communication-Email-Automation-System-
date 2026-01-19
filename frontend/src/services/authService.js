import http, { authClient } from "./httpClient";

export async function signupRequest(payload) {
  const fullUrl = `${http.defaults.baseURL}/auth/signup`;
  console.log('Signup request URL:', fullUrl);
  console.log('Signup request payload:', payload);
  try {
    const res = await authClient.post("/auth/signup", payload);
    console.log('Signup response:', res.data);
    return res.data;
  } catch (error) {
    console.error('Signup request failed:', error);
    console.error('Error response status:', error.response?.status);
    console.error('Error response data:', error.response?.data);
    console.error('Request URL was:', fullUrl);
    throw error;
  }
}

export async function loginRequest(email, password) {
  const res = await authClient.post("/auth/login", { email, password });
  return res.data;
}

export async function googleLoginRequest(token) {
  console.log("=== AUTH SERVICE GOOGLE LOGIN ===");
  console.log("X. Making request to backend with token length:", token?.length);
  
  try {
    const res = await authClient.post("/auth/google-login", { token });
    console.log("Y. Backend response received:", res.data);
    return res.data;
  } catch (error) {
    console.error("=== AUTH SERVICE ERROR ===");
    console.error("Z. Request failed:", error);
    console.error("Z1. Error message:", error.message);
    console.error("Z2. Error response:", error.response);
    console.error("Z3. Error response data:", error.response?.data);
    console.error("Z4. Error response status:", error.response?.status);
    throw error;
  }
}
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 second timeout for file uploads
  headers: {
    'Content-Type': 'application/json'
  }
});

// Special client for auth requests with longer timeout
const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 seconds for auth
  headers: {
    'Content-Type': 'application/json'
  }
});

http.interceptors.request.use((config) => {
  console.log(`Making ${config.method?.toUpperCase()} request to:`, config.baseURL + config.url);
  const stored = localStorage.getItem("hirebot_auth");
  if (stored) {
    const { token } = JSON.parse(stored);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

authClient.interceptors.request.use((config) => {
  console.log(`Making AUTH ${config.method?.toUpperCase()} request to:`, config.baseURL + config.url);
  return config;
});

http.interceptors.response.use(
  (response) => {
    console.log(`Response received:`, response.status, response.data);
    return response;
  },
  (error) => {
    console.error(`HTTP Error:`, error.message);
    console.error(`Error details:`, error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

authClient.interceptors.response.use(
  (response) => {
    console.log(`AUTH Response received:`, response.status, response.data);
    return response;
  },
  (error) => {
    console.error(`AUTH HTTP Error:`, error.message);
    console.error(`AUTH Error details:`, error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export default http;
export { authClient };
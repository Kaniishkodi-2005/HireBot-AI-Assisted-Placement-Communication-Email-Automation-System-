import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest, googleLoginRequest } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("hirebot_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log("Restored auth from localStorage:", parsed);
        setUser(parsed.user);
        setToken(parsed.token);
      } catch (error) {
        console.error("Failed to parse stored auth:", error);
        localStorage.removeItem("hirebot_auth");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await loginRequest(email, password);
    const authData = {
      user: {
        email: res.email,
        role: res.role,
        organization: res.organization
      },
      token: res.access_token
    };
    localStorage.setItem("hirebot_auth", JSON.stringify(authData));
    setUser(authData.user);
    setToken(authData.token);
    return authData;
  };

  const googleLogin = async (googleToken) => {
    console.log("=== AUTH CONTEXT GOOGLE LOGIN ===");
    try {
      console.log("A. Sending Google token to backend...");
      console.log("B. Token length:", googleToken?.length);
      
      const res = await googleLoginRequest(googleToken);
      console.log("C. Backend response:", res);
      
      const authData = {
        user: {
          email: res.email,
          role: res.role,
          organization: res.organization
        },
        token: res.access_token
      };
      
      console.log("D. Auth data created:", authData);
      
      localStorage.setItem("hirebot_auth", JSON.stringify(authData));
      console.log("E. Saved to localStorage");
      
      setUser(authData.user);
      setToken(authData.token);
      console.log("F. State updated");
      
      return authData;
    } catch (error) {
      console.error("=== AUTH CONTEXT ERROR ===");
      console.error("Error in googleLogin:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("hirebot_auth");
    setUser(null);
    setToken(null);
    navigate("/login", { replace: true });
  };

  const value = { user, token, login, googleLogin, logout, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}



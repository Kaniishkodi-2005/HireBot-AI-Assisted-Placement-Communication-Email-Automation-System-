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

        // Validation: Verify ID exists
        if (!parsed.user || !parsed.user.id) {
          console.warn("Found stale auth data without User ID. Clearing session.");
          localStorage.removeItem("hirebot_auth");
          setLoading(false);
          return;
        }

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
    console.log("Login API Response:", res); // Debug log to verify ID presence

    // Safety check
    if (!res.id) {
      console.error("CRITICAL: Login response missing User ID!", res);
      // Fallback or alert? We'll rely on global error handling or just let it fail later, 
      // but log it clearly.
    }

    const authData = {
      user: {
        id: res.id,
        email: res.email,
        full_name: res.full_name,
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
    try {
      const res = await googleLoginRequest(googleToken);

      const authData = {
        user: {
          id: res.id,
          email: res.email,
          full_name: res.full_name,
          role: res.role,
          organization: res.organization
        },
        token: res.access_token
      };

      localStorage.setItem("hirebot_auth", JSON.stringify(authData));

      setUser(authData.user);
      setToken(authData.token);

      return authData;
    } catch (error) {
      console.error("Error in googleLogin:", error);
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



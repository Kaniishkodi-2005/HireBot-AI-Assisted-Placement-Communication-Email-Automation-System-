import { useState } from "react";

// Simple helper hook to manage loading/error state for API calls.
export function useApi(fn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      setError(err);
      throw err;
    }
  };

  return { call, loading, error };
}










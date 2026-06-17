import { useState, useEffect } from "react";

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  created_at: string;
}

const STORAGE_KEY = "learningquest_user";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const userData = localStorage.getItem(STORAGE_KEY);
        if (userData) setUser(JSON.parse(userData));
      }
    } catch (err) {
      console.error("Error getting user from localStorage:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = (userData: CurrentUser) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (err) {
      console.error("Error updating user in localStorage:", err);
      setError(err as Error);
    }
  };

  const clearUser = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    } catch (err) {
      console.error("Error clearing user from localStorage:", err);
      setError(err as Error);
    }
  };

  return {
    user,
    loading,
    error,
    updateUser,
    clearUser,
    isAuthenticated: !!user,
    isTeacher: user?.role === "teacher",
    isStudent: user?.role === "student",
    isAdmin: user?.role === "admin",
  };
}

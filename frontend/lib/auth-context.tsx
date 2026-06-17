"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient, MoodleLoginResult } from "./api-client";

export type User = {
  id: string;
  token: string;
  refreshToken?: string;
  username: string;
  name: string;
  email: string;
  role: string;
  // NOTE: legacy field name. Now holds the native backend user id (string).
  // Kept so existing components keyed on `moodleId` keep working; rename in cleanup.
  moodleId: string;
  avatarUrl?: string;
  bio?: string;
  level?: number;
  xp?: number;
  badges?: number;
};

interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

interface RegisterResult {
  success: boolean;
  email?: string;
  message?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<MoodleLoginResult>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  verifyEmail: (email: string, code: string) => Promise<MoodleLoginResult>;
  resendVerification: (email: string) => Promise<{ message: string }>;
  loginWithGoogle: (idToken: string) => Promise<MoodleLoginResult>;
  logout: () => void;
  setUser: (user: User | null) => void;
  updateUser: (patch: Partial<User>) => void;
}

const STORAGE_KEY = "learningquest_user";
const LEGACY_KEYS = ["moodlequest_user", "moodle_user"];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Map a backend user payload + tokens into the client User shape. */
function toUser(apiUser: any, token: string, refreshToken?: string): User {
  const name =
    `${apiUser.first_name || ""} ${apiUser.last_name || ""}`.trim() ||
    apiUser.username;
  const id = String(apiUser.id ?? "");
  return {
    id,
    token,
    refreshToken,
    username: apiUser.username,
    name,
    email: apiUser.email || "",
    role: apiUser.role || "student",
    moodleId: id,
    avatarUrl: apiUser.profile_image_url || "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Restore session from storage on mount.
  useEffect(() => {
    if (!isMounted) return;
    try {
      let stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        for (const key of LEGACY_KEYS) {
          const legacy = localStorage.getItem(key);
          if (legacy) {
            stored = legacy;
            localStorage.setItem(STORAGE_KEY, legacy);
            localStorage.removeItem(key);
            break;
          }
        }
      }
      if (stored) {
        const userData = JSON.parse(stored);
        apiClient.setTokens(userData.token, userData.refreshToken || "");
        setUser(userData);
      }
    } catch (error) {
      console.error("Error loading user from storage:", error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [isMounted]);

  // Keep the API client tokens in sync with the user.
  useEffect(() => {
    apiClient.setTokens(user?.token || "", user?.refreshToken || "");
  }, [user]);

  // When the client silently refreshes the access token (on a 401), persist the
  // new tokens so they survive reloads.
  useEffect(() => {
    apiClient.setOnTokensRefreshed((access, refresh) => {
      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, token: access, refreshToken: refresh };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });
    });
  }, []);

  // Redirect unauthenticated users away from protected routes.
  useEffect(() => {
    if (!isLoading && isMounted) {
      const publicRoutes = [
        "/signin",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/",
        "/learn-more",
        "/faq",
        "/about",
      ];
      const isPublicRoute = publicRoutes.some((route) =>
        pathname?.startsWith(route)
      );
      if (!user && !isPublicRoute) {
        router.push("/signin");
      }
    }
  }, [user, isLoading, isMounted, pathname, router]);

  function persist(result: MoodleLoginResult): MoodleLoginResult {
    if (result.success && result.user) {
      const userData = toUser(
        result.user,
        result.token || result.access_token || "",
        result.refresh_token
      );
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    }
    return result;
  }

  const login = async (username: string, password: string) => {
    return persist(await apiClient.login(username, password));
  };

  const register = async (data: RegisterData) => {
    // Does not log in — registration now requires email verification.
    return apiClient.register(data);
  };

  const verifyEmail = async (email: string, code: string) => {
    return persist(await apiClient.verifyEmail(email, code));
  };

  const resendVerification = async (email: string) => {
    return apiClient.resendVerification(email);
  };

  const loginWithGoogle = async (idToken: string) => {
    return persist(await apiClient.googleLogin(idToken));
  };

  // Merge a partial update into the current user and persist it so the change
  // survives reloads (used by profile editing).
  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  };

  const logout = () => {
    apiClient.logout().catch(() => {});
    setUser(null);
    apiClient.setToken("");
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    router.push("/signin");
  };

  const contextValue = isMounted
    ? {
        user,
        isLoading,
        login,
        register,
        verifyEmail,
        resendVerification,
        loginWithGoogle,
        logout,
        setUser,
        updateUser,
      }
    : {
        user: null,
        isLoading: true,
        login,
        register,
        verifyEmail,
        resendVerification,
        loginWithGoogle,
        logout,
        setUser,
        updateUser,
      };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isLoading && !user) {
      router.push("/signin");
    }
  }, [user, isLoading, isMounted, router]);

  return { user, isLoading };
}

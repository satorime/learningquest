/**
 * API client for interacting with the FastAPI backend
 */

import { User } from "./auth-context";
import type {
  Badge,
  UserBadge,
  BadgeSystemResponse,
  BadgeCreate,
  BadgeUpdate,
  BadgeCheckResult,
} from "@/types/badges";

// Update to match your actual backend URL
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL;

// Origin of the backend without the trailing "/api" — used to resolve static
// file URLs like "/static/uploads/...". e.g. http://localhost:8002/api -> http://localhost:8002
export const API_ORIGIN = (API_BASE_URL || "").replace(/\/api\/?$/, "");

/** Turn a relative "/static/..." path into an absolute URL on the backend. */
export function resolveStaticUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url; // already absolute (e.g. a link attachment)
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  status?: number;
}

/** Error thrown by request() for non-OK responses. `message` is the clean
 * FastAPI `detail`; `status` carries the HTTP status for branching. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True if the error is an ApiError with the given HTTP status. */
export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

/** Clean user-facing message from any thrown error (ApiError already clean). */
export function cleanError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface MoodleLoginParams {
  username: string;
  password: string;
  service?: string;
}

export interface MoodleLoginResult {
  success: boolean;
  user?: any;
  token?: string;
  access_token?: string;
  refresh_token?: string;
  privateToken?: string;
  error?: string;
}

export interface JwtToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user: {
    id: number;
    username: string;
    email?: string;
    role: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    auth_provider?: string;
    is_active?: boolean;
    created_at?: string;
  };
}

// Daily Quest Types
export interface DailyQuest {
  quest_id: number;
  quest_type: string;
  title: string;
  description: string;
  xp_reward: number;
}

export interface UserDailyQuest {
  id: number;
  user_id: number;
  daily_quest_id: number;
  quest_date: string;
  status: "available" | "completed" | "expired";
  current_progress: number;
  target_progress: number;
  started_at?: string;
  completed_at?: string;
  expires_at: string;
  xp_awarded: number;
  quest_metadata: any;
  daily_quest: DailyQuest;
}

export interface DailyQuestSummary {
  date: string;
  total_quests: number;
  completed_quests: number;
  completion_percentage: number;
  total_xp_earned: number;
  quests: UserDailyQuest[];
}

export interface QuestCompletionResponse {
  success: boolean;
  message: string;
  xp_awarded: number;
  quest?: UserDailyQuest;
}

// Teacher Profile Types
export interface TeacherProfile {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email: string;
  profile_image_url?: string;
  bio?: string;
  joined_date: string;
  total_courses: number;
  active_courses: number;
  total_students: number;
  quests_created: number;
  badges_designed: number;
  account_status: string;
}

export interface TeacherProfileUpdate {
  first_name?: string;
  last_name?: string;
  bio?: string;
  profile_image_url?: string;
}

// Streak Types
export interface UserStreak {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  start_date?: string;
  streak_type: string;
}

export interface StreakResponse {
  success: boolean;
  streak: UserStreak;
}

export interface StudentProgress {
  user_id: number;
  total_exp: number;
  quests_completed: number;
  badges_earned: number;
  study_hours: number;
  streak_days: number;
  last_activity: string | null;
}

// Aggregated payload from GET /dashboard/summary. Loose types on the list/object
// slots avoid importing service modules (which import this file).
export interface DashboardSummary {
  quizzes: any[];
  classes: any[];
  progress: StudentProgress | null;
  pet: any | null;
  streak: { streak?: { current_streak?: number } } | null;
}

class ApiClient {
  private token: string = "";
  private refreshTokenValue: string = "";
  private connectionPoolTimers: Map<string, NodeJS.Timeout> = new Map();
  private maxRetries: number = 2;
  private onTokensRefreshed: ((access: string, refresh: string) => void) | null = null;
  private refreshing: Promise<boolean> | null = null;

  setToken(token: string) {
    this.token = token;
  }

  setTokens(access: string, refresh: string) {
    this.token = access;
    this.refreshTokenValue = refresh || "";
  }

  setOnTokensRefreshed(cb: (access: string, refresh: string) => void) {
    this.onTokensRefreshed = cb;
  }

  getToken() {
    return this.token;
  }

  // Exchange the refresh token for a fresh access token (deduped across
  // concurrent 401s). Returns true on success.
  private tryRefresh(): Promise<boolean> {
    if (!this.refreshTokenValue) return Promise.resolve(false);
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: this.refreshTokenValue }),
            credentials: "omit",
          });
          if (!res.ok) return false;
          const data = await res.json();
          this.token = data.access_token;
          this.refreshTokenValue = data.refresh_token || this.refreshTokenValue;
          this.onTokensRefreshed?.(this.token, this.refreshTokenValue);
          return true;
        } catch {
          return false;
        }
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  // Helper for making API requests with automatic retries and connection pooling
  public async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: any,
    retries: number = this.maxRetries,
    timeout: number = 8000,
    refreshRetried: boolean = false
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Check if we have a connection in progress to this endpoint
    const poolKey = `${method}:${url}`;
    if (this.connectionPoolTimers.has(poolKey)) {
      // We're already trying to connect to this endpoint, wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Create an abort controller for the timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Mark this connection as in progress
    this.connectionPoolTimers.set(poolKey, timeoutId);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // Auth uses Bearer tokens (Authorization header), not cookies, so we
        // don't need credentialed requests — this avoids the credentialed-CORS
        // wildcard restriction.
        credentials: "omit",
      });

      // Connection completed, remove from pool
      clearTimeout(timeoutId);
      this.connectionPoolTimers.delete(poolKey);

      // Handle HTTP error responses
      if (!response.ok) {
        // Expired access token → try a one-time refresh, then replay the request.
        if (
          response.status === 401 &&
          !refreshRetried &&
          !endpoint.startsWith("/auth/")
        ) {
          clearTimeout(timeoutId);
          this.connectionPoolTimers.delete(poolKey);
          const refreshed = await this.tryRefresh();
          if (refreshed) {
            return this.request<T>(endpoint, method, body, retries, timeout, true);
          }
        }

        const errorText = await response.text();

        // For database connection errors, retry
        if (
          (errorText.includes("SSL SYSCALL error") ||
            errorText.includes("EOF detected") ||
            errorText.includes("connection") ||
            response.status >= 500) &&
          retries > 0
        ) {
          console.warn(
            `Database connection issue, retrying... (${retries} attempts left)`
          );
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.request<T>(endpoint, method, body, retries - 1, timeout, refreshRetried);
        }

        // Surface the FastAPI `detail` as a clean message; keep the status code.
        let detail = errorText || response.statusText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.detail) {
            detail =
              typeof parsed.detail === "string"
                ? parsed.detail
                : Array.isArray(parsed.detail)
                ? parsed.detail.map((d: { msg?: string }) => d?.msg || String(d)).join(", ")
                : detail;
          }
        } catch {
          /* not JSON */
        }
        throw new ApiError(response.status, detail);
      }

      // Handle 204 No Content responses (like DELETE operations)
      if (response.status === 204) {
        return undefined as T;
      }

      // Check if response has content before trying to parse as JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      // Connection error or timeout, clean up
      clearTimeout(timeoutId);
      this.connectionPoolTimers.delete(poolKey);

      // Handle abort/timeout errors
      if (error instanceof DOMException && error.name === "AbortError") {
        if (retries > 0) {
          console.warn(
            `Request timeout, retrying... (${retries} attempts left)`
          );
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.request<T>(endpoint, method, body, retries - 1, timeout, refreshRetried);
        }
        throw new Error("Request timeout");
      }

      throw error;
    }
  }

  // Multipart file upload. Cannot reuse request() because that forces a JSON
  // Content-Type; here the browser must set the multipart boundary itself.
  async uploadFile<T>(endpoint: string, file: File): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: form,
      credentials: "omit",
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed ${response.status}: ${errorText}`);
    }
    return (await response.json()) as T;
  }

  // Native email/username + password login
  async login(username: string, password: string): Promise<MoodleLoginResult> {
    try {
      const token = await this.request<JwtToken>("/auth/login", "POST", {
        username,
        password,
      });
      this.setToken(token.access_token);
      return {
        success: true,
        token: token.access_token,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        user: token.user,
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: cleanError(error, "Login failed"),
      };
    }
  }

  // Native self-registration (always creates a student). Returns a
  // verification-pending result — the user must confirm an emailed code.
  async register(data: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Promise<{ success: boolean; email?: string; message?: string; error?: string }> {
    try {
      const res = await this.request<{ message: string; email: string }>(
        "/auth/register",
        "POST",
        data
      );
      return { success: true, email: res.email, message: res.message };
    } catch (error) {
      console.error("Register error:", error);
      return {
        success: false,
        error: cleanError(error, "Registration failed"),
      };
    }
  }

  // Confirm the emailed verification code; on success the user is logged in.
  async verifyEmail(email: string, code: string): Promise<MoodleLoginResult> {
    try {
      const token = await this.request<JwtToken>("/auth/verify-email", "POST", {
        email,
        code,
      });
      this.setToken(token.access_token);
      return {
        success: true,
        token: token.access_token,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        user: token.user,
      };
    } catch (error) {
      console.error("Verify email error:", error);
      return {
        success: false,
        error: cleanError(error, "Verification failed"),
      };
    }
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/resend-verification", "POST", {
      email,
    });
  }

  // Google Sign-In: exchange a Google ID token for our session token
  async googleLogin(idToken: string): Promise<MoodleLoginResult> {
    try {
      const token = await this.request<JwtToken>("/auth/google", "POST", {
        id_token: idToken,
      });
      this.setToken(token.access_token);
      return {
        success: true,
        token: token.access_token,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        user: token.user,
      };
    } catch (error) {
      console.error("Google login error:", error);
      return {
        success: false,
        error: cleanError(error, "Google sign-in failed"),
      };
    }
  }

  async refreshSession(refreshToken: string): Promise<JwtToken | null> {
    try {
      const token = await this.request<JwtToken>("/auth/refresh", "POST", {
        refresh_token: refreshToken,
      });
      this.setToken(token.access_token);
      return token;
    } catch (error) {
      console.error("Refresh error:", error);
      return null;
    }
  }

  async getMe(): Promise<JwtToken["user"] | null> {
    try {
      return await this.request<JwtToken["user"]>("/auth/me", "GET");
    } catch (error) {
      console.error("getMe error:", error);
      return null;
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/forgot-password", "POST", {
      email,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/reset-password", "POST", {
      token,
      new_password: newPassword,
    });
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await this.request<void>("/auth/logout", "POST");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear token regardless of API response
      this.token = "";
    }
  }

  // Fetch student progress data
  async fetchStudentProgress(userId: number): Promise<StudentProgress> {
    try {
      return await this.request<StudentProgress>(
        `/quests/student-progress/${userId}`,
        "GET"
      );
    } catch (error) {
      console.error("Student progress fetch error:", error);
      throw error;
    }
  }

  // One request that returns everything the student dashboard needs, so the
  // page doesn't fan out into ~10 separate round-trips. Callers should fall
  // back to the individual endpoints if this throws.
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>(
      "/dashboard/summary",
      "GET",
      undefined,
      1,
      12000
    );
  }

  // Daily Quest Methods
  async getDailyQuestSummary(userId: number): Promise<DailyQuestSummary> {
    try {
      return await this.request<DailyQuestSummary>(
        `/daily-quests/user/${userId}`,
        "GET"
      );
    } catch (error) {
      console.error("Daily quest summary fetch error:", error);
      throw error;
    }
  }

  async completeDailyQuest(
    userId: number,
    questType: string
  ): Promise<QuestCompletionResponse> {
    try {
      return await this.request<QuestCompletionResponse>(
        `/daily-quests/user/${userId}/complete`,
        "POST",
        { quest_type: questType }
      );
    } catch (error) {
      console.error("Daily quest completion error:", error);
      throw error;
    }
  }

  async seedDailyQuests(): Promise<any> {
    try {
      return await this.request<any>("/daily-quests/seed", "POST");
    } catch (error) {
      console.error("Daily quest seed error:", error);
      throw error;
    }
  }

  // Streak Methods
  async getUserStreak(
    userId: number,
    streakType: string = "daily_login"
  ): Promise<StreakResponse> {
    try {
      return await this.request<StreakResponse>(
        `/daily-quests/user/${userId}/streak?streak_type=${streakType}`,
        "GET"
      );
    } catch (error) {
      console.error("User streak fetch error:", error);
      throw error;
    }
  }

  async getTopLoginStreak(
    streakType: string = "daily_login"
  ): Promise<{
    success: boolean;
    user: {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
      profile_image_url: string | null;
    } | null;
    streak: number;
    longest_streak: number;
  }> {
    try {
      return await this.request<{
        success: boolean;
        user: {
          id: number;
          username: string;
          first_name: string;
          last_name: string;
          profile_image_url: string | null;
        } | null;
        streak: number;
        longest_streak: number;
      }>(`/daily-quests/top-streak?streak_type=${streakType}`, "GET");
    } catch (error) {
      console.error("Top streak fetch error:", error);
      throw error;
    }
  }

  // Profile Methods
  async getTeacherProfile(): Promise<TeacherProfile> {
    try {
      return await this.request<TeacherProfile>("/profile/teacher", "GET");
    } catch (error) {
      console.error("Teacher profile fetch error:", error);
      throw error;
    }
  }

  async updateTeacherProfile(
    updateData: TeacherProfileUpdate
  ): Promise<TeacherProfile> {
    try {
      return await this.request<TeacherProfile>(
        "/profile/teacher",
        "PUT",
        updateData
      );
    } catch (error) {
      console.error("Teacher profile update error:", error);
      throw error;
    }
  }

  // Convenience methods for specific quest types
  async completeDailyLoginQuest(
    userId: number
  ): Promise<QuestCompletionResponse> {
    return this.completeDailyQuest(userId, "daily_login");
  }

  async completeFeedPetQuest(userId: number): Promise<QuestCompletionResponse> {
    return this.completeDailyQuest(userId, "feed_pet");
  }

  async completeEarnXPQuest(
    userId: number,
    xpAmount: number = 10
  ): Promise<QuestCompletionResponse> {
    try {
      return await this.request<QuestCompletionResponse>(
        `/daily-quests/user/${userId}/complete`,
        "POST",
        { quest_type: "earn_xp", xp_amount: xpAmount }
      );
    } catch (error) {
      console.error("Earn XP quest completion error:", error);
      throw error;
    }
  }
  // Badge Methods
  async getAllBadges(activeOnly: boolean = true): Promise<Badge[]> {
    try {
      return await this.request<Badge[]>(
        `/badges?active_only=${activeOnly}`,
        "GET",
        undefined,
        1, // one retry is plenty; avoids a slow call hanging the badge panel
        8000
      );
    } catch (error) {
      console.error("Get all badges error:", error);
      throw error;
    }
  }

  async getBadge(badgeId: number): Promise<Badge> {
    try {
      return await this.request<Badge>(`/badges/${badgeId}`, "GET");
    } catch (error) {
      console.error("Get badge error:", error);
      throw error;
    }
  }

  async createBadge(badgeData: BadgeCreate): Promise<Badge> {
    try {
      return await this.request<Badge>("/badges", "POST", badgeData);
    } catch (error) {
      console.error("Create badge error:", error);
      throw error;
    }
  }

  async seedBadges(): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>("/badges/seed", "POST");
    } catch (error) {
      console.error("Seed badges error:", error);
      throw error;
    }
  }

  // --- Teacher custom badges ---
  async createCustomBadge(data: {
    name: string;
    description?: string;
    icon: string;
    color: string;
    shape: "circle" | "shield" | "banner";
    exp_value: number;
  }): Promise<{ success: boolean; badge: Badge }> {
    return this.request("/badges/custom", "POST", data);
  }

  async getMyCustomBadges(): Promise<{ success: boolean; badges: Badge[] }> {
    return this.request("/badges/custom/mine", "GET");
  }

  async updateCustomBadge(
    badgeId: number,
    data: Partial<{
      name: string;
      description: string;
      icon: string;
      color: string;
      shape: "circle" | "shield" | "banner";
      exp_value: number;
      is_active: boolean;
    }>
  ): Promise<{ success: boolean; badge: Badge }> {
    return this.request(`/badges/custom/${badgeId}`, "PUT", data);
  }

  async deleteCustomBadge(badgeId: number): Promise<{ success: boolean }> {
    return this.request(`/badges/custom/${badgeId}`, "DELETE");
  }

  async awardCustomBadge(
    badgeId: number,
    userId: number,
    courseId?: number
  ): Promise<{ success: boolean; message: string; exp_bonus: number }> {
    return this.request(`/badges/custom/${badgeId}/award`, "POST", {
      user_id: userId,
      course_id: courseId ?? null,
    });
  }

  async revokeCustomBadge(
    badgeId: number,
    userId: number
  ): Promise<{ success: boolean }> {
    return this.request(`/badges/custom/${badgeId}/award/${userId}`, "DELETE");
  }

  async getBadgeRecipients(
    badgeId: number
  ): Promise<{
    success: boolean;
    recipients: { user_id: number; name: string; awarded_at: string | null }[];
  }> {
    return this.request(`/badges/custom/${badgeId}/recipients`, "GET");
  }

  // Badges the student earned but hasn't seen the popup for yet (offline replay).
  async getUnseenBadges(): Promise<{
    success: boolean;
    badges: {
      badge_id: number;
      name: string;
      description: string;
      icon: string;
      color: string;
      shape: "circle" | "shield" | "banner";
      exp_value: number;
      is_custom: boolean;
    }[];
  }> {
    return this.request("/badges/unseen", "GET");
  }

  async ackBadges(badgeIds: number[]): Promise<{ success: boolean }> {
    return this.request("/badges/unseen/ack", "POST", { badge_ids: badgeIds });
  }

  async updateBadge(badgeId: number, badgeData: BadgeUpdate): Promise<Badge> {
    try {
      return await this.request<Badge>(`/badges/${badgeId}`, "PUT", badgeData);
    } catch (error) {
      console.error("Update badge error:", error);
      throw error;
    }
  }
  async getUserBadges(userId: number): Promise<UserBadge[]> {
    try {
      return await this.request<UserBadge[]>(`/badges/user/${userId}`, "GET");
    } catch (error) {
      console.error("Get user badges error:", error);
      throw error;
    }
  }

  async getUserBadgeSystem(userId: number): Promise<BadgeSystemResponse> {
    try {
      return await this.request<BadgeSystemResponse>(
        `/badges/user/${userId}/system`,
        "GET"
      );
    } catch (error) {
      console.error("Get user badge system error:", error);
      throw error;
    }
  }
  async getUserBadgeProgress(userId: number): Promise<{
    earned_badges: any[];
    available_badges: any[];
    stats: {
      total_badges: number;
      earned_count: number;
      available_count: number;
      completion_percentage: number;
    };
  }> {
    try {
      return await this.request(`/badges/user/${userId}/progress`, "GET");
    } catch (error) {
      console.error("Get user badge progress error:", error);
      throw error;
    }
  }

  async getMyBadgeSystem(): Promise<BadgeSystemResponse> {
    try {
      return await this.request<BadgeSystemResponse>(
        "/badges/me/system",
        "GET"
      );
    } catch (error) {
      console.error("Get my badge system error:", error);
      throw error;
    }
  }

  async getMyBadges(): Promise<UserBadge[]> {
    try {
      return await this.request<UserBadge[]>("/badges/me/earned", "GET");
    } catch (error) {
      console.error("Get my badges error:", error);
      throw error;
    }
  }

  async awardBadge(userId: number, badgeId: number): Promise<UserBadge> {
    try {
      return await this.request<UserBadge>(
        `/badges/user/${userId}/award/${badgeId}`,
        "POST"
      );
    } catch (error) {
      console.error("Award badge error:", error);
      throw error;
    }
  }

  async checkAndAwardBadges(userId: number): Promise<UserBadge[]> {
    try {
      return await this.request<UserBadge[]>(
        `/badges/user/${userId}/check`,
        "POST"
      );
    } catch (error) {
      console.error("Check and award badges error:", error);
      throw error;
    }
  }

  // Badge Checking Methods
  async checkAllBadgesForUser(
    userId: number,
    courseId?: number,
    awardedBy?: number
  ): Promise<BadgeCheckResult> {
    try {
      const url = `/badges/check-all/${userId}${
        courseId ? `?course_id=${courseId}` : ""
      }${awardedBy ? `&awarded_by=${awardedBy}` : ""}`;
      return await this.request<BadgeCheckResult>(url, "POST");
    } catch (error) {
      console.error("Check all badges error:", error);
      throw error;
    }
  }

  async triggerBadgeCheck(eventData: {
    user_id: number;
    event_type:
      | "quest_completed"
      | "login"
      | "xp_earned"
      | "daily_quest_completed";
    course_id?: number;
    metadata?: any;
  }): Promise<BadgeCheckResult> {
    try {
      return await this.request<BadgeCheckResult>(
        "/badges/trigger-check",
        "POST",
        eventData
      );
    } catch (error) {
      console.error("Trigger badge check error:", error);
      throw error;
    }
  }

  async checkSpecificBadgeCriteria(
    userId: number,
    badgeId: number
  ): Promise<{
    badge_id: number;
    badge_name: string;
    user_id: number;
    meets_criteria: boolean;
    progress: any;
    criteria: any;
  }> {
    try {
      return await this.request(
        `/badges/check-criteria/${userId}/${badgeId}`,
        "GET"
      );
    } catch (error) {
      console.error("Check specific badge criteria error:", error);
      throw error;
    }
  }

  // Quest Methods
  async createQuest(questData: any, creatorId: number): Promise<any> {
    try {
      return await this.request<any>(
        `/quests?creator_id=${creatorId}`,
        "POST",
        questData
      );
    } catch (error) {
      console.error("Create quest error:", error);
      throw error;
    }
  }

  async getQuests(filters?: {
    skip?: number;
    limit?: number;
    course_id?: number;
    is_active?: boolean;
    difficulty_level?: number;
  }): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value.toString());
          }
        });
      }
      const url = `/quests${params.toString() ? `?${params.toString()}` : ''}`;
      return await this.request<any>(url, "GET");
    } catch (error) {
      console.error("Get quests error:", error);
      throw error;
    }
  }

  async getQuest(questId: number): Promise<any> {
    try {
      return await this.request<any>(`/quests/${questId}`, "GET");
    } catch (error) {
      console.error("Get quest error:", error);
      throw error;
    }
  }

  async updateQuest(questId: number, questData: any): Promise<any> {
    try {
      return await this.request<any>(`/quests/${questId}`, "PUT", questData);
    } catch (error) {
      console.error("Update quest error:", error);
      throw error;
    }
  }

  async deleteQuest(questId: number): Promise<void> {
    try {
      await this.request<void>(`/quests/${questId}`, "DELETE");
    } catch (error) {
      console.error("Delete quest error:", error);
      throw error;
    }
  }

  async getMyQuests(): Promise<any> {
    try {
      return await this.request<any>("/quests/my-quests", "GET");
    } catch (error) {
      console.error("Get my quests error:", error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient();

export default apiClient;

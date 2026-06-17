import { apiClient } from "@/lib/api-client";
import { User } from "@/lib/auth-context";

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Profile cache store
interface ProfileCache {
  data: ProfileData;
  timestamp: number;
}
const profileCache: Map<string, ProfileCache> = new Map();

export interface MoodleProfileData {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  profileimageurl?: string;
  bio?: string;
  department?: string;
  institution?: string;
  // Removed unused description field to improve clarity.
  roles?: any[];
}

export interface ProfileData {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url: string;
  role: string;
  level: number;
  learning_score: number;
  joined_date: string;
  school: string;
  department: string;
  bio?: string;
  stats: {
    finished_skills: number;
    watched_workflows: number;
    viewed_time: string;
    courses_completed: number;
    quests_completed: number;
    exp_points: number;
  };
  badges_collected: any[];
  certificates: any[];
  ranking: {
    position: number;
    total_students: number;
  };
}

/**
 * Fetch user profile directly from backend API
 */
export async function fetchUserProfileFromBackend(
  user: User
): Promise<ProfileData | null> {
  try {
    // Use Moodle user ID if available, otherwise fall back to local ID
    const userId = user.moodleId || user.id;

    // Set the token in the API client
    apiClient.setToken(user.token);

    const result = await apiClient.request<any>(
      `/auth/users/${userId}/profile`,
      "GET"
    );

    if (result.success && result.data) {
      // Map the backend response to our ProfileData format
      const profileData: ProfileData = {
        id: result.data.id?.toString() || user.id.toString(),
        username: result.data.username || user.username,
        first_name: result.data.first_name || user.username.split(".")[0] || "",
        last_name: result.data.last_name || user.username.split(".")[1] || "",
        email:
          result.data.email || user.email || `${user.username}@example.com`,
        profile_image_url:
          result.data.profile_image_url ||
          user.avatarUrl ||
          "",
        role: result.data.role || user.role,
        level: result.data.current_level || 1, // Use actual level from backend
        learning_score: result.data.badges_earned || 0, // Use badges earned instead of learning score
        joined_date: result.data.created_at
          ? new Date(result.data.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
        school: "Unknown School", // Default
        department: "General Studies", // Default
        bio: result.data.bio || "", // This should now work correctly
        stats: {
          finished_skills: 0,
          watched_workflows: 0,
          viewed_time: "0min",
          courses_completed: 0,
          quests_completed: result.data.quests_completed || 0, // Use actual quests completed
          exp_points: user.xp || 0,
        },
        badges_collected: [],
        certificates: [],
        ranking: {
          position: 0,
          total_students: 0,
        },
      };

      return profileData;
    }

    throw new Error("Invalid response format from backend");
  } catch (error) {
    console.error("Error fetching profile from backend:", error);
    return null;
  }
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  bio?: string;
}

/**
 * Persist edits to the current user's profile via the backend.
 * Returns the updated profile, or throws an ApiError on failure.
 */
export async function updateUserProfileOnBackend(
  user: User,
  payload: UpdateProfilePayload
): Promise<ProfileData | null> {
  const userId = user.moodleId || user.id;
  apiClient.setToken(user.token);

  const result = await apiClient.request<any>(
    `/auth/users/${userId}/profile`,
    "PUT",
    payload
  );

  // Bust the cache so the next read reflects the change.
  profileCache.delete(String(userId));

  if (result?.success && result.data) {
    return result.data as ProfileData;
  }
  return null;
}

/**
 * Step 1 of changing email: email a verification code to the new address.
 * The address is not changed until confirmEmailChange() succeeds.
 */
export async function requestEmailChange(
  user: User,
  newEmail: string
): Promise<{ success: boolean; message?: string }> {
  apiClient.setToken(user.token);
  return apiClient.request("/auth/change-email/request", "POST", {
    new_email: newEmail,
  });
}

/**
 * Step 2 of changing email: confirm with the code sent to the new address.
 * Returns the updated profile on success.
 */
export async function confirmEmailChange(
  user: User,
  code: string
): Promise<ProfileData | null> {
  const userId = user.moodleId || user.id;
  apiClient.setToken(user.token);
  const result = await apiClient.request<any>(
    "/auth/change-email/confirm",
    "POST",
    { code }
  );
  profileCache.delete(String(userId));
  return result?.success && result.data ? (result.data as ProfileData) : null;
}

/**
 * Fetch detailed user profile from Moodle
 */
async function fetchMoodleProfile(
  token: string,
  username: string
): Promise<MoodleProfileData> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch("/api/proxy/moodle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "webservice/rest/server.php",
        params: {
          wstoken: token,
          wsfunction: "core_user_get_users_by_field",
          moodlewsrestformat: "json",
          field: "username",
          "values[0]": username,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch Moodle profile: ${response.statusText}`);
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    throw new Error("No user profile found in Moodle");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Moodle profile fetch timeout");
    }
    throw error;
  }
}

/**
 * Store Moodle profile data in our backend
 */
async function storeMoodleProfile(
  moodleData: MoodleProfileData,
  token: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    await fetch("/api/auth/moodle/store-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        moodleId: moodleData.id,
        username: moodleData.username,
        email: moodleData.email || `${moodleData.username}@example.com`,
        firstName: moodleData.firstname || "",
        lastName: moodleData.lastname || "",
        token: token,
        bio: moodleData.bio || "",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    console.error("Failed to store Moodle profile in backend:", error);
    // Non-blocking error - we continue even if storage fails
    throw error;
  }
}

/**
 * Create profile data from Moodle user data
 */
function createProfileFromMoodle(
  moodleData: MoodleProfileData,
  user: User
): ProfileData {
  return {
    id: user.id,
    username: moodleData.username || user.username,
    first_name: moodleData.firstname || user.username.split(".")[0] || "",
    last_name: moodleData.lastname || user.username.split(".")[1] || "",
    email: moodleData.email || user.email || `${user.username}@example.com`,
    profile_image_url:
      moodleData.profileimageurl ||
      user.avatarUrl ||
      "",
    role: user.role,
    level: user.level || 1,
    learning_score: 3,
    joined_date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    school: moodleData.institution || "Unknown School",
    department: moodleData.department || "General Studies",
    bio: moodleData.bio || "",
    badges_collected: [],
    stats: {
      finished_skills: 0,
      watched_workflows: 0,
      viewed_time: "0min",
      courses_completed: 0,
      quests_completed: 0,
      exp_points: user.xp || 0,
    },
    certificates: [],
    ranking: {
      position: 0,
      total_students: 0,
    },
  };
}

/**
 * Create default profile data from session
 */
function createDefaultProfile(user: User): ProfileData {
  return {
    id: user.id,
    username: user.username,
    first_name: user.username.split(".")[0] || "",
    last_name: user.username.split(".")[1] || "",
    email: user.email || `${user.username}@example.com`,
    profile_image_url: user.avatarUrl || "",
    role: user.role,
    level: user.level || 1,
    learning_score: 3,
    joined_date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    school: "Unknown School",
    department: "General Studies",
    bio: "",
    badges_collected: [],
    stats: {
      finished_skills: 0,
      watched_workflows: 0,
      viewed_time: "0min",
      courses_completed: 0,
      quests_completed: 0,
      exp_points: user.xp || 0,
    },
    certificates: [],
    ranking: {
      position: 0,
      total_students: 0,
    },
  };
}

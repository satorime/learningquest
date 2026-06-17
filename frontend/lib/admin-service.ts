/** Client for admin user-management + platform endpoints. */
import { apiClient } from "./api-client";

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  first_name?: string | null;
  last_name?: string | null;
  is_active: boolean;
  auth_provider?: string;
  created_at?: string | null;
}

export interface PlatformStats {
  total_users: number;
  students: number;
  teachers: number;
  admins: number;
  active_users: number;
}

export interface ActivityEntry {
  log_id: number;
  user_id: number;
  action_type: string;
  action_details: any;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  timestamp?: string | null;
}

export const adminService = {
  stats(): Promise<PlatformStats> {
    return apiClient.request("/admin/stats", "GET");
  },
  listUsers(params: { role?: string; q?: string; is_active?: boolean } = {}): Promise<AdminUser[]> {
    const qs = new URLSearchParams();
    if (params.role) qs.append("role", params.role);
    if (params.q) qs.append("q", params.q);
    if (params.is_active !== undefined) qs.append("is_active", String(params.is_active));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiClient.request(`/admin/users${suffix}`, "GET");
  },
  createUser(data: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: string;
  }): Promise<AdminUser> {
    return apiClient.request("/admin/users", "POST", data);
  },
  promote(id: number): Promise<AdminUser> {
    return apiClient.request(`/admin/users/${id}/promote`, "POST");
  },
  demote(id: number): Promise<AdminUser> {
    return apiClient.request(`/admin/users/${id}/demote`, "POST");
  },
  activate(id: number): Promise<AdminUser> {
    return apiClient.request(`/admin/users/${id}/activate`, "POST");
  },
  deactivate(id: number): Promise<AdminUser> {
    return apiClient.request(`/admin/users/${id}/deactivate`, "POST");
  },
  activity(limit = 50): Promise<ActivityEntry[]> {
    return apiClient.request(`/admin/activity?limit=${limit}`, "GET");
  },
};

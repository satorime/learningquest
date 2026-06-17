/**
 * Client for native class (group) management + enrollment endpoints.
 */
import { apiClient } from "./api-client";

export interface ClassItem {
  id: number;
  title: string;
  description?: string | null;
  join_code?: string | null;
  teacher_id: number;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  member_count: number;
}

export interface ClassMember {
  user_id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role: string;
  status: string;
  enrolled_at?: string | null;
}

export interface CreateClassInput {
  title: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export const classService = {
  listMyClasses(includeArchived = false): Promise<ClassItem[]> {
    return apiClient.request<ClassItem[]>(
      `/classes?include_archived=${includeArchived}`,
      "GET"
    );
  },
  createClass(data: CreateClassInput): Promise<ClassItem> {
    return apiClient.request<ClassItem>("/classes", "POST", data);
  },
  getClass(id: number): Promise<ClassItem> {
    return apiClient.request<ClassItem>(`/classes/${id}`, "GET");
  },
  updateClass(id: number, data: Partial<CreateClassInput> & { is_active?: boolean }): Promise<ClassItem> {
    return apiClient.request<ClassItem>(`/classes/${id}`, "PATCH", data);
  },
  regenerateCode(id: number): Promise<ClassItem> {
    return apiClient.request<ClassItem>(`/classes/${id}/regenerate-code`, "POST");
  },
  listMembers(id: number): Promise<ClassMember[]> {
    return apiClient.request<ClassMember[]>(`/classes/${id}/members`, "GET");
  },
  removeMember(id: number, userId: number): Promise<void> {
    return apiClient.request<void>(`/classes/${id}/members/${userId}`, "DELETE");
  },
  joinClass(code: string): Promise<ClassItem> {
    return apiClient.request<ClassItem>("/classes/join", "POST", { code });
  },
  myEnrolledClasses(): Promise<ClassItem[]> {
    return apiClient.request<ClassItem[]>("/classes/mine/enrolled", "GET");
  },
  leaveClass(id: number): Promise<void> {
    return apiClient.request<void>(`/classes/${id}/leave`, "DELETE");
  },
};

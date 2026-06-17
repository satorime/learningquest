/** Client for the teacher Google Drive connection endpoints. */
import { apiClient } from "./api-client";

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  folder_link: string | null;
}

export const driveService = {
  status(): Promise<DriveStatus> {
    return apiClient.request<DriveStatus>("/drive/status", "GET");
  },
  /** Fetch the Google consent URL and navigate the browser to it. */
  async connect(): Promise<void> {
    const res = await apiClient.request<{ url: string }>("/drive/connect", "GET");
    window.location.href = res.url;
  },
  disconnect(): Promise<{ success: boolean }> {
    return apiClient.request("/drive/disconnect", "POST");
  },
  setRootFolder(folderId: string): Promise<{ success: boolean; folder_link: string }> {
    return apiClient.request("/drive/root-folder", "POST", { folder_id: folderId });
  },
};

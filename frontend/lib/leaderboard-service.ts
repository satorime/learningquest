import { apiClient } from './api-client';
import {
  Leaderboard,
  TopStudent,
  CourseLeaderboard,
  StudentProgress,
  LeaderboardFilter,
  LeaderboardUser,
  TimeFrameOption,
  MetricType
} from '@/types/gamification';

export interface ClassLeaderboardEntry {
  rank: number;
  name: string;
}

export class LeaderboardService {
  /**
   * Class leaderboard — Top 10 by quiz score, names only (members-only on the
   * backend). No scores are returned.
   */
  async getClassLeaderboard(classId: number): Promise<ClassLeaderboardEntry[]> {
    return await apiClient.request<ClassLeaderboardEntry[]>(
      `/classes/${classId}/leaderboard`,
      "GET"
    );
  }

  /**
   * Get all leaderboards with optional filtering
   */
  async getLeaderboards(filters?: LeaderboardFilter): Promise<Leaderboard[]> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      if (filters.course_id) queryParams.append('course_id', filters.course_id.toString());
      if (filters.metric_type) queryParams.append('metric_type', filters.metric_type);
      if (filters.timeframe) queryParams.append('timeframe', filters.timeframe);
      if (filters.is_active !== undefined) queryParams.append('is_active', filters.is_active.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
      if (filters.offset) queryParams.append('offset', filters.offset.toString());
    }
    
    const endpoint = `/leaderboard?${queryParams.toString()}`;
    return await apiClient.request<Leaderboard[]>(endpoint, 'GET');
  }

  /**
   * Get a specific leaderboard by ID
   */
  async getLeaderboard(leaderboardId: number): Promise<Leaderboard> {
    return await apiClient.request<Leaderboard>(`/leaderboard/${leaderboardId}`, 'GET');
  }

  /**
   * Get top students for a specific course
   */
  async getCourseTopStudents(courseId: number, limit: number = 10, timeframe?: TimeFrameOption): Promise<TopStudent[]> {
    let endpoint = `/leaderboard/top-students/course/${courseId}?limit=${limit}`;
    if (timeframe) {
      endpoint += `&timeframe=${timeframe}`;
    }
    return await apiClient.request<TopStudent[]>(endpoint, 'GET');
  }

  /**
   * Get global top students across all courses
   */
  async getGlobalTopStudents(limit: number = 20, timeframe?: TimeFrameOption): Promise<TopStudent[]> {
    let endpoint = `/leaderboard/top-students/global?limit=${limit}`;
    if (timeframe) {
      endpoint += `&timeframe=${timeframe}`;
    }
    return await apiClient.request<TopStudent[]>(endpoint, 'GET');
  }

  /**
   * Get course leaderboard summary with top students and available leaderboards
   */
  async getCourseLeaderboardSummary(courseId: number): Promise<CourseLeaderboard> {
    return await apiClient.request<CourseLeaderboard>(
      `/leaderboard/course/${courseId}/summary`,
      'GET'
    );
  }

  /**
   * Get student progress for a specific course
   */
  async getCourseProgress(courseId: number, limit: number = 50, offset: number = 0): Promise<StudentProgress[]> {
    return await apiClient.request<StudentProgress[]>(
      `/leaderboard/progress/course/${courseId}?limit=${limit}&offset=${offset}`,
      'GET'
    );
  }

  /**
   * Get current user's progress in a course
   */
  async getMyProgress(courseId: number): Promise<StudentProgress> {
    return await apiClient.request<StudentProgress>(
      `/leaderboard/progress/course/${courseId}/me`,
      'GET'
    );
  }

  /**
   * Refresh leaderboard rankings (admin/teacher only)
   */
  async refreshLeaderboard(leaderboardId: number): Promise<Leaderboard> {
    return await apiClient.request<Leaderboard>(
      `/leaderboard/${leaderboardId}/refresh`,
      'POST'
    );
  }

  /**
   * Transform backend leaderboard data to frontend format
   */
  transformToLeaderboardUsers(entries: any[]): LeaderboardUser[] {
    return entries.map((entry, index) => ({
      id: entry.user_id,
      username: entry.username || `User${entry.user_id}`,
      first_name: entry.first_name || '',
      last_name: entry.last_name || '',
      profile_image_url: entry.profile_image_url,
      rank: this.calculateUserRank(entry.score || 0),
        stats: {
          quests_completed: entry.quests_completed || 0,
          exp_points: entry.total_exp || entry.score || 0,
          rank_score: entry.score || 0,
          badges_earned: entry.badges_earned || 0,
          current_ranking: entry.current_ranking || entry.rank || 0,
          last_active: entry.last_active || 'Unknown'
        },
      level: this.calculateLevel(entry.total_exp || entry.score || 0),
      position: entry.rank || index + 1
    }));
  }

  /**
   * Calculate user rank based on experience points
   */
  private calculateUserRank(exp: number): string {
    if (exp >= 3000) return 'Master';
    if (exp >= 2000) return 'Expert';
    if (exp >= 1000) return 'Intermediate';
    return 'Beginner';
  }

  /**
   * Calculate user level based on experience points
   */
  private calculateLevel(exp: number): number {
    return Math.floor(exp / 200) + 1;
  }

  /**
   * Get leaderboard data formatted for the frontend component
   */
  async getFormattedLeaderboardData(
    courseId?: number,
    timeframe: TimeFrameOption = 'weekly',
    metricType: MetricType = 'exp',
    limit: number = 50
  ): Promise<{
    topUsers: LeaderboardUser[];
    otherUsers: LeaderboardUser[];
    totalParticipants: number;
  }> {
    try {
      let users: LeaderboardUser[] = [];

      if (courseId) {
        // Get course-specific leaderboard
        const topStudents = await this.getCourseTopStudents(courseId, limit, timeframe);
        users = this.transformToLeaderboardUsers(topStudents);
      } else {
        // Get global leaderboard
        const globalStudents = await this.getGlobalTopStudents(limit, timeframe);
        users = this.transformToLeaderboardUsers(globalStudents);
      }

      // Split into top 3 and others
      const topUsers = users.slice(0, 3);
      const otherUsers = users.slice(3);

      return {
        topUsers,
        otherUsers,
        totalParticipants: users.length
      };
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      // Return empty data on error
      return {
        topUsers: [],
        otherUsers: [],
        totalParticipants: 0
      };
    }
  }

  /**
   * Search users in leaderboard
   */
  async searchLeaderboardUsers(
    query: string,
    courseId?: number,
    timeframe: TimeFrameOption = 'weekly',
    limit: number = 20
  ): Promise<LeaderboardUser[]> {
    try {
      const { topUsers, otherUsers } = await this.getFormattedLeaderboardData(
        courseId,
        timeframe,
        'exp',
        100 // Get more data for searching
      );
      
      const allUsers = [...topUsers, ...otherUsers];
      
      if (!query.trim()) {
        return allUsers.slice(0, limit);
      }

      const searchTerm = query.toLowerCase();
      const filteredUsers = allUsers.filter(user =>
        user.username.toLowerCase().includes(searchTerm) ||
        user.first_name.toLowerCase().includes(searchTerm) ||
        user.last_name.toLowerCase().includes(searchTerm)
      );

      return filteredUsers.slice(0, limit);
    } catch (error) {
      console.error('Error searching leaderboard users:', error);
      return [];
    }
  }
}

export const leaderboardService = new LeaderboardService(); 
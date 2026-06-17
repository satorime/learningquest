/** Client for Math Duck Race (multiplayer, teacher-hosted). */
import { apiClient } from "./api-client";

export const DUCK_COLOR_HEX: Record<string, string> = {
  yellow: "#FFD700",
  orange: "#FF8C00",
  pink: "#FF69B4",
  blue: "#4169E1",
  green: "#32CD32",
  purple: "#9370DB",
  red: "#DC143C",
  white: "#E5E7EB",
};

export type RaceStatus = "waiting" | "playing" | "finished";

export interface RacePlayer {
  user_id: number;
  display_name: string;
  duck_color: string;
  tile: number;
  score: number;
  is_ready: boolean;
  is_host: boolean;
  correct_answers: number;
  wrong_answers: number;
}

export interface RaceChoice {
  id: number;
  text: string;
}

export interface RaceQuestion {
  index: number;
  prompt: string;
  type: string;
  choices: RaceChoice[];
}

export interface RaceRoomState {
  id: number;
  code: string;
  host_id: number;
  quiz_id: number;
  status: RaceStatus;
  total_tiles: number;
  time_per_question: number;
  max_players: number;
  current_index: number;
  total_questions: number;
  current_started_at: string | null;
  locked: boolean;
  locked_by: number | null;
  locked_by_name: string | null;
  winner_id: number | null;
}

export interface RaceState {
  room: RaceRoomState;
  players: RacePlayer[];
  current_question: RaceQuestion | null;
  me: { user_id: number; is_host: boolean; already_answered: boolean };
  server_now: string;
}

export interface RaceResults {
  room: { id: number; code: string; status: string; winner_id: number | null; total_tiles: number };
  standings: {
    rank: number;
    user_id: number;
    display_name: string;
    duck_color: string;
    tile: number;
    score: number;
    correct_answers: number;
    wrong_answers: number;
    is_winner: boolean;
  }[];
  question_stats: { index: number; prompt: string; correct_count: number; wrong_count: number }[];
}

export const raceService = {
  createRoom(data: {
    quiz_id: number;
    total_tiles?: number;
    time_per_question?: number;
    max_players?: number;
  }): Promise<RaceState> {
    return apiClient.request("/race/rooms", "POST", data);
  },
  join(code: string): Promise<RaceState> {
    return apiClient.request("/race/join", "POST", { code });
  },
  ready(roomId: number, isReady: boolean, duckColor?: string): Promise<RaceState> {
    return apiClient.request(`/race/rooms/${roomId}/ready`, "POST", {
      is_ready: isReady,
      duck_color: duckColor,
    });
  },
  start(roomId: number): Promise<RaceState> {
    return apiClient.request(`/race/rooms/${roomId}/start`, "POST");
  },
  close(roomId: number): Promise<{ status: string }> {
    return apiClient.request(`/race/rooms/${roomId}/close`, "POST");
  },
  answer(roomId: number, answer: string): Promise<{ correct: boolean; locked_by: number | null }> {
    return apiClient.request(`/race/rooms/${roomId}/answer`, "POST", { answer });
  },
  state(roomId: number): Promise<RaceState> {
    return apiClient.request(`/race/rooms/${roomId}/state`, "GET");
  },
  results(roomId: number): Promise<RaceResults> {
    return apiClient.request(`/race/rooms/${roomId}/results`, "GET");
  },
};

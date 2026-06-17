/** Client for the interactive math mini-games (server-generated + graded). */
import { apiClient } from "./api-client";

export interface GameProblem {
  index: number;
  prompt: string;
  topic: string;
  choices: string[];
}

export interface StartResponse {
  session_id: number;
  difficulty: number;
  seconds_per_question: number;
  problems: GameProblem[];
}

export interface AnswerResponse {
  correct: boolean;
  correct_value: string;
  solution: string;
}

export interface FinishResponse {
  correct: number;
  total: number;
  food_awarded: number;
  xp_awarded: number;
  food_total: number;
}

export const gamesService = {
  startMath(): Promise<StartResponse> {
    return apiClient.request("/games/math/start", "POST");
  },
  answerMath(sessionId: number, index: number, value: string): Promise<AnswerResponse> {
    return apiClient.request("/games/math/answer", "POST", {
      session_id: sessionId,
      index,
      value,
    });
  },
  finishMath(sessionId: number): Promise<FinishResponse> {
    return apiClient.request("/games/math/finish", "POST", { session_id: sessionId });
  },
};

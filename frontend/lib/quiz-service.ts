/** Client for the quiz engine (questions, taking, submitting, grading). */
import { apiClient, resolveStaticUrl } from "./api-client";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export type AttachmentKind = "file" | "link";

export interface Attachment {
  id?: number;
  kind: AttachmentKind;
  url: string;
  name: string;
  mime?: string | null;
  size?: number | null;
  external_id?: string | null; // Google Drive file id (files only)
}

export interface QuizOption {
  id?: number;
  text: string;
  is_correct?: boolean | null;
  position?: number;
}

export interface QuizQuestion {
  id: number;
  quest_id: number;
  type: QuestionType;
  prompt: string;
  points: number;
  position: number;
  correct_answer?: string | null;
  options: QuizOption[];
}

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  points: number;
  position?: number;
  correct_answer?: string | null;
  options?: { text: string; is_correct: boolean }[];
}

export interface AnswerInput {
  question_id: number;
  selected_option_id?: number | null;
  answer_text?: string | null;
}

export interface SubmissionResult {
  id: number;
  quest_id: number;
  user_id: number;
  status: string;
  score: number;
  max_score: number;
  text_response?: string | null;
  file_url?: string | null;
  feedback?: string | null;
  needs_manual_grading: boolean;
  submitted_at?: string | null;
  graded_at?: string | null;
  answers: {
    question_id: number;
    selected_option_id?: number | null;
    answer_text?: string | null;
    awarded_points: number;
    is_correct?: boolean | null;
  }[];
  attachments: Attachment[];
}

export interface TeacherQuest {
  quest_id: number;
  title: string;
  description?: string | null;
  status: string;
  class_id?: number | null;
  class_title?: string | null;
  difficulty_level: number;
  exp_reward: number;
  question_count: number;
  submission_count: number;
  end_date?: string | null;
  created_at?: string | null;
}

export interface StudentQuest {
  quest_id: number;
  title: string;
  description?: string | null;
  class_id?: number | null;
  class_title?: string | null;
  exp_reward: number;
  difficulty_level: number;
  end_date?: string | null;
  time_limit_minutes?: number | null;
  submission_status: string;
  score?: number | null;
  max_score?: number | null;
}

export interface QuestInfo {
  quest_id: number;
  title: string;
  description?: string | null;
  exp_reward: number;
  time_limit_minutes?: number | null;
  end_date?: string | null;
}

export const quizService = {
  // lifecycle
  createQuest(data: {
    title: string;
    description?: string;
    class_id?: number | null;
    difficulty_level?: number;
    end_date?: string | null;
    time_limit_minutes?: number | null;
  }): Promise<TeacherQuest> {
    return apiClient.request("/quiz/quests", "POST", data);
  },
  myQuests(): Promise<TeacherQuest[]> {
    return apiClient.request("/quiz/quests/mine", "GET");
  },
  deleteQuest(questId: number): Promise<void> {
    return apiClient.request(`/quiz/quests/${questId}`, "DELETE");
  },
  availableQuests(): Promise<StudentQuest[]> {
    return apiClient.request("/quiz/available", "GET");
  },
  // teacher authoring
  listQuestions(questId: number): Promise<QuizQuestion[]> {
    return apiClient.request(`/quiz/${questId}/questions`, "GET");
  },
  addQuestion(questId: number, q: QuestionInput): Promise<QuizQuestion> {
    return apiClient.request(`/quiz/${questId}/questions`, "POST", q);
  },
  /** Parse questions from an uploaded PDF/Word doc (drafts, not yet saved). */
  importQuestions(questId: number, file: File): Promise<{ questions: QuestionInput[] }> {
    return apiClient.uploadFile<{ questions: QuestionInput[] }>(`/quiz/${questId}/import`, file);
  },
  /** Create several reviewed questions at once. */
  addQuestionsBulk(questId: number, questions: QuestionInput[]): Promise<QuizQuestion[]> {
    return apiClient.request(`/quiz/${questId}/questions/bulk`, "POST", { questions });
  },
  updateQuestion(questionId: number, q: Partial<QuestionInput>): Promise<QuizQuestion> {
    return apiClient.request(`/quiz/questions/${questionId}`, "PUT", q);
  },
  deleteQuestion(questionId: number): Promise<void> {
    return apiClient.request(`/quiz/questions/${questionId}`, "DELETE");
  },
  publish(questId: number): Promise<{ status: string }> {
    return apiClient.request(`/quiz/${questId}/publish`, "POST");
  },
  archive(questId: number): Promise<{ status: string }> {
    return apiClient.request(`/quiz/${questId}/archive`, "POST");
  },
  // student taking
  questInfo(questId: number): Promise<QuestInfo> {
    return apiClient.request(`/quiz/${questId}/info`, "GET");
  },
  take(questId: number): Promise<QuizQuestion[]> {
    return apiClient.request(`/quiz/${questId}/take`, "GET");
  },
  /** Upload a file for a quest and get back attachment metadata (not yet attached). */
  uploadFile(questId: number, file: File): Promise<Attachment> {
    return apiClient.uploadFile<Attachment>(`/quiz/${questId}/uploads`, file);
  },
  submit(
    questId: number,
    payload: {
      answers: AnswerInput[];
      text_response?: string;
      file_url?: string;
      attachments?: Attachment[];
    }
  ): Promise<SubmissionResult> {
    return apiClient.request(`/quiz/${questId}/submit`, "POST", payload);
  },
  mySubmission(questId: number): Promise<SubmissionResult> {
    return apiClient.request(`/quiz/${questId}/my-submission`, "GET");
  },
  /** Withdraw a submission (back to not-started) before the deadline. */
  unsubmit(questId: number): Promise<void> {
    return apiClient.request(`/quiz/${questId}/my-submission`, "DELETE");
  },
  // teacher grading
  listSubmissions(questId: number): Promise<SubmissionResult[]> {
    return apiClient.request(`/quiz/${questId}/submissions`, "GET");
  },
  grade(
    submissionId: number,
    payload: {
      feedback?: string;
      answer_grades?: { question_id: number; awarded_points: number; is_correct?: boolean }[];
      score?: number;
      max_score?: number;
    }
  ): Promise<SubmissionResult> {
    return apiClient.request(`/quiz/submissions/${submissionId}/grade`, "POST", payload);
  },
  /** Absolute URL for a file attachment served from the backend. */
  fileUrl(url: string): string {
    return resolveStaticUrl(url);
  },
};

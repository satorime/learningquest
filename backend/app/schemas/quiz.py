"""Schemas for the quiz engine: questions, options, submissions, grading."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# --- authoring (teacher) ----------------------------------------------------
class OptionCreate(BaseModel):
    text: str
    is_correct: bool = False


class QuestionCreate(BaseModel):
    type: str = Field(description="multiple_choice | true_false | short_answer")
    prompt: str
    points: int = Field(default=1, ge=0)
    position: int = 0
    # short_answer only: accepted answer (case-insensitive exact match)
    correct_answer: Optional[str] = None
    options: List[OptionCreate] = []


class QuestionUpdate(BaseModel):
    prompt: Optional[str] = None
    points: Optional[int] = Field(default=None, ge=0)
    position: Optional[int] = None
    correct_answer: Optional[str] = None
    options: Optional[List[OptionCreate]] = None


class BulkQuestionsRequest(BaseModel):
    """Create several questions at once (used by the AI document import)."""
    questions: List[QuestionCreate] = []


class OptionResponse(BaseModel):
    id: int
    text: str
    position: int
    # Only included in the teacher/authoring view.
    is_correct: Optional[bool] = None

    class Config:
        from_attributes = True


class QuestionResponse(BaseModel):
    id: int
    quest_id: int
    type: str
    prompt: str
    points: int
    position: int
    correct_answer: Optional[str] = None  # teacher view only
    options: List[OptionResponse] = []

    class Config:
        from_attributes = True


# --- taking / submitting (student) ------------------------------------------
class AnswerInput(BaseModel):
    question_id: int
    selected_option_id: Optional[int] = None
    answer_text: Optional[str] = None


class AttachmentInput(BaseModel):
    kind: str = Field(description="file | link")
    url: str
    name: str
    mime: Optional[str] = None
    size: Optional[int] = None
    external_id: Optional[str] = None  # e.g. Google Drive file id (set by upload)


class AttachmentResponse(BaseModel):
    id: int
    kind: str
    url: str
    name: str
    mime: Optional[str] = None
    size: Optional[int] = None

    class Config:
        from_attributes = True


class SubmissionInput(BaseModel):
    answers: List[AnswerInput] = []
    text_response: Optional[str] = None
    file_url: Optional[str] = None
    attachments: List[AttachmentInput] = []


class AnswerResult(BaseModel):
    question_id: int
    selected_option_id: Optional[int] = None
    answer_text: Optional[str] = None
    awarded_points: int = 0
    is_correct: Optional[bool] = None

    class Config:
        from_attributes = True


class SubmissionResponse(BaseModel):
    id: int
    quest_id: int
    user_id: int
    status: str
    score: int
    max_score: int
    text_response: Optional[str] = None
    file_url: Optional[str] = None
    feedback: Optional[str] = None
    needs_manual_grading: bool = False
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None
    answers: List[AnswerResult] = []
    attachments: List[AttachmentResponse] = []

    class Config:
        from_attributes = True


# --- grading (teacher) ------------------------------------------------------
class AnswerGrade(BaseModel):
    question_id: int
    awarded_points: int = Field(ge=0)
    is_correct: Optional[bool] = None


class GradeInput(BaseModel):
    feedback: Optional[str] = None
    # Per-answer overrides for subjective questions (optional).
    answer_grades: List[AnswerGrade] = []
    # Direct overall grade — used for attachment/text assignments with no
    # auto-graded questions. When omitted, the score is summed from answers.
    score: Optional[int] = Field(default=None, ge=0)
    max_score: Optional[int] = Field(default=None, ge=0)


# --- quest (quiz) lifecycle -------------------------------------------------
class QuestCreateInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    class_id: Optional[int] = None  # the Course/class this quiz belongs to
    difficulty_level: int = Field(default=1, ge=1, le=4)
    exp_reward: Optional[int] = None  # auto from difficulty if omitted
    end_date: Optional[datetime] = None  # hard deadline
    time_limit_minutes: Optional[int] = Field(default=None, ge=1)  # countdown once started


class QuestInfoResponse(BaseModel):
    """Lightweight quest metadata for the student taking screen."""
    quest_id: int
    title: str
    description: Optional[str] = None
    exp_reward: int
    time_limit_minutes: Optional[int] = None
    end_date: Optional[datetime] = None


class TeacherQuestSummary(BaseModel):
    quest_id: int
    title: str
    description: Optional[str] = None
    status: str
    class_id: Optional[int] = None
    class_title: Optional[str] = None
    difficulty_level: int
    exp_reward: int
    question_count: int
    submission_count: int
    end_date: Optional[datetime] = None
    time_limit_minutes: Optional[int] = None
    created_at: Optional[datetime] = None


class StudentQuestItem(BaseModel):
    quest_id: int
    title: str
    description: Optional[str] = None
    class_id: Optional[int] = None
    class_title: Optional[str] = None
    exp_reward: int
    difficulty_level: int
    end_date: Optional[datetime] = None
    time_limit_minutes: Optional[int] = None
    # student-specific
    submission_status: str = "not_started"  # not_started | submitted | completed
    score: Optional[int] = None
    max_score: Optional[int] = None

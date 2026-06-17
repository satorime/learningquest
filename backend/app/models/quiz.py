"""Structured quiz content + submissions for quests.

A quest (== quiz) owns a set of questions. Students submit answers which are
auto-graded for objective question types; subjective answers are left for the
teacher to grade manually.
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, ForeignKey, DateTime,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base


# Question types
QUESTION_TYPES = ("multiple_choice", "true_false", "short_answer")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quest_id = Column(Integer, ForeignKey("quests.quest_id", ondelete="CASCADE"),
                      nullable=False, index=True)
    type = Column(String(20), nullable=False)  # see QUESTION_TYPES
    prompt = Column(Text, nullable=False)
    points = Column(Integer, nullable=False, default=1)
    position = Column(Integer, nullable=False, default=0)
    # For short_answer: the accepted answer (case-insensitive exact match).
    correct_answer = Column(Text, nullable=True)

    options = relationship(
        "QuizOption", back_populates="question",
        cascade="all, delete-orphan", order_by="QuizOption.position",
    )


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("quiz_questions.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)

    question = relationship("QuizQuestion", back_populates="options")


class QuestSubmission(Base):
    __tablename__ = "quest_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quest_id = Column(Integer, ForeignKey("quests.quest_id", ondelete="CASCADE"),
                      nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    # submitted -> graded -> completed
    status = Column(String(20), nullable=False, default="submitted")
    score = Column(Integer, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=0)
    text_response = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    feedback = Column(Text, nullable=True)
    needs_manual_grading = Column(Boolean, nullable=False, default=False)
    reward_granted = Column(Boolean, nullable=False, default=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    graded_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", name="uq_user_quest_submission"),
    )

    answers = relationship(
        "SubmissionAnswer", back_populates="submission",
        cascade="all, delete-orphan",
    )
    attachments = relationship(
        "SubmissionAttachment", back_populates="submission",
        cascade="all, delete-orphan",
    )


class SubmissionAttachment(Base):
    """A file upload or external link attached to a submission (Classroom-style)."""
    __tablename__ = "submission_attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("quest_submissions.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    kind = Column(String(10), nullable=False)  # "file" | "link"
    url = Column(Text, nullable=False)         # /static/..., external URL, or a Drive webViewLink
    name = Column(Text, nullable=False)        # display name / original filename
    mime = Column(String(255), nullable=True)
    size = Column(Integer, nullable=True)      # bytes (files only)
    external_id = Column(String(128), nullable=True)  # Google Drive file id (for delete)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("QuestSubmission", back_populates="attachments")


class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("quest_submissions.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("quiz_questions.id", ondelete="CASCADE"),
                         nullable=False)
    selected_option_id = Column(Integer, ForeignKey("quiz_options.id", ondelete="SET NULL"),
                                nullable=True)
    answer_text = Column(Text, nullable=True)
    awarded_points = Column(Integer, nullable=False, default=0)
    is_correct = Column(Boolean, nullable=True)

    submission = relationship("QuestSubmission", back_populates="answers")

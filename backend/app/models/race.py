"""Math Duck Race — multiplayer race game tables.

Re-platforms the "Duck Math" gameplay onto LearningQuest's stack. A room attaches
one of the teacher's quizzes as its question bank; students join by code and race
ducks along a track, first-correct-answer advances a tile.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, Text, ForeignKey, DateTime, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database.connection import Base


class RaceRoom(Base):
    __tablename__ = "race_rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(8), unique=True, nullable=False, index=True)
    host_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quests.quest_id", ondelete="CASCADE"), nullable=False)

    total_tiles = Column(Integer, nullable=False, default=10)
    time_per_question = Column(Integer, nullable=False, default=30)
    max_players = Column(Integer, nullable=False, default=30)

    # waiting -> playing -> finished
    status = Column(String(20), nullable=False, default="waiting")
    question_order = Column(JSONB, nullable=False, default=list)  # shuffled QuizQuestion ids
    current_index = Column(Integer, nullable=False, default=0)
    current_started_at = Column(DateTime(timezone=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    locked_by = Column(Integer, nullable=True)   # user_id of first correct answer
    winner_id = Column(Integer, nullable=True)
    rewards_granted = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)


class RacePlayer(Base):
    __tablename__ = "race_players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("race_rooms.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    display_name = Column(String(120), nullable=False)
    duck_color = Column(String(20), nullable=False, default="yellow")
    tile = Column(Integer, nullable=False, default=0)
    score = Column(Integer, nullable=False, default=0)
    is_ready = Column(Boolean, nullable=False, default=False)
    is_host = Column(Boolean, nullable=False, default=False)  # teacher observer
    correct_answers = Column(Integer, nullable=False, default=0)
    wrong_answers = Column(Integer, nullable=False, default=0)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_race_room_user"),
    )


class RaceAnswer(Base):
    __tablename__ = "race_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("race_rooms.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    question_index = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=False)
    answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=False, default=False)
    response_ms = Column(Integer, nullable=False, default=0)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("room_id", "question_index", "user_id", name="uq_race_answer"),
    )

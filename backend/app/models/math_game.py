"""Server-side sessions for the 'Pet Feast' math mini-game.

The session stores the generated problems *with* their answers so grading and
reward-granting happen entirely on the server — the client never sees the
answers and can't fake a score.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database.connection import Base


class MathGameSession(Base):
    __tablename__ = "math_game_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    difficulty = Column(Integer, nullable=False, default=1)
    # [{ "prompt": "3 + 4", "answer": 7, "choices": [5,7,8,6] }, ...]
    problems = Column(JSONB, nullable=False)
    # Server-recorded answers: { "<index>": value } — graded here, never trusted
    # from the client at finish time.
    responses = Column(JSONB, nullable=False, default=dict, server_default="{}")
    status = Column(String(20), nullable=False, default="pending")  # pending | finished
    correct_count = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    food_awarded = Column(Integer, nullable=False, default=0)
    xp_awarded = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

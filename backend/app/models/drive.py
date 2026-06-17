"""Google Drive integration: per-teacher connection + per-student folder map.

A teacher connects their own Drive once (OAuth); we store the encrypted refresh
token and the id of a root "LearningQuest" folder. Class folders live under the
root (id kept on Course.gdrive_folder_id) and each student gets a subfolder per
class (DriveStudentFolder), so we never recreate folders.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func

from app.database.connection import Base


class TeacherDriveConnection(Base):
    __tablename__ = "teacher_drive_connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, unique=True, index=True)
    google_email = Column(String(255), nullable=True)
    refresh_token_enc = Column(Text, nullable=False)  # Fernet-encrypted
    root_folder_id = Column(String(128), nullable=True)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())


class DriveStudentFolder(Base):
    __tablename__ = "drive_student_folders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    folder_id = Column(String(128), nullable=False)

    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_drive_student_folder"),
    )

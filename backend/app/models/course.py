from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    course_code = Column(String(50), unique=True, nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    moodle_course_id = Column(Integer, unique=True, nullable=True)
    enrollment_key = Column(String(100), nullable=True)
    settings = Column(JSONB, default={})
    short_name = Column(String(50), nullable=True)
    format = Column(String(50), nullable=True)
    visible = Column(Boolean, default=True)
    category_id = Column(Integer, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), server_default=func.now())
    # Google Drive folder id for this class (under the teacher's root folder).
    gdrive_folder_id = Column(String(128), nullable=True)

    # Relationships - use string reference to avoid circular import
    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan", lazy="dynamic") 
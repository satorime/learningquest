"""Schemas for classes (a Course used as a teacher-owned class/group)."""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class ClassCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ClassUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None  # False = archived


class ClassResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    join_code: Optional[str] = None
    teacher_id: int
    is_active: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: Optional[datetime] = None
    member_count: int = 0

    class Config:
        from_attributes = True


class JoinClassRequest(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class MemberResponse(BaseModel):
    user_id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    status: str
    enrolled_at: Optional[datetime] = None

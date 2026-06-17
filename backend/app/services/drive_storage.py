"""DB-aware Google Drive orchestration: resolve the class teacher's connection,
mint an access token, ensure the class + student folders, upload/delete files.

Folder tree in the teacher's Drive:
    <root "LearningQuest"> / <Class Title> / <Student Name (username)> / files
"""
import logging

from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.drive import TeacherDriveConnection, DriveStudentFolder
from app.models.user import User
from app.services import google_drive as gd
from app.utils.crypto import decrypt

logger = logging.getLogger(__name__)

ROOT_FOLDER_NAME = "LearningQuest"


class DriveNotConnected(Exception):
    """The class teacher hasn't connected their Google Drive."""


def get_connection(db: Session, teacher_id: int) -> TeacherDriveConnection | None:
    return (
        db.query(TeacherDriveConnection)
        .filter(TeacherDriveConnection.user_id == teacher_id)
        .first()
    )


def _access_token(conn: TeacherDriveConnection) -> str:
    return gd.refresh_access_token(decrypt(conn.refresh_token_enc))


def _ensure_root(db: Session, conn: TeacherDriveConnection, token: str) -> str:
    if conn.root_folder_id:
        return conn.root_folder_id
    fid = gd.ensure_folder(token, ROOT_FOLDER_NAME, None)
    conn.root_folder_id = fid
    db.commit()
    return fid


def _student_label(student: User) -> str:
    name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.username
    return f"{name} ({student.username})"


def upload_submission(
    db: Session, course: Course, student: User,
    filename: str, content: bytes, mime: str | None,
) -> dict:
    """Upload a student's file into the right Drive subfolder. Returns
    {url: webViewLink, external_id: fileId}. Raises DriveNotConnected if the
    class teacher hasn't connected Drive."""
    conn = get_connection(db, course.teacher_id)
    if not conn:
        raise DriveNotConnected()

    token = _access_token(conn)
    root = _ensure_root(db, conn, token)

    class_fid = course.gdrive_folder_id
    if not class_fid:
        class_fid = gd.ensure_folder(token, course.title or f"Class {course.id}", root)
        course.gdrive_folder_id = class_fid
        db.commit()

    sf = (
        db.query(DriveStudentFolder)
        .filter(DriveStudentFolder.course_id == course.id,
                DriveStudentFolder.user_id == student.id)
        .first()
    )
    if sf:
        student_fid = sf.folder_id
    else:
        student_fid = gd.ensure_folder(token, _student_label(student), class_fid)
        db.add(DriveStudentFolder(course_id=course.id, user_id=student.id,
                                  folder_id=student_fid))
        db.commit()
        # Share the whole subfolder with the student so they can see all their
        # submissions for this class in one place (best-effort).
        if student.email:
            gd.share_with(token, student_fid, student.email)

    up = gd.upload_file(token, student_fid, filename, content, mime)
    if student.email:
        gd.share_with(token, up["id"], student.email)
    return {"url": up["webViewLink"], "external_id": up["id"]}


def delete_submission_file(db: Session, course: Course, file_id: str) -> None:
    """Best-effort removal of a Drive file using the class teacher's token."""
    if not file_id:
        return
    conn = get_connection(db, course.teacher_id)
    if not conn:
        return
    try:
        gd.delete_file(_access_token(conn), file_id)
    except Exception as exc:  # noqa: BLE001 - cleanup is best-effort
        logger.warning("Drive delete failed for %s: %s", file_id, exc)

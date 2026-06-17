"""Quiz engine: structured questions, student submissions, auto + manual grading.

Operates on existing Quest rows (quest == quiz). Distinct from the legacy
`quests.py` router; all endpoints here are JWT-authenticated and role-checked.
"""
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.quest import Quest
from app.models.course import Course
from app.models.enrollment import CourseEnrollment
from app.models.quiz import (
    QuizQuestion, QuizOption, QuestSubmission, SubmissionAnswer,
    SubmissionAttachment, QUESTION_TYPES,
)
from app.schemas.quiz import (
    QuestionCreate, QuestionUpdate, QuestionResponse, OptionResponse,
    SubmissionInput, SubmissionResponse, AnswerResult, AttachmentResponse,
    GradeInput, QuestCreateInput, QuestInfoResponse, TeacherQuestSummary,
    StudentQuestItem, BulkQuestionsRequest,
)
from app.services import storage
from app.services.rewards import grant_quest_completion_reward
from app.utils.auth import get_current_active_user, require_teacher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quiz", tags=["quiz"])

# XP awarded by difficulty level.
DIFFICULTY_XP = {1: 20, 2: 50, 3: 100, 4: 150}

# File uploads
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
# Whitelist of safe submission file types. Excludes active content (.html, .svg,
# .js, .xml, executables) that could run script when opened from the file host.
ALLOWED_UPLOAD_EXTS = {
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "rtf", "csv",
    "odt", "ods", "odp", "md",
    "png", "jpg", "jpeg", "gif", "webp", "heic",
    "zip",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _deadline_passed(quest: Quest) -> bool:
    """True if the quest has an end_date that is now in the past."""
    if not quest.end_date:
        return False
    end = quest.end_date
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return _utcnow() > end


# --- helpers ----------------------------------------------------------------
def _get_quest(db: Session, quest_id: int) -> Quest:
    quest = db.query(Quest).filter(Quest.quest_id == quest_id).first()
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    return quest


def _require_owner(db: Session, quest_id: int, user: User) -> Quest:
    quest = _get_quest(db, quest_id)
    if user.role != "admin" and quest.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Not your quest")
    return quest


def _require_enrolled(db: Session, quest: Quest, user: User):
    if quest.course_id is None:
        return
    enrolled = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == quest.course_id,
        CourseEnrollment.user_id == user.id,
        CourseEnrollment.status == "active",
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")


def _delete_attachment_file(db: Session, course, att) -> None:
    """Remove a stored attachment file (Drive when configured, else local)."""
    from app.config import STORAGE_BACKEND
    if STORAGE_BACKEND == "gdrive" and getattr(att, "external_id", None) and course:
        from app.services import drive_storage
        drive_storage.delete_submission_file(db, course, att.external_id)
    else:
        storage.delete(att.url)


def _question_to_response(q: QuizQuestion, include_answers: bool) -> QuestionResponse:
    return QuestionResponse(
        id=q.id,
        quest_id=q.quest_id,
        type=q.type,
        prompt=q.prompt,
        points=q.points,
        position=q.position,
        correct_answer=q.correct_answer if include_answers else None,
        options=[
            OptionResponse(
                id=o.id, text=o.text, position=o.position,
                is_correct=o.is_correct if include_answers else None,
            )
            for o in q.options
        ],
    )


def _submission_to_response(s: QuestSubmission) -> SubmissionResponse:
    return SubmissionResponse(
        id=s.id, quest_id=s.quest_id, user_id=s.user_id, status=s.status,
        score=s.score, max_score=s.max_score, text_response=s.text_response,
        file_url=s.file_url, feedback=s.feedback,
        needs_manual_grading=s.needs_manual_grading,
        submitted_at=s.submitted_at, graded_at=s.graded_at,
        answers=[AnswerResult.model_validate(a) for a in s.answers],
        attachments=[
            AttachmentResponse(
                id=a.id, kind=a.kind,
                # Files get resolved to a public/signed URL; links pass through.
                url=storage.resolve_url(a.url) if a.kind == "file" else a.url,
                name=a.name, mime=a.mime, size=a.size,
            )
            for a in s.attachments
        ],
    )


# --- quest (quiz) lifecycle -------------------------------------------------
@router.post("/quests", response_model=TeacherQuestSummary,
             status_code=status.HTTP_201_CREATED)
async def create_quest(
    data: QuestCreateInput,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    """Create a new quiz/quest (draft) owned by the teacher."""
    class_title = None
    if data.class_id is not None:
        course = db.query(Course).filter(Course.id == data.class_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Class not found")
        if teacher.role != "admin" and course.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not your class")
        class_title = course.title

    quest = Quest(
        title=data.title,
        description=data.description,
        course_id=data.class_id,
        creator_id=teacher.id,
        quest_type="quiz",
        validation_method="quiz",
        difficulty_level=data.difficulty_level,
        exp_reward=data.exp_reward if data.exp_reward is not None
        else DIFFICULTY_XP.get(data.difficulty_level, 50),
        status="draft",
        is_active=True,
        end_date=data.end_date,
        time_limit_minutes=data.time_limit_minutes,
    )
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return TeacherQuestSummary(
        quest_id=quest.quest_id, title=quest.title, description=quest.description,
        status=quest.status, class_id=quest.course_id, class_title=class_title,
        difficulty_level=quest.difficulty_level, exp_reward=quest.exp_reward,
        question_count=0, submission_count=0, end_date=quest.end_date,
        time_limit_minutes=quest.time_limit_minutes, created_at=quest.created_at,
    )


@router.get("/quests/mine", response_model=List[TeacherQuestSummary])
async def my_quests(
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    """Quizzes created by the current teacher (all for admins)."""
    query = db.query(Quest)
    if teacher.role != "admin":
        query = query.filter(Quest.creator_id == teacher.id)
    quests = query.order_by(Quest.created_at.desc()).all()

    out = []
    for q in quests:
        qcount = db.query(QuizQuestion).filter(QuizQuestion.quest_id == q.quest_id).count()
        scount = db.query(QuestSubmission).filter(QuestSubmission.quest_id == q.quest_id).count()
        title = None
        if q.course_id:
            c = db.query(Course).filter(Course.id == q.course_id).first()
            title = c.title if c else None
        out.append(TeacherQuestSummary(
            quest_id=q.quest_id, title=q.title, description=q.description,
            status=q.status or "draft", class_id=q.course_id, class_title=title,
            difficulty_level=q.difficulty_level or 1, exp_reward=q.exp_reward or 0,
            question_count=qcount, submission_count=scount, end_date=q.end_date,
            time_limit_minutes=q.time_limit_minutes, created_at=q.created_at,
        ))
    return out


@router.get("/available", response_model=List[StudentQuestItem])
def available_quests(
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    """Published quizzes from the student's enrolled classes, with their status."""
    class_ids = [
        e.course_id for e in db.query(CourseEnrollment).filter(
            CourseEnrollment.user_id == user.id,
            CourseEnrollment.status == "active",
        ).all()
    ]
    if not class_ids:
        return []

    quests = db.query(Quest).filter(
        Quest.course_id.in_(class_ids),
        Quest.status == "published",
    ).order_by(Quest.created_at.desc()).all()
    if not quests:
        return []

    # Batch the per-quest lookups (submission + course) into two queries instead
    # of two-per-quest, so this stays a couple of round-trips to the remote DB
    # regardless of how many quizzes the student has.
    quest_ids = [q.quest_id for q in quests]
    course_ids = {q.course_id for q in quests if q.course_id is not None}
    subs = {
        s.quest_id: s
        for s in db.query(QuestSubmission).filter(
            QuestSubmission.quest_id.in_(quest_ids),
            QuestSubmission.user_id == user.id,
        ).all()
    }
    courses = {
        c.id: c
        for c in db.query(Course).filter(Course.id.in_(course_ids)).all()
    } if course_ids else {}

    out = []
    for q in quests:
        sub = subs.get(q.quest_id)
        c = courses.get(q.course_id)
        out.append(StudentQuestItem(
            quest_id=q.quest_id, title=q.title, description=q.description,
            class_id=q.course_id, class_title=c.title if c else None,
            exp_reward=q.exp_reward or 0, difficulty_level=q.difficulty_level or 1,
            end_date=q.end_date, time_limit_minutes=q.time_limit_minutes,
            submission_status=sub.status if sub else "not_started",
            score=sub.score if sub else None,
            max_score=sub.max_score if sub else None,
        ))
    return out


# --- teacher: authoring -----------------------------------------------------
@router.post("/{quest_id}/questions", response_model=QuestionResponse,
             status_code=status.HTTP_201_CREATED)
async def add_question(
    quest_id: int, data: QuestionCreate,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    _require_owner(db, quest_id, teacher)
    if data.type not in QUESTION_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of {QUESTION_TYPES}")

    question = QuizQuestion(
        quest_id=quest_id, type=data.type, prompt=data.prompt,
        points=data.points, position=data.position,
        correct_answer=data.correct_answer,
    )
    db.add(question)
    db.flush()

    if data.type in ("multiple_choice", "true_false"):
        for i, opt in enumerate(data.options):
            db.add(QuizOption(question_id=question.id, text=opt.text,
                              is_correct=opt.is_correct, position=i))
    db.commit()
    db.refresh(question)
    return _question_to_response(question, include_answers=True)


@router.post("/{quest_id}/import")
async def import_questions(
    quest_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    """Parse questions from an uploaded PDF/Word/text document (does NOT save).

    Returns a draft list for the teacher to review/edit before creating them.
    """
    _require_owner(db, quest_id, teacher)
    from app.services import quiz_import

    if not quiz_import.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI import isn't configured on the server (GROQ_API_KEY missing).",
        )

    name = file.filename or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in ("pdf", "docx", "txt", "md"):
        raise HTTPException(status_code=415, detail="Upload a PDF, Word (.docx), or text file.")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        text = quiz_import.extract_text(file.filename, contents)
        questions = quiz_import.extract_questions(text)
    except quiz_import.QuizImportError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not questions:
        raise HTTPException(status_code=422, detail="No questions could be detected in that document.")
    return {"questions": questions}


@router.post("/{quest_id}/questions/bulk", response_model=List[QuestionResponse],
             status_code=status.HTTP_201_CREATED)
async def add_questions_bulk(
    quest_id: int, data: BulkQuestionsRequest,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    """Create several questions at once (used after reviewing an import)."""
    _require_owner(db, quest_id, teacher)
    base = db.query(QuizQuestion).filter(QuizQuestion.quest_id == quest_id).count()
    created = []
    for offset, q in enumerate(data.questions):
        if q.type not in QUESTION_TYPES:
            raise HTTPException(status_code=422, detail=f"type must be one of {QUESTION_TYPES}")
        question = QuizQuestion(
            quest_id=quest_id, type=q.type, prompt=q.prompt,
            points=q.points, position=base + offset, correct_answer=q.correct_answer,
        )
        db.add(question)
        db.flush()
        if q.type in ("multiple_choice", "true_false"):
            for i, opt in enumerate(q.options):
                db.add(QuizOption(question_id=question.id, text=opt.text,
                                  is_correct=opt.is_correct, position=i))
        created.append(question)
    db.commit()
    for q in created:
        db.refresh(q)
    return [_question_to_response(q, include_answers=True) for q in created]


@router.get("/{quest_id}/questions", response_model=List[QuestionResponse])
async def list_questions_for_teacher(
    quest_id: int,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    """Authoring view — includes correct answers."""
    _require_owner(db, quest_id, teacher)
    questions = db.query(QuizQuestion).filter(
        QuizQuestion.quest_id == quest_id
    ).order_by(QuizQuestion.position).all()
    return [_question_to_response(q, include_answers=True) for q in questions]


@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: int, data: QuestionUpdate,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    question = db.query(QuizQuestion).filter(QuizQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    _require_owner(db, question.quest_id, teacher)

    for field in ("prompt", "points", "position", "correct_answer"):
        value = getattr(data, field)
        if value is not None:
            setattr(question, field, value)

    if data.options is not None:
        # Replace the option set.
        for o in list(question.options):
            db.delete(o)
        db.flush()
        for i, opt in enumerate(data.options):
            db.add(QuizOption(question_id=question.id, text=opt.text,
                              is_correct=opt.is_correct, position=i))
    db.commit()
    db.refresh(question)
    return _question_to_response(question, include_answers=True)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: int,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    question = db.query(QuizQuestion).filter(QuizQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    _require_owner(db, question.quest_id, teacher)
    db.delete(question)
    db.commit()


@router.post("/{quest_id}/publish", status_code=status.HTTP_200_OK)
async def publish_quest(
    quest_id: int,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    quest = _require_owner(db, quest_id, teacher)
    has_questions = db.query(QuizQuestion).filter(
        QuizQuestion.quest_id == quest_id
    ).count()
    if not has_questions:
        raise HTTPException(status_code=400, detail="Add at least one question first")
    quest.status = "published"
    quest.is_active = True
    db.commit()

    # Notify enrolled students so the new quiz appears on their dashboard live.
    if quest.course_id:
        from app.services.realtime import broadcast_to_class
        broadcast_to_class(
            db, quest.course_id, "quiz_published",
            {"class_id": quest.course_id, "quest_id": quest_id},
        )
    return {"quest_id": quest_id, "status": quest.status}


@router.post("/{quest_id}/archive", status_code=status.HTTP_200_OK)
async def archive_quest(
    quest_id: int,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    quest = _require_owner(db, quest_id, teacher)
    quest.status = "archived"
    quest.is_active = False
    db.commit()
    return {"quest_id": quest_id, "status": quest.status}


@router.delete("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quest(
    quest_id: int,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    """Permanently delete a quiz/quest and everything under it.

    Questions, submissions and answers cascade at the DB level; uploaded files
    are removed from storage first (best-effort) so they don't orphan.
    """
    quest = _require_owner(db, quest_id, teacher)

    from app.models.course import Course
    course = db.query(Course).filter(Course.id == quest.course_id).first() if quest.course_id else None
    submissions = db.query(QuestSubmission).filter(
        QuestSubmission.quest_id == quest_id
    ).all()
    for sub in submissions:
        for att in sub.attachments:
            if att.kind == "file":
                _delete_attachment_file(db, course, att)

    db.delete(quest)
    db.commit()


# --- student: upload + take + submit ----------------------------------------
@router.post("/{quest_id}/uploads", status_code=status.HTTP_201_CREATED)
async def upload_file(
    quest_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    """Store an uploaded file for a quest submission and return attachment metadata.

    Quest-scoped so file storage can route into the class teacher's Google Drive
    (folder per class + per student). The attachment row is created later when the
    student submits; this just persists the bytes and hands back the link.
    """
    quest = _get_quest(db, quest_id)
    _require_enrolled(db, quest, user)

    name = file.filename or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in ALLOWED_UPLOAD_EXTS:
        raise HTTPException(
            status_code=415,
            detail="That file type isn't allowed. Use a document, image, or zip.",
        )

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    from app.config import STORAGE_BACKEND
    if STORAGE_BACKEND == "gdrive":
        from app.models.course import Course
        from app.services import drive_storage
        course = db.query(Course).filter(Course.id == quest.course_id).first() if quest.course_id else None
        if not course:
            raise HTTPException(status_code=409, detail="This quiz isn't attached to a class, so files can't be stored.")
        try:
            up = drive_storage.upload_submission(
                db, course, user, file.filename, contents, file.content_type
            )
        except drive_storage.DriveNotConnected:
            raise HTTPException(
                status_code=409,
                detail="Your teacher hasn't connected Google Drive yet, so file uploads are unavailable. You can still submit text answers.",
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Drive upload failed for user %s: %s", user.id, exc)
            raise HTTPException(status_code=502, detail="Google Drive upload failed. Try again.")
        return {
            "kind": "file", "url": up["url"], "name": file.filename or "file",
            "mime": file.content_type, "size": len(contents),
            "external_id": up["external_id"],
        }

    # Dev / fallback: local disk.
    try:
        return storage.save_upload(user.id, file.filename, contents, file.content_type)
    except storage.StorageError as exc:
        logger.error("Upload failed for user %s: %s", user.id, exc)
        raise HTTPException(status_code=502, detail="File storage is unavailable")


@router.get("/{quest_id}/info", response_model=QuestInfoResponse)
async def quest_info(
    quest_id: int,
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    """Quest metadata for the student taking screen (title, time limit, deadline)."""
    quest = _get_quest(db, quest_id)
    if quest.status != "published":
        raise HTTPException(status_code=403, detail="Quest is not available")
    _require_enrolled(db, quest, user)
    return QuestInfoResponse(
        quest_id=quest.quest_id, title=quest.title, description=quest.description,
        exp_reward=quest.exp_reward or 0,
        time_limit_minutes=quest.time_limit_minutes, end_date=quest.end_date,
    )


@router.get("/{quest_id}/take", response_model=List[QuestionResponse])
async def take_quest(
    quest_id: int,
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    """Student view of the questions — never exposes correct answers."""
    quest = _get_quest(db, quest_id)
    if quest.status != "published":
        raise HTTPException(status_code=403, detail="Quest is not available")
    _require_enrolled(db, quest, user)
    questions = db.query(QuizQuestion).filter(
        QuizQuestion.quest_id == quest_id
    ).order_by(QuizQuestion.position).all()
    return [_question_to_response(q, include_answers=False) for q in questions]


@router.get("/{quest_id}/my-submission", response_model=SubmissionResponse)
async def my_submission(
    quest_id: int,
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    sub = db.query(QuestSubmission).filter(
        QuestSubmission.quest_id == quest_id,
        QuestSubmission.user_id == user.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="No submission yet")
    return _submission_to_response(sub)


@router.post("/{quest_id}/submit", response_model=SubmissionResponse,
             status_code=status.HTTP_201_CREATED)
async def submit_quest(
    quest_id: int, data: SubmissionInput,
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    """Submit or resubmit. Editable until the deadline or until the teacher grades it."""
    quest = _get_quest(db, quest_id)
    if quest.status != "published":
        raise HTTPException(status_code=403, detail="Quest is not available")
    _require_enrolled(db, quest, user)
    if _deadline_passed(quest):
        raise HTTPException(status_code=403, detail="The deadline has passed")

    existing = db.query(QuestSubmission).filter(
        QuestSubmission.quest_id == quest_id,
        QuestSubmission.user_id == user.id,
    ).first()
    if existing and (existing.reward_granted
                     or existing.status in ("graded", "completed")):
        raise HTTPException(
            status_code=409,
            detail="This has already been graded and can no longer be changed.",
        )

    questions = db.query(QuizQuestion).filter(
        QuizQuestion.quest_id == quest_id
    ).all()
    answers_by_q = {a.question_id: a for a in data.answers}

    if existing:
        # Resubmission — wipe the previous answers/attachments and recompute.
        submission = existing
        for a in list(submission.answers):
            db.delete(a)
        for att in list(submission.attachments):
            db.delete(att)
        db.flush()
        submission.text_response = data.text_response
        submission.file_url = data.file_url
        submission.feedback = None
        submission.graded_at = None
        submission.submitted_at = _utcnow()
    else:
        submission = QuestSubmission(
            quest_id=quest_id, user_id=user.id, status="submitted",
            text_response=data.text_response, file_url=data.file_url,
        )
        db.add(submission)
        db.flush()

    # Persist attachments (files + links).
    for att in data.attachments:
        db.add(SubmissionAttachment(
            submission_id=submission.id, kind=att.kind, url=att.url,
            name=att.name, mime=att.mime, size=att.size,
            external_id=att.external_id,
        ))

    total_score = 0
    max_score = 0
    # Free-text and any attachment require teacher review.
    needs_manual = bool(data.text_response) or bool(data.attachments)

    for q in questions:
        max_score += q.points
        ans = answers_by_q.get(q.id)
        awarded, is_correct = 0, None

        if q.type in ("multiple_choice", "true_false"):
            if ans and ans.selected_option_id is not None:
                opt = db.query(QuizOption).filter(
                    QuizOption.id == ans.selected_option_id,
                    QuizOption.question_id == q.id,
                ).first()
                is_correct = bool(opt and opt.is_correct)
                awarded = q.points if is_correct else 0
            else:
                is_correct = False
        elif q.type == "short_answer":
            if q.correct_answer:
                given = (ans.answer_text or "").strip().lower() if ans else ""
                is_correct = given == q.correct_answer.strip().lower()
                awarded = q.points if is_correct else 0
            else:
                # Subjective — leave for manual grading.
                is_correct = None
                needs_manual = True

        total_score += awarded
        db.add(SubmissionAnswer(
            submission_id=submission.id, question_id=q.id,
            selected_option_id=ans.selected_option_id if ans else None,
            answer_text=ans.answer_text if ans else None,
            awarded_points=awarded, is_correct=is_correct,
        ))

    submission.score = total_score
    submission.max_score = max_score
    submission.needs_manual_grading = needs_manual

    if needs_manual:
        submission.status = "submitted"
    else:
        submission.status = "completed"
        submission.graded_at = _utcnow()
        submission.reward_granted = True
        grant_quest_completion_reward(
            db, user, quest,
            score=submission.score, max_score=submission.max_score,
        )

    db.commit()
    db.refresh(submission)

    # Submitting any quiz is the real action that completes the daily
    # "Knowledge Check" quest (works for manual-graded quizzes too, which don't
    # grant a reward until the teacher grades them).
    try:
        from app.services.daily_quest_service import DailyQuestService
        dq = DailyQuestService(db)
        dq.generate_all_daily_quests_for_user(user.id)
        dq.complete_quest_by_type(user.id, "complete_quiz")
    except Exception as exc:  # noqa: BLE001 - gamification is best-effort
        logger.warning("complete_quiz daily-quest trigger failed: %s", exc)

    return _submission_to_response(submission)


@router.delete("/{quest_id}/my-submission", status_code=status.HTTP_204_NO_CONTENT)
async def unsubmit_quest(
    quest_id: int,
    db: Session = Depends(get_db), user: User = Depends(get_current_active_user),
):
    """Withdraw a submission (back to not-started) before the deadline.

    Blocked once the teacher has graded it or the deadline has passed.
    """
    quest = _get_quest(db, quest_id)
    sub = db.query(QuestSubmission).filter(
        QuestSubmission.quest_id == quest_id,
        QuestSubmission.user_id == user.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="No submission to withdraw")
    if sub.reward_granted or sub.status in ("graded", "completed"):
        raise HTTPException(
            status_code=409,
            detail="This has already been graded and can no longer be withdrawn.",
        )
    if _deadline_passed(quest):
        raise HTTPException(status_code=403, detail="The deadline has passed")

    # Best-effort removal of this student's uploaded files from storage.
    from app.models.course import Course
    course = db.query(Course).filter(Course.id == quest.course_id).first() if quest.course_id else None
    for att in sub.attachments:
        if att.kind == "file":
            _delete_attachment_file(db, course, att)

    db.delete(sub)
    db.commit()


# --- teacher: review + grade ------------------------------------------------
@router.get("/{quest_id}/submissions", response_model=List[SubmissionResponse])
async def list_submissions(
    quest_id: int,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    _require_owner(db, quest_id, teacher)
    subs = db.query(QuestSubmission).filter(
        QuestSubmission.quest_id == quest_id
    ).order_by(QuestSubmission.submitted_at.desc()).all()
    return [_submission_to_response(s) for s in subs]


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionResponse)
async def grade_submission(
    submission_id: int, data: GradeInput,
    db: Session = Depends(get_db), teacher: User = Depends(require_teacher),
):
    sub = db.query(QuestSubmission).filter(
        QuestSubmission.id == submission_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    quest = _require_owner(db, sub.quest_id, teacher)

    overrides = {g.question_id: g for g in data.answer_grades}
    for answer in sub.answers:
        g = overrides.get(answer.question_id)
        if g is not None:
            answer.awarded_points = g.awarded_points
            answer.is_correct = g.is_correct

    # A direct score override wins (used for attachment/text assignments with no
    # auto-graded questions); otherwise sum the per-answer points.
    if data.score is not None:
        sub.score = data.score
    else:
        sub.score = sum(a.awarded_points for a in sub.answers)
    if data.max_score is not None:
        sub.max_score = data.max_score

    if data.feedback is not None:
        sub.feedback = data.feedback
    sub.needs_manual_grading = False
    sub.graded_at = _utcnow()
    sub.status = "graded"

    # Apply gamification reward once, scaled to the final score.
    if not sub.reward_granted:
        student = db.query(User).filter(User.id == sub.user_id).first()
        grant_quest_completion_reward(
            db, student, quest,
            score=sub.score, max_score=sub.max_score,
        )
        sub.reward_granted = True
    sub.status = "completed"

    db.commit()
    db.refresh(sub)
    return _submission_to_response(sub)
